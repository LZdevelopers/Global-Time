// Cálculo de feriados, datas móveis, feriadões e exportação para agendas.
// Sem DOM. As datas são civis ({ ano, mes, dia }), sem hora nem fuso.
//
// Nomes de feriados são nomes próprios do Brasil e ficam em português; os
// rótulos de tipo, os horários parciais e a descrição saem no idioma da
// interface. Observações longas dos dados (em português) só aparecem nos
// idiomas portugueses.

import { DATAS_COMEMORATIVAS, EXTRAS_POR_ANO, FERIADOS_NACIONAIS } from "../dados/feriados-nacionais.js";
import { FERIADOS_ESTADUAIS } from "../dados/feriados-estaduais.js";
import { FERIADOS_MUNICIPAIS } from "../dados/feriados-municipais.js";
import { idiomaAtual, t } from "../i18n/estado.js";
import { capitalizar, dataIso, deDiaJuliano, diaJuliano, diasNoMes, diaSemana, doisDigitos } from "./tempo.js";

export const TIPOS_EVENTO = {
  nacional: { folga: true },
  estadual: { folga: true },
  municipal: { folga: true },
  facultativo: { folga: false },
  comemorativa: { folga: false },
};

/** "Feriado nacional", "Ponto facultativo"… no idioma da interface. */
export function rotuloDoTipo(tipo) {
  return TIPOS_EVENTO[tipo] ? capitalizar(t(`calendario.tipo.${tipo}`)) : tipo;
}

// Horários parciais dos dados ("até as 14h", "após as 13h").
const PARCIAIS = [
  [/^até as (\d{1,2})h$/, "feriados.parcial.ate"],
  [/^após as (\d{1,2})h$/, "feriados.parcial.apos"],
];

/** Texto do expediente parcial no idioma da interface (ou o original). */
export function parcialTraduzido(texto) {
  if (!texto) return null;
  for (const [re, chave] of PARCIAIS) {
    const m = re.exec(texto);
    if (m) return t(chave, { hora: m[1] });
  }
  return texto;
}

/** Observação dos dados (em português) — só nos idiomas portugueses. */
export function observacaoVisivel(evento) {
  return evento.observacao && idiomaAtual().startsWith("pt") ? evento.observacao : null;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { ano, mes, dia };
}

export function resolverRegra(regra, ano) {
  if (!regra) return null;
  if (regra.tipo === "fixa") {
    if (regra.dia > diasNoMes(ano, regra.mes)) return null;
    return { ano, mes: regra.mes, dia: regra.dia };
  }
  if (regra.tipo === "pascoa") {
    const p = pascoa(ano);
    const { ano: a, mes, dia } = deDiaJuliano(diaJuliano(p.ano, p.mes, p.dia) + regra.deslocamento);
    return { ano: a, mes, dia };
  }
  if (regra.tipo === "domingoSeguinte") {
    const atraso = (7 - diaSemana(ano, regra.mes, regra.dia)) % 7;
    const { ano: a, mes, dia } = deDiaJuliano(diaJuliano(ano, regra.mes, regra.dia) + atraso);
    return { ano: a, mes, dia };
  }
  if (regra.tipo === "nesimo") {
    const primeiro = diaSemana(ano, regra.mes, 1);
    const dia = 1 + ((regra.diaSemana - primeiro + 7) % 7) + (regra.n - 1) * 7;
    return dia <= diasNoMes(ano, regra.mes) ? { ano, mes: regra.mes, dia } : null;
  }
  return null;
}

function vigente(definicao, ano) {
  if (definicao.desde && ano < definicao.desde) return false;
  if (definicao.ate && ano > definicao.ate) return false;
  return true;
}

function montarEvento(definicao, ano, tipoPadrao) {
  if (!vigente(definicao, ano)) return null;
  const data = resolverRegra(definicao.regra, ano);
  if (!data) return null;
  const tipo = definicao.tipo ?? tipoPadrao;
  return {
    id: `${definicao.id}-${ano}`,
    idBase: definicao.id,
    nome: definicao.nome,
    tipo,
    rotuloTipo: rotuloDoTipo(tipo),
    folga: TIPOS_EVENTO[tipo]?.folga ?? false,
    parcial: definicao.parcial ?? null,
    uf: definicao.uf ?? null,
    municipio: definicao.municipio ?? null,
    baseLegal: definicao.base_legal ?? null,
    fonte: definicao.fonte ?? null,
    observacao: definicao.observacao ?? null,
    data,
    juliano: diaJuliano(data.ano, data.mes, data.dia),
    iso: dataIso(data.ano, data.mes, data.dia),
  };
}

/**
 * Todos os eventos de um ano, ordenados por data.
 * opcoes: { uf, municipio, comemorativas = true, facultativos = true }
 */
export function eventosDoAno(ano, opcoes = {}) {
  const { uf = null, municipio = null, comemorativas = true, facultativos = true } = opcoes;
  const extras = EXTRAS_POR_ANO[ano] ?? { adicionar: [], remover: [] };
  const removidos = new Set(extras.remover ?? []);

  const definicoes = [
    ...FERIADOS_NACIONAIS.filter((d) => !removidos.has(d.id)).map((d) => [d, "nacional"]),
    ...(extras.adicionar ?? []).map((d) => [d, "facultativo"]),
    ...(uf ? FERIADOS_ESTADUAIS.filter((d) => d.uf === uf).map((d) => [d, "estadual"]) : []),
    ...(uf && municipio
      ? FERIADOS_MUNICIPAIS.filter((d) => d.uf === uf && d.municipio === municipio).map((d) => [d, "municipal"])
      : []),
    ...(comemorativas ? DATAS_COMEMORATIVAS.map((d) => [d, "comemorativa"]) : []),
  ];

  return definicoes
    .map(([definicao, tipo]) => montarEvento(definicao, ano, tipo))
    .filter((evento) => evento && (facultativos || evento.tipo !== "facultativo"))
    .sort((a, b) => a.juliano - b.juliano || ordemTipo(a.tipo) - ordemTipo(b.tipo));
}

function ordemTipo(tipo) {
  return ["nacional", "estadual", "municipal", "facultativo", "comemorativa"].indexOf(tipo);
}

/** Eventos em um intervalo de dias julianos [inicio, fim], cruzando anos se preciso. */
export function eventosNoIntervalo(inicio, fim, opcoes = {}) {
  const anoInicio = deDiaJuliano(inicio).ano;
  const anoFim = deDiaJuliano(fim).ano;
  const lista = [];
  for (let ano = anoInicio; ano <= anoFim; ano += 1) {
    lista.push(...eventosDoAno(ano, opcoes).filter((e) => e.juliano >= inicio && e.juliano <= fim));
  }
  return lista;
}

/** Conjunto de dias julianos que são feriados (com folga) para a localidade. */
export function diasDeFeriado(inicio, fim, opcoes = {}) {
  return new Set(
    eventosNoIntervalo(inicio, fim, { ...opcoes, comemorativas: false, facultativos: false })
      .filter((e) => e.folga)
      .map((e) => e.juliano),
  );
}

export function ehFimDeSemana(juliano) {
  const dia = deDiaJuliano(juliano).diaSemana;
  return dia === 0 || dia === 6;
}

/**
 * Conta dias úteis entre duas datas (dias julianos), incluindo as duas pontas.
 * Dia útil = segunda a sexta que não seja feriado da localidade.
 * Pontos facultativos contam como úteis (não são folga obrigatória).
 */
export function contarDiasUteis(inicio, fim, opcoes = {}) {
  const [a, b] = inicio <= fim ? [inicio, fim] : [fim, inicio];
  const feriados = diasDeFeriado(a, b, opcoes);
  let uteis = 0;
  for (let d = a; d <= b; d += 1) {
    if (!ehFimDeSemana(d) && !feriados.has(d)) uteis += 1;
  }
  return uteis;
}

/** Soma `quantidade` dias úteis a partir de `inicio` (não conta o dia inicial). */
export function somarDiasUteis(inicio, quantidade, opcoes = {}) {
  const passo = quantidade >= 0 ? 1 : -1;
  const margem = Math.abs(quantidade) * 2 + 30;
  const feriados = diasDeFeriado(
    Math.min(inicio, inicio + passo * margem),
    Math.max(inicio, inicio + passo * margem),
    opcoes,
  );
  let restantes = Math.abs(quantidade);
  let dia = inicio;
  while (restantes > 0) {
    dia += passo;
    if (!ehFimDeSemana(dia) && !feriados.has(dia)) restantes -= 1;
  }
  return dia;
}

/**
 * Analisa se um feriado forma um feriadão (≥ 3 dias seguidos de folga) ou se
 * uma emenda de um único dia útil formaria um bloco de 4 dias ou mais.
 * Retorna { tipo: "feriadao" | "emenda" | null, inicio, fim, dias, ponte }.
 */
export function analisarFeriadao(juliano, opcoes = {}) {
  const feriados = diasDeFeriado(juliano - 10, juliano + 10, opcoes);
  const folga = (d) => ehFimDeSemana(d) || feriados.has(d);
  if (!folga(juliano) || ehFimDeSemana(juliano)) return { tipo: null };

  const bloco = (centro, extra = null) => {
    const livre = (d) => folga(d) || d === extra;
    let inicio = centro;
    let fim = centro;
    while (livre(inicio - 1)) inicio -= 1;
    while (livre(fim + 1)) fim += 1;
    return { inicio, fim, dias: fim - inicio + 1 };
  };

  const atual = bloco(juliano);
  if (atual.dias >= 3) return { tipo: "feriadao", ...atual, ponte: null };

  let melhor = null;
  for (const ponte of [juliano - 1, juliano + 1]) {
    if (folga(ponte)) continue;
    const comPonte = bloco(juliano, ponte);
    if (comPonte.dias >= 4 && (!melhor || comPonte.dias > melhor.dias)) melhor = { ...comPonte, ponte };
  }
  return melhor ? { tipo: "emenda", ...melhor } : { tipo: null };
}

// ---- Exportação ------------------------------------------------------------

function escaparIcs(texto) {
  return String(texto)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Dobra linhas em 75 octetos, como pede a RFC 5545. */
function dobrarLinha(linha) {
  const codificador = new TextEncoder();
  if (codificador.encode(linha).length <= 75) return linha;
  const partes = [];
  let atual = "";
  for (const caractere of linha) {
    const limite = partes.length === 0 ? 75 : 74;
    if (codificador.encode(atual + caractere).length > limite) {
      partes.push(atual);
      atual = caractere;
    } else {
      atual += caractere;
    }
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

function dataCompacta({ ano, mes, dia }) {
  return `${String(ano).padStart(4, "0")}${doisDigitos(mes)}${doisDigitos(dia)}`;
}

function diaSeguinte(data) {
  const { ano, mes, dia } = deDiaJuliano(diaJuliano(data.ano, data.mes, data.dia) + 1);
  return { ano, mes, dia };
}

function carimboUtc(instante) {
  const d = new Date(instante);
  return `${dataCompacta({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() })}T${doisDigitos(
    d.getUTCHours(),
  )}${doisDigitos(d.getUTCMinutes())}${doisDigitos(d.getUTCSeconds())}Z`;
}

export function descricaoEvento(evento) {
  return [
    evento.rotuloTipo + (evento.parcial ? ` (${parcialTraduzido(evento.parcial)})` : ""),
    observacaoVisivel(evento),
    evento.baseLegal ? t("feriados.baseLegalValor", { valor: evento.baseLegal }) : null,
    evento.fonte ? t("feriados.fonteValor", { valor: evento.fonte }) : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Gera um arquivo iCalendar (.ics) com eventos de dia inteiro. */
export function gerarIcs(eventos, { nome = "GlobalTime", agora = Date.now() } = {}) {
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GlobalTime//Feriados//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escaparIcs(nome)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
  ];
  for (const evento of eventos) {
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${evento.id}@globaltime`,
      `DTSTAMP:${carimboUtc(agora)}`,
      `DTSTART;VALUE=DATE:${dataCompacta(evento.data)}`,
      `DTEND;VALUE=DATE:${dataCompacta(diaSeguinte(evento.data))}`,
      `SUMMARY:${escaparIcs(evento.nome)}`,
      `DESCRIPTION:${escaparIcs(descricaoEvento(evento))}`,
      `CATEGORIES:${escaparIcs(evento.rotuloTipo)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR");
  return `${linhas.map(dobrarLinha).join("\r\n")}\r\n`;
}

/** Link "adicionar ao Google Agenda" para um evento de dia inteiro. */
export function linkGoogleAgenda(evento) {
  const parametros = new URLSearchParams({
    action: "TEMPLATE",
    text: evento.nome,
    dates: `${dataCompacta(evento.data)}/${dataCompacta(diaSeguinte(evento.data))}`,
    details: descricaoEvento(evento),
  });
  return `https://calendar.google.com/calendar/render?${parametros}`;
}

export { FERIADOS_NACIONAIS, DATAS_COMEMORATIVAS };
