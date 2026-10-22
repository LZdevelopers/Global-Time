// Página inicial: relógio sincronizado no fuso preferido (o do aparelho, ou o
// escolhido pelo usuário), o horário de Brasília quando o fuso é outro, o
// próximo feriado nacional (do mesmo país do calendário) e um resumo do clima
// do lugar escolhido na página /clima.
//
// O instante vem sempre do relógio sincronizado; o fuso só muda a exibição.

import "../i18n/index.js";
import { locale, t, urlLocal } from "../i18n/estado.js";
import { BloqueioTela } from "../nucleo/alertas.js";
import { criarRelogioAnalogico } from "../nucleo/analogico.js";
import { registrarAtalhos } from "../nucleo/atalhos.js";
import {
  LIMITE_ATUAL_MS,
  VALIDADE_PREVISAO_MS,
  condicao,
  grau,
  horaDoTexto,
  lugarPorIp,
  lugarSalvo,
  obterPrevisao,
  salvarLugar,
  textoCondicao,
} from "../nucleo/clima.js";
import { eventosNoIntervalo } from "../nucleo/feriados.js";
import { PAIS_COM_DADOS_PROPRIOS, paisPreferido, proximoFeriadoDoPais } from "../nucleo/feriados-paises.js";
import { cidadePreferida, escolherCidade, fusoDoAparelho, fusoPreferido } from "../nucleo/fuso-preferido.js";
import { ligarIndicador } from "../nucleo/indicador-sincronizacao.js";
import { ler, gravar } from "../nucleo/armazenamento.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import {
  FUSO_BRASILIA,
  capitalizar,
  deDiaJuliano,
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
import { $, agendarPorSegundo, anunciar, avisar, copiarTexto, criarDialogo, definirTexto, el, preencherSelect, trocarIcone } from "../nucleo/ui.js";

const relogio = obterRelogio();
let preferido = fusoPreferido();
let consultaFeriado = 0; // descarta respostas de feriados que chegarem fora de ordem

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
    atualizarProximoFeriado(agora, p);
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

// ---- Próximo feriado nacional ------------------------------------------------------
// O país é o mesmo do calendário (escolha salva lá ou o do fuso). O Brasil usa
// os dados próprios e o dia de Brasília; os outros países, /api/feriados e o
// dia no fuso exibido. Sem dados, o bloco fica com "—".

async function atualizarProximoFeriado(agora, partesExibidas) {
  const pais = paisPreferido();
  const brasil = pais === PAIS_COM_DADOS_PROPRIOS;
  const hoje = brasil ? partesNoFuso(agora, FUSO_BRASILIA) : partesExibidas;
  const inicio = diaJuliano(hoje.ano, hoje.mes, hoje.dia);
  const link = $(".proximo-feriado");
  link.href = urlLocal(brasil ? "/feriados" : `/calendario?pais=${pais}`);

  let proximo = null;
  if (brasil) {
    proximo = eventosNoIntervalo(inicio, inicio + 400, { comemorativas: false, facultativos: false }).find((e) => e.tipo === "nacional");
  } else {
    const minha = ++consultaFeriado;
    try {
      proximo = await proximoFeriadoDoPais(pais, inicio, hoje.ano);
    } catch {
      proximo = null;
    }
    if (minha !== consultaFeriado) return;
  }
  if (!proximo) {
    definirTexto($("#tituloProximoFeriado"), "—");
    definirTexto($("#faltaProximoFeriado"), "");
    return;
  }
  const faltam = proximo.juliano - inicio;
  const data = formatarDataExtenso(deDiaJuliano(proximo.juliano), { comSemana: false, comAno: false });
  definirTexto($("#tituloProximoFeriado"), proximo.nome);
  const quando =
    faltam === 0 ? t("inicio.feriadoHoje", { data }) : faltam === 1 ? t("inicio.feriadoAmanha", { data }) : t("inicio.feriadoEm", { data, n: faltam });
  definirTexto($("#faltaProximoFeriado"), brasil ? quando : `${quando} · ${nomeDoPais(pais)}`);
}

function nomeDoPais(codigo) {
  try {
    return new Intl.DisplayNames([locale()], { type: "region" }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

// ---- Tela cheia ------------------------------------------------------------------
// Um clique no botão já pede a tela cheia ao navegador (a API só aceita pedidos
// feitos durante um gesto do usuário). Enquanto ela dura, a página mostra só o
// relógio, mantém a tela ligada quando possível e esconde o cursor parado.
// Sem a Fullscreen API (ex.: Safari no iPhone), o mesmo modo vale dentro da
// janela. Esc sai: o navegador consome a tecla e avisa por fullscreenchange.
const ESPERA_CURSOR_MS = 3000;
const botaoTelaCheia = $("#botaoTelaCheia");
const bloqueioTela = new BloqueioTela();
let emTelaCheia = false;
let idCursor = null;

const apiTelaCheia = () => Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);

function mostrarCursor() {
  document.body.classList.remove("cursor-oculto");
  clearTimeout(idCursor);
  if (emTelaCheia) idCursor = setTimeout(() => document.body.classList.add("cursor-oculto"), ESPERA_CURSOR_MS);
}

function aplicarTelaCheia(ativa) {
  if (ativa === emTelaCheia) return;
  emTelaCheia = ativa;
  document.body.classList.toggle("inicio-tela-cheia", ativa);
  const rotulo = t(ativa ? "inicio.sairTelaCheia" : "inicio.telaCheia");
  botaoTelaCheia.setAttribute("aria-pressed", String(ativa));
  botaoTelaCheia.setAttribute("aria-label", rotulo);
  botaoTelaCheia.title = rotulo;
  trocarIcone(botaoTelaCheia.querySelector("svg"), ativa ? "sair-tela-cheia" : "tela-cheia");
  if (ativa) {
    bloqueioTela.ativar();
    mostrarCursor();
    anunciar(t("inicio.telaCheiaAtivada"));
  } else {
    bloqueioTela.desativar();
    clearTimeout(idCursor);
    document.body.classList.remove("cursor-oculto");
  }
  agendador.agora();
}

async function entrarTelaCheia() {
  if (!apiTelaCheia()) {
    aplicarTelaCheia(true);
    avisar(t("inicio.telaCheiaIndisponivel"), { duracaoMs: 5000 });
    return;
  }
  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    avisar(t("inicio.telaCheiaNegada"));
  }
}

async function sairTelaCheia() {
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      /* já saiu */
    }
  } else {
    aplicarTelaCheia(false);
  }
}

document.addEventListener("fullscreenchange", () => aplicarTelaCheia(Boolean(document.fullscreenElement)));
botaoTelaCheia.addEventListener("click", () => (emTelaCheia ? sairTelaCheia() : entrarTelaCheia()));
for (const evento of ["mousemove", "pointerdown", "touchstart", "keydown"]) {
  document.addEventListener(evento, () => emTelaCheia && mostrarCursor(), { passive: true });
}

registrarAtalhos([
  { tecla: "f", descricao: "inicio.atalho.telaCheia", acao: () => (emTelaCheia ? sairTelaCheia() : entrarTelaCheia()) },
  // Só chega aqui no modo sem a API; na tela cheia real o navegador trata o Esc.
  { tecla: "Escape", teclas: ["Esc"], descricao: "inicio.atalho.sairTelaCheia", habilitado: () => emTelaCheia, acao: sairTelaCheia },
]);

// ---- Copiar ----------------------------------------------------------------------
$("#botaoCopiar").addEventListener("click", async () => {
  const p = partesNoFuso(relogio.agora(), preferido.fuso);
  const texto = t("inicio.textoCopiado", { hora: formatarHora(p), data: formatarDataExtenso(p), lugar: preferido.nome });
  avisar(t((await copiarTexto(texto)) ? "inicio.copiado" : "comum.naoCopiou"));
});

// ---- Clima agora -------------------------------------------------------------------
// O lugar é o escolhido na página do clima; na primeira visita, o aproximado
// pelo IP (só na Vercel). Sem lugar ou sem dados, o link só leva à página.
// Atualiza a cada 10 minutos com a página visível, sem relação com o relógio.
let climaRecebidoEm = 0;

async function atualizarClima() {
  let lugar = lugarSalvo();
  if (!lugar) {
    lugar = await lugarPorIp();
    if (!lugar) return;
    salvarLugar(lugar);
  }
  let r;
  try {
    r = await obterPrevisao(lugar.lat, lugar.lon);
  } catch {
    return;
  }
  climaRecebidoEm = r.recebidoEm;
  const a = r.dados.atual;
  const c = condicao(a.weather_code, a.is_day !== 0);
  trocarIcone($("#climaIcone"), c.icone);
  const resumo = $("#climaResumo");
  resumo.removeAttribute("data-i18n");
  definirTexto(resumo, `${grau(a.temperature_2m)} · ${textoCondicao(c.codigo)}`);
  const antigo = r.desatualizado || Date.now() - (r.dados.obtidoEm ?? r.recebidoEm) > LIMITE_ATUAL_MS;
  const nome = lugar.nome || t("clima.minhaLocalizacao");
  definirTexto($("#climaLugar"), antigo ? t("inicio.climaAntigo", { lugar: nome, hora: horaDoTexto(a.time) }) : nome);
  $("#climaInicio").setAttribute("aria-label", t("inicio.climaRotulo", { lugar: nome, resumo: resumo.textContent }));
}

atualizarClima();
setInterval(() => {
  if (document.visibilityState === "visible" && Date.now() - climaRecebidoEm >= VALIDADE_PREVISAO_MS) atualizarClima();
}, 60 * 1000);
