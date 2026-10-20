// Cálculos de datas, durações, unidades e timestamps Unix usados pelas
// páginas /calculadoras e /timestamp. Sem DOM: testado em Node.
// Textos no idioma da interface; erros são códigos que as páginas traduzem.

import { locale, t } from "../i18n/estado.js";
import { contarDiasUteis, somarDiasUteis } from "./feriados.js";
import {
  FUSO_BRASILIA,
  MS_DIA,
  MS_HORA,
  MS_MINUTO,
  civilParaInstantes,
  dataCivilValida,
  deDiaJuliano,
  deslocamentoMinutos,
  diaJuliano,
  diasNoMes,
  doisDigitos,
  lerHora,
  partesNoFuso,
} from "./tempo.js";

// ---- Textos ----------------------------------------------------------------

/**
 * Quantidade com unidade no plural certo ("1 dia", "3 dias"). Uma forma
 * própria para zero ("<chave>.zero") vale quando existe no dicionário — em
 * português é "0 dias", embora a regra de plural trate 0 como singular.
 */
export function quantidade(chave, n) {
  const zero = `${chave}.zero`;
  if (n === 0) {
    const texto = t(zero, { n });
    if (texto !== zero) return texto;
  }
  return t(chave, { n });
}

/** Lista "a, b e c" no idioma da interface. */
export function juntarLista(partes) {
  if (partes.length < 2) return partes[0] ?? "";
  try {
    return new Intl.ListFormat(locale(), { type: "conjunction" }).format(partes);
  } catch {
    return partes.join(", ");
  }
}

// ---- Datas ---------------------------------------------------------------

function somarMeses({ ano, mes, dia }, meses) {
  const total = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  // Dia limitado ao fim do mês: 31/jan + 1 mês = 28 ou 29/fev.
  return { ano: novoAno, mes: novoMes, dia: Math.min(dia, diasNoMes(novoAno, novoMes)) };
}

/**
 * Diferença entre duas datas civis.
 * Retorna dias totais (b − a, com sinal), semanas + dias e a diferença de
 * calendário em anos, meses e dias (sempre positiva, com `negativa` indicando
 * que b é anterior a a).
 */
export function diferencaEntreDatas(a, b) {
  const ja = diaJuliano(a.ano, a.mes, a.dia);
  const jb = diaJuliano(b.ano, b.mes, b.dia);
  const dias = jb - ja;
  const [inicio, fim] = dias >= 0 ? [a, b] : [b, a];
  const jInicio = Math.min(ja, jb);
  const jFim = Math.max(ja, jb);

  let meses = (fim.ano - inicio.ano) * 12 + (fim.mes - inicio.mes);
  let intermediaria = somarMeses(inicio, meses);
  while (meses > 0 && diaJuliano(intermediaria.ano, intermediaria.mes, intermediaria.dia) > jFim) {
    meses -= 1;
    intermediaria = somarMeses(inicio, meses);
  }
  const diasRestantes = jFim - diaJuliano(intermediaria.ano, intermediaria.mes, intermediaria.dia);
  const absDias = jFim - jInicio;

  return {
    dias,
    negativa: dias < 0,
    semanas: Math.floor(absDias / 7),
    diasAlemSemanas: absDias % 7,
    anos: Math.floor(meses / 12),
    meses: meses % 12,
    diasCalendario: diasRestantes,
    horas: absDias * 24,
  };
}

/** Texto como "1 ano, 2 meses e 3 dias". */
export function descreverCalendario({ anos, meses, diasCalendario }) {
  const partes = [];
  if (anos) partes.push(quantidade("calc.qtd.anos", anos));
  if (meses) partes.push(quantidade("calc.qtd.meses", meses));
  if (diasCalendario || partes.length === 0) partes.push(quantidade("calc.qtd.dias", diasCalendario));
  return juntarLista(partes);
}

/**
 * Dias úteis entre duas datas, incluindo as duas pontas.
 * Considera feriados nacionais e, se `uf` for informada, os estaduais.
 * Pontos facultativos contam como dias úteis.
 */
export function diasUteisEntre(a, b, { uf = null } = {}) {
  return contarDiasUteis(diaJuliano(a.ano, a.mes, a.dia), diaJuliano(b.ano, b.mes, b.dia), { uf });
}

/** Soma dias corridos ou úteis a uma data. `quantidade` pode ser negativa. */
export function somarDias(data, quantidade, { uteis = false, uf = null } = {}) {
  const inicio = diaJuliano(data.ano, data.mes, data.dia);
  const resultado = uteis ? somarDiasUteis(inicio, quantidade, { uf }) : inicio + quantidade;
  const { ano, mes, dia, diaSemana } = deDiaJuliano(resultado);
  return { ano, mes, dia, diaSemana };
}

// ---- Durações entre horários ----------------------------------------------

/**
 * Duração entre dois horários "HH:MM". Se o fim for anterior ao início,
 * considera que passou da meia-noite. `pausaMinutos` é descontada.
 * Retorna null para entradas inválidas e { erro: "pausa-maior" } quando a
 * pausa não cabe no intervalo.
 */
export function duracaoEntreHorarios(inicioTexto, fimTexto, pausaMinutos = 0) {
  const inicio = lerHora(inicioTexto);
  const fim = lerHora(fimTexto);
  const pausa = Number(pausaMinutos);
  if (!inicio || !fim || !Number.isFinite(pausa) || pausa < 0) return null;

  const msInicio = inicio.hora * MS_HORA + inicio.minuto * MS_MINUTO + inicio.segundo * 1000;
  let msFim = fim.hora * MS_HORA + fim.minuto * MS_MINUTO + fim.segundo * 1000;
  const viraDia = msFim < msInicio;
  if (viraDia) msFim += MS_DIA;

  const bruto = msFim - msInicio;
  const pausaMs = pausa * MS_MINUTO;
  if (pausaMs > bruto) return { erro: "pausa-maior" };
  const liquido = bruto - pausaMs;
  const totalMinutos = Math.round(liquido / MS_MINUTO);

  return {
    ms: liquido,
    viraDia,
    horas: Math.floor(totalMinutos / 60),
    minutos: totalMinutos % 60,
    texto: `${Math.floor(totalMinutos / 60)}:${doisDigitos(totalMinutos % 60)}`,
    decimal: liquido / MS_HORA,
  };
}

// ---- Unidades ----------------------------------------------------------------

// Segundos de cada unidade. Os nomes vêm do dicionário (calc.unidade.<chave>).
export const UNIDADES = {
  segundos: { s: 1 },
  minutos: { s: 60 },
  horas: { s: 3600 },
  dias: { s: 86400 },
  semanas: { s: 604800 },
};

/**
 * Lê um número com vírgula ou ponto decimal: "1.234,5", "1,5", "1234.5" e
 * "1,234.5" — o separador que aparece por último é o decimal.
 */
export function lerNumero(texto) {
  let valor = String(texto ?? "").trim().replace(/\s/g, "");
  if (!valor) return Number.NaN;
  const virgula = valor.lastIndexOf(",");
  const ponto = valor.lastIndexOf(".");
  if (virgula > ponto) valor = valor.replace(/\./g, "").replace(",", ".");
  else if (virgula >= 0) valor = valor.replace(/,/g, "");
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(valor)) return Number.NaN;
  return Number(valor);
}

/** Converte `valor` da unidade `de` para todas as unidades. */
export function converterUnidades(valor, de) {
  const unidade = UNIDADES[de];
  if (!unidade || !Number.isFinite(valor)) return null;
  const segundos = valor * unidade.s;
  return Object.fromEntries(Object.entries(UNIDADES).map(([chave, u]) => [chave, segundos / u.s]));
}

export function formatarNumero(valor, casas = 6) {
  if (!Number.isFinite(valor)) return "—";
  return valor.toLocaleString(locale(), { maximumFractionDigits: casas });
}

// ---- Timestamps Unix -----------------------------------------------------------

// Heurística de unidade: |valor| ≥ 100 000 000 000 é tratado como
// milissegundos. Em segundos, esse valor seria o ano 5138; em milissegundos,
// é março de 1973. Assim, qualquer data entre 1973 e 5138 é reconhecida
// corretamente nas duas unidades.
export const LIMIAR_MILISSEGUNDOS = 1e11;
const LIMITE_DATE = 8.64e15;

/**
 * Lê um timestamp Unix. `unidade`: "auto" | "s" | "ms".
 * Retorna { ms, unidade, detectada } ou { erro } com o código "vazio",
 * "formato" ou "intervalo".
 */
export function lerTimestamp(texto, unidade = "auto") {
  const limpo = String(texto ?? "").trim().replace(/[\s_]/g, "");
  if (!limpo) return { erro: "vazio" };
  if (!/^[-+]?\d+(\.\d+)?$/.test(limpo)) return { erro: "formato" };
  const valor = Number(limpo);
  const usada = unidade === "auto" ? (Math.abs(valor) >= LIMIAR_MILISSEGUNDOS ? "ms" : "s") : unidade;
  const ms = usada === "ms" ? valor : valor * 1000;
  if (!Number.isFinite(ms) || Math.abs(ms) > LIMITE_DATE) return { erro: "intervalo" };
  return { ms: Math.round(ms), unidade: usada, detectada: unidade === "auto" };
}

const DIAS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deslocamento no formato "-0300" ou "-03:00". */
function deslocamentoTexto(minutos, separador = "") {
  const sinal = minutos < 0 ? "-" : "+";
  const abs = Math.abs(minutos);
  return `${sinal}${doisDigitos(Math.floor(abs / 60))}${separador}${doisDigitos(abs % 60)}`;
}

/** ISO 8601 com o deslocamento do fuso: "2026-10-19T17:00:00.000-03:00". */
export function formatarIsoNoFuso(ms, fuso = FUSO_BRASILIA) {
  const p = partesNoFuso(ms, fuso);
  const milis = String(((ms % 1000) + 1000) % 1000).padStart(3, "0");
  const desl = deslocamentoMinutos(ms, fuso);
  const ano = p.ano < 0 ? `-${String(-p.ano).padStart(6, "0")}` : String(p.ano).padStart(4, "0");
  return `${ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}T${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}:${doisDigitos(
    p.segundo,
  )}.${milis}${desl === 0 ? "Z" : deslocamentoTexto(desl, ":")}`;
}

/** RFC 2822 no fuso indicado: "Mon, 19 Oct 2026 17:00:00 -0300". */
export function formatarRfc2822(ms, fuso = FUSO_BRASILIA) {
  const p = partesNoFuso(ms, fuso);
  return `${DIAS_EN[p.diaSemana]}, ${doisDigitos(p.dia)} ${MESES_EN[p.mes - 1]} ${p.ano} ${doisDigitos(p.hora)}:${doisDigitos(
    p.minuto,
  )}:${doisDigitos(p.segundo)} ${deslocamentoTexto(deslocamentoMinutos(ms, fuso))}`;
}

/** "há 3 dias", "em 2 horas", "agora" (no idioma da interface). */
export function formatarRelativo(ms, agora) {
  const diff = ms - agora;
  const abs = Math.abs(diff);
  if (abs < 1000) return t("timestamp.agoraRelativo");
  const escalas = [
    ["year", 365.2425 * MS_DIA],
    ["month", 30.436875 * MS_DIA],
    ["week", 7 * MS_DIA],
    ["day", MS_DIA],
    ["hour", MS_HORA],
    ["minute", MS_MINUTO],
    ["second", 1000],
  ];
  const [unidade, tamanho] = escalas.find(([, limite]) => abs >= limite);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "always" });
  return rtf.format(Math.trunc(diff / tamanho), unidade);
}

/**
 * Converte data/hora civil num fuso em timestamp.
 * Retorna { situacao, instantes } (ver civilParaInstantes) ou { erro } com o
 * código "data" ou "hora".
 */
export function civilParaTimestamp({ ano, mes, dia, hora = 0, minuto = 0, segundo = 0 }, fuso = FUSO_BRASILIA) {
  if (!dataCivilValida(ano, mes, dia)) return { erro: "data" };
  if (![hora, minuto, segundo].every(Number.isInteger) || hora > 23 || minuto > 59 || segundo > 59 || hora < 0 || minuto < 0 || segundo < 0) {
    return { erro: "hora" };
  }
  return civilParaInstantes({ ano, mes, dia, hora, minuto, segundo }, fuso);
}
