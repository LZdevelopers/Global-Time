// Conversor de timestamp Unix: valor atual (relógio sincronizado),
// timestamp → data e data → timestamp em qualquer fuso. O fuso de referência
// é o preferido (o do aparelho ou o escolhido na página inicial).

import "../i18n/index.js";
import { t } from "../i18n/estado.js";
import {
  civilParaTimestamp,
  formatarIsoNoFuso,
  formatarRelativo,
  formatarRfc2822,
  lerTimestamp,
} from "../nucleo/calculos.js";
import { fusoPreferido } from "../nucleo/fuso-preferido.js";
import { ligarIndicador } from "../nucleo/indicador-sincronizacao.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import {
  FUSO_BRASILIA,
  capitalizar,
  dataIso,
  deslocamentoMinutos,
  formatarDataCurta,
  formatarDataExtenso,
  formatarDeslocamento,
  formatarHora,
  lerDataIso,
  lerHora,
  partesNoFuso,
} from "../nucleo/tempo.js";
import { $, $$, avisar, copiarTexto, criarLacoQuadros, definirTexto, el, icone, preencherSelect } from "../nucleo/ui.js";
import { CIDADES, opcoesCidades } from "../dados/cidades.js";

const relogio = obterRelogio();
ligarIndicador(relogio, { selo: $("#seloSync") });
const preferido = fusoPreferido();

async function copiar(valor) {
  avisar((await copiarTexto(valor)) ? t("timestamp.copiado", { valor }) : t("comum.naoCopiou"));
}

/** Lista de formatos: cada valor com um botão de copiar ao lado. */
function linhas(lista, pares) {
  lista.replaceChildren(
    ...pares.map(([dt, dd]) =>
      el(
        "div",
        {},
        el("dt", {}, dt),
        el(
          "dd",
          {},
          el("span", { class: "ts-formatos__valor" }, dd),
          el(
            "button",
            {
              type: "button",
              class: "botao botao--fantasma botao--icone botao--mini",
              "aria-label": t("timestamp.copiarValor", { rotulo: dt }),
              title: t("comum.copiar"),
              dataset: { valor: dd },
            },
            icone("copiar", "icone--sm"),
          ),
        ),
      ),
    ),
  );
}

for (const lista of $$(".ts-formatos")) {
  lista.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-valor]");
    if (botao) copiar(botao.dataset.valor);
  });
}

function mostrarErro(elemento, texto) {
  elemento.hidden = !texto;
  elemento.textContent = texto ?? "";
}

function descreverNoFuso(ms, fuso) {
  const p = partesNoFuso(ms, fuso);
  return `${capitalizar(formatarDataExtenso(p))}, ${formatarHora(p)} (${formatarDeslocamento(deslocamentoMinutos(ms, fuso))})`;
}

// ---- Agora -------------------------------------------------------------------
const agoraSegundos = $("#agoraSegundos");
const agoraMs = $("#agoraMs");
let ultimaPintura = 0;
const laco = criarLacoQuadros((instante) => {
  // ~10 atualizações por segundo bastam para a leitura.
  if (instante - ultimaPintura < 100) return;
  ultimaPintura = instante;
  const agora = Math.floor(relogio.agora());
  definirTexto(agoraSegundos, String(Math.floor(agora / 1000)));
  definirTexto(agoraMs, String(agora));
});
laco.iniciar();

for (const botao of $$("[data-copiar-agora]")) {
  botao.addEventListener("click", () => {
    const agora = Math.floor(relogio.agora());
    copiar(botao.dataset.copiarAgora === "s" ? String(Math.floor(agora / 1000)) : String(agora));
  });
}

// ---- Timestamp → data ----------------------------------------------------------
const tsEntrada = $("#tsEntrada");
const tsUnidade = $("#tsUnidade");
definirTexto($("#tsRotulo"), `${preferido.nome} · ${formatarDeslocamento(deslocamentoMinutos(relogio.agora(), preferido.fuso))}`);

function converterTimestamp() {
  const r = lerTimestamp(tsEntrada.value, tsUnidade.value);
  if (r.erro) {
    tsEntrada.setAttribute("aria-invalid", "true");
    $("#tsResultado").textContent = "—";
    linhas($("#tsDetalhes"), []);
    mostrarErro($("#tsErro"), t(`timestamp.erro.${r.erro}`));
    return;
  }
  tsEntrada.removeAttribute("aria-invalid");
  mostrarErro($("#tsErro"), null);
  const { ms } = r;
  const p = partesNoFuso(ms, preferido.fuso);
  $("#tsResultado").textContent = `${formatarHora(p)} · ${formatarDataCurta(p)}`;
  const unidade = t(r.unidade === "ms" ? "timestamp.unidadeMilissegundos" : "timestamp.unidadeSegundos");
  const pares = [
    [t("timestamp.campo.unidade"), r.detectada ? t("timestamp.unidadeDetectada", { unidade }) : unidade],
    [preferido.nome, descreverNoFuso(ms, preferido.fuso)],
  ];
  if (preferido.fuso !== FUSO_BRASILIA) pares.push(["Brasília", descreverNoFuso(ms, FUSO_BRASILIA)]);
  pares.push(
    ["UTC", descreverNoFuso(ms, "UTC")],
    ["ISO 8601 (UTC)", new Date(ms).toISOString()],
    [`ISO 8601 (${preferido.nome})`, formatarIsoNoFuso(ms, preferido.fuso)],
    [`RFC 2822 (${preferido.nome})`, formatarRfc2822(ms, preferido.fuso)],
    ["HTTP-date (UTC)", new Date(ms).toUTCString()],
    [t("timestamp.campo.relativo"), formatarRelativo(ms, relogio.agora())],
    [t("timestamp.campo.segundos"), String(Math.floor(ms / 1000))],
    [t("timestamp.campo.milissegundos"), String(ms)],
  );
  linhas($("#tsDetalhes"), pares);
}

tsEntrada.addEventListener("input", converterTimestamp);
tsUnidade.addEventListener("change", converterTimestamp);
$("#tsAgora").addEventListener("click", () => {
  tsEntrada.value = String(Math.floor(relogio.agora() / 1000));
  tsUnidade.value = "auto";
  converterTimestamp();
});
$("#formParaData").addEventListener("submit", (e) => e.preventDefault());
tsEntrada.value = String(Math.floor(relogio.agora() / 1000));
converterTimestamp();

// ---- Data → timestamp ----------------------------------------------------------
const dtData = $("#dtData");
const dtHora = $("#dtHora");
const dtFuso = $("#dtFuso");

const principais = t("timestamp.principais");
const opcoesFuso = [
  { valor: `fuso:${preferido.fuso}`, rotulo: `${preferido.nome} (${preferido.fuso})`, grupo: principais },
  ...(preferido.fuso !== FUSO_BRASILIA
    ? [{ valor: `fuso:${FUSO_BRASILIA}`, rotulo: `Brasília (${FUSO_BRASILIA})`, grupo: principais }]
    : []),
  ...(preferido.fuso !== "UTC" ? [{ valor: "fuso:UTC", rotulo: "UTC", grupo: principais }] : []),
  ...opcoesCidades((c) => c.fuso !== preferido.fuso && c.fuso !== FUSO_BRASILIA).map((o) => ({ ...o, valor: `cidade:${o.valor}` })),
];
preencherSelect(dtFuso, opcoesFuso, `fuso:${preferido.fuso}`);

function fusoSelecionado() {
  const [tipo, valor] = dtFuso.value.split(/:(.+)/);
  if (tipo === "cidade") return CIDADES.find((c) => c.id === valor)?.fuso ?? preferido.fuso;
  return valor || preferido.fuso;
}

const hoje = partesNoFuso(relogio.agora(), preferido.fuso);
dtData.value = dataIso(hoje.ano, hoje.mes, hoje.dia);

let segundosAtuais = null;

function converterData() {
  const data = lerDataIso(dtData.value);
  const hora = lerHora(dtHora.value || "00:00");
  const aviso = $("#dtAviso");
  aviso.hidden = true;
  segundosAtuais = null;
  if (!data || !hora) {
    $("#dtResultado").textContent = "—";
    linhas($("#dtDetalhes"), []);
    mostrarErro($("#dtErro"), t(!data ? "timestamp.erro.data" : "timestamp.erro.hora"));
    return;
  }
  const fuso = fusoSelecionado();
  const r = civilParaTimestamp({ ...data, ...hora }, fuso);
  if (r.erro) {
    mostrarErro($("#dtErro"), t(`timestamp.erro.${r.erro}`));
    return;
  }
  mostrarErro($("#dtErro"), null);
  const ms = r.instantes[0];
  segundosAtuais = String(Math.floor(ms / 1000));
  $("#dtResultado").textContent = segundosAtuais;
  linhas($("#dtDetalhes"), [
    [t("timestamp.campo.milissegundos"), String(ms)],
    ["ISO 8601 (UTC)", new Date(ms).toISOString()],
    [t("timestamp.campo.isoNoFuso"), formatarIsoNoFuso(ms, fuso)],
    [t("timestamp.campo.fuso"), `${fuso} (${formatarDeslocamento(deslocamentoMinutos(ms, fuso))})`],
  ]);

  if (r.situacao === "ambigua") {
    const segundo = r.instantes[1];
    aviso.hidden = false;
    aviso.textContent = t("timestamp.avisoAmbigua", { segundos: String(Math.floor(segundo / 1000)), iso: formatarIsoNoFuso(segundo, fuso) });
  } else if (r.situacao === "inexistente") {
    aviso.hidden = false;
    aviso.textContent = t("timestamp.avisoInexistente", { iso: formatarIsoNoFuso(ms, fuso) });
  }
}

for (const campo of [dtData, dtHora, dtFuso]) {
  campo.addEventListener("input", converterData);
  campo.addEventListener("change", converterData);
}
$("#formParaTs").addEventListener("submit", (e) => e.preventDefault());
$("#dtCopiar").addEventListener("click", () => {
  if (!segundosAtuais) {
    avisar(t("calc.semResultado"));
    return;
  }
  copiar(segundosAtuais);
});
converterData();
