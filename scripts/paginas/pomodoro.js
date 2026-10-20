// Página do Pomodoro: etapas de foco e pausa sobre a mesma ContagemRegressiva
// do temporizador, com histórico local.

import "../i18n/index.js";
import { locale, t } from "../i18n/estado.js";
import { Alarme, notificar, prepararAudio } from "../nucleo/alertas.js";
import { gravar, ler } from "../nucleo/armazenamento.js";
import { registrarAtalhos } from "../nucleo/atalhos.js";
import { ContagemRegressiva } from "../nucleo/medidores.js";
import {
  FASES,
  duracaoDaFase,
  nomeFase,
  normalizarConfig,
  posicaoNoCiclo,
  proximaFase,
  resumoDoPeriodo,
} from "../nucleo/pomodoro.js";
import { MS_DIA, formatarDuracao, formatarDuracaoExtenso } from "../nucleo/tempo.js";
import {
  $,
  $$,
  anunciar,
  confirmar,
  criarLacoQuadros,
  criarTitulo,
  definirTexto,
  el,
  trocarIcone,
} from "../nucleo/ui.js";
import { criarDisparo, ligarBloqueioTela, ligarNotificacoes, ligarSons } from "./comum-temporizadores.js";

const CHAVE_ESTADO = "pomodoro:estado";
const CHAVE_CONFIG = "pomodoro:config";
const CHAVE_HISTORICO = "pomodoro:historico";
const LIMITE_HISTORICO = 200;

const elVisor = $("#visor");
const elRotulo = $("#rotulo");
const barra = $("#barra");
const botaoIniciar = $("#botaoIniciar");
const botaoPular = $("#botaoPular");
const botaoReiniciar = $("#botaoReiniciar");
const botoesFase = $$("[data-fase]");
const definirTitulo = criarTitulo();
const alarme = new Alarme();

// ---- Ajustes ----------------------------------------------------------------------
let config = normalizarConfig(ler(CHAVE_CONFIG, {}));
const campos = {
  foco: $("#cfgFoco"),
  curta: $("#cfgCurta"),
  longa: $("#cfgLonga"),
  ciclos: $("#cfgCiclos"),
};
const caixaAutoPausa = $("#cfgAutoPausa");
const caixaAutoFoco = $("#cfgAutoFoco");
const selectSom = $("#som");

ligarSons(selectSom, $("#botaoTestar"), () => 1);
ligarNotificacoes($("#estadoNotificacao"), $("#botaoNotificacao"));
const caixaTela = $("#telaAtiva");
caixaTela.checked = config.telaAtiva;
const telaAtiva = ligarBloqueioTela(caixaTela, $("#estadoTela"), (marcado) => {
  config.telaAtiva = marcado;
  gravar(CHAVE_CONFIG, config);
});

function mostrarConfig() {
  for (const [chave, campo] of Object.entries(campos)) campo.value = String(config[chave]);
  caixaAutoPausa.checked = config.autoPausa;
  caixaAutoFoco.checked = config.autoFoco;
  selectSom.value = config.som;
  if (!selectSom.value) selectSom.value = config.som = "sino";
}

function lerConfig() {
  config = normalizarConfig({
    ...Object.fromEntries(Object.entries(campos).map(([chave, campo]) => [chave, campo.value])),
    autoPausa: caixaAutoPausa.checked,
    autoFoco: caixaAutoFoco.checked,
    som: selectSom.value,
    telaAtiva: caixaTela.checked,
  });
  gravar(CHAVE_CONFIG, config);
  // A etapa atual só muda de duração se ainda não começou.
  if (contagem.status === "pronto" || contagem.status === "vazio") {
    contagem.definirDuracao(duracaoDaFase(estado.fase, config));
    atualizar();
  } else {
    renderizar();
  }
}

for (const campo of Object.values(campos)) {
  campo.addEventListener("change", () => {
    lerConfig();
    mostrarConfig();
  });
}
for (const controle of [caixaAutoPausa, caixaAutoFoco, selectSom]) controle.addEventListener("change", lerConfig);

// ---- Estado -------------------------------------------------------------------------
const salvo = ler(CHAVE_ESTADO, {});
const estado = {
  fase: salvo.fase in FASES ? salvo.fase : "foco",
  focosConcluidos: Number.isInteger(salvo.focosConcluidos) && salvo.focosConcluidos >= 0 ? salvo.focosConcluidos : 0,
};
let historico = (ler(CHAVE_HISTORICO, []) ?? []).filter(
  (h) => h && h.fase in FASES && Number.isFinite(h.fimEpoch) && Number.isFinite(h.duracaoMs),
);

const contagem = salvo.contagem
  ? ContagemRegressiva.restaurar(salvo.contagem)
  : new ContagemRegressiva(duracaoDaFase(estado.fase, config));
if (contagem.status === "vazio") contagem.definirDuracao(duracaoDaFase(estado.fase, config));

const disparo = criarDisparo(contagem, () => concluirEtapa({ tocar: true }));

function salvar() {
  gravar(CHAVE_ESTADO, { ...estado, contagem: contagem.serializar() });
}

// ---- Renderização ------------------------------------------------------------------------

function renderizarTempo() {
  const texto = formatarDuracao(contagem.restante(), { horas: "auto", arredondar: "cima" });
  definirTexto(elVisor, texto);
  barra.style.transform = `scaleX(${contagem.progresso()})`;
  definirTitulo(contagem.rodando || contagem.status === "pausado" ? `${texto} · ${nomeFase(estado.fase)}` : "");
}

const laco = criarLacoQuadros(renderizarTempo);
let idTitulo = null;

function renderizar() {
  for (const botao of botoesFase) botao.setAttribute("aria-pressed", String(botao.dataset.fase === estado.fase));

  const posicao = posicaoNoCiclo(estado.fase, estado.focosConcluidos, config.ciclos);
  const situacao = contagem.status === "pausado" && !contagem.rodando ? ` · ${t("pomodoro.pausado")}` : "";
  definirTexto(
    elRotulo,
    estado.fase === "longa"
      ? `${nomeFase("longa")}${situacao} · ${t("pomodoro.focosConcluidos", { n: estado.focosConcluidos })}`
      : `${nomeFase(estado.fase)} · ${t("pomodoro.ciclo", { posicao, total: config.ciclos })}${situacao}`,
  );

  // Marcadores: um por foco do ciclo; preenchidos os já concluídos.
  const concluidosNoCiclo = estado.fase === "foco" ? estado.focosConcluidos % config.ciclos : posicao;
  const marcadores = [];
  for (let i = 0; i < config.ciclos; i += 1) {
    marcadores.push(el("span", { class: `marcador-ciclo${i < concluidosNoCiclo ? " marcador-ciclo--feito" : ""}` }));
  }
  $("#marcadoresCiclo").replaceChildren(...marcadores);

  const { status } = contagem;
  definirTexto(botaoIniciar.querySelector("span"), t(status === "rodando" ? "temporizador.pausar" : status === "pausado" ? "temporizador.continuar" : "temporizador.iniciar"));
  const svg = botaoIniciar.querySelector("svg");
  trocarIcone(svg, status === "rodando" ? "pause" : "play");
  svg.classList.toggle("icone--preenchido", status !== "rodando");
  botaoReiniciar.disabled = status === "pronto";

  if (contagem.rodando) {
    laco.iniciar();
    idTitulo ??= setInterval(renderizarTempo, 1000);
  } else {
    laco.parar();
    clearInterval(idTitulo);
    idTitulo = null;
  }
  telaAtiva.sincronizar(contagem.rodando);
  renderizarTempo();
  renderizarHistorico();
}

function renderizarHistorico() {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const inicio = inicioHoje.getTime();
  const resumo = resumoDoPeriodo(historico, inicio, inicio + MS_DIA + 3600000);
  definirTexto(
    $("#resumoHoje"),
    t("pomodoro.resumoHoje", {
      focos: t("pomodoro.focos", { n: resumo.focos }),
      tempo: resumo.focoMs ? formatarDuracaoExtenso(resumo.focoMs) : t("tempo.unidade.min", { n: 0 }),
      pausas: t("pomodoro.pausas", { n: resumo.pausas }),
    }),
  );

  const recentes = historico.slice(-12).reverse();
  $("#historicoVazio").hidden = recentes.length > 0;
  $("#botaoLimpar").disabled = historico.length === 0;
  $("#listaHistorico").replaceChildren(
    ...recentes.map((item) => {
      const fim = new Date(item.fimEpoch);
      const quando = fim.toLocaleString(locale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      return el(
        "li",
        {},
        el("span", { class: `selo selo--sem-ponto ${item.fase === "foco" ? "selo--acento" : ""}` }, nomeFase(item.fase)),
        el("span", { class: "numeros" }, formatarDuracaoExtenso(item.duracaoMs)),
        el("span", { class: "texto-fraco numeros" }, quando),
      );
    }),
  );
}

function atualizar() {
  salvar();
  renderizar();
}

// ---- Ações -----------------------------------------------------------------------------------

function irPara(fase, { iniciar = false } = {}) {
  disparo.cancelar();
  estado.fase = fase;
  contagem.definirDuracao(duracaoDaFase(fase, config));
  if (iniciar) {
    contagem.iniciar();
    disparo.agendar();
  }
  atualizar();
}

function concluirEtapa({ tocar, fimEpoch = Date.now() }) {
  const fase = estado.fase;
  historico.push({ fase, duracaoMs: contagem.duracaoMs, fimEpoch });
  if (historico.length > LIMITE_HISTORICO) historico = historico.slice(-LIMITE_HISTORICO);
  gravar(CHAVE_HISTORICO, historico);

  if (fase === "foco") estado.focosConcluidos += 1;
  const proxima = proximaFase(fase, estado.focosConcluidos, config.ciclos);
  const automatico = tocar && (proxima === "foco" ? config.autoFoco : config.autoPausa);

  if (tocar) {
    alarme.tocar({ som: config.som, repetir: false });
    const mensagem = fase === "foco" ? t(`pomodoro.fimFoco.${proxima}`) : t("pomodoro.fimPausa");
    notificar(nomeFase(fase), mensagem, { tag: "pomodoro" });
    anunciar(mensagem, "assertive");
  }
  irPara(proxima, { iniciar: automatico });
}

function alternar() {
  prepararAudio();
  alarme.parar();
  if (contagem.rodando) {
    contagem.pausar();
    disparo.cancelar();
  } else {
    contagem.iniciar();
    disparo.agendar();
  }
  atualizar();
}

async function pular() {
  if (contagem.rodando || contagem.status === "pausado") {
    const ok = await confirmar({
      titulo: t("pomodoro.pularTitulo"),
      mensagem: t("pomodoro.pularMensagem"),
      confirmar: t("pomodoro.pular"),
    });
    if (!ok) return;
  }
  // Pular um foco avança o ciclo como se ele tivesse acontecido, sem registrá-lo.
  const focos = estado.fase === "foco" ? estado.focosConcluidos + 1 : estado.focosConcluidos;
  const proxima = proximaFase(estado.fase, focos, config.ciclos);
  if (estado.fase === "foco") estado.focosConcluidos = focos;
  irPara(proxima);
}

async function reiniciarEtapa() {
  if (contagem.status === "pronto") return;
  if (contagem.rodando) {
    const ok = await confirmar({
      titulo: t("pomodoro.reiniciarTitulo"),
      mensagem: t("pomodoro.reiniciarMensagem"),
      confirmar: t("temporizador.reiniciar"),
    });
    if (!ok) return;
  }
  irPara(estado.fase);
}

async function escolherFase(fase) {
  if (fase === estado.fase && contagem.status === "pronto") return;
  if (contagem.rodando || contagem.status === "pausado") {
    const ok = await confirmar({
      titulo: t("pomodoro.mudarTitulo", { fase: nomeFase(fase) }),
      mensagem: t("pomodoro.mudarMensagem"),
      confirmar: t("pomodoro.mudar"),
    });
    if (!ok) return;
  }
  irPara(fase);
}

botaoIniciar.addEventListener("click", alternar);
botaoPular.addEventListener("click", pular);
botaoReiniciar.addEventListener("click", reiniciarEtapa);
for (const botao of botoesFase) botao.addEventListener("click", () => escolherFase(botao.dataset.fase));

$("#botaoLimpar").addEventListener("click", async () => {
  const ok = await confirmar({
    titulo: t("pomodoro.limparTitulo"),
    mensagem: t("pomodoro.limparMensagem"),
    confirmar: t("pomodoro.limpar"),
    perigo: true,
  });
  if (!ok) return;
  historico = [];
  gravar(CHAVE_HISTORICO, historico);
  if (!contagem.rodando && contagem.status !== "pausado") estado.focosConcluidos = 0;
  atualizar();
});

registrarAtalhos([
  { tecla: "espaco", descricao: "temporizador.atalho.alternar", acao: alternar },
  { tecla: "n", descricao: "pomodoro.atalho.pular", acao: pular },
  { tecla: "r", descricao: "pomodoro.atalho.reiniciar", acao: reiniciarEtapa },
]);

window.addEventListener("pagehide", salvar);

// ---- Início -------------------------------------------------------------------------------------
mostrarConfig();
if (contagem.terminouEm) {
  // A etapa terminou com a página fechada: registra e avança, sem som.
  const hora = new Date(contagem.terminouEm).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  const fase = nomeFase(estado.fase);
  concluirEtapa({ tocar: false, fimEpoch: contagem.terminouEm });
  definirTexto(elRotulo, t("pomodoro.terminouFechada", { fase, hora }));
} else {
  if (contagem.rodando) disparo.agendar();
  renderizar();
}
