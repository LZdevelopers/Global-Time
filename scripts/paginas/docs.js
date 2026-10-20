// Documentação: índice lateral por categorias (gerado a partir do conteúdo),
// busca, índice da seção atual, indicação da seção em leitura, botões de
// copiar nos trechos de código e menu recolhível no celular.
//
// O conteúdo existe em português e em inglês; os demais idiomas mostram a
// versão em inglês com um aviso.

import "../i18n/index.js";
import { idiomaAtual, t } from "../i18n/estado.js";
import { $, $$, copiarTexto, el } from "../nucleo/ui.js";

const portugues = idiomaAtual().startsWith("pt");
const artigos = $$("[data-docs-idioma]");
const artigo = artigos.find((a) => a.dataset.docsIdioma === (portugues ? "pt" : "en")) ?? artigos[0];
for (const a of artigos) a.hidden = a !== artigo;
$("#docsAvisoIdioma").hidden = portugues || idiomaAtual() === "en" || artigo.dataset.docsIdioma !== "en";

const secoes = $$(":scope > .docs__grupo > section[id]", artigo);
const indice = $("#docsIndice");
const toc = $("#docsToc");
const botaoMenu = $("#docsMenu");
const navegacao = $("#docsNavegacao");
const rotuloMenu = $("#docsSecaoAtual");

// ---- Índice lateral -----------------------------------------------------------
const links = new Map();
indice.replaceChildren(
  ...$$(":scope > .docs__grupo", artigo).map((grupo) => {
    const itens = $$(":scope > section[id]", grupo).map((secao) => {
      const link = el("a", { href: `#${secao.id}` }, secao.querySelector("h2").textContent);
      links.set(secao.id, link);
      return el("li", {}, link);
    });
    return el("div", { class: "docs__indice-grupo" }, el("p", { class: "docs__indice-titulo" }, grupo.dataset.grupo), el("ul", {}, itens));
  }),
);

// ---- Seção atual (destaque no índice e índice "Nesta seção") -----------------------
let atual = null;

function marcarAtual(secao) {
  if (!secao || secao === atual) return;
  atual = secao;
  for (const [id, link] of links) {
    if (id === secao.id) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
  rotuloMenu.textContent = secao.querySelector("h2").textContent;
  const subtitulos = $$("h3[id]", secao);
  toc.replaceChildren(
    el(
      "ul",
      {},
      el("li", {}, el("a", { href: `#${secao.id}` }, secao.querySelector("h2").textContent)),
      subtitulos.map((h3) => el("li", { class: "docs__toc-sub" }, el("a", { href: `#${h3.id}` }, h3.textContent))),
    ),
  );
}

// A seção atual é a última cujo topo já passou da faixa de leitura.
function atualizarAtual() {
  const limite = innerHeight * 0.3;
  let escolhida = secoes[0];
  for (const secao of secoes) {
    if (secao.getBoundingClientRect().top <= limite) escolhida = secao;
  }
  marcarAtual(escolhida);
}
let agendado = false;
addEventListener(
  "scroll",
  () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => {
      agendado = false;
      atualizarAtual();
    });
  },
  { passive: true },
);

// ---- Busca ------------------------------------------------------------------------
const normalizar = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const textos = new Map(secoes.map((s) => [s.id, normalizar(s.textContent)]));
const busca = $("#docsBusca");
const resultado = $("#docsResultado");

function filtrar() {
  const termo = normalizar(busca.value.trim());
  let encontrados = 0;
  for (const [id, link] of links) {
    const ok = !termo || textos.get(id).includes(termo);
    link.parentElement.hidden = !ok;
    if (ok) encontrados += 1;
  }
  for (const grupo of $$(".docs__indice-grupo", indice)) {
    grupo.hidden = !$$("li", grupo).some((li) => !li.hidden);
  }
  resultado.textContent = termo ? (encontrados ? t("docs.resultados", { n: encontrados }) : t("docs.nadaEncontrado")) : "";
}

busca.addEventListener("input", filtrar);
busca.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    evento.preventDefault();
    const primeiro = [...links.values()].find((link) => !link.parentElement.hidden);
    primeiro?.click();
  } else if (evento.key === "Escape" && busca.value) {
    evento.preventDefault();
    busca.value = "";
    filtrar();
  }
});

// ---- Menu no celular -----------------------------------------------------------------
function alternarMenu(abrir) {
  botaoMenu.setAttribute("aria-expanded", String(abrir));
  navegacao.classList.toggle("docs__navegacao--aberta", abrir);
}
botaoMenu.addEventListener("click", () => alternarMenu(botaoMenu.getAttribute("aria-expanded") !== "true"));
indice.addEventListener("click", (evento) => {
  if (evento.target.closest("a")) alternarMenu(false);
});

// ---- Copiar código ----------------------------------------------------------------------
for (const bloco of $$("pre", artigo)) {
  const botao = el("button", { type: "button", class: "docs__copiar" }, t("comum.copiar"));
  botao.addEventListener("click", async () => {
    const ok = await copiarTexto(bloco.querySelector("code")?.textContent ?? bloco.textContent);
    botao.textContent = t(ok ? "comum.copiado" : "comum.naoCopiou");
    setTimeout(() => (botao.textContent = t("comum.copiar")), 1600);
  });
  bloco.classList.add("docs__codigo");
  bloco.append(botao);
}

// ---- Âncoras entre idiomas --------------------------------------------------------------
// Links como /docs#sincronizacao funcionam nas duas versões (#en-sincronizacao).
function irParaAncora() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id || artigo.querySelector(`[id="${CSS.escape(id)}"]`)) return;
  const alternativo = artigo.dataset.docsIdioma === "en" ? `en-${id}` : id.replace(/^en-/, "");
  const alvo = artigo.querySelector(`[id="${CSS.escape(alternativo)}"]`);
  if (alvo) {
    history.replaceState(null, "", `#${alternativo}`);
    alvo.scrollIntoView();
  }
}
irParaAncora();
addEventListener("hashchange", irParaAncora);
atualizarAtual();
