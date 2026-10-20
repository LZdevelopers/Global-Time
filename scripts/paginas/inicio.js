// Página inicial: relógio sincronizado no fuso preferido (o do aparelho, ou o
// escolhido pelo usuário), o horário de Brasília quando o fuso é outro e o
// próximo feriado nacional do Brasil.
//
// O instante vem sempre do relógio sincronizado; o fuso só muda a exibição.

import "../i18n/index.js";
import { t } from "../i18n/estado.js";
import { criarRelogioAnalogico } from "../nucleo/analogico.js";
import { eventosNoIntervalo } from "../nucleo/feriados.js";
import { cidadePreferida, escolherCidade, fusoDoAparelho, fusoPreferido } from "../nucleo/fuso-preferido.js";
import { ligarIndicador } from "../nucleo/indicador-sincronizacao.js";
import { ler, gravar } from "../nucleo/armazenamento.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import {
  FUSO_BRASILIA,
  capitalizar,
  deslocamentoMinutos,
  diaJuliano,
  doisDigitos,
  formatarDataExtenso,
  formatarDeslocamento,
  formatarDiferencaFuso,
  formatarHora,
  outroDia,
  partesNoFuso,
} from "../nucleo/tempo.js";
import { nomeDoFuso, opcoesCidades } from "../dados/cidades.js";
import { $, agendarPorSegundo, avisar, copiarTexto, criarDialogo, definirTexto, el, preencherSelect } from "../nucleo/ui.js";

const relogio = obterRelogio();
let preferido = fusoPreferido();

const elHora = $("#hora");
const elData = $("#data");
const elOutroFuso = $("#outroFuso");
const visorDigital = $("#visorDigital");
const visorAnalogico = $("#visorAnalogico");
const botaoModo = $("#botaoModo");
const analogico = criarRelogioAnalogico({ rotulo: t("inicio.titulo") });
visorAnalogico.append(analogico.elemento);

ligarIndicador(relogio, {
  selo: $("#seloSync"),
  detalhe: $("#detalheSync"),
  botaoDetalhes: $("#botaoDetalhes"),
});

// ---- Digital / analógico --------------------------------------------------
function definirModo(modo) {
  const analogicoAtivo = modo === "analogico";
  visorDigital.hidden = analogicoAtivo;
  visorAnalogico.hidden = !analogicoAtivo;
  botaoModo.setAttribute("aria-pressed", String(analogicoAtivo));
  gravar("inicio:modo", modo);
  agendador?.agora();
}
botaoModo.addEventListener("click", () => definirModo(visorAnalogico.hidden ? "analogico" : "digital"));

// ---- Fuso ---------------------------------------------------------------------
function abrirEscolhaFuso() {
  const aparelho = fusoDoAparelho();
  const select = el("select", { class: "entrada", id: "selectFusoInicio" });
  preencherSelect(select, [
    { valor: "", rotulo: t("inicio.fusoAparelho", { nome: nomeDoFuso(aparelho) }) },
    ...opcoesCidades(),
  ]);
  select.value = preferido.manual ? (cidadePreferida()?.id ?? "") : "";
  const botaoOk = el("button", { type: "button", class: "botao botao--primario" }, t("comum.salvar"));
  const dialogo = criarDialogo({
    titulo: t("inicio.mudarFuso"),
    conteudo: [
      el("label", { class: "campo", for: "selectFusoInicio" }, el("span", { class: "campo__rotulo" }, t("inicio.cidadeOuFuso")), select),
      el("p", { class: "texto-xs texto-fraco dica-rodape-atalhos" }, t("inicio.fusoExplicacao")),
    ],
    acoes: [botaoOk],
  });
  botaoOk.addEventListener("click", () => {
    escolherCidade(select.value || null);
    preferido = fusoPreferido();
    ultimaData = "";
    agendador.agora();
    dialogo.close();
  });
  dialogo.addEventListener("close", () => {
    dialogo.remove();
    $("#botaoFuso").focus();
  });
  dialogo.showModal();
  select.focus();
}
$("#botaoFuso").addEventListener("click", abrirEscolhaFuso);

// ---- Atualização a cada segundo ---------------------------------------------
let ultimaData = "";
const segundos = elHora.querySelector(".visor__fracao");
const horasMinutos = document.createTextNode("");
elHora.replaceChildren(horasMinutos, segundos);

function atualizar(agora) {
  const p = partesNoFuso(agora, preferido.fuso);
  horasMinutos.nodeValue = `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`;
  definirTexto(segundos, `:${doisDigitos(p.segundo)}`);
  elHora.setAttribute("datetime", new Date(agora).toISOString());
  if (!visorAnalogico.hidden) analogico.atualizar(p);

  const desloc = deslocamentoMinutos(agora, preferido.fuso);
  definirTexto($("#nomeFuso"), preferido.nome);
  definirTexto($("#deslocFuso"), formatarDeslocamento(desloc));

  const chaveData = `${preferido.fuso}|${p.ano}-${p.mes}-${p.dia}`;
  if (chaveData !== ultimaData) {
    ultimaData = chaveData;
    definirTexto(elData, capitalizar(formatarDataExtenso(p)));
    atualizarProximoFeriado(partesNoFuso(agora, FUSO_BRASILIA));
  }

  // Horário de Brasília sempre à mão quando o fuso exibido tem outra hora.
  const deslocBrasilia = deslocamentoMinutos(agora, FUSO_BRASILIA);
  const diferente = desloc !== deslocBrasilia;
  elOutroFuso.hidden = !diferente;
  if (diferente) {
    const pb = partesNoFuso(agora, FUSO_BRASILIA);
    const dia = outroDia(pb, p);
    definirTexto(
      elOutroFuso,
      t("inicio.emBrasilia", {
        hora: formatarHora(pb, false),
        dia: dia ? ` (${dia})` : "",
        diferenca: formatarDiferencaFuso(deslocBrasilia - desloc),
      }),
    );
  }
}

const agendador = agendarPorSegundo(atualizar, () => relogio.agora());
relogio.addEventListener("estado", () => agendador.agora());
definirModo(ler("inicio:modo", "digital"));

// ---- Próximo feriado (nacional, do Brasil) ------------------------------------
function atualizarProximoFeriado(hoje) {
  const inicio = diaJuliano(hoje.ano, hoje.mes, hoje.dia);
  const proximo = eventosNoIntervalo(inicio, inicio + 400, { comemorativas: false, facultativos: false }).find(
    (e) => e.tipo === "nacional",
  );
  if (!proximo) return;
  const faltam = proximo.juliano - inicio;
  const data = formatarDataExtenso(proximo.data, { comSemana: false, comAno: false });
  definirTexto($("#tituloProximoFeriado"), proximo.nome);
  definirTexto(
    $("#faltaProximoFeriado"),
    faltam === 0 ? t("inicio.feriadoHoje", { data }) : faltam === 1 ? t("inicio.feriadoAmanha", { data }) : t("inicio.feriadoEm", { data, n: faltam }),
  );
}

// ---- Copiar ----------------------------------------------------------------------
$("#botaoCopiar").addEventListener("click", async () => {
  const p = partesNoFuso(relogio.agora(), preferido.fuso);
  const texto = t("inicio.textoCopiado", { hora: formatarHora(p), data: formatarDataExtenso(p), lugar: preferido.nome });
  avisar(t((await copiarTexto(texto)) ? "inicio.copiado" : "comum.naoCopiou"));
});
