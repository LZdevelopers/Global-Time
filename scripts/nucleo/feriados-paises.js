// Feriados de outros países no calendário, vindos de /api/feriados (Nager.Date).
//
// O Brasil continua com os dados próprios do site (scripts/nucleo/feriados.js,
// com estados e capitais); os demais países do relógio mundial são consultados
// por país e ano. As datas chegam como "AAAA-MM-DD" e viram dias civis
// (dia juliano) sem passar por Date: nenhum fuso horário mexe nelas.
//
// Cache: memória + localStorage por país e ano. Feriados quase não mudam, então
// um ano salvo vale por 30 dias; depois disso é consultado de novo, e se a
// consulta falhar a cópia salva continua sendo usada.

import { cidadeDoFuso, codigoPais, fusoDoNavegador } from "../dados/cidades.js";
import { PAISES_RELOGIO } from "../dados/paises.js";
import { gravar, ler } from "./armazenamento.js";
import { cidadePreferida } from "./fuso-preferido.js";
import { diaJuliano, lerDataIso } from "./tempo.js";

export const PAIS_COM_DADOS_PROPRIOS = "BR";
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;
const VALIDADE_LISTA_MS = 7 * 24 * 60 * 60 * 1000;
const CHAVE_LISTA = "feriados-paises:lista";
const CHAVE_PAIS = "calendario:pais";
// Gravado por scripts/nucleo/unidades-clima.js.
const CHAVE_PAIS_VISITANTE = "clima:pais";

/**
 * País dos feriados, o mesmo no calendário e na página inicial. Ordem: o
 * indicado (ex.: ?pais= na URL), a escolha salva no calendário, o país
 * onde o visitante está (localização por IP ou GPS feita no clima), o da
 * cidade do fuso preferido, o do fuso do aparelho e, por fim, o Brasil.
 */
export function paisPreferido(indicado = null) {
  const candidatos = [
    indicado?.toUpperCase(),
    ler(CHAVE_PAIS),
    ler(CHAVE_PAIS_VISITANTE),
    codigoPais(cidadePreferida()),
    codigoPais(cidadeDoFuso(fusoDoNavegador())),
  ];
  return candidatos.find((c) => typeof c === "string" && PAISES_RELOGIO.includes(c)) ?? PAIS_COM_DADOS_PROPRIOS;
}

export function salvarPaisPreferido(pais) {
  gravar(CHAVE_PAIS, pais);
}

/**
 * Próximo feriado nacional (com folga) de um país a partir do dia juliano
 * `hoje`, olhando este ano e o seguinte. Resolve com o evento ou null.
 */
export async function proximoFeriadoDoPais(pais, hoje, ano) {
  const anos = await Promise.allSettled([carregarFeriados(pais, ano), carregarFeriados(pais, ano + 1)]);
  const carregados = anos.filter((r) => r.status === "fulfilled").map((r) => r.value.eventos);
  if (!carregados.length) throw anos[0].reason;
  return (
    carregados
      .flat()
      .filter((e) => e.tipo === "nacional" && e.juliano >= hoje)
      .sort((a, b) => a.juliano - b.juliano)[0] ?? null
  );
}

/**
 * Item da API → evento do calendário.
 * Tipos da fonte: Public (feriado), Bank, School, Authorities (só para esses
 * setores), Optional (folga opcional), Observance (data comemorativa).
 */
export function eventoDoFeriado(item, pais) {
  const data = lerDataIso(item?.data);
  if (!data || typeof item.nome !== "string") return null;
  const tipos = Array.isArray(item.tipos) ? item.tipos : [];
  let tipo;
  if (tipos.includes("Public")) tipo = item.nacional ? "nacional" : "regional";
  else if (tipos.includes("Optional")) tipo = "opcional";
  else if (tipos.includes("Bank") || tipos.includes("School") || tipos.includes("Authorities")) tipo = "setorial";
  else tipo = "comemorativa";
  return {
    id: `${pais}-${item.data}-${item.nome}`,
    nome: item.nome,
    nomeIngles: item.nomeIngles && item.nomeIngles !== item.nome ? item.nomeIngles : null,
    tipo,
    // Folga marcada só quando vale para o país inteiro.
    folga: tipo === "nacional",
    setores: tipos.filter((t) => ["Bank", "School", "Authorities"].includes(t)),
    regioes: item.regioes ?? null,
    pais,
    juliano: diaJuliano(data.ano, data.mes, data.dia),
  };
}

const memoria = new Map();
const pendentes = new Map();
const chave = (pais, ano) => `feriados-paises:${pais}:${ano}`;

/**
 * Eventos já carregados de um país/ano, ou null. Não consulta a rede.
 * { eventos, obtidoEm }
 */
export function feriadosEmCache(pais, ano) {
  const k = chave(pais, ano);
  if (!memoria.has(k)) {
    const salvo = ler(k);
    if (salvo && Array.isArray(salvo.lista) && Number.isFinite(salvo.obtidoEm)) {
      memoria.set(k, { eventos: salvo.lista.map((i) => eventoDoFeriado(i, pais)).filter(Boolean), obtidoEm: salvo.obtidoEm });
    }
  }
  return memoria.get(k) ?? null;
}

/**
 * Carrega (se preciso) os feriados de um país/ano. Resolve com
 * { eventos, obtidoEm, desatualizado? } ou rejeita com Error("sem-dados" |
 * "indisponivel") quando não há nem consulta nem cópia salva.
 */
export function carregarFeriados(pais, ano, { agora = Date.now() } = {}) {
  const k = chave(pais, ano);
  const atual = feriadosEmCache(pais, ano);
  if (atual && agora - atual.obtidoEm < VALIDADE_MS) return Promise.resolve(atual);
  if (pendentes.has(k)) return pendentes.get(k);

  const promessa = (async () => {
    try {
      const resposta = await fetch(`/api/feriados?pais=${encodeURIComponent(pais)}&ano=${ano}`, { headers: { Accept: "application/json" } });
      if (resposta.status === 404) throw new Error("sem-dados");
      if (!resposta.ok) throw new Error("indisponivel");
      const corpo = await resposta.json();
      if (!Array.isArray(corpo?.feriados)) throw new Error("indisponivel");
      const registro = { eventos: corpo.feriados.map((i) => eventoDoFeriado(i, pais)).filter(Boolean), obtidoEm: agora };
      memoria.set(k, registro);
      gravar(k, { lista: corpo.feriados, obtidoEm: agora });
      return registro;
    } catch (erro) {
      if (atual) return { ...atual, desatualizado: true };
      throw new Error(erro?.message === "sem-dados" ? "sem-dados" : "indisponivel");
    } finally {
      pendentes.delete(k);
    }
  })();
  pendentes.set(k, promessa);
  return promessa;
}

/**
 * Países do relógio mundial que a fonte cobre (mais o Brasil, sempre).
 * Sem rede e sem lista salva, devolve todos os do relógio.
 */
export async function paisesComFeriados({ agora = Date.now() } = {}) {
  const salvo = ler(CHAVE_LISTA);
  const valido = salvo && Array.isArray(salvo.paises) && agora - salvo.obtidoEm < VALIDADE_LISTA_MS;
  if (valido) return filtrar(salvo.paises);
  try {
    const resposta = await fetch("/api/feriados?paises=1", { headers: { Accept: "application/json" } });
    if (!resposta.ok) throw new Error();
    const { paises } = await resposta.json();
    if (!Array.isArray(paises)) throw new Error();
    gravar(CHAVE_LISTA, { paises, obtidoEm: agora });
    return filtrar(paises);
  } catch {
    return Array.isArray(salvo?.paises) ? filtrar(salvo.paises) : [...PAISES_RELOGIO];
  }
}

function filtrar(lista) {
  const conjunto = new Set([PAIS_COM_DADOS_PROPRIOS, ...lista]);
  return PAISES_RELOGIO.filter((p) => conjunto.has(p));
}
