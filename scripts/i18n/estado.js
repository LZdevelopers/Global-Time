// Dicionário ativo e função de tradução `t`. Começa em português do Brasil;
// scripts/i18n/index.js troca o dicionário no navegador antes de qualquer
// página usar os textos. Sem DOM nem armazenamento: funciona nos testes.
//
// Regra: nunca chamar t() no nível de módulo — só dentro de funções —, para
// que o texto saia sempre no idioma já carregado.

import ptBR from "./textos/pt-BR.js";
import { IDIOMA_PADRAO, caminhoNoIdioma, infoIdioma } from "./idiomas.js";

let codigoAtual = IDIOMA_PADRAO;
let dicionario = ptBR;
let localeIntl = "pt-BR";
const regrasPlural = new Map();
const formatosNumero = new Map();

export function definirDicionario(codigo, novo) {
  codigoAtual = codigo;
  dicionario = novo ?? ptBR;
  localeIntl = infoIdioma(codigo)?.intl ?? codigo;
}

/** Código do idioma da interface (ex.: "pt-BR", "en", "zh-CN"). */
export function idiomaAtual() {
  return codigoAtual;
}

/** Caminho de uma página do site no idioma atual ("/docs" → "/en/docs"). */
export function urlLocal(caminho) {
  const texto = String(caminho);
  const corte = texto.search(/[?#]/);
  const base = corte < 0 ? texto : texto.slice(0, corte);
  return `${caminhoNoIdioma(base, codigoAtual)}${corte < 0 ? "" : texto.slice(corte)}`;
}

/** Locale para Intl (datas e números). */
export function locale() {
  return localeIntl;
}

function regraPlural() {
  if (!regrasPlural.has(localeIntl)) regrasPlural.set(localeIntl, new Intl.PluralRules(localeIntl));
  return regrasPlural.get(localeIntl);
}

/** Número formatado no idioma atual (separador de milhar e decimal). */
export function numero(valor, opcoes) {
  const chave = `${localeIntl}|${JSON.stringify(opcoes ?? {})}`;
  if (!formatosNumero.has(chave)) formatosNumero.set(chave, new Intl.NumberFormat(localeIntl, opcoes));
  return formatosNumero.get(chave).format(valor);
}

/**
 * Texto traduzido. Parâmetros entram como {nome}; números são formatados no
 * idioma. Entradas com formas de plural ({ one, other, … }) escolhem a forma
 * pelo parâmetro `n`.
 */
export function t(chave, parametros = {}) {
  let valor = dicionario[chave] ?? ptBR[chave];
  if (valor == null) return chave;
  if (typeof valor === "object") {
    const n = Number(parametros.n ?? 0);
    let forma = regraPlural().select(n);
    // Em pt-BR o CLDR trata 0 como singular ("0 dia"); o uso corrente é "0 dias".
    if (n === 0 && codigoAtual === "pt-BR") forma = "other";
    valor = valor[forma] ?? valor.other ?? "";
  }
  return valor.replace(/\{(\w+)\}/g, (marca, nome) => {
    const v = parametros[nome];
    if (v == null) return marca;
    return typeof v === "number" ? numero(v) : String(v);
  });
}

/** Separador decimal do idioma ("," em português, "." em inglês…). */
export function separadorDecimal() {
  return numero(1.5).replace(/\d/g, "") || ",";
}

/** true se a chave existe no dicionário de referência. */
export function existe(chave) {
  return chave in ptBR;
}
