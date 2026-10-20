// Idiomas da interface e escolha automática a partir das preferências do
// navegador (navigator.languages). Sem DOM: usado também nos testes.

export const IDIOMA_PADRAO = "pt-BR";

// `intl` é o locale passado ao Intl (datas, números). Em árabe fixamos os
// algarismos latinos para que datas e relógio usem os mesmos dígitos.
export const IDIOMAS = Object.freeze([
  { codigo: "pt-BR", nome: "Português (Brasil)", intl: "pt-BR", dir: "ltr" },
  { codigo: "pt-PT", nome: "Português (Portugal)", intl: "pt-PT", dir: "ltr" },
  { codigo: "en", nome: "English", intl: "en", dir: "ltr" },
  { codigo: "es", nome: "Español", intl: "es", dir: "ltr" },
  { codigo: "fr", nome: "Français", intl: "fr", dir: "ltr" },
  { codigo: "de", nome: "Deutsch", intl: "de", dir: "ltr" },
  { codigo: "it", nome: "Italiano", intl: "it", dir: "ltr" },
  { codigo: "nl", nome: "Nederlands", intl: "nl", dir: "ltr" },
  { codigo: "ru", nome: "Русский", intl: "ru", dir: "ltr" },
  { codigo: "ja", nome: "日本語", intl: "ja", dir: "ltr" },
  { codigo: "zh-CN", nome: "简体中文", intl: "zh-CN", dir: "ltr" },
  { codigo: "ko", nome: "한국어", intl: "ko", dir: "ltr" },
  { codigo: "ar", nome: "العربية", intl: "ar-u-nu-latn", dir: "rtl" },
]);

// Variantes regionais do português que seguem a norma europeia.
const PORTUGUES_EUROPEU = ["PT", "AO", "MZ", "CV", "GW", "ST", "TL", "MO"];

export function infoIdioma(codigo) {
  return IDIOMAS.find((i) => i.codigo === codigo) ?? null;
}

/** Normaliza uma tag BCP 47 para um idioma suportado, ou null. */
export function idiomaDaTag(tag) {
  if (typeof tag !== "string" || !tag.trim()) return null;
  const partes = tag.trim().replace(/_/g, "-").split("-");
  const base = partes[0].toLowerCase();
  const resto = partes.slice(1).map((p) => p.toUpperCase());

  const exato = IDIOMAS.find((i) => i.codigo.toLowerCase() === tag.trim().replace(/_/g, "-").toLowerCase());
  if (exato) return exato.codigo;

  if (base === "pt") return resto.some((r) => PORTUGUES_EUROPEU.includes(r)) ? "pt-PT" : "pt-BR";
  // Chinês: só há a escrita simplificada; leitores do tradicional costumam
  // entendê-la melhor do que um idioma estrangeiro.
  if (base === "zh") return "zh-CN";
  return IDIOMAS.find((i) => i.codigo.toLowerCase() === base)?.codigo ?? null;
}

/** Primeiro idioma suportado da lista de preferências, ou o padrão. */
export function escolherIdioma(preferencias) {
  for (const tag of preferencias ?? []) {
    const codigo = idiomaDaTag(tag);
    if (codigo) return codigo;
  }
  return IDIOMA_PADRAO;
}
