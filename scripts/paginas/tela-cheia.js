// Relógio em tela cheia / modo quiosque para TVs e monitores.
//
// A Fullscreen API só pode ser acionada por um gesto do usuário. Quando ela
// não existe (ex.: Safari no iPhone) ou é negada, ainda entramos no modo
// quiosque — que esconde cabeçalho e rodapé — dentro da janela atual.

import "../i18n/index.js";
import { t } from "../i18n/estado.js";
import { buscarCidade, nomeCidade, opcoesCidades } from "../dados/cidades.js";
import { BloqueioTela } from "../nucleo/alertas.js";
import { criarRelogioAnalogico } from "../nucleo/analogico.js";
import { ler, gravar } from "../nucleo/armazenamento.js";
import { registrarAtalhos } from "../nucleo/atalhos.js";
import { cidadePreferida, fusoPreferido } from "../nucleo/fuso-preferido.js";
import { lerListaCidades, validarListaCidades } from "../nucleo/fusos.js";
import { ligarIndicador } from "../nucleo/indicador-sincronizacao.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import {
  capitalizar,
  deslocamentoMinutos,
  doisDigitos,
  formatarDataExtenso,
  formatarDiferencaFuso,
  formatarHora,
  outroDia,
  partesNoFuso,
} from "../nucleo/tempo.js";
import { $, $$, agendarPorSegundo, anunciar, avisar, definirTexto, el, icone, preencherSelect } from "../nucleo/ui.js";

const CHAVE = "tela-cheia:ajustes";
const MAX_FUSOS = 3;
const ESPERA_CURSOR_MS = 3000;

const relogio = obterRelogio();
ligarIndicador(relogio, { selo: $("#seloSync") });

// O relógio principal mostra o fuso preferido (o do aparelho ou o escolhido
// na página inicial); os fusos extras mostram a diferença em relação a ele.
const principal = fusoPreferido();
const idPrincipal = cidadePreferida()?.id ?? null;
definirTexto($("#rotuloLugar"), t("telaCheia.horaEm", { lugar: principal.nome }));

// ---- Ajustes: URL tem prioridade sobre o que está salvo -----------------------
const salvo = ler(CHAVE, {}) ?? {};
const parametros = new URLSearchParams(location.search);
const ajustes = {
  modo: ["digital", "analogico"].includes(parametros.get("modo"))
    ? parametros.get("modo")
    : ["digital", "analogico"].includes(salvo.modo)
      ? salvo.modo
      : "digital",
  fusos: parametros.has("fusos")
    ? lerListaCidades(parametros.get("fusos"), MAX_FUSOS)
    : validarListaCidades(salvo.fusos, MAX_FUSOS) ?? ["brasilia", "lisboa", "nova-york"].filter((id) => id !== idPrincipal).slice(0, 2),
};

function persistir() {
  gravar(CHAVE, ajustes);
  const url = new URL(location.href);
  url.searchParams.set("modo", ajustes.modo);
  if (ajustes.fusos.length) url.searchParams.set("fusos", ajustes.fusos.join(","));
  else url.searchParams.delete("fusos");
  history.replaceState(null, "", url);
}

// ---- Relógio ---------------------------------------------------------------------
const elHora = $("#hora");
const segundos = elHora.querySelector(".visor__fracao");
const horasMinutos = document.createTextNode("");
elHora.replaceChildren(horasMinutos, segundos);

const analogico = criarRelogioAnalogico({ rotulo: t("telaCheia.horaEm", { lugar: principal.nome }) });
$("#visorAnalogico").append(analogico.elemento);

let linhasFusos = [];

function renderizarFusos() {
  linhasFusos = ajustes.fusos.map((id) => {
    const cidade = buscarCidade(id);
    const hora = el("div", { class: "visor" }, "--:--");
    const info = el("span");
    return { cidade, hora, info, item: el("div", { class: "quiosque__fuso" }, hora, info) };
  });
  $("#fusosExtras").replaceChildren(...linhasFusos.map((l) => l.item));

  $("#fichasFusos").replaceChildren(
    ...ajustes.fusos.map((id) => {
      const cidade = buscarCidade(id);
      const nome = nomeCidade(cidade);
      return el(
        "li",
        {},
        el(
          "span",
          { class: "ficha" },
          nome,
          el(
            "button",
            {
              type: "button",
              class: "ficha__acao",
              "aria-label": t("telaCheia.remover", { cidade: nome }),
              title: t("comum.remover"),
              onclick: () => {
                ajustes.fusos = ajustes.fusos.filter((f) => f !== id);
                persistir();
                renderizarFusos();
                $("#selectFuso").focus();
                anunciar(t("telaCheia.removida", { cidade: nome }));
              },
            },
            icone("fechar", "icone--sm"),
          ),
        ),
      );
    }),
  );

  preencherSelect($("#selectFuso"), opcoesCidades((c) => !ajustes.fusos.includes(c.id) && c.id !== idPrincipal));
  const cheio = ajustes.fusos.length >= MAX_FUSOS;
  $("#selectFuso").disabled = cheio;
  $("#botaoAdicionarFuso").disabled = cheio;
  atualizar(relogio.agora());
}

let ultimaData = "";
function atualizar(agora) {
  const p = partesNoFuso(agora, principal.fuso);
  horasMinutos.nodeValue = `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`;
  definirTexto(segundos, `:${doisDigitos(p.segundo)}`);
  elHora.setAttribute("datetime", new Date(agora).toISOString());
  if (ajustes.modo === "analogico") analogico.atualizar(p);

  const chave = `${p.ano}-${p.mes}-${p.dia}`;
  if (chave !== ultimaData) {
    ultimaData = chave;
    definirTexto($("#data"), capitalizar(formatarDataExtenso(p)));
  }

  const deslPrincipal = deslocamentoMinutos(agora, principal.fuso);
  for (const linha of linhasFusos) {
    const pf = partesNoFuso(agora, linha.cidade.fuso);
    const diferenca = deslocamentoMinutos(agora, linha.cidade.fuso) - deslPrincipal;
    const relativo = outroDia(pf, p);
    definirTexto(linha.hora, formatarHora(pf, false));
    const partes = [nomeCidade(linha.cidade), diferenca === 0 ? t("telaCheia.mesmoHorario") : formatarDiferencaFuso(diferenca)];
    if (relativo) partes.push(relativo);
    definirTexto(linha.info, partes.join(" · "));
  }
}

// ---- Digital / analógico ------------------------------------------------------------
function definirModo(modo) {
  ajustes.modo = modo;
  const analogicoAtivo = modo === "analogico";
  $("#visorDigital").hidden = analogicoAtivo;
  $("#visorAnalogico").hidden = !analogicoAtivo;
  for (const botao of $$("[data-modo]")) botao.setAttribute("aria-pressed", String(botao.dataset.modo === modo));
  $("#barraModo").textContent = t(analogicoAtivo ? "telaCheia.digital" : "telaCheia.analogico");
  $("#barraModo").setAttribute("aria-label", t(analogicoAtivo ? "telaCheia.mostrarDigital" : "telaCheia.mostrarAnalogico"));
  persistir();
  atualizar(relogio.agora());
}

for (const botao of $$("[data-modo]")) botao.addEventListener("click", () => definirModo(botao.dataset.modo));
$("#barraModo").addEventListener("click", () => definirModo(ajustes.modo === "digital" ? "analogico" : "digital"));

$("#formFuso").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const id = $("#selectFuso").value;
  if (!buscarCidade(id) || ajustes.fusos.includes(id) || ajustes.fusos.length >= MAX_FUSOS) return;
  ajustes.fusos.push(id);
  persistir();
  renderizarFusos();
  anunciar(t("telaCheia.adicionada", { cidade: nomeCidade(buscarCidade(id)) }));
});

// ---- Modo quiosque e tela cheia ---------------------------------------------------
let emQuiosque = false;
let idCursor = null;

const telaCheiaDisponivel = () => Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);

function mostrarCursor() {
  document.body.classList.remove("cursor-oculto");
  clearTimeout(idCursor);
  if (emQuiosque) idCursor = setTimeout(() => document.body.classList.add("cursor-oculto"), ESPERA_CURSOR_MS);
}

async function entrar() {
  emQuiosque = true;
  document.body.classList.add("modo-quiosque");
  mostrarCursor();
  if (telaCheiaDisponivel()) {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      avisar(t("telaCheia.negada"));
    }
  } else {
    avisar(t("telaCheia.indisponivel"), { duracaoMs: 5000 });
  }
  $("#barraSair").focus();
  anunciar(t("telaCheia.ativado"));
}

async function sair() {
  emQuiosque = false;
  clearTimeout(idCursor);
  document.body.classList.remove("modo-quiosque", "cursor-oculto");
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      /* já saiu */
    }
  }
  $("#botaoEntrar").focus();
}

// Esc na tela cheia é consumido pelo navegador: tratamos pela mudança de estado.
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && emQuiosque) sair();
});

$("#botaoEntrar").addEventListener("click", entrar);
$("#barraSair").addEventListener("click", sair);
for (const evento of ["mousemove", "pointerdown", "touchstart", "keydown"]) {
  document.addEventListener(evento, () => emQuiosque && mostrarCursor(), { passive: true });
}

registrarAtalhos([
  { tecla: "f", descricao: "telaCheia.atalho.f", acao: () => (emQuiosque ? sair() : entrar()) },
  {
    tecla: "m",
    descricao: "telaCheia.atalho.m",
    acao: () => definirModo(ajustes.modo === "digital" ? "analogico" : "digital"),
  },
  { tecla: "Escape", teclas: ["Esc"], descricao: "telaCheia.atalho.esc", habilitado: () => emQuiosque, acao: sair },
]);

// ---- Manter a tela ligada ------------------------------------------------------------
const bloqueio = new BloqueioTela();
const caixaManter = $("#manterTela");
const estadoManter = $("#estadoManterTela");
if (!BloqueioTela.disponivel()) {
  caixaManter.disabled = true;
  estadoManter.textContent = t("avisos.tela.naoSuportado");
}
caixaManter.addEventListener("change", async () => {
  if (caixaManter.checked) {
    const ok = await bloqueio.ativar();
    if (!ok) {
      caixaManter.checked = false;
      avisar(t("telaCheia.naoManteve"));
    }
  } else {
    await bloqueio.desativar();
  }
});
bloqueio.addEventListener("mudanca", (evento) => {
  if (!BloqueioTela.disponivel()) return;
  estadoManter.textContent = evento.detail.ativo
    ? t("telaCheia.manterAtivo")
    : evento.detail.desejado
      ? t("telaCheia.manterPausado")
      : t("telaCheia.manterAjuda");
});

// ---- Início ---------------------------------------------------------------------
renderizarFusos();
definirModo(ajustes.modo);
const agendador = agendarPorSegundo(atualizar, () => relogio.agora());
relogio.addEventListener("estado", () => agendador.agora());
