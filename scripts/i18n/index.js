// Idioma da interface no navegador.
//
// 1. Preferência manual salva (seletor de idioma), se houver.
// 2. Senão, o primeiro idioma suportado entre a localidade regional do
//    sistema (Intl) e navigator.languages (ou navigator.language), com
//    português do Brasil como padrão.
//
// O dicionário é carregado antes de qualquer página usar os textos (await no
// nível do módulo). O HTML já vem em português do Brasil; nos demais idiomas
// os elementos marcados com data-i18n são traduzidos aqui.

import { IDIOMA_PADRAO, IDIOMAS, escolherIdioma, infoIdioma } from "./idiomas.js";
import { definirDicionario, t } from "./estado.js";

const CHAVE = "gt:idioma";

function preferenciaSalva() {
  try {
    const valor = localStorage.getItem(CHAVE);
    return infoIdioma(valor) ? valor : null;
  } catch {
    return null;
  }
}

/**
 * Preferências em ordem: a localidade regional do sistema (a do Intl — muda
 * quando a região do aparelho muda, inclusive na simulação de região do
 * DevTools), depois a lista de idiomas do navegador.
 */
function preferenciasDoNavegador() {
  let regional = null;
  try {
    regional = Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    regional = null;
  }
  const lista = navigator.languages?.length ? navigator.languages : [navigator.language];
  return [regional, ...lista].filter(Boolean);
}

export const idioma = preferenciaSalva() ?? escolherIdioma(preferenciasDoNavegador());

if (idioma !== IDIOMA_PADRAO) {
  try {
    const modulo = await import(`./textos/${idioma}.js`);
    definirDicionario(idioma, modulo.default);
  } catch {
    // Sem o arquivo (ex.: offline antes do primeiro cache): fica em português.
  }
}

/** Escolha manual: salva e recarrega para que toda a página mude junto. */
export function trocarIdioma(codigo) {
  if (!infoIdioma(codigo)) return;
  try {
    localStorage.setItem(CHAVE, codigo);
  } catch {
    /* preferência não persistida */
  }
  location.reload();
}

/** true se o usuário escolheu o idioma manualmente. */
export function idiomaManual() {
  return preferenciaSalva() !== null;
}

/**
 * Traduz um trecho do DOM:
 *  - data-i18n="chave"              → textContent (só em elementos-folha);
 *  - data-i18n-attr="title:chave;aria-label:outra" → atributos.
 */
export function traduzirDom(raiz = document) {
  for (const elemento of raiz.querySelectorAll("[data-i18n]")) {
    elemento.textContent = t(elemento.dataset.i18n);
  }
  for (const elemento of raiz.querySelectorAll("[data-i18n-attr]")) {
    for (const par of elemento.dataset.i18nAttr.split(";")) {
      const [atributo, chave] = par.split(":").map((s) => s.trim());
      if (atributo && chave) elemento.setAttribute(atributo, t(chave));
    }
  }
}

const info = infoIdioma(idioma) ?? IDIOMAS[0];
document.documentElement.lang = idioma;
document.documentElement.dir = info.dir;
if (idioma !== IDIOMA_PADRAO) {
  traduzirDom();
  const pagina = document.querySelector('meta[name="gt:pagina"]')?.content;
  if (pagina) document.title = pagina === "inicio" ? t("paginas.inicio.titulo") : `${t(`paginas.${pagina}.titulo`)} | GlobalTime`;
}
document.documentElement.classList.remove("i18n-pendente");
