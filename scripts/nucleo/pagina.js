// Comportamentos comuns a todas as páginas: idioma, tema, painel de
// ferramentas, ajuda de atalhos e registro do service worker (PWA).

import { idioma, trocarIdioma } from "../i18n/index.js";
import { IDIOMA_PADRAO, prefixoIdioma } from "../i18n/idiomas.js";
import { t } from "../i18n/estado.js";
import { abrirAjudaAtalhos } from "./atalhos.js";
import { avisar } from "./ui.js";

const CHAVE_TEMA = "gt:tema";
const DURACAO_TRANSICAO_TEMA = 320;

function iniciarTema() {
  const botao = document.getElementById("botaoTema");
  if (!botao) return;

  const aplicar = (tema) => {
    const escuro = tema === "dark";
    document.documentElement.dataset.theme = escuro ? "dark" : "light";
    botao.setAttribute("aria-pressed", String(escuro));
    const rotulo = t(escuro ? "comum.temaClaro" : "comum.temaEscuro");
    botao.setAttribute("aria-label", rotulo);
    botao.title = rotulo;
    botao.querySelector("use")?.setAttribute("href", `/assets/icones.svg#${escuro ? "tema-claro" : "tema-escuro"}`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#0b0b0d" : "#ffffff");
  };

  // Transição suave só durante a troca (a classe liga as transições de cor em
  // toda a página e sai logo depois); com movimento reduzido, troca direta.
  let idTransicao = null;
  const trocarComTransicao = (tema) => {
    const raiz = document.documentElement;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raiz.classList.add("tema-em-transicao");
      clearTimeout(idTransicao);
      idTransicao = setTimeout(() => raiz.classList.remove("tema-em-transicao"), DURACAO_TRANSICAO_TEMA);
    }
    aplicar(tema);
  };

  aplicar(document.documentElement.dataset.theme);

  botao.addEventListener("click", () => {
    const proximo = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(CHAVE_TEMA, proximo);
      localStorage.removeItem("brasilTimeTheme");
    } catch {
      /* preferência não persistida */
    }
    trocarComTransicao(proximo);
  });

  window.addEventListener("storage", (evento) => {
    if (evento.key === CHAVE_TEMA && evento.newValue) trocarComTransicao(evento.newValue);
  });
}

function iniciarSeletorIdioma() {
  const seletor = document.getElementById("seletorIdioma");
  if (!seletor) return;
  seletor.value = idioma;
  seletor.addEventListener("change", () => trocarIdioma(seletor.value));
}

function iniciarPainelFerramentas() {
  const botao = document.getElementById("botaoMenu");
  const painel = document.getElementById("painelFerramentas");
  if (!botao || !painel) return;

  let fundo = null;

  const fechar = (devolverFoco = true) => {
    if (painel.hidden) return;
    painel.hidden = true;
    botao.setAttribute("aria-expanded", "false");
    fundo?.remove();
    fundo = null;
    document.removeEventListener("keydown", aoTeclar);
    if (devolverFoco) botao.focus();
  };

  const abrir = () => {
    painel.hidden = false;
    botao.setAttribute("aria-expanded", "true");
    fundo = document.createElement("div");
    fundo.className = "fundo-painel";
    fundo.addEventListener("click", () => fechar());
    painel.after(fundo);
    document.addEventListener("keydown", aoTeclar);
    painel.querySelector("a")?.focus();
  };

  function aoTeclar(evento) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      fechar();
    }
  }

  botao.addEventListener("click", () => (painel.hidden ? abrir() : fechar()));
  // Outros pontos da página que abrem o mesmo menu (ex.: "Todas as ferramentas").
  for (const atalho of document.querySelectorAll("[data-abrir-ferramentas]")) {
    atalho.addEventListener("click", (evento) => {
      evento.stopPropagation();
      if (painel.hidden) abrir();
    });
  }
  painel.addEventListener("focusout", (evento) => {
    if (evento.relatedTarget && !painel.contains(evento.relatedTarget) && evento.relatedTarget !== botao) {
      fechar(false);
    }
  });
}

function iniciarAjudaAtalhos() {
  for (const botao of document.querySelectorAll("[data-abrir-atalhos]")) {
    botao.addEventListener("click", abrirAjudaAtalhos);
  }
}

function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Em desenvolvimento local o SW atrapalha a edição; só registramos em HTTPS
  // de produção ou quando explicitamente pedido com ?sw=1.
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (local && !new URLSearchParams(location.search).has("sw") && !sessionStorageTem("bt:sw")) return;
  if (local) sessionStorageGravar("bt:sw");

  window.addEventListener("load", async () => {
    try {
      const registro = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const oferecerAtualizacao = (trabalhador) => {
        avisar(t("comum.novaVersao"), {
          acao: t("comum.atualizar"),
          duracaoMs: 0,
          aoAgir: () => trabalhador.postMessage({ tipo: "ATIVAR_AGORA" }),
        });
      };

      if (registro.waiting && navigator.serviceWorker.controller) oferecerAtualizacao(registro.waiting);

      // O pré-cache traz as páginas em português; as do idioma em uso são
      // guardadas agora, para também abrirem offline.
      if (idioma !== IDIOMA_PADRAO) {
        navigator.serviceWorker.ready
          .then((pronto) => pronto.active?.postMessage({ tipo: "GUARDAR_IDIOMA", prefixo: prefixoIdioma(idioma) }))
          .catch(() => {});
      }

      registro.addEventListener("updatefound", () => {
        const novo = registro.installing;
        novo?.addEventListener("statechange", () => {
          if (novo.state === "installed" && navigator.serviceWorker.controller) oferecerAtualizacao(novo);
        });
      });

      let recarregando = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (recarregando) return;
        recarregando = true;
        location.reload();
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registro.update().catch(() => {});
      });
    } catch {
      /* sem PWA: o site continua funcionando normalmente */
    }
  });
}

function sessionStorageTem(chave) {
  try {
    return sessionStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}

function sessionStorageGravar(chave) {
  try {
    sessionStorage.setItem(chave, "1");
  } catch {
    /* ignora */
  }
}

function atualizarAno() {
  const ano = String(new Date().getFullYear());
  for (const elemento of document.querySelectorAll("[data-ano-atual]")) elemento.textContent = ano;
}

iniciarTema();
iniciarSeletorIdioma();
atualizarAno();
iniciarPainelFerramentas();
iniciarAjudaAtalhos();
registrarServiceWorker();
