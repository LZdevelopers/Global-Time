// Atalhos de teclado contextuais.
//
// Regras:
//  - nunca disparam enquanto o foco está em campos de texto, selects,
//    áreas editáveis, com uma janela aberta ou com teclas modificadoras
//    (Ctrl/Alt/Meta) — assim não conflitam com atalhos do navegador ou do
//    sistema;
//  - Espaço/Enter não são interceptados quando o foco está num botão ou link,
//    para não quebrar a ativação nativa pelo teclado;
//  - letras valem pelo caractere digitado (respeita AZERTY, QWERTZ…) e, em
//    teclados não latinos (cirílico, árabe, coreano…), pela posição física da
//    tecla (event.code), para que "L" funcione em qualquer layout;
//  - a ajuda abre com H (sem Shift, funciona em teclados compactos), com "?"
//    ou pelos botões "Atalhos de teclado" da página.

import { t } from "../i18n/estado.js";
import { criarDialogo, el } from "./ui.js";

const registrados = [];
let dialogoAjuda = null;

function emCampoEditavel(alvo) {
  if (!(alvo instanceof Element)) return false;
  if (alvo.isContentEditable) return true;
  const tag = alvo.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const tipo = (alvo.getAttribute("type") || "text").toLowerCase();
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color"].includes(tipo);
  }
  return false;
}

/** Tecla normalizada: "espaco", uma letra/símbolo minúsculo ou o nome da tecla. */
export function normalizarTecla({ key, code }) {
  if (key === " " || code === "Space") return "espaco";
  if (typeof key === "string" && key.length === 1) {
    const minuscula = key.toLowerCase();
    if (/^[a-z0-9?+\-]$/.test(minuscula)) return minuscula;
    // Letra de alfabeto não latino: usa a posição física (KeyL → "l").
    const fisica = /^Key([A-Z])$/.exec(code ?? "");
    if (fisica) return fisica[1].toLowerCase();
    return minuscula;
  }
  return key;
}

/**
 * Registra atalhos da página: [{ tecla, teclas?, descricao, acao, habilitado? }].
 *  - `tecla`: "espaco", uma letra ("l") ou um símbolo ("+");
 *  - `descricao`: chave de tradução;
 *  - `teclas`: como aparece na ajuda (padrão: a própria tecla em maiúscula).
 */
export function registrarAtalhos(lista) {
  registrados.push(...lista);
}

const AJUDA = new Set(["?", "h"]);

function aoPressionar(evento) {
  if (evento.defaultPrevented || evento.ctrlKey || evento.metaKey || evento.altKey) return;
  if (document.querySelector("dialog[open]")) return;
  if (emCampoEditavel(evento.target)) return;

  const tecla = normalizarTecla(evento);
  if (AJUDA.has(tecla) && !registrados.some((a) => a.tecla === tecla)) {
    evento.preventDefault();
    abrirAjudaAtalhos();
    return;
  }

  const ativavel = evento.target instanceof Element && evento.target.closest("button, a, summary, [role='button']");
  if (tecla === "espaco" && ativavel) return;

  const atalho = registrados.find((a) => a.tecla === tecla);
  if (!atalho) return;
  if (atalho.habilitado && !atalho.habilitado()) return;
  evento.preventDefault();
  atalho.acao(evento);
}

function rotuloTecla(tecla) {
  if (tecla === "espaco") return t("teclas.espaco");
  return tecla.length === 1 ? tecla.toUpperCase() : tecla;
}

export function abrirAjudaAtalhos() {
  dialogoAjuda?.remove();
  const itens = [
    ...registrados.map((a) => ({ teclas: (a.teclas ?? [a.tecla]).map(rotuloTecla), descricao: t(a.descricao) })),
    { teclas: ["H", "?"], descricao: t("atalhos.ajuda") },
    { teclas: ["Esc"], descricao: t("atalhos.esc") },
  ];
  const lista = el(
    "dl",
    { class: "lista-atalhos" },
    itens.map((item) => el("div", {}, el("dt", {}, item.descricao), el("dd", {}, item.teclas.map((tecla) => el("kbd", {}, tecla))))),
  );
  dialogoAjuda = criarDialogo({
    titulo: t("comum.atalhos"),
    conteudo: [
      registrados.length ? null : el("p", { class: "texto-pequeno texto-suave" }, t("atalhos.semAtalhos")),
      lista,
      el("p", { class: "texto-xs texto-fraco dica-rodape-atalhos" }, t("atalhos.regras")),
    ],
  });
  dialogoAjuda.addEventListener("close", () => {
    dialogoAjuda?.remove();
    dialogoAjuda = null;
  });
  dialogoAjuda.showModal();
}

if (typeof document !== "undefined") document.addEventListener("keydown", aoPressionar);
