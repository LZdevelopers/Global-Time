// Idioma da interface no navegador.
//
// Cada página indexável existe já traduzida no próprio endereço (/cronometro
// em português do Brasil, /en/cronometro em inglês…), gerada por
// dev/gerar.mjs; o idioma é o do HTML (<html lang>). A escolha automática na
// primeira visita é feita pela Vercel (vercel.json), pelo Accept-Language,
// antes de a página carregar.
//
// As páginas 404 e offline respondem por qualquer endereço e são traduzidas
// aqui: idioma do prefixo da URL, senão a preferência salva, senão o do
// navegador (Intl e navigator.languages).
//
// A escolha manual fica no cookie gt_idioma (lido pela Vercel para levar à
// versão certa) e em localStorage.

import { IDIOMA_PADRAO, IDIOMAS, caminhoNoIdioma, escolherIdioma, idiomaDoCaminho, infoIdioma } from "./idiomas.js";
import { definirDicionario, t } from "./estado.js";

const CHAVE = "gt:idioma";
const COOKIE = "gt_idioma";
const UM_ANO_S = 365 * 24 * 60 * 60;

function preferenciaSalva() {
  try {
    const valor = localStorage.getItem(CHAVE);
    return infoIdioma(valor) ? valor : null;
  } catch {
    return null;
  }
}

function cookieIdioma() {
  const par = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
  const valor = par ? decodeURIComponent(par.slice(COOKIE.length + 1)) : null;
  return infoIdioma(valor) ? valor : null;
}

function gravarPreferencia(codigo) {
  try {
    localStorage.setItem(CHAVE, codigo);
  } catch {
    /* preferência não persistida */
  }
  const seguro = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(codigo)}; Path=/; Max-Age=${UM_ANO_S}; SameSite=Lax${seguro}`;
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

const paginaAtual = document.querySelector('meta[name="gt:pagina"]')?.content;
// 404 e offline: o mesmo HTML (em português) para qualquer endereço.
const paginaGenerica = paginaAtual === "404" || paginaAtual === "offline";
const idiomaDoHtml = infoIdioma(document.documentElement.lang)?.codigo ?? IDIOMA_PADRAO;

export const idioma = paginaGenerica
  ? (idiomaDoCaminho(location.pathname) ?? preferenciaSalva() ?? escolherIdioma(preferenciasDoNavegador()))
  : idiomaDoHtml;

// Preferência salva por uma versão anterior do site (só em localStorage):
// vira cookie, para a Vercel passar a respeitá-la, e leva uma única vez à
// versão no idioma escolhido.
const salva = preferenciaSalva();
if (salva && !cookieIdioma()) {
  gravarPreferencia(salva);
  if (!paginaGenerica && salva !== idioma && !idiomaDoCaminho(location.pathname)) {
    location.replace(caminhoNoIdioma(location.pathname, salva) + location.search + location.hash);
  }
}

if (idioma !== IDIOMA_PADRAO) {
  try {
    const modulo = await import(`./textos/${idioma}.js`);
    definirDicionario(idioma, modulo.default);
  } catch {
    // Sem o arquivo (ex.: offline antes do primeiro cache): fica em português.
  }
}

/** Escolha manual: salva e abre a mesma página no idioma escolhido. */
export function trocarIdioma(codigo) {
  if (!infoIdioma(codigo)) return;
  gravarPreferencia(codigo);
  if (paginaGenerica) {
    location.reload();
    return;
  }
  location.assign(caminhoNoIdioma(location.pathname, codigo) + location.search + location.hash);
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
// Só 404/offline chegam aqui num idioma diferente do HTML.
if (idioma !== idiomaDoHtml) {
  traduzirDom();
  if (paginaAtual) document.title = `${t(`paginas.${paginaAtual}.titulo`)} | GlobalTime`;
}
document.documentElement.classList.remove("i18n-pendente");
