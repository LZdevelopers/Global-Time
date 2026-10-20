// Página do cronômetro: controles, voltas, exportação e persistência.

import "../i18n/index.js";
import { separadorDecimal, t } from "../i18n/estado.js";
import { registrarAtalhos } from "../nucleo/atalhos.js";
import { gravar, ler } from "../nucleo/armazenamento.js";
import { Cronometro } from "../nucleo/medidores.js";
import { csvVoltas, formatarCronometro, formatarDiferencaVolta, textoVoltas } from "../nucleo/voltas.js";
import { MS_MINUTO, dataIso, doisDigitos, partesNoFuso } from "../nucleo/tempo.js";
import {
  $,
  anunciar,
  avisar,
  baixarArquivo,
  confirmar,
  copiarTexto,
  criarLacoQuadros,
  criarTitulo,
  definirTexto,
  el,
  trocarIcone,
} from "../nucleo/ui.js";

const CHAVE = "cronometro";
// A partir deste tempo medido, zerar pede confirmação mesmo sem voltas.
const PROTEGER_A_PARTIR_DE = MS_MINUTO;

const elVisor = $("#visor");
const elEstado = $("#estado");
const elVoltaAtual = $("#voltaAtual");
const botaoIniciar = $("#botaoIniciar");
const botaoVolta = $("#botaoVolta");
const botaoZerar = $("#botaoZerar");
const botaoCopiar = $("#botaoCopiar");
const botaoCsv = $("#botaoCsv");
const corpoVoltas = $("#corpoVoltas");
const definirTitulo = criarTitulo();
const decimal = separadorDecimal();

// O visor tem duas partes: "MM:SS" em destaque e ",cc" mais clara.
const textoPrincipal = document.createTextNode("00:00");
const textoFracao = el("span", { class: "visor__fracao" }, `${decimal}00`);
elVisor.replaceChildren(textoPrincipal, textoFracao);

function carregar() {
  const salvo = ler(CHAVE);
  if (salvo) return Cronometro.restaurar(salvo);
  // Migração do formato antigo ({ tempo, voltas } na chave "cronometro").
  try {
    const antigo = JSON.parse(localStorage.getItem("cronometro") ?? "null");
    if (antigo && Number(antigo.tempo) > 0) {
      localStorage.removeItem("cronometro");
      return Cronometro.restaurar({ status: "pausado", acumuladoMs: Number(antigo.tempo), voltas: antigo.voltas ?? [] });
    }
  } catch {
    /* sem dados antigos */
  }
  return new Cronometro();
}

const cronometro = carregar();

function salvar() {
  gravar(CHAVE, cronometro.serializar());
}

// ---- Renderização ------------------------------------------------------------

function renderizarTempo() {
  const total = cronometro.decorrido();
  const texto = formatarCronometro(total);
  const corte = texto.lastIndexOf(decimal);
  const principal = texto.slice(0, corte);
  if (textoPrincipal.nodeValue !== principal) textoPrincipal.nodeValue = principal;
  definirTexto(textoFracao, texto.slice(corte));
  definirTexto(elVoltaAtual, t("cronometro.voltaAtual", { numero: cronometro.voltas.length + 1, tempo: formatarCronometro(cronometro.voltaAtual()) }));
  definirTitulo(cronometro.status === "parado" ? "" : principal);
}

const laco = criarLacoQuadros(renderizarTempo);

function renderizarEstado() {
  const { status } = cronometro;
  elEstado.textContent = t(`cronometro.${status}`);
  elEstado.dataset.status = status;

  const rotuloIniciar = status === "rodando" ? "pausar" : status === "pausado" ? "continuar" : "iniciar";
  definirTexto(botaoIniciar.querySelector("span"), t(`cronometro.${rotuloIniciar}`));
  trocarIcone(botaoIniciar.querySelector("svg"), status === "rodando" ? "pause" : "play");
  botaoIniciar.querySelector("svg").classList.toggle("icone--preenchido", status !== "rodando");

  // Com o cronômetro rodando, "Volta" é a ação em destaque ao lado de "Pausar".
  botaoVolta.disabled = status !== "rodando";
  botaoVolta.classList.toggle("botao--acento", status === "rodando");
  botaoVolta.classList.toggle("botao--secundario", status !== "rodando");
  botaoZerar.disabled = status === "rodando" || (cronometro.decorrido() === 0 && cronometro.voltas.length === 0);
  const temDados = cronometro.decorrido() > 0;
  botaoCopiar.disabled = !temDados;
  botaoCsv.disabled = !temDados;

  if (status === "rodando") laco.iniciar();
  else laco.parar();
  renderizarTempo();
}

function renderizarVoltas() {
  const voltas = cronometro.voltasDetalhadas();
  $("#secaoVoltas").hidden = voltas.length === 0;

  const linhas = [...voltas].reverse().map((v) => {
    const marca = v.melhor ? "melhor" : v.pior ? "pior" : null;
    const classeDiferenca = v.diferencaMs == null ? "" : v.diferencaMs < 0 ? "melhor" : v.diferencaMs > 0 ? "pior" : "";
    return el(
      "tr",
      { class: marca ? `volta--${marca}` : null },
      el(
        "td",
        {},
        el("strong", {}, String(v.numero)),
        marca
          ? el("span", { class: `selo selo--sem-ponto ${marca === "melhor" ? "selo--sucesso" : "selo--perigo"}` }, t(`cronometro.${marca}`))
          : null,
      ),
      el("td", { class: "numero" }, formatarCronometro(v.voltaMs)),
      el("td", { class: `numero voltas__diferenca ${classeDiferenca}`.trim() }, formatarDiferencaVolta(v.diferencaMs)),
      el("td", { class: "numero" }, formatarCronometro(v.totalMs)),
    );
  });
  corpoVoltas.replaceChildren(...linhas);

  if (!voltas.length) return;
  const melhor = voltas.find((v) => v.melhor);
  const media = voltas.reduce((s, v) => s + v.voltaMs, 0) / voltas.length;
  const partes = [t("cronometro.resumo", { n: voltas.length, media: formatarCronometro(media) })];
  if (melhor) partes.push(t("cronometro.resumoMelhor", { numero: melhor.numero, tempo: formatarCronometro(melhor.voltaMs) }));
  definirTexto($("#resumoVoltas"), partes.join(" · "));
}

function atualizarTudo() {
  renderizarEstado();
  renderizarVoltas();
  salvar();
}

// ---- Ações ------------------------------------------------------------------------

function alternar() {
  cronometro.alternar();
  atualizarTudo();
  anunciar(cronometro.rodando ? t("cronometro.iniciado") : t("cronometro.pausadoEm", { tempo: formatarCronometro(cronometro.decorrido()) }));
}

function registrarVolta() {
  const total = cronometro.registrarVolta();
  if (total == null) return;
  atualizarTudo();
  const ultima = cronometro.voltasDetalhadas().at(-1);
  anunciar(t("cronometro.anuncioVolta", { numero: ultima.numero, tempo: formatarCronometro(ultima.voltaMs) }));
}

async function zerar() {
  if (cronometro.rodando) return;
  const voltas = cronometro.voltas.length;
  if (voltas > 0 || cronometro.decorrido() >= PROTEGER_A_PARTIR_DE) {
    const ok = await confirmar({
      titulo: t("cronometro.confirmarTitulo"),
      mensagem: voltas > 0 ? t("cronometro.confirmarComVoltas", { n: voltas }) : t("cronometro.confirmarTempo", { tempo: formatarCronometro(cronometro.decorrido()) }),
      confirmar: t("cronometro.zerar"),
      perigo: true,
    });
    if (!ok) return;
  }
  cronometro.zerar();
  atualizarTudo();
  anunciar(t("cronometro.zerado"));
}

function nomeArquivo() {
  const p = partesNoFuso(Date.now());
  return `${t("cronometro.nomeArquivo")}-${dataIso(p.ano, p.mes, p.dia)}-${doisDigitos(p.hora)}${doisDigitos(p.minuto)}.csv`;
}

botaoIniciar.addEventListener("click", alternar);
botaoVolta.addEventListener("click", registrarVolta);
botaoZerar.addEventListener("click", zerar);
botaoCopiar.addEventListener("click", async () => {
  const ok = await copiarTexto(textoVoltas(cronometro.voltas, cronometro.decorrido()));
  avisar(t(ok ? "cronometro.copiados" : "comum.naoCopiou"));
});
botaoCsv.addEventListener("click", () => {
  baixarArquivo(nomeArquivo(), csvVoltas(cronometro.voltas, cronometro.decorrido()), "text/csv;charset=utf-8");
  avisar(t("cronometro.csvGerado"));
});

registrarAtalhos([
  { tecla: "espaco", descricao: "cronometro.atalho.alternar", acao: alternar },
  { tecla: "l", descricao: "cronometro.atalho.volta", acao: registrarVolta, habilitado: () => cronometro.rodando },
  { tecla: "r", descricao: "cronometro.atalho.zerar", acao: zerar, habilitado: () => !cronometro.rodando },
]);

// Salva também ao sair, para registrar o estado mais recente.
window.addEventListener("pagehide", salvar);

atualizarTudo();
