// Despertador: alarmes únicos ou semanais em qualquer fuso, disparados pelo
// relógio sincronizado. O disparo usa um único setTimeout até o próximo
// alarme (rearmado a cada mudança, ao voltar para a aba e a cada minuto), e
// não um laço de 1 s — laços encadeados são fortemente atrasados pelo
// navegador em abas ocultas.

import "../i18n/index.js";
import { t } from "../i18n/estado.js";
import { cidadePreferida } from "../nucleo/fuso-preferido.js";
import {
  adiarAlarme,
  alarmesPerdidos,
  aposDisparo,
  proximoDisparo,
  proximoGeral,
  restaurarAlarmes,
  validarAlarme,
} from "../nucleo/alarmes.js";
import { Alarme, BloqueioTela, SONS, estadoNotificacao, notificar, pedirPermissaoNotificacao, prepararAudio, tocarSom } from "../nucleo/alertas.js";
import { gravar, ler } from "../nucleo/armazenamento.js";
import { registrarAtalhos } from "../nucleo/atalhos.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import {
  FUSO_BRASILIA,
  dataIso,
  doisDigitos,
  formatarDataCurta,
  formatarDuracaoExtenso,
  formatarHora,
  lerDataIso,
  nomeDiaSemana,
  partesNoFuso,
} from "../nucleo/tempo.js";
import { CIDADES, buscarCidade, nomeCidade, opcoesCidades } from "../dados/cidades.js";
import {
  $,
  $$,
  agendarPorSegundo,
  anunciar,
  avisar,
  confirmar,
  criarDialogo,
  criarTitulo,
  definirTexto,
  el,
  icone,
  preencherSelect,
} from "../nucleo/ui.js";

const CHAVE = "despertador:alarmes";
const CHAVE_VERIFICADO = "despertador:verificadoEm";
const MAXIMO_ESPERA = 60 * 1000; // rede de segurança: reavalia pelo menos a cada minuto

const relogio = obterRelogio();
const tocador = new Alarme();
const bloqueio = new BloqueioTela();
const definirTitulo = criarTitulo();

let alarmes = restaurarAlarmes(ler(CHAVE, []));
let verificadoEm = null;
let idDisparo = null;
let editandoId = null;
let modo = "unico";
const fila = [];
let tocandoAgora = null;

// ---- Elementos -------------------------------------------------------------
const form = $("#formAlarme");
const campoHora = $("#campoHora");
const campoData = $("#campoData");
const campoFuso = $("#campoFuso");
const campoRotulo = $("#campoRotulo");
const campoSom = $("#campoSom");
const lista = $("#listaAlarmes");

// O select de fuso lista cidades; o valor salvo no alarme é o fuso IANA.
// Padrão: a cidade do fuso preferido (o do aparelho ou o escolhido no início).
const CIDADE_PADRAO = cidadePreferida()?.id ?? "brasilia";
preencherSelect(campoFuso, opcoesCidades(), CIDADE_PADRAO);
preencherSelect(
  campoSom,
  Object.keys(SONS).map((valor) => ({ valor, rotulo: t(`sons.${valor}`) })),
  "bipe",
);
const nomeSom = (chave) => t(`sons.${chave in SONS ? chave : "bipe"}`);

const DIAS_ORDEM = [1, 2, 3, 4, 5, 6, 0];
const caixasDias = DIAS_ORDEM.map((dia) => {
  const caixa = el("input", { type: "checkbox", value: String(dia), name: "dias" });
  $("#diasSemana").append(el("label", { class: "ficha ficha-marcavel", title: nomeDiaSemana(dia) }, caixa, nomeDiaSemana(dia, true)));
  return caixa;
});

function nomeFuso(fuso, cidadeId) {
  const cidade = (cidadeId && buscarCidade(cidadeId)) || CIDADES.find((c) => c.fuso === fuso);
  return cidade ? nomeCidade(cidade) : fuso;
}

function salvar() {
  gravar(CHAVE, alarmes);
}

function marcarVerificado(instante) {
  verificadoEm = instante;
  gravar(CHAVE_VERIFICADO, instante);
}

// ---- Formulário ------------------------------------------------------------
function definirModo(novo) {
  modo = novo;
  for (const botao of $$("[data-modo]")) botao.setAttribute("aria-pressed", String(botao.dataset.modo === novo));
  $("#grupoData").hidden = novo !== "unico";
  $("#grupoDias").hidden = novo !== "semanal";
}
for (const botao of $$("[data-modo]")) botao.addEventListener("click", () => definirModo(botao.dataset.modo));

function cidadeSelecionada() {
  return buscarCidade(campoFuso.value);
}

function atualizarAjudaFuso() {
  const cidade = cidadeSelecionada();
  definirTexto($("#ajudaFuso"), cidade ? t("despertador.ajudaFuso", { fuso: cidade.fuso }) : "");
}
campoFuso.addEventListener("change", () => {
  atualizarAjudaFuso();
  if (!editandoId) definirDataPadrao();
});

/** Data padrão: hoje no fuso escolhido, ou amanhã se o horário já passou. */
function definirDataPadrao() {
  const fuso = cidadeSelecionada()?.fuso ?? FUSO_BRASILIA;
  const agora = relogio.agora();
  const hoje = partesNoFuso(agora, fuso);
  const teste = { hora: campoHora.value || "07:00", data: dataIso(hoje.ano, hoje.mes, hoje.dia), dias: [], fuso, ativo: true };
  if (proximoDisparo(teste, agora) == null) {
    const amanha = partesNoFuso(agora + 24 * 3600 * 1000, fuso);
    campoData.value = dataIso(amanha.ano, amanha.mes, amanha.dia);
  } else {
    campoData.value = teste.data;
  }
}

function mostrarErro(id, mensagem) {
  const elemento = $(id);
  elemento.hidden = !mensagem;
  elemento.textContent = mensagem ?? "";
}

function limparFormulario() {
  editandoId = null;
  form.reset();
  campoHora.value = "07:00";
  campoFuso.value = CIDADE_PADRAO;
  campoSom.value = "bipe";
  for (const caixa of caixasDias) caixa.checked = false;
  definirModo("unico");
  definirDataPadrao();
  atualizarAjudaFuso();
  definirTexto($("#tituloForm"), t("despertador.novo"));
  definirTexto($("#botaoSalvar"), t("despertador.salvar"));
  $("#botaoCancelar").hidden = true;
  for (const id of ["#erroHora", "#erroData", "#erroDias"]) mostrarErro(id, null);
  campoHora.removeAttribute("aria-invalid");
  campoData.removeAttribute("aria-invalid");
}

function editar(alarme) {
  editandoId = alarme.id;
  campoHora.value = alarme.hora;
  campoRotulo.value = alarme.rotulo;
  campoSom.value = alarme.som in SONS ? alarme.som : "bipe";
  const cidade = (alarme.cidade && buscarCidade(alarme.cidade)) || CIDADES.find((c) => c.fuso === alarme.fuso);
  campoFuso.value = cidade?.id ?? CIDADE_PADRAO;
  atualizarAjudaFuso();
  definirModo(alarme.data ? "unico" : "semanal");
  if (alarme.data) campoData.value = alarme.data;
  else definirDataPadrao();
  for (const caixa of caixasDias) caixa.checked = alarme.dias.includes(Number(caixa.value));
  definirTexto($("#tituloForm"), t("despertador.editar"));
  definirTexto($("#botaoSalvar"), t("despertador.salvarAlteracoes"));
  $("#botaoCancelar").hidden = false;
  campoHora.focus();
}

$("#botaoCancelar").addEventListener("click", limparFormulario);

form.addEventListener("submit", (evento) => {
  evento.preventDefault();
  prepararAudio(); // gesto do usuário: libera o áudio para o disparo futuro
  const cidade = cidadeSelecionada();
  const resultado = validarAlarme(
    {
      id: editandoId,
      rotulo: campoRotulo.value,
      hora: campoHora.value,
      modo,
      data: campoData.value,
      dias: caixasDias.filter((c) => c.checked).map((c) => Number(c.value)),
      fuso: cidade?.fuso,
      som: campoSom.value,
    },
    relogio.agora(),
  );

  mostrarErro("#erroHora", resultado.erros.hora);
  mostrarErro("#erroData", resultado.erros.data);
  mostrarErro("#erroDias", resultado.erros.dias);
  campoHora.toggleAttribute("aria-invalid", Boolean(resultado.erros.hora));
  campoData.toggleAttribute("aria-invalid", Boolean(resultado.erros.data));
  if (!resultado.ok) {
    anunciar(Object.values(resultado.erros).join(" "), "assertive");
    return;
  }

  const alarme = { ...resultado.alarme, cidade: cidade?.id ?? null };
  const existente = alarmes.findIndex((a) => a.id === alarme.id);
  if (existente >= 0) alarmes[existente] = alarme;
  else alarmes.push(alarme);
  salvar();
  avisar(t(existente >= 0 ? "despertador.atualizado" : "despertador.criado"));
  limparFormulario();
  renderizar();
  rearmar();
});

campoHora.addEventListener("change", () => {
  if (!editandoId && modo === "unico") definirDataPadrao();
});

$("#botaoTestarSom").addEventListener("click", () => {
  prepararAudio();
  tocarSom(campoSom.value);
});

// ---- Lista ----------------------------------------------------------------------
/** "07:00" ou "07:00 (Reunião)" — usado em rótulos acessíveis e confirmações. */
function descreverAlarme(alarme) {
  return alarme.rotulo ? `${alarme.hora} (${alarme.rotulo})` : alarme.hora;
}

const itens = new Map(); // id → { contagem }

function descreverRepeticao(alarme) {
  if (alarme.data) {
    const d = lerDataIso(alarme.data);
    return t("despertador.umaVezEm", { data: formatarDataCurta(d) });
  }
  if (alarme.dias.length === 7) return t("despertador.todosOsDias");
  const uteis = [1, 2, 3, 4, 5];
  if (alarme.dias.length === 5 && uteis.every((d) => alarme.dias.includes(d))) return t("despertador.segundaASexta");
  if (alarme.dias.length === 2 && alarme.dias.includes(0) && alarme.dias.includes(6)) return t("despertador.finsDeSemana");
  return DIAS_ORDEM.filter((d) => alarme.dias.includes(d))
    .map((d) => nomeDiaSemana(d, true))
    .join(", ");
}

function renderizar() {
  itens.clear();
  const ordenados = [...alarmes].sort((a, b) => a.hora.localeCompare(b.hora));
  lista.replaceChildren(
    ...ordenados.map((alarme) => {
      const contagem = el("span", { class: "alarme__contagem" });
      const interruptor = el("input", {
        type: "checkbox",
        class: "interruptor",
        checked: alarme.ativo,
        "aria-label": t("despertador.rotuloAtivar", { descricao: descreverAlarme(alarme) }),
      });
      interruptor.addEventListener("change", () => alternar(alarme.id, interruptor.checked));
      const item = el(
        "li",
        { class: `alarme${alarme.ativo ? "" : " alarme--inativo"}` },
        el(
          "div",
          { class: "alarme__info" },
          el("span", { class: "alarme__hora visor" }, alarme.hora),
          el("span", { class: "alarme__rotulo" }, alarme.rotulo || t("despertador.alarme")),
          el(
            "span",
            { class: "alarme__meta" },
            `${descreverRepeticao(alarme)} · ${nomeFuso(alarme.fuso, alarme.cidade)} · ${nomeSom(alarme.som)}`,
          ),
          contagem,
        ),
        el(
          "div",
          { class: "alarme__acoes" },
          interruptor,
          el(
            "button",
            {
              type: "button",
              class: "botao botao--fantasma botao--icone botao--pequeno",
              "aria-label": t("despertador.rotuloEditar", { descricao: descreverAlarme(alarme) }),
              title: t("comum.editar"),
              onclick: () => editar(alarme),
            },
            icone("editar", "icone--sm"),
          ),
          el(
            "button",
            {
              type: "button",
              class: "botao botao--fantasma botao--icone botao--pequeno",
              "aria-label": t("despertador.rotuloExcluir", { descricao: descreverAlarme(alarme) }),
              title: t("comum.excluir"),
              onclick: () => excluir(alarme),
            },
            icone("lixeira", "icone--sm"),
          ),
        ),
      );
      itens.set(alarme.id, { contagem });
      return item;
    }),
  );
  $("#semAlarmes").hidden = alarmes.length > 0;
  atualizarContagens(relogio.agora());
}

function alternar(id, ativo) {
  const indice = alarmes.findIndex((a) => a.id === id);
  if (indice < 0) return;
  const alarme = alarmes[indice];
  if (ativo && alarme.data && proximoDisparo({ ...alarme, ativo: true, sonecaAte: null }, relogio.agora()) == null) {
    avisar(t("despertador.unicoPassou"));
    renderizar();
    return;
  }
  alarmes[indice] = { ...alarme, ativo, sonecaAte: null };
  salvar();
  renderizar();
  rearmar();
}

async function excluir(alarme) {
  const ok = await confirmar({
    titulo: t("despertador.excluirTitulo"),
    mensagem: t("despertador.excluirMensagem", { descricao: descreverAlarme(alarme) }),
    confirmar: t("comum.excluir"),
    perigo: true,
  });
  if (!ok) return;
  alarmes = alarmes.filter((a) => a.id !== alarme.id);
  if (editandoId === alarme.id) limparFormulario();
  salvar();
  renderizar();
  rearmar();
}

function atualizarContagens(agora) {
  for (const alarme of alarmes) {
    const item = itens.get(alarme.id);
    if (!item) continue;
    const instante = proximoDisparo(alarme, agora);
    let texto;
    if (instante != null) {
      const soneca = Number.isFinite(alarme.sonecaAte) && alarme.sonecaAte === instante;
      const duracao = formatarDuracaoExtenso(Math.ceil((instante - agora) / 1000) * 1000);
      texto = t(soneca ? "despertador.sonecaTocaEm" : "despertador.tocaEm", { duracao });
    } else {
      texto = t(alarme.ativo ? "despertador.semProximo" : alarme.data ? "despertador.desativadoPassou" : "despertador.desativado");
    }
    definirTexto(item.contagem, texto);
  }

  const proximo = proximoGeral(alarmes, agora);
  if (proximo) {
    const fuso = proximo.alarme.fuso;
    const p = partesNoFuso(proximo.instante, fuso);
    const hoje = partesNoFuso(agora, fuso);
    const ehHoje = p.ano === hoje.ano && p.mes === hoje.mes && p.dia === hoje.dia;
    definirTexto($("#proximoAlarme"), t("despertador.em", { duracao: formatarDuracaoExtenso(Math.ceil((proximo.instante - agora) / 1000) * 1000) }));
    definirTexto(
      $("#proximoDetalhe"),
      t(ehHoje ? "despertador.proximoHoje" : "despertador.proximoData", {
        nome: proximo.alarme.rotulo || t("despertador.alarme"),
        hora: formatarHora(p, false),
        data: formatarDataCurta(p),
        lugar: nomeFuso(fuso, proximo.alarme.cidade),
      }),
    );
  } else {
    definirTexto($("#proximoAlarme"), t("despertador.nenhumAtivo"));
    definirTexto($("#proximoDetalhe"), t(alarmes.length ? "despertador.ativeNaLista" : "despertador.crieNoFormulario"));
  }
}

// ---- Disparo -------------------------------------------------------------------
function rearmar() {
  clearTimeout(idDisparo);
  const agora = relogio.agora();
  const proximo = proximoGeral(alarmes, agora);
  const espera = proximo ? Math.min(Math.max(0, proximo.instante - agora), MAXIMO_ESPERA) : MAXIMO_ESPERA;
  idDisparo = setTimeout(verificar, espera);
}

function verificar() {
  const agora = relogio.agora();
  // Pequena folga: o setTimeout pode disparar alguns ms antes.
  const vencidos = alarmesPerdidos(alarmes, verificadoEm ?? agora, agora + 250);
  marcarVerificado(agora + 250);
  for (const { alarme } of vencidos) disparar(alarme.id);
  rearmar();
}

function disparar(id) {
  const alarme = alarmes.find((a) => a.id === id);
  if (!alarme) return;
  // Alarme único sai da fila de disparos imediatamente; o semanal segue.
  alarmes = alarmes.map((a) => (a.id === id ? aposDisparo(a) : a));
  salvar();
  renderizar();
  fila.push(alarme);
  if (!tocandoAgora) tocarProximo();
}

let idPiscar = null;

function tocarProximo() {
  const alarme = fila.shift();
  if (!alarme) {
    tocandoAgora = null;
    return;
  }
  tocandoAgora = alarme;
  const nome = alarme.rotulo || t("despertador.alarme");
  const hora = alarme.hora;

  tocador.tocar({ som: alarme.som, repetir: true });
  notificar(`⏰ ${nome}`, t("despertador.notificacao", { hora, lugar: nomeFuso(alarme.fuso, alarme.cidade) }), { tag: `alarme-${alarme.id}` });
  anunciar(t("despertador.anuncio", { nome, hora }), "assertive");

  let alternado = false;
  clearInterval(idPiscar);
  idPiscar = setInterval(() => {
    alternado = !alternado;
    definirTitulo(alternado ? `⏰ ${hora}` : "");
  }, 1000);

  const botaoSoneca = el("button", { type: "button", class: "botao botao--secundario" }, t("despertador.soneca"));
  const botaoDesligar = el("button", { type: "button", class: "botao botao--primario" }, t("despertador.desligar"));
  const dialogo = criarDialogo({
    titulo: nome,
    classe: "dialogo--alarme",
    conteudo: [
      el("div", { class: "icone-alarme" }, icone("despertador")),
      el("p", { class: "visor visor--md" }, hora),
      el("p", { class: "texto-suave texto-pequeno dica-rodape-atalhos" }, nomeFuso(alarme.fuso, alarme.cidade)),
    ],
    acoes: [botaoSoneca, botaoDesligar],
    rotuloFechar: t("despertador.desligar"),
  });
  dialogo.id = "dialogoAlarme";
  botaoSoneca.addEventListener("click", () => dialogo.close("soneca"));
  botaoDesligar.addEventListener("click", () => dialogo.close("desligar"));
  dialogo.addEventListener("close", () => {
    tocador.parar();
    clearInterval(idPiscar);
    definirTitulo("");
    if (dialogo.returnValue === "soneca") {
      const agora = relogio.agora();
      alarmes = alarmes.map((a) => (a.id === alarme.id ? adiarAlarme({ ...a, ativo: true }, agora) : a));
      salvar();
      avisar(t("despertador.sonecaAviso"));
    }
    dialogo.remove();
    renderizar();
    rearmar();
    tocarProximo();
  });
  dialogo.showModal();
  botaoDesligar.focus();
}

// ---- Alarmes perdidos com a página fechada --------------------------------------
function verificarPerdidos() {
  const anterior = ler(CHAVE_VERIFICADO, null);
  const agora = relogio.agora();
  const perdidos = Number.isFinite(anterior) ? alarmesPerdidos(alarmes, anterior, agora) : [];
  if (perdidos.length) {
    const listaPerdidos = $("#listaPerdidos");
    listaPerdidos.replaceChildren(
      ...perdidos.map(({ alarme, instante }) => {
        const p = partesNoFuso(instante, alarme.fuso);
        return el(
          "li",
          {},
          t("despertador.perdido", {
            hora: `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`,
            rotulo: alarme.rotulo ? ` (${alarme.rotulo})` : "",
            data: formatarDataCurta(p),
          }),
        );
      }),
    );
    $("#avisoPerdidos").hidden = false;
    alarmes = alarmes.map((a) => (perdidos.some((p) => p.alarme.id === a.id) ? aposDisparo(a) : a));
    salvar();
  }
  marcarVerificado(agora);
}
$("#botaoFecharPerdidos").addEventListener("click", () => {
  $("#avisoPerdidos").hidden = true;
});

// ---- Notificações e tela ativa ------------------------------------------------------
function atualizarNotificacao() {
  const estado = estadoNotificacao();
  definirTexto($("#estadoNotificacao"), t(`avisos.notificacao.${estado}`));
  $("#botaoNotificacao").hidden = estado !== "default";
}
$("#botaoNotificacao").addEventListener("click", async () => {
  prepararAudio();
  await pedirPermissaoNotificacao();
  atualizarNotificacao();
});

const campoTela = $("#campoTelaAtiva");
if (!BloqueioTela.disponivel()) {
  campoTela.disabled = true;
  definirTexto($("#estadoTelaAtiva"), t("avisos.tela.naoSuportado"));
}
campoTela.addEventListener("change", async () => {
  if (campoTela.checked) {
    const ok = await bloqueio.ativar();
    if (!ok) {
      campoTela.checked = false;
      avisar(t("despertador.telaFalhou"));
    }
  } else {
    await bloqueio.desativar();
  }
});
bloqueio.addEventListener("mudanca", (evento) => {
  if (BloqueioTela.disponivel()) {
    definirTexto(
      $("#estadoTelaAtiva"),
      evento.detail.ativo
        ? t("avisos.tela.ativo")
        : evento.detail.desejado
          ? t("despertador.telaVolta")
          : t("despertador.telaEnquantoVisivel"),
    );
  }
});

// ---- Início -----------------------------------------------------------------------
definirModo("unico");
atualizarAjudaFuso();
atualizarNotificacao();

// Espera a primeira sincronização (ou o fallback) antes de checar perdas,
// para não confundir um relógio local errado com alarmes perdidos.
let iniciado = false;
function iniciar() {
  if (iniciado) return;
  iniciado = true;
  verificarPerdidos();
  definirDataPadrao();
  renderizar();
  rearmar();
  agendarPorSegundo(atualizarContagens, () => relogio.agora());
}
if (relogio.estado.status !== "sincronizando") iniciar();
else {
  relogio.addEventListener("estado", function aoSincronizar(evento) {
    if (evento.detail.status !== "sincronizando") {
      relogio.removeEventListener("estado", aoSincronizar);
      iniciar();
    }
  });
  setTimeout(iniciar, 6000);
}

// Ao voltar para a aba, o timer pode ter atrasado: verifica na hora.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && iniciado) verificar();
});
relogio.addEventListener("estado", () => {
  if (iniciado) rearmar();
});
window.addEventListener("pagehide", () => {
  if (iniciado) marcarVerificado(relogio.agora());
});

registrarAtalhos([
  {
    tecla: "n",
    descricao: "despertador.novo",
    acao: () => {
      limparFormulario();
      campoHora.focus();
    },
  },
]);
