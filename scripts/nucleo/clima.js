// Clima: lugar escolhido, consultas a /api/clima, cache e leitura dos dados
// da Open-Meteo (condições, chuva, vento). Usado pela página /clima e pelo
// resumo da página inicial.
//
// Horários: a Open-Meteo devolve tudo já no fuso do lugar consultado
// ("2026-10-22T15:00"), então as horas e datas são lidas do texto, sem Date —
// nada é convertido para o fuso do aparelho.
//
// Cache: a última previsão fica no localStorage. Ela é reaproveitada por até
// 10 minutos; depois disso a página consulta de novo e, se falhar, continua
// mostrando a cópia salva — marcada como possivelmente desatualizada.

import { idiomaAtual, t } from "../i18n/estado.js";
import { gravar, ler, remover } from "./armazenamento.js";

const CHAVE_LUGAR = "clima:lugar";
const CHAVE_PREVISAO = "clima:previsao";
export const VALIDADE_PREVISAO_MS = 10 * 60 * 1000;
/** Previsão salva com mais de 1 h não é mais "agora". */
export const LIMITE_ATUAL_MS = 60 * 60 * 1000;
/** Dias a partir dos quais a previsão é tendência (menos confiável). */
export const DIAS_CONFIAVEIS = 7;

// ---- Condições (códigos WMO usados pela Open-Meteo) -----------------------------
// tema: aparência da página do clima; icone: símbolo de assets/icones.svg.
const CONDICOES = {
  0: { tema: "limpo", icone: "sol" },
  1: { tema: "limpo", icone: "sol-nuvem" },
  2: { tema: "parcial", icone: "sol-nuvem" },
  3: { tema: "nublado", icone: "nuvem" },
  45: { tema: "neblina", icone: "neblina" },
  48: { tema: "neblina", icone: "neblina" },
  51: { tema: "chuva", icone: "garoa" },
  53: { tema: "chuva", icone: "garoa" },
  55: { tema: "chuva", icone: "garoa" },
  56: { tema: "chuva", icone: "garoa" },
  57: { tema: "chuva", icone: "garoa" },
  61: { tema: "chuva", icone: "chuva" },
  63: { tema: "chuva", icone: "chuva" },
  65: { tema: "chuva", icone: "chuva" },
  66: { tema: "chuva", icone: "chuva" },
  67: { tema: "chuva", icone: "chuva" },
  71: { tema: "neve", icone: "neve" },
  73: { tema: "neve", icone: "neve" },
  75: { tema: "neve", icone: "neve" },
  77: { tema: "neve", icone: "neve" },
  80: { tema: "chuva", icone: "chuva" },
  81: { tema: "chuva", icone: "chuva" },
  82: { tema: "chuva", icone: "chuva" },
  85: { tema: "neve", icone: "neve" },
  86: { tema: "neve", icone: "neve" },
  95: { tema: "tempestade", icone: "tempestade" },
  96: { tema: "tempestade", icone: "tempestade" },
  99: { tema: "tempestade", icone: "tempestade" },
};

/** Códigos conhecidos (o dicionário tem um texto para cada). */
export const CODIGOS_CONDICAO = Object.keys(CONDICOES).map(Number);

/**
 * { codigo, tema, icone, noite } de um código WMO. À noite, céu limpo ou com
 * poucas nuvens usa a lua. Código desconhecido conta como nublado.
 */
export function condicao(codigo, diurno = true) {
  const base = CONDICOES[codigo] ?? CONDICOES[3];
  const noite = !diurno;
  let icone = base.icone;
  if (noite && icone === "sol") icone = "lua";
  if (noite && icone === "sol-nuvem") icone = "lua-nuvem";
  return { codigo: CONDICOES[codigo] ? codigo : 3, tema: base.tema, icone: `clima-${icone}`, noite };
}

/** Texto da condição no idioma da interface. */
export function textoCondicao(codigo) {
  return t(`clima.cond.${CONDICOES[codigo] ? codigo : 3}`);
}

/** Direção de onde o vento sopra, em 8 pontos: "n", "ne", … */
export function pontoCardeal(graus) {
  if (!Number.isFinite(graus)) return null;
  return ["n", "ne", "l", "se", "s", "so", "o", "no"][Math.round((((graus % 360) + 360) % 360) / 45) % 8];
}

/** Faixa do índice UV (escala da OMS). */
export function faixaUv(uv) {
  if (!Number.isFinite(uv)) return null;
  if (uv < 3) return "baixo";
  if (uv < 6) return "moderado";
  if (uv < 8) return "alto";
  if (uv < 11) return "muitoAlto";
  return "extremo";
}

// ---- Leitura dos dados -------------------------------------------------------------
/** "2026-10-22T15:15" → { ano, mes, dia, hora, minuto } (hora local do lugar). */
export function lerHorario(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(texto ?? ""));
  if (!m) return null;
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]), hora: Number(m[4] ?? 0), minuto: Number(m[5] ?? 0) };
}

/** "15:00" a partir do texto da Open-Meteo. */
export function horaDoTexto(texto) {
  return String(texto ?? "").slice(11, 16);
}

/** Índice da hora em curso na lista horária (a hora cheia de `atual.time`). */
export function indiceHoraAtual(previsao) {
  const horaCheia = `${String(previsao?.atual?.time ?? "").slice(0, 13)}:00`;
  const i = previsao?.horas?.time?.indexOf(horaCheia) ?? -1;
  return i < 0 ? 0 : i;
}

/** Índice de hoje (data local do lugar) na lista diária. */
export function indiceHoje(previsao) {
  const hoje = String(previsao?.atual?.time ?? "").slice(0, 10);
  const i = previsao?.dias?.time?.indexOf(hoje) ?? -1;
  return i < 0 ? 0 : i;
}

/** As próximas `n` horas a partir da atual: [{ i, time, temp, prob, mm, codigo, diurno }]. */
export function proximasHoras(previsao, n = 48) {
  const h = previsao.horas;
  const inicio = indiceHoraAtual(previsao);
  const fim = Math.min(h.time.length, inicio + n);
  const lista = [];
  for (let i = inicio; i < fim; i += 1) {
    lista.push({
      i,
      time: h.time[i],
      temp: h.temperature_2m?.[i],
      sensacao: h.apparent_temperature?.[i],
      prob: h.precipitation_probability?.[i],
      mm: h.precipitation?.[i],
      codigo: h.weather_code?.[i],
      diurno: h.is_day?.[i] !== 0,
      vento: h.wind_speed_10m?.[i],
    });
  }
  return lista;
}

/** Horas de um dia (texto "AAAA-MM-DD"), no mesmo formato de proximasHoras. */
export function horasDoDia(previsao, data) {
  const h = previsao.horas;
  const lista = [];
  h.time.forEach((time, i) => {
    if (!time.startsWith(data)) return;
    lista.push({ i, time, temp: h.temperature_2m?.[i], prob: h.precipitation_probability?.[i], mm: h.precipitation?.[i], codigo: h.weather_code?.[i], diurno: h.is_day?.[i] !== 0 });
  });
  return lista;
}

/** Dados de um dia da lista diária. */
export function dia(previsao, i) {
  const d = previsao.dias;
  return {
    i,
    data: d.time[i],
    codigo: d.weather_code?.[i],
    max: d.temperature_2m_max?.[i],
    min: d.temperature_2m_min?.[i],
    sensacaoMax: d.apparent_temperature_max?.[i],
    sensacaoMin: d.apparent_temperature_min?.[i],
    nascer: d.sunrise?.[i],
    por: d.sunset?.[i],
    uv: d.uv_index_max?.[i],
    mm: d.precipitation_sum?.[i],
    horasChuva: d.precipitation_hours?.[i],
    prob: d.precipitation_probability_max?.[i],
    vento: d.wind_speed_10m_max?.[i],
    rajadas: d.wind_gusts_10m_max?.[i],
    direcao: d.wind_direction_10m_dominant?.[i],
  };
}

/**
 * Períodos seguidos com chance de chuva ≥ `limiar` %, nas horas dadas:
 * [{ inicio, fim, probMax, mm, horas }] — `fim` é o texto da última hora.
 */
export function periodosDeChuva(horas, limiar = 40) {
  const periodos = [];
  let atual = null;
  for (const h of horas) {
    if (Number.isFinite(h.prob) && h.prob >= limiar) {
      if (!atual) {
        atual = { inicio: h.time, fim: h.time, probMax: h.prob, mm: 0, horas: 0 };
        periodos.push(atual);
      }
      atual.fim = h.time;
      atual.probMax = Math.max(atual.probMax, h.prob);
      atual.mm += Number.isFinite(h.mm) ? h.mm : 0;
      atual.horas += 1;
    } else {
      atual = null;
    }
  }
  for (const p of periodos) p.mm = Math.round(p.mm * 10) / 10;
  return periodos;
}

/** Hora com a maior chance de chuva (a primeira, em empate), ou null se for 0. */
export function picoDeChuva(horas) {
  let pico = null;
  for (const h of horas) if (Number.isFinite(h.prob) && h.prob > 0 && (!pico || h.prob > pico.prob)) pico = h;
  return pico;
}

/** Soma de precipitação prevista (mm, 1 casa). */
export function somaChuva(horas) {
  return Math.round(horas.reduce((s, h) => s + (Number.isFinite(h.mm) ? h.mm : 0), 0) * 10) / 10;
}

/** Aparência da página: tema da condição atual + dia/noite. */
export function aparencia(previsao) {
  const c = condicao(previsao.atual.weather_code, previsao.atual.is_day !== 0);
  return { tema: c.tema, periodo: c.noite ? "noite" : "dia" };
}

// ---- Lugar escolhido ------------------------------------------------------------------
// { nome, regiao, pais, codigoPais, lat, lon, origem: "busca" | "gps" | "ip" }

export function lugarSalvo() {
  const l = ler(CHAVE_LUGAR);
  if (!l || !Number.isFinite(l.lat) || !Number.isFinite(l.lon) || Math.abs(l.lat) > 90 || Math.abs(l.lon) > 180) return null;
  return {
    nome: typeof l.nome === "string" ? l.nome.slice(0, 80) : null,
    regiao: typeof l.regiao === "string" ? l.regiao.slice(0, 80) : null,
    pais: typeof l.pais === "string" ? l.pais.slice(0, 80) : null,
    codigoPais: typeof l.codigoPais === "string" ? l.codigoPais.slice(0, 2) : null,
    lat: l.lat,
    lon: l.lon,
    origem: ["busca", "gps", "ip"].includes(l.origem) ? l.origem : "busca",
  };
}

export function salvarLugar(lugar) {
  gravar(CHAVE_LUGAR, lugar);
}

export function esquecerLugar() {
  remover(CHAVE_LUGAR);
  remover(CHAVE_PREVISAO);
}

/** "Umuarama, Paraná, Brasil" sem partes vazias ou repetidas. */
export function descricaoLugar(lugar, { comPais = true } = {}) {
  const partes = [lugar.nome, lugar.regiao !== lugar.nome ? lugar.regiao : null, comPais ? lugar.pais : null];
  return partes.filter(Boolean).join(", ") || t("clima.semNome");
}

// ---- Consultas ------------------------------------------------------------------------
const idiomaFonte = () => idiomaAtual().slice(0, 2).toLowerCase();
const chaveLugar = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

async function obterJson(url) {
  let resposta;
  try {
    resposta = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("rede");
  }
  if (!resposta.ok) throw new Error(resposta.status === 404 ? "sem-dados" : "indisponivel");
  try {
    return await resposta.json();
  } catch {
    throw new Error("indisponivel");
  }
}

/** Previsão já salva para este lugar, ou null. { dados, recebidoEm } */
export function previsaoSalva(lat, lon) {
  const salvo = ler(CHAVE_PREVISAO);
  if (!salvo || salvo.chave !== chaveLugar(lat, lon) || !salvo.dados?.atual || !Number.isFinite(salvo.recebidoEm)) return null;
  return { dados: salvo.dados, recebidoEm: salvo.recebidoEm };
}

/**
 * Previsão do lugar. Usa a cópia salva se tiver menos de 10 minutos (ou se
 * `forcar` for falso e a rede falhar). Resolve com
 * { dados, recebidoEm, desatualizado } ou rejeita sem nenhuma cópia.
 */
export async function obterPrevisao(lat, lon, { forcar = false, agora = Date.now() } = {}) {
  const salva = previsaoSalva(lat, lon);
  if (salva && !forcar && agora - salva.recebidoEm < VALIDADE_PREVISAO_MS) return { ...salva, desatualizado: false };
  try {
    const dados = await obterJson(`/api/clima?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
    if (!dados?.atual || !dados?.horas?.time || !dados?.dias?.time) throw new Error("indisponivel");
    gravar(CHAVE_PREVISAO, { chave: chaveLugar(lat, lon), dados, recebidoEm: agora });
    return { dados, recebidoEm: agora, desatualizado: false };
  } catch (erro) {
    if (salva) return { ...salva, desatualizado: true, erro: erro.message };
    throw erro;
  }
}

/** Cidades que combinam com o texto. */
export async function buscarCidades(texto) {
  const { resultados } = await obterJson(`/api/clima?busca=${encodeURIComponent(texto)}&idioma=${idiomaFonte()}`);
  return Array.isArray(resultados) ? resultados : [];
}

/** Nome do lugar nas coordenadas (para a localização do aparelho). */
export async function nomeDoLugar(lat, lon) {
  const { lugar } = await obterJson(`/api/clima?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&lugar=1&idioma=${idiomaFonte()}`);
  return lugar ?? null;
}

/** Lugar aproximado pelo IP (só em produção, na Vercel), ou null. */
export async function lugarPorIp() {
  try {
    const { local } = await obterJson("/api/clima?local=ip");
    return local ? { ...local, origem: "ip" } : null;
  } catch {
    return null;
  }
}

/** Posição do aparelho, com a permissão do usuário. Rejeita com "negado" | "indisponivel". */
export function posicaoDoAparelho() {
  return new Promise((resolve, rejeitar) => {
    if (!navigator.geolocation) return rejeitar(new Error("indisponivel"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => rejeitar(new Error(e.code === 1 ? "negado" : "indisponivel")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

// ---- Formatação --------------------------------------------------------------------------
/** "23°" (arredondado; −0 vira 0). */
export function grau(valor) {
  if (!Number.isFinite(valor)) return "—";
  return `${Math.round(valor) || 0}°`;
}
