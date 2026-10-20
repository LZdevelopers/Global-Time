// Nascer e pôr do sol pelo algoritmo da NOAA (Solar Calculator, baseado em
// Jean Meeus, "Astronomical Algorithms"). Sem DOM.
//
// Precisão esperada: cerca de ±1 minuto para latitudes até ~72°, piorando
// perto dos círculos polares. Usamos o ângulo padrão de 90,833° (refração
// atmosférica média de 0,833°, já incluindo o raio do disco solar). Relevo,
// altitude e condições atmosféricas reais podem mudar o horário observado em
// alguns minutos — os valores são calculados, não observados nem oficiais.
//
// Convenção: latitude positiva ao norte, longitude positiva a leste.
// Os resultados são instantes Unix (ms).

import { locale, t } from "../i18n/estado.js";
import { MS_DIA, MS_MINUTO, partesNoFuso } from "./tempo.js";

const rad = (graus) => (graus * Math.PI) / 180;
const graus = (radianos) => (radianos * 180) / Math.PI;

export const ZENITE_OFICIAL = 90.833;
export const ZENITE_CIVIL = 96;

function seculoJuliano(jd) {
  return (jd - 2451545) / 36525;
}

function longitudeMedia(t) {
  const l = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  return l < 0 ? l + 360 : l;
}

function anomaliaMedia(t) {
  return 357.52911 + t * (35999.05029 - 0.0001537 * t);
}

function excentricidade(t) {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
}

function equacaoDoCentro(t) {
  const m = rad(anomaliaMedia(t));
  return (
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m) * 0.000289
  );
}

function longitudeAparente(t) {
  const verdadeira = longitudeMedia(t) + equacaoDoCentro(t);
  return verdadeira - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * t));
}

function obliquidadeCorrigida(t) {
  const segundos = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const media = 23 + (26 + segundos / 60) / 60;
  return media + 0.00256 * Math.cos(rad(125.04 - 1934.136 * t));
}

export function declinacao(t) {
  return graus(Math.asin(Math.sin(rad(obliquidadeCorrigida(t))) * Math.sin(rad(longitudeAparente(t)))));
}

/** Equação do tempo, em minutos. */
export function equacaoDoTempo(t) {
  const eps = rad(obliquidadeCorrigida(t));
  const l0 = rad(longitudeMedia(t));
  const e = excentricidade(t);
  const m = rad(anomaliaMedia(t));
  const y = Math.tan(eps / 2) ** 2;
  const valor =
    y * Math.sin(2 * l0) -
    2 * e * Math.sin(m) +
    4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * e * e * Math.sin(2 * m);
  return graus(valor) * 4;
}

/** cos do ângulo horário; fora de [−1, 1] o sol não cruza o ângulo pedido. */
function cossenoAnguloHorario(latitude, decl, zenite) {
  const lat = rad(latitude);
  const d = rad(decl);
  return Math.cos(rad(zenite)) / (Math.cos(lat) * Math.cos(d)) - Math.tan(lat) * Math.tan(d);
}

function jdDoDia({ ano, mes, dia }) {
  return Date.UTC(ano, mes - 1, dia) / MS_DIA + 2440587.5;
}

/** Meio-dia solar em minutos UTC desde a meia-noite UTC do dia. */
function meioDiaMinutos(jd, longitude) {
  let eq = equacaoDoTempo(seculoJuliano(jd - longitude / 360));
  let minutos = 720 - longitude * 4 - eq;
  eq = equacaoDoTempo(seculoJuliano(jd + minutos / 1440));
  minutos = 720 - longitude * 4 - eq;
  return minutos;
}

/**
 * Minutos UTC do cruzamento do zênite pedido (nascer ou ocaso), ou um status
 * "sempre-acima" / "sempre-abaixo".
 */
function cruzamento(nascer, jd, latitude, longitude, zenite) {
  const calcular = (jdRef) => {
    const t = seculoJuliano(jdRef);
    const cos = cossenoAnguloHorario(latitude, declinacao(t), zenite);
    if (cos > 1) return { status: "sempre-abaixo" };
    if (cos < -1) return { status: "sempre-acima" };
    let anguloHorario = graus(Math.acos(cos));
    if (!nascer) anguloHorario = -anguloHorario;
    return { minutos: 720 - 4 * (longitude + anguloHorario) - equacaoDoTempo(t) };
  };
  const primeiro = calcular(jd + meioDiaMinutos(jd, longitude) / 1440);
  if (primeiro.status) return primeiro;
  // Refina com a posição do sol no próprio instante do evento.
  return calcular(jd + primeiro.minutos / 1440);
}

/**
 * Calcula os eventos do dia civil `data` ({ ano, mes, dia }) no local.
 * `fuso` define qual é o "dia" (a data civil local); os instantes retornados
 * caem dentro desse dia local sempre que o fuso for coerente com a longitude.
 *
 * Retorna {
 *   status: "normal" | "dia-polar" | "noite-polar",
 *   nascer, por, meioDia, duracaoMs,
 *   crepusculo: { status: "normal" | "claro-toda-noite" | "sem-crepusculo", inicio, fim }
 * }
 */
export function calcularSol(data, latitude, longitude, fuso) {
  let jd = jdDoDia(data);
  const meiaNoiteUtc = (j) => (j - 2440587.5) * MS_DIA;
  const meioDiaDe = (j) => meiaNoiteUtc(j) + meioDiaMinutos(j, longitude) * MS_MINUTO;
  const alvo = Date.UTC(data.ano, data.mes - 1, data.dia);

  // Ajusta o dia de cálculo para que o meio-dia solar caia na data civil local
  // (relevante perto da linha de data, ex.: Auckland ou Honolulu).
  if (fuso) {
    for (let i = 0; i < 2; i += 1) {
      const local = partesNoFuso(meioDiaDe(jd), fuso);
      const diff = Math.round((Date.UTC(local.ano, local.mes - 1, local.dia) - alvo) / MS_DIA);
      if (diff === 0) break;
      jd -= diff;
    }
  }
  const base = meiaNoiteUtc(jd);
  const meioDia = meioDiaDe(jd);
  const instante = (minutos) => base + minutos * MS_MINUTO;

  const resultado = { status: "normal", nascer: null, por: null, meioDia, duracaoMs: null, crepusculo: null };

  const nasc = cruzamento(true, jd, latitude, longitude, ZENITE_OFICIAL);
  const oc = cruzamento(false, jd, latitude, longitude, ZENITE_OFICIAL);
  if (nasc.status === "sempre-acima" || oc.status === "sempre-acima") {
    resultado.status = "dia-polar";
    resultado.duracaoMs = MS_DIA;
  } else if (nasc.status === "sempre-abaixo" || oc.status === "sempre-abaixo") {
    resultado.status = "noite-polar";
    resultado.duracaoMs = 0;
  } else {
    resultado.nascer = instante(nasc.minutos);
    resultado.por = instante(oc.minutos);
    resultado.duracaoMs = resultado.por - resultado.nascer;
  }

  const ci = cruzamento(true, jd, latitude, longitude, ZENITE_CIVIL);
  const cf = cruzamento(false, jd, latitude, longitude, ZENITE_CIVIL);
  if (ci.status === "sempre-acima" || cf.status === "sempre-acima") {
    resultado.crepusculo = { status: "claro-toda-noite", inicio: null, fim: null };
  } else if (ci.status === "sempre-abaixo" || cf.status === "sempre-abaixo") {
    resultado.crepusculo = { status: "sem-crepusculo", inicio: null, fim: null };
  } else {
    resultado.crepusculo = { status: "normal", inicio: instante(ci.minutos), fim: instante(cf.minutos) };
  }

  return resultado;
}

export function coordenadasValidas(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/** "23,55° S, 46,63° O" (pontos cardeais e números no idioma da interface). */
export function formatarCoordenadas(lat, lon) {
  const f = (v) => Math.abs(v).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return `${f(lat)}° ${t(lat >= 0 ? "sol.norte" : "sol.sul")}, ${f(lon)}° ${t(lon >= 0 ? "sol.leste" : "sol.oeste")}`;
}
