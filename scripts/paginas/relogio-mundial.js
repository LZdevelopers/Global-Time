// Relógio mundial: lista de cidades escolhida pelo usuário, com a diferença
// em relação ao fuso preferido (o do aparelho ou o escolhido na página
// inicial) e indicação aproximada de horário comercial. Começa com poucas
// cidades: a do fuso preferido, Brasília, Lisboa e Nova York.

import "../i18n/index.js";
import { t } from "../i18n/estado.js";
import { CIDADES_FUSOS_BRASIL, buscarCidade, nomeCidade, nomePais, opcoesCidades } from "../dados/cidades.js";
import { ler, gravar } from "../nucleo/armazenamento.js";
import { cidadePreferida, fusoPreferido } from "../nucleo/fuso-preferido.js";
import { emHorarioComercial, validarListaCidades } from "../nucleo/fusos.js";
import { ligarIndicador } from "../nucleo/indicador-sincronizacao.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import {
  deslocamentoMinutos,
  formatarDeslocamento,
  formatarDiferencaFuso,
  formatarHora,
  nomeDiaSemana,
  outroDia,
  partesNoFuso,
} from "../nucleo/tempo.js";
import { $, agendarPorSegundo, anunciar, definirTexto, el, icone, preencherSelect } from "../nucleo/ui.js";

const CHAVE = "mundial:cidades";
const LIMITE_PADRAO = 4;
const relogio = obterRelogio();
const referencia = fusoPreferido();
ligarIndicador(relogio, { selo: $("#seloSync") });

// Lista inicial: a cidade do fuso preferido, Brasília e duas referências
// comuns, sem repetir.
function listaPadrao() {
  const ids = [cidadePreferida()?.id, "brasilia", "lisboa", "nova-york"].filter(Boolean);
  return [...new Set(ids)].slice(0, LIMITE_PADRAO);
}

let cidades = validarListaCidades(ler(CHAVE)) ?? listaPadrao();
let linhasCidades = [];

// ---- Lista de cidades ------------------------------------------------------
function salvar() {
  gravar(CHAVE, cidades);
}

function atualizarSelect() {
  preencherSelect(
    $("#selectCidade"),
    opcoesCidades((c) => !cidades.includes(c.id)),
  );
}

function mover(id, passo) {
  const i = cidades.indexOf(id);
  const j = i + passo;
  if (i < 0 || j < 0 || j >= cidades.length) return;
  [cidades[i], cidades[j]] = [cidades[j], cidades[i]];
  salvar();
  renderizarCidades();
  // Mantém o foco no mesmo botão após reordenar.
  $(`[data-mover="${passo}"][data-id="${id}"]`)?.focus();
}

function remover(id) {
  const cidade = buscarCidade(id);
  const indice = cidades.indexOf(id);
  cidades = cidades.filter((c) => c !== id);
  salvar();
  renderizarCidades();
  atualizarSelect();
  anunciar(t("mundial.removida", { cidade: cidade ? nomeCidade(cidade) : t("mundial.cidade") }));
  const proximo = $$botoesRemover()[Math.min(indice, cidades.length - 1)];
  (proximo ?? $("#selectCidade")).focus();
}

function $$botoesRemover() {
  return [...document.querySelectorAll("[data-remover]")];
}

function botaoAcao({ rotulo, titulo, disabled, dataset, onclick, nomeIcone, classeIcone }) {
  return el(
    "button",
    { type: "button", class: "botao botao--fantasma botao--icone botao--mini", "aria-label": rotulo, title: titulo, disabled, dataset, onclick },
    icone(nomeIcone, classeIcone),
  );
}

function renderizarCidades() {
  const lista = $("#listaCidades");
  linhasCidades = cidades.map((id, indice) => {
    const cidade = buscarCidade(id);
    const nome = nomeCidade(cidade);
    const hora = el("span", { class: "visor" }, "--:--:--");
    const dia = el("span", { class: "cidade__dia" });
    const diferenca = el("span");
    const comercial = el("span", { class: "cidade__comercial" });
    const item = el(
      "li",
      { class: "cidade" },
      el(
        "div",
        { class: "cidade__texto" },
        el("div", { class: "cidade__nome" }, nome),
        el(
          "div",
          { class: "cidade__info" },
          el("span", {}, cidade.uf ? `${cidade.uf}, ${nomePais(cidade)}` : nomePais(cidade)),
          diferenca,
          comercial,
        ),
      ),
      el("div", { class: "cidade__hora" }, hora, dia),
      el(
        "div",
        { class: "cidade__acoes" },
        botaoAcao({
          rotulo: t("mundial.moverCima", { cidade: nome }),
          titulo: t("mundial.moverCimaCurto"),
          disabled: indice === 0,
          dataset: { mover: "-1", id },
          onclick: () => mover(id, -1),
          nomeIcone: "anterior",
          classeIcone: "icone--sm icone--girado",
        }),
        botaoAcao({
          rotulo: t("mundial.moverBaixo", { cidade: nome }),
          titulo: t("mundial.moverBaixoCurto"),
          disabled: indice === cidades.length - 1,
          dataset: { mover: "1", id },
          onclick: () => mover(id, 1),
          nomeIcone: "proximo",
          classeIcone: "icone--sm icone--girado",
        }),
        botaoAcao({
          rotulo: t("mundial.remover", { cidade: nome }),
          titulo: t("comum.remover"),
          dataset: { remover: id },
          onclick: () => remover(id),
          nomeIcone: "fechar",
          classeIcone: "icone--sm",
        }),
      ),
    );
    return { cidade, item, hora, dia, diferenca, comercial };
  });
  lista.replaceChildren(...linhasCidades.map((l) => l.item));
  lista.hidden = cidades.length === 0;
  $("#vazioCidades").hidden = cidades.length > 0;
  atualizar(relogio.agora());
}

$("#formAdicionar").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const id = $("#selectCidade").value;
  const erro = $("#erroAdicionar");
  if (!buscarCidade(id) || cidades.includes(id)) {
    erro.textContent = t("mundial.jaNaLista");
    erro.hidden = false;
    return;
  }
  erro.hidden = true;
  cidades.push(id);
  salvar();
  renderizarCidades();
  atualizarSelect();
  anunciar(t("mundial.adicionada", { cidade: nomeCidade(buscarCidade(id)) }));
});

$("#botaoFusosBrasil").addEventListener("click", () => {
  const novas = CIDADES_FUSOS_BRASIL.filter((id) => !cidades.includes(id));
  if (!novas.length) {
    anunciar(t("mundial.fusosBrasilJa"));
    return;
  }
  cidades.push(...novas);
  salvar();
  renderizarCidades();
  atualizarSelect();
  anunciar(t("mundial.fusosBrasilAdicionados"));
});

$("#botaoRestaurar").addEventListener("click", () => {
  cidades = listaPadrao();
  salvar();
  renderizarCidades();
  atualizarSelect();
  anunciar(t("mundial.restaurada"));
});

// ---- Atualização por segundo --------------------------------------------------
function atualizar(agora) {
  const minha = partesNoFuso(agora, referencia.fuso);
  const deslMeu = deslocamentoMinutos(agora, referencia.fuso);

  for (const linha of linhasCidades) {
    const fuso = linha.cidade.fuso;
    const p = partesNoFuso(agora, fuso);
    const desl = deslocamentoMinutos(agora, fuso);
    const relativo = outroDia(p, minha);
    definirTexto(linha.hora, formatarHora(p));
    const nomeDia = nomeDiaSemana(p.diaSemana);
    definirTexto(linha.dia, relativo ? t("mundial.diaRelativo", { dia: nomeDia, relativo }) : nomeDia);
    definirTexto(
      linha.diferenca,
      fuso === referencia.fuso
        ? t("mundial.seuFuso")
        : desl === deslMeu
          ? t("mundial.mesmoHorario")
          : t("mundial.diferenca", { diferenca: formatarDiferencaFuso(desl - deslMeu) }),
    );
    const utc = formatarDeslocamento(desl);
    if (linha.diferenca.title !== utc) linha.diferenca.title = utc;
    const aberto = emHorarioComercial(p);
    linha.comercial.classList.toggle("cidade__comercial--aberto", aberto);
    definirTexto(linha.comercial, t(aberto ? "mundial.comercial" : "mundial.foraExpediente"));
  }
}

atualizarSelect();
renderizarCidades();
const agendador = agendarPorSegundo(atualizar, () => relogio.agora());
relogio.addEventListener("estado", () => agendador.agora());
