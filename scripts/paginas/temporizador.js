// Página do temporizador: contagem regressiva com alarme, notificação,
// bloqueio de tela e persistência do estado e das preferências.

import "../i18n/index.js";
import { locale, t } from "../i18n/estado.js";
import { Alarme, notificar, prepararAudio } from "../nucleo/alertas.js";
import { gravar, ler } from "../nucleo/armazenamento.js";
import { registrarAtalhos } from "../nucleo/atalhos.js";
import { ContagemRegressiva } from "../nucleo/medidores.js";
import { MS_HORA, MS_MINUTO, MS_SEGUNDO, formatarDuracao, formatarDuracaoExtenso } from "../nucleo/tempo.js";
import {
  $,
  $$,
  anunciar,
  confirmar,
  criarDialogo,
  criarLacoQuadros,
  criarTitulo,
  definirTexto,
  el,
  icone,
  trocarIcone,
} from "../nucleo/ui.js";
import { criarDisparo, ligarBloqueioTela, ligarNotificacoes, ligarSons } from "./comum-temporizadores.js";

const CHAVE_ESTADO = "temporizador:estado";
const CHAVE_CONFIG = "temporizador:config";
const DURACAO_PADRAO = 5 * MS_MINUTO;

const painel = $("#painel");
const elVisor = $("#visor");
const elEstado = $("#estado");
const elRotulo = $("#rotulo");
const barra = $("#barra");
const entradas = { horas: $("#horas"), minutos: $("#minutos"), segundos: $("#segundos") };
const botaoIniciar = $("#botaoIniciar");
const botaoReiniciar = $("#botaoReiniciar");
const botaoMaisUm = $("#botaoMaisUm");
const fichas = $$("[data-preset]");
const selectSom = $("#som");
const entradaVolume = $("#volume");
const caixaRepetir = $("#repetir");
const caixaTela = $("#telaAtiva");
const definirTitulo = criarTitulo();
const alarme = new Alarme();

// ---- Preferências --------------------------------------------------------------
const config = { som: "bipe", volume: 0.8, repetir: true, telaAtiva: false, ...ler(CHAVE_CONFIG, {}) };
const salvarConfig = () => gravar(CHAVE_CONFIG, config);

ligarSons(selectSom, $("#botaoTestar"), () => config.volume);
selectSom.value = config.som;
if (!selectSom.value) selectSom.value = config.som = "bipe";
entradaVolume.value = String(config.volume);
caixaRepetir.checked = config.repetir;
caixaTela.checked = config.telaAtiva;

selectSom.addEventListener("change", () => {
  config.som = selectSom.value;
  salvarConfig();
});
entradaVolume.addEventListener("input", () => {
  config.volume = Number(entradaVolume.value);
  salvarConfig();
});
caixaRepetir.addEventListener("change", () => {
  config.repetir = caixaRepetir.checked;
  salvarConfig();
});

ligarNotificacoes($("#estadoNotificacao"), $("#botaoNotificacao"));
const telaAtiva = ligarBloqueioTela(caixaTela, $("#estadoTela"), (marcado) => {
  config.telaAtiva = marcado;
  salvarConfig();
});

// ---- Estado ------------------------------------------------------------------------

function carregar() {
  const salvo = ler(CHAVE_ESTADO);
  if (salvo) return ContagemRegressiva.restaurar(salvo);
  // Migração do formato antigo (chave "estadoTemporizador"): só a duração.
  try {
    const antigo = JSON.parse(localStorage.getItem("estadoTemporizador") ?? "null");
    localStorage.removeItem("estadoTemporizador");
    if (antigo && Number(antigo.duracaoTotal) > 0) return new ContagemRegressiva(Number(antigo.duracaoTotal));
  } catch {
    /* sem dados antigos */
  }
  return new ContagemRegressiva(DURACAO_PADRAO);
}

const contagem = carregar();
const disparo = criarDisparo(contagem, aoTerminar);
const salvar = () => gravar(CHAVE_ESTADO, contagem.serializar());

function lerEntradas() {
  const valor = (entrada, max) => {
    const n = Math.floor(Number(entrada.value));
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
  };
  return valor(entradas.horas, 99) * MS_HORA + valor(entradas.minutos, 59) * MS_MINUTO + valor(entradas.segundos, 59) * MS_SEGUNDO;
}

function preencherEntradas(ms) {
  const total = Math.round(ms / MS_SEGUNDO);
  entradas.horas.value = String(Math.floor(total / 3600));
  entradas.minutos.value = String(Math.floor((total % 3600) / 60));
  entradas.segundos.value = String(total % 60);
}

const editavel = () => ["pronto", "vazio", "concluido"].includes(contagem.status);

// ---- Renderização ------------------------------------------------------------------

function textoRestante() {
  const restante = contagem.restante();
  return formatarDuracao(restante, { horas: contagem.duracaoMs >= MS_HORA ? "sempre" : "auto", arredondar: "cima" });
}

function renderizarTempo() {
  const texto = textoRestante();
  definirTexto(elVisor, texto);
  barra.style.transform = `scaleX(${contagem.progresso()})`;
  if (contagem.status === "rodando") definirTitulo(texto);
  else if (contagem.status === "pausado") definirTitulo(t("temporizador.tituloPausado", { tempo: texto }));
  else if (contagem.status === "concluido") definirTitulo(t("temporizador.esgotado"));
  else definirTitulo("");
}

const laco = criarLacoQuadros(renderizarTempo);

// O título da aba continua contando em segundo plano, onde o laço de
// quadros fica pausado. Intervalo simples: só afeta o texto do título.
let idTitulo = null;
function atualizarLacos() {
  if (contagem.rodando) {
    laco.iniciar();
    idTitulo ??= setInterval(renderizarTempo, 1000);
  } else {
    laco.parar();
    clearInterval(idTitulo);
    idTitulo = null;
  }
}

let terminouEmTexto = null;

function renderizar() {
  const { status } = contagem;
  elEstado.textContent = t(`temporizador.${status}`);
  painel.dataset.status = status;
  painel.classList.toggle("estado-concluido", status === "concluido" && alarme.tocando);

  const duracao = formatarDuracaoExtenso(contagem.duracaoMs);
  if (status === "rodando") {
    const fim = new Date(Date.now() + contagem.restante());
    definirTexto(elRotulo, t("temporizador.terminaAs", { hora: fim.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }));
  } else if (status === "pausado") {
    definirTexto(elRotulo, t("temporizador.pausadoDuracao", { duracao }));
  } else if (status === "concluido") {
    definirTexto(elRotulo, terminouEmTexto ?? t("temporizador.concluidoDuracao", { duracao }));
  } else if (status === "vazio") {
    definirTexto(elRotulo, t("temporizador.escolhaDuracao"));
  } else {
    definirTexto(elRotulo, t("temporizador.duracaoValor", { duracao }));
  }

  const rotuloIniciar = status === "rodando" ? "pausar" : status === "pausado" ? "continuar" : status === "concluido" ? "repetir" : "iniciar";
  definirTexto(botaoIniciar.querySelector("span"), t(`temporizador.${rotuloIniciar}`));
  const svg = botaoIniciar.querySelector("svg");
  trocarIcone(svg, status === "rodando" ? "pause" : "play");
  svg.classList.toggle("icone--preenchido", status !== "rodando");
  botaoIniciar.disabled = status === "vazio";
  botaoReiniciar.disabled = status === "pronto" || status === "vazio";
  botaoMaisUm.disabled = status === "vazio";

  for (const entrada of Object.values(entradas)) entrada.disabled = !editavel();
  for (const ficha of fichas) {
    ficha.disabled = !editavel();
    ficha.setAttribute("aria-pressed", String(Number(ficha.dataset.preset) * MS_SEGUNDO === contagem.duracaoMs));
  }

  atualizarLacos();
  telaAtiva.sincronizar(contagem.rodando);
  renderizarTempo();
}

function atualizar() {
  salvar();
  renderizar();
}

// ---- Ações ------------------------------------------------------------------------------

function definirDuracao(ms) {
  if (!editavel()) return;
  terminouEmTexto = null;
  contagem.definirDuracao(ms);
  atualizar();
}

function alternar() {
  if (contagem.status === "vazio") return;
  prepararAudio(); // libera o áudio dentro do gesto do usuário
  if (contagem.rodando) {
    contagem.pausar();
    disparo.cancelar();
    anunciar(t("temporizador.anuncioPausado", { tempo: textoRestante() }));
  } else {
    terminouEmTexto = null;
    contagem.iniciar();
    disparo.agendar();
    anunciar(t("temporizador.anuncioIniciado", { duracao: formatarDuracaoExtenso(contagem.restante()) }));
  }
  atualizar();
}

async function reiniciar({ perguntar = false } = {}) {
  if (contagem.status === "pronto" || contagem.status === "vazio") return;
  if (perguntar && (contagem.rodando || contagem.status === "pausado")) {
    const ok = await confirmar({
      titulo: t("temporizador.confirmarTitulo"),
      mensagem: t("temporizador.confirmarMensagem"),
      confirmar: t("temporizador.reiniciar"),
    });
    if (!ok) return;
  }
  pararAlarme();
  disparo.cancelar();
  terminouEmTexto = null;
  contagem.reiniciar();
  preencherEntradas(contagem.duracaoMs);
  atualizar();
  anunciar(t("temporizador.reiniciado"));
}

function maisUmMinuto() {
  if (contagem.status === "vazio") return;
  // Depois do fim, "+1 min" funciona como soneca: volta a contar na hora.
  const soneca = contagem.status === "concluido";
  if (soneca) pararAlarme();
  contagem.ajustar(MS_MINUTO);
  if (soneca) {
    prepararAudio();
    terminouEmTexto = null;
    contagem.iniciar();
  }
  if (contagem.rodando) disparo.agendar();
  if (editavel()) preencherEntradas(contagem.duracaoMs);
  atualizar();
}

let dialogoAlarme = null;

function pararAlarme() {
  alarme.parar();
  if (dialogoAlarme?.open) dialogoAlarme.close();
  painel.classList.remove("estado-concluido");
}

function aoTerminar() {
  const duracao = formatarDuracaoExtenso(contagem.duracaoMs);
  alarme.tocar({ som: config.som, repetir: config.repetir, volume: config.volume });
  notificar(t("temporizador.esgotado"), t("temporizador.terminou", { duracao }), { tag: "temporizador" });
  anunciar(t("temporizador.esgotadoAnuncio"), "assertive");
  atualizar();
  mostrarDialogo(duracao);
}

function mostrarDialogo(duracao) {
  dialogoAlarme?.remove();
  const botaoRepetir = el("button", { type: "button", class: "botao botao--secundario" }, t("temporizador.repetir"));
  const botaoDispensar = el("button", { type: "button", class: "botao botao--primario" }, t("temporizador.dispensar"));
  dialogoAlarme = criarDialogo({
    titulo: t("temporizador.esgotado"),
    classe: "dialogo--alarme",
    rotuloFechar: t("temporizador.dispensarAlarme"),
    conteudo: [
      el("div", { class: "icone-alarme" }, icone("sino")),
      el("p", { class: "texto-suave" }, t("temporizador.terminou", { duracao })),
    ],
    acoes: [botaoRepetir, botaoDispensar],
  });
  botaoDispensar.addEventListener("click", () => dialogoAlarme.close());
  botaoRepetir.addEventListener("click", () => {
    dialogoAlarme.close();
    prepararAudio();
    contagem.iniciar();
    disparo.agendar();
    atualizar();
  });
  dialogoAlarme.addEventListener("close", () => {
    alarme.parar();
    painel.classList.remove("estado-concluido");
    renderizar();
  });
  dialogoAlarme.showModal();
  botaoDispensar.focus();
}

// ---- Eventos --------------------------------------------------------------------------------

for (const entrada of Object.values(entradas)) {
  entrada.addEventListener("input", () => definirDuracao(lerEntradas()));
  entrada.addEventListener("change", () => {
    definirDuracao(lerEntradas());
    preencherEntradas(contagem.duracaoMs);
  });
}

for (const ficha of fichas) {
  ficha.addEventListener("click", () => {
    const ms = Number(ficha.dataset.preset) * MS_SEGUNDO;
    preencherEntradas(ms);
    definirDuracao(ms);
  });
}

botaoIniciar.addEventListener("click", alternar);
botaoReiniciar.addEventListener("click", () => reiniciar({ perguntar: false }));
botaoMaisUm.addEventListener("click", maisUmMinuto);

registrarAtalhos([
  { tecla: "espaco", descricao: "temporizador.atalho.alternar", acao: alternar },
  { tecla: "r", descricao: "temporizador.atalho.reiniciar", acao: () => reiniciar({ perguntar: true }) },
  { tecla: "+", descricao: "temporizador.maisUmMinuto", acao: maisUmMinuto },
]);

window.addEventListener("pagehide", salvar);

// ---- Início ----------------------------------------------------------------------------------

if (contagem.terminouEm) {
  const hora = new Date(contagem.terminouEm).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  terminouEmTexto = t("temporizador.terminouFechada", { hora });
  salvar();
}
preencherEntradas(contagem.duracaoMs);
if (contagem.rodando) disparo.agendar();
renderizar();
