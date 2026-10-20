// Utilidades de interface compartilhadas pelas páginas.
// Todo texto vindo de dados ou do usuário entra no DOM via textContent;
// nada aqui monta HTML a partir de strings.

import { t } from "../i18n/estado.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Cria um elemento: el("button", { class: "botao", onclick }, "Texto", outroNo) */
export function el(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos ?? {})) {
    if (valor == null || valor === false) continue;
    if (chave.startsWith("on") && typeof valor === "function") {
      elemento.addEventListener(chave.slice(2), valor);
    } else if (chave === "class") {
      elemento.className = valor;
    } else if (chave === "dataset") {
      Object.assign(elemento.dataset, valor);
    } else if (chave in elemento && typeof valor !== "string") {
      elemento[chave] = valor;
    } else {
      elemento.setAttribute(chave, valor === true ? "" : String(valor));
    }
  }
  anexar(elemento, filhos);
  return elemento;
}

function anexar(pai, filhos) {
  for (const filho of filhos.flat(Infinity)) {
    if (filho == null || filho === false) continue;
    pai.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
}

/** Ícone do sprite /assets/icones.svg. */
export function icone(nome, classe = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", `icone ${classe}`.trim());
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const uso = document.createElementNS(SVG_NS, "use");
  uso.setAttribute("href", `/assets/icones.svg#${nome}`);
  svg.append(uso);
  return svg;
}

/** Troca o ícone de um <svg><use> já existente. */
export function trocarIcone(svg, nome) {
  svg?.querySelector("use")?.setAttribute("href", `/assets/icones.svg#${nome}`);
}

export function $(seletor, raiz = document) {
  return raiz.querySelector(seletor);
}

export function $$(seletor, raiz = document) {
  return [...raiz.querySelectorAll(seletor)];
}

/** Altera texto só quando mudou — evita trabalho de layout desnecessário. */
export function definirTexto(elemento, texto) {
  if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
}

// ---- Anúncios para leitores de tela --------------------------------------

let regiaoViva = null;

/** Anuncia uma mensagem para tecnologias assistivas (aria-live). */
export function anunciar(texto, prioridade = "polite") {
  if (!regiaoViva) {
    regiaoViva = el("div", { class: "sr-only", "aria-live": "polite", "aria-atomic": "true" });
    document.body.append(regiaoViva);
  }
  regiaoViva.setAttribute("aria-live", prioridade);
  regiaoViva.textContent = "";
  // Pequeno atraso para que leitores de tela percebam a troca.
  setTimeout(() => {
    regiaoViva.textContent = texto;
  }, 60);
}

// ---- Avisos flutuantes ---------------------------------------------------

let pilhaAvisos = null;

export function avisar(texto, { acao, aoAgir, duracaoMs = 4000 } = {}) {
  if (!pilhaAvisos) {
    pilhaAvisos = el("div", { class: "avisos-flutuantes", role: "status", "aria-live": "polite" });
    document.body.append(pilhaAvisos);
  }
  const aviso = el("div", { class: "aviso-flutuante" }, el("span", {}, texto));
  const remover = () => aviso.remove();
  if (acao) {
    aviso.append(
      el("button", { type: "button", class: "botao", onclick: () => { remover(); aoAgir?.(); } }, acao),
    );
  }
  pilhaAvisos.append(aviso);
  if (duracaoMs > 0) setTimeout(remover, duracaoMs);
  return remover;
}

// ---- Área de transferência e downloads -----------------------------------

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Alternativa para contextos sem a API de clipboard.
    const area = el("textarea", { class: "sr-only", readonly: true });
    area.value = texto;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export function baixarArquivo(nome, conteudo, tipo = "text/plain;charset=utf-8") {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: nome, class: "sr-only" });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Diálogos --------------------------------------------------------------

/** Cria um <dialog> padrão. `conteudo` é um nó ou lista de nós. */
export function criarDialogo({ titulo, conteudo, acoes = [], classe = "", rotuloFechar = t("comum.fechar") }) {
  const idTitulo = `dlg-${Math.random().toString(36).slice(2, 8)}`;
  const dialogo = el(
    "dialog",
    { class: `dialogo ${classe}`.trim(), "aria-labelledby": idTitulo },
    el(
      "div",
      { class: "dialogo__corpo" },
      el(
        "div",
        { class: "dialogo__cabecalho" },
        el("h2", { id: idTitulo }, titulo),
        el(
          "button",
          {
            type: "button",
            class: "botao botao--fantasma botao--icone botao--pequeno",
            "aria-label": rotuloFechar,
            onclick: () => dialogo.close("cancelar"),
          },
          icone("fechar"),
        ),
      ),
      conteudo,
      acoes.length ? el("div", { class: "dialogo__acoes" }, acoes) : null,
    ),
  );
  // Clique no fundo fecha o diálogo.
  dialogo.addEventListener("click", (evento) => {
    if (evento.target === dialogo) dialogo.close("cancelar");
  });
  document.body.append(dialogo);
  return dialogo;
}

/** Confirmação acessível. Resolve true/false. */
export function confirmar({ titulo, mensagem, confirmar: rotuloOk = t("comum.confirmar"), cancelar = t("comum.cancelar"), perigo = false }) {
  return new Promise((resolver) => {
    const botaoOk = el("button", { type: "button", class: `botao ${perigo ? "botao--perigo" : "botao--primario"}` }, rotuloOk);
    const botaoCancelar = el("button", { type: "button", class: "botao botao--secundario" }, cancelar);
    const dialogo = criarDialogo({
      titulo,
      conteudo: el("p", { class: "texto-suave" }, mensagem),
      acoes: [botaoCancelar, botaoOk],
    });
    botaoOk.addEventListener("click", () => dialogo.close("ok"));
    botaoCancelar.addEventListener("click", () => dialogo.close("cancelar"));
    dialogo.addEventListener("close", () => {
      resolver(dialogo.returnValue === "ok");
      dialogo.remove();
    });
    dialogo.showModal();
    botaoCancelar.focus();
  });
}

// ---- Agendamento de atualizações ---------------------------------------

/**
 * Chama `callback` logo após cada virada de segundo do relógio `obterAgora`.
 * Usa setTimeout recalculado a cada chamada (não setInterval), então não
 * acumula atraso. Quando a aba volta a ficar visível, atualiza na hora.
 */
export function agendarPorSegundo(callback, obterAgora = () => Date.now()) {
  let id = null;
  let ativo = true;

  const executar = () => {
    if (!ativo) return;
    clearTimeout(id);
    const agora = obterAgora();
    callback(agora);
    // +8 ms garante que já estamos do outro lado da virada do segundo.
    const espera = 1000 - (((agora % 1000) + 1000) % 1000) + 8;
    id = setTimeout(executar, espera);
  };

  const aoMudarVisibilidade = () => {
    if (document.visibilityState === "visible") executar();
  };
  document.addEventListener("visibilitychange", aoMudarVisibilidade);
  executar();

  return {
    agora: executar,
    parar() {
      ativo = false;
      clearTimeout(id);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    },
  };
}

/**
 * Laço de quadros com requestAnimationFrame. O navegador pausa o laço em abas
 * ocultas (economiza bateria); ao voltar, ele retoma sozinho.
 */
export function criarLacoQuadros(callback) {
  let id = null;
  const quadro = (t) => {
    id = requestAnimationFrame(quadro);
    callback(t);
  };
  return {
    iniciar() {
      if (id == null) id = requestAnimationFrame(quadro);
    },
    parar() {
      if (id != null) cancelAnimationFrame(id);
      id = null;
    },
    get ativo() {
      return id != null;
    },
  };
}

/** Atualiza document.title mantendo o nome base da página. */
export function criarTitulo() {
  const base = document.title;
  return (prefixo) => {
    const novo = prefixo ? `${prefixo} · ${base}` : base;
    if (document.title !== novo) document.title = novo;
  };
}

/** Cria as <option> de um <select> a partir de [{ valor, rotulo, grupo? }]. */
export function preencherSelect(select, opcoes, selecionado) {
  select.replaceChildren();
  const grupos = new Map();
  for (const opcao of opcoes) {
    const item = el("option", { value: opcao.valor }, opcao.rotulo);
    if (opcao.valor === selecionado) item.selected = true;
    if (opcao.grupo) {
      if (!grupos.has(opcao.grupo)) {
        const grupo = el("optgroup", { label: opcao.grupo });
        grupos.set(opcao.grupo, grupo);
        select.append(grupo);
      }
      grupos.get(opcao.grupo).append(item);
    } else {
      select.append(item);
    }
  }
}
