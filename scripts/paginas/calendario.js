// Calendário: visões anual (padrão), mensal e semanal com feriados da
// localidade, pontos facultativos, datas comemorativas, contagens salvas e
// eventos pessoais — na conta, quando há sessão, ou neste navegador.
//
// País: o Brasil usa os dados próprios do site (com estado e capital); os
// outros países do relógio mundial vêm de /api/feriados, carregados por ano
// conforme o calendário navega (ver scripts/nucleo/feriados-paises.js).
//
// Sistema: gregoriano por padrão, ou outro que o navegador saiba calcular
// (hegírico, hebraico, chinês, persa…). Só muda a grade e a escrita das
// datas; os eventos são os mesmos (ver scripts/nucleo/sistemas-calendario.js).

import "../i18n/index.js";
import { locale, t, urlLocal } from "../i18n/estado.js";
import { aoMudarEmOutraAba, gravar, ler } from "../nucleo/armazenamento.js";
import { classeMarca, classeSeloEvento, criarCalendario, legendaCalendario } from "../nucleo/calendario.js";
import { abrirArmazemEventos, cadastrar, entrar, enviarLocaisParaConta, estadoConta, eventosLocais, excluirConta, sair } from "../nucleo/conta.js";
import { LIMITE_DESCRICAO, LIMITE_TITULO, ocorrencias } from "../nucleo/eventos.js";
import { eventosNoIntervalo } from "../nucleo/feriados.js";
import {
  PAIS_COM_DADOS_PROPRIOS,
  carregarFeriados,
  feriadosEmCache,
  paisPreferido,
  paisesComFeriados,
  salvarPaisPreferido,
} from "../nucleo/feriados-paises.js";
import { fusoPreferido } from "../nucleo/fuso-preferido.js";
import { ligarSeletorLocalidade } from "../nucleo/localidade.js";
import { nomesCurtos, salvarSistemaPreferido, sistemaPreferido, sistemasDisponiveis } from "../nucleo/sistemas-calendario.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import {
  anoBissexto,
  capitalizar,
  dataIso,
  deDiaJuliano,
  diaDoAno,
  diaJuliano,
  formatarDataExtenso,
  lerDataIso,
  lerHora,
  partesNoFuso,
  semanaIso,
} from "../nucleo/tempo.js";
import { $, $$, agendarPorSegundo, anunciar, avisar, confirmar, criarDialogo, definirTexto, el, preencherSelect } from "../nucleo/ui.js";

const relogio = obterRelogio();
const fusoHoje = () => fusoPreferido().fuso;
let hoje = partesNoFuso(relogio.agora(), fusoHoje());
let hojeJuliano = diaJuliano(hoje.ano, hoje.mes, hoje.dia);

// ---- Fontes de eventos -----------------------------------------------------------

const localidade = ligarSeletorLocalidade($("#selectUf"), $("#selectMunicipio"), {
  aoMudar: () => redesenhar(),
});

// ---- País ----------------------------------------------------------------------------
// ?pais= na URL tem prioridade; depois, a mesma escolha da página inicial.
let pais = paisPreferido(new URLSearchParams(location.search).get("pais"));
const ehBrasil = () => pais === PAIS_COM_DADOS_PROPRIOS;
const selectPais = $("#selectPais");

function nomeDoPais(codigo) {
  try {
    return new Intl.DisplayNames([locale()], { type: "region" }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

function preencherPaises(codigos) {
  const opcoes = codigos
    .map((c) => ({ valor: c, rotulo: nomeDoPais(c) }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, locale()));
  preencherSelect(selectPais, opcoes, pais);
}

function aplicarPais() {
  for (const campo of $$("[data-so-brasil]")) campo.hidden = !ehBrasil();
  $("#areaLegenda").replaceChildren(legendaCalendario({ contagens: true, pessoais: true, outroPais: !ehBrasil() }));
  erroFeriados = null;
  redesenhar();
}

selectPais.addEventListener("change", () => {
  pais = selectPais.value;
  salvarPaisPreferido(pais);
  aplicarPais();
});

// A lista começa com o país atual; a consulta traz os que a fonte cobre.
preencherPaises([...new Set([PAIS_COM_DADOS_PROPRIOS, pais])]);
paisesComFeriados().then((codigos) => preencherPaises(codigos.includes(pais) ? codigos : [...codigos, pais]));

// ---- Feriados de outros países: carregados por ano, sob demanda -------------------
let erroFeriados = null;
let carregando = 0;
const pedidos = new Set();

function feriadosDoPais(inicio, fim) {
  const anoInicio = deDiaJuliano(inicio).ano;
  const anoFim = deDiaJuliano(fim).ano;
  const lista = [];
  for (let ano = anoInicio; ano <= anoFim; ano += 1) {
    const registro = feriadosEmCache(pais, ano);
    if (registro) lista.push(...registro.eventos.filter((e) => e.juliano >= inicio && e.juliano <= fim));
    pedirAno(pais, ano, registro);
  }
  return lista;
}

// Uma consulta por país/ano nesta visita; carregarFeriados decide se o cache basta.
function pedirAno(codigo, ano, registro) {
  const k = `${codigo}:${ano}`;
  if (pedidos.has(k)) return;
  pedidos.add(k);
  carregando += 1;
  carregarFeriados(codigo, ano)
    .then((r) => {
      if (codigo !== pais) return;
      if (r.desatualizado) erroFeriados = { codigo: "desatualizado", ano };
      // Só redesenha se chegou algo diferente do que já está na tela.
      if (r !== registro) setTimeout(redesenhar);
    })
    .catch((erro) => {
      if (codigo === pais) erroFeriados = { codigo: erro.message, ano };
      pedidos.delete(k);
    })
    .finally(() => {
      carregando -= 1;
      mostrarEstadoFeriados();
    });
}

function mostrarEstadoFeriados() {
  const area = $("#estadoFeriados");
  if (ehBrasil()) {
    area.hidden = true;
    return;
  }
  const partes = [];
  if (carregando > 0) partes.push(el("span", {}, t("calendario.feriadosCarregando")));
  else if (erroFeriados?.codigo === "sem-dados") {
    partes.push(el("span", {}, t("calendario.feriadosSemDados", { pais: nomeDoPais(pais), ano: erroFeriados.ano })));
  } else if (erroFeriados) {
    partes.push(
      el("span", {}, t(erroFeriados.codigo === "desatualizado" ? "calendario.feriadosDesatualizados" : "calendario.feriadosErro")),
      el("button", { type: "button", class: "link-botao", onclick: tentarDeNovo }, t("comum.tentarNovamente")),
    );
  }
  partes.push(el("span", {}, t("calendario.fonteFeriados"), " ", el("a", { href: "https://date.nager.at", rel: "noopener" }, "Nager.Date")));
  area.replaceChildren(...partes);
  area.hidden = false;
}

function tentarDeNovo() {
  erroFeriados = null;
  pedidos.clear();
  redesenhar();
}

function opcoesLocal() {
  const { uf, municipio } = localidade.selecao;
  return { uf: uf || null, municipio: municipio || null };
}

/** Contagens salvas pela página /contagem, validadas (dados do armazenamento local). */
function lerContagens() {
  const lista = ler("contagem:lista", []);
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((c) => c && typeof c === "object" && typeof c.titulo === "string")
    .map((c) => {
      const data = lerDataIso(c.data);
      if (!data) return null;
      return {
        id: `contagem-${String(c.id ?? c.data)}`,
        nome: c.titulo.slice(0, 80) || t("paginas.contagem.rotulo"),
        tipo: "contagem",
        folga: false,
        hora: lerHora(c.hora) ? c.hora : null,
        juliano: diaJuliano(data.ano, data.mes, data.dia),
      };
    })
    .filter(Boolean);
}

let contagens = lerContagens();
aoMudarEmOutraAba("contagem:lista", () => {
  contagens = lerContagens();
  redesenhar();
});

let armazem = { origem: "local", lista: eventosLocais() };

function eventosPessoais(inicio, fim) {
  return ocorrencias(armazem.lista, inicio, fim).map(({ juliano, evento }) => ({
    id: evento.id,
    nome: evento.titulo,
    tipo: "pessoal",
    folga: false,
    hora: evento.hora,
    juliano,
    evento,
  }));
}

function eventosEntre(inicio, fim) {
  return [
    ...(ehBrasil() ? eventosNoIntervalo(inicio, fim, opcoesLocal()) : feriadosDoPais(inicio, fim)),
    ...contagens.filter((c) => c.juliano >= inicio && c.juliano <= fim),
    ...eventosPessoais(inicio, fim),
  ];
}

// ---- Calendário ---------------------------------------------------------------------

const parametros = new URLSearchParams(location.search);
const visaoUrl = parametros.get("visao");
const calendario = criarCalendario({
  obterEventos: eventosEntre,
  aoSelecionar: (juliano) => mostrarDia(juliano),
  aoAtivar: (juliano) => abrirEditor({ juliano }),
  aoMudarVisao: (visao) => gravar("calendario:visao", visao),
  visao: ["ano", "mes", "semana"].includes(visaoUrl) ? visaoUrl : ler("calendario:visao", "ano"),
  sistema: sistemaPreferido(parametros.get("sistema")),
});
$("#areaCalendario").append(calendario.elemento);

// ---- Sistema de calendário ------------------------------------------------------------
const selectSistema = $("#selectSistema");
// O gregoriano primeiro; os demais em ordem alfabética no idioma.
const sistemas = sistemasDisponiveis();
const rotulos = nomesCurtos(sistemas);
const [gregoriano, ...outros] = sistemas.map((s, i) => ({ valor: s, rotulo: rotulos[i] }));
outros.sort((a, b) => a.rotulo.localeCompare(b.rotulo, locale()));
preencherSelect(selectSistema, [gregoriano, ...outros], calendario.sistema.id);
selectSistema.addEventListener("change", () => {
  salvarSistemaPreferido(selectSistema.value);
  calendario.definirSistema(selectSistema.value);
  mostrarDia(calendario.estado.selecionado);
});

function redesenhar() {
  calendario.atualizar();
  mostrarDia(calendario.estado.selecionado);
  mostrarEstadoFeriados();
}

// ---- Painel do dia -----------------------------------------------------------------

function relativo(juliano) {
  const diff = juliano - hojeJuliano;
  if (diff === 0) return capitalizar(t("tempo.hoje"));
  if (diff === 1) return capitalizar(t("tempo.amanha"));
  if (diff === -1) return capitalizar(t("tempo.ontem"));
  return diff > 0 ? t("calendario.daquiA", { n: diff }) : t("calendario.ha", { n: -diff });
}

const SETORES = { Bank: "calendario.setor.bancos", School: "calendario.setor.escolas", Authorities: "calendario.setor.orgaos" };

function rotuloEvento(evento) {
  const tipo = t(`calendario.tipo.${evento.tipo}`);
  if (evento.tipo === "estadual") return `${capitalizar(tipo)} · ${evento.uf}`;
  if (evento.tipo === "municipal") return `${capitalizar(tipo)} · ${evento.municipio}`;
  if (evento.tipo === "setorial" && evento.setores?.length) {
    return `${capitalizar(tipo)} · ${evento.setores.map((s) => t(SETORES[s])).join(", ")}`;
  }
  return capitalizar(tipo);
}

/** Onde vale um feriado regional: "DE-BW, DE-BY" → "Só em: BW, BY". */
function regioesDoEvento(evento) {
  return t("calendario.soEm", { regioes: evento.regioes.map((r) => r.replace(/^[A-Z]{2}-/, "")).join(", ") });
}

function itemEvento(evento) {
  const pessoal = evento.tipo === "pessoal";
  const nome = evento.hora ? t("calendario.nomeComHora", { nome: evento.nome, hora: evento.hora }) : evento.nome;
  return el(
    "div",
    { class: `evento-dia evento-dia--${classeMarca(evento)}` },
    el("span", { class: classeSeloEvento(evento) }, rotuloEvento(evento)),
    el("strong", { class: "evento-dia__nome" }, nome),
    evento.nomeIngles ? el("span", { class: "texto-xs texto-fraco", lang: "en" }, evento.nomeIngles) : null,
    evento.regioes ? el("span", { class: "texto-xs texto-fraco" }, regioesDoEvento(evento)) : null,
    pessoal && evento.evento.descricao ? el("p", { class: "evento-dia__descricao" }, evento.evento.descricao) : null,
    pessoal && evento.evento.anual ? el("span", { class: "texto-xs texto-fraco" }, t("eventos.repeteTodoAno")) : null,
    pessoal
      ? el(
          "div",
          { class: "evento-dia__acoes" },
          el("button", { type: "button", class: "link-botao", onclick: () => abrirEditor({ evento: evento.evento }) }, t("comum.editar")),
          el("button", { type: "button", class: "link-botao link-botao--perigo", onclick: () => excluirEvento(evento.evento) }, t("comum.excluir")),
        )
      : null,
  );
}

function mostrarDia(juliano) {
  if (juliano == null) return;
  const d = deDiaJuliano(juliano);
  const eventos = eventosEntre(juliano, juliano);
  const fimDeSemana = d.diaSemana === 0 || d.diaSemana === 6;
  const situacao = eventos.some((e) => e.folga)
    ? "calendario.situacao.feriado"
    : fimDeSemana
      ? "calendario.situacao.fimDeSemana"
      : eventos.some((e) => e.tipo === "facultativo" || e.tipo === "opcional")
        ? "calendario.situacao.facultativo"
        : "calendario.situacao.util";

  definirTexto($("#tituloDia"), capitalizar(formatarDataExtenso(d)));
  const sistema = calendario.sistema;
  const dataNoSistema = $("#dataNoSistema");
  dataNoSistema.hidden = sistema.gregoriano;
  if (!sistema.gregoriano) definirTexto(dataNoSistema, capitalizar(sistema.data(juliano, { comSemana: false })));
  const linhas = [
    [t("calendario.campo.situacao"), t(situacao)],
    [t("calendario.campo.relativo"), relativo(juliano)],
    [t("calendario.campo.diaDoAno"), t("calendario.diaDoAnoValor", { dia: diaDoAno(d.ano, d.mes, d.dia), total: anoBissexto(d.ano) ? 366 : 365 })],
    [t("calendario.campo.semana"), String(semanaIso(d.ano, d.mes, d.dia))],
  ];
  $("#dadosDia").replaceChildren(...linhas.map(([dt, dd]) => el("div", {}, el("dt", {}, dt), el("dd", {}, dd))));

  $("#eventosDia").replaceChildren(
    ...(eventos.length ? eventos.map(itemEvento) : [el("p", { class: "texto-fraco" }, t("calendario.diaVazio"))]),
  );

  const titulo = eventos.find((e) => e.tipo !== "contagem")?.nome ?? capitalizar(formatarDataExtenso(d, { comSemana: false }));
  const busca = new URLSearchParams({ titulo, data: `${dataIso(d.ano, d.mes, d.dia)}T00:00`, fuso: fusoHoje() });
  $("#linkContagem").href = urlLocal(`/contagem?${busca}`);
}

// ---- Editor de eventos ------------------------------------------------------------------

function abrirEditor({ evento = null, juliano = calendario.estado.selecionado } = {}) {
  const d = deDiaJuliano(juliano);
  const campo = (rotulo, controle, erro) =>
    el("label", { class: "campo" }, el("span", { class: "campo__rotulo" }, rotulo), controle, erro);
  const erro = () => el("span", { class: "campo__erro", hidden: true });
  const titulo = el("input", { class: "entrada", type: "text", maxlength: String(LIMITE_TITULO), required: true, autocomplete: "off", id: "eventoTitulo" });
  const data = el("input", { class: "entrada", type: "date", required: true, id: "eventoData" });
  const hora = el("input", { class: "entrada", type: "time", step: "60", id: "eventoHora" });
  const descricao = el("textarea", { class: "entrada", rows: "3", maxlength: String(LIMITE_DESCRICAO), id: "eventoDescricao" });
  const anual = el("input", { type: "checkbox", id: "eventoAnual" });
  const erros = { titulo: erro(), data: erro(), hora: erro() };
  const erroGeral = el("p", { class: "campo__erro", role: "alert", hidden: true });

  titulo.value = evento?.titulo ?? "";
  data.value = evento?.data ?? dataIso(d.ano, d.mes, d.dia);
  hora.value = evento?.hora ?? "";
  descricao.value = evento?.descricao ?? "";
  anual.checked = evento?.anual ?? false;

  const formulario = el(
    "form",
    { class: "pilha", novalidate: true, id: "formEvento" },
    campo(t("eventos.titulo"), titulo, erros.titulo),
    el("div", { class: "campos campos--2-fixo" }, campo(t("eventos.data"), data, erros.data), campo(t("eventos.hora"), hora, erros.hora)),
    campo(t("eventos.descricao"), descricao),
    el("label", { class: "opcao" }, anual, el("span", { class: "opcao__texto" }, el("strong", {}, t("eventos.anual")), el("span", {}, t("eventos.anualAjuda")))),
    erroGeral,
    el("p", { class: "texto-xs texto-fraco" }, t(armazem.origem === "conta" ? "eventos.salvoNaConta" : "eventos.salvoLocal")),
  );
  const botaoSalvar = el("button", { type: "submit", class: "botao botao--primario", form: "formEvento" }, t("comum.salvar"));
  const acoes = [botaoSalvar];
  if (evento) {
    acoes.unshift(
      el("button", { type: "button", class: "botao botao--fantasma", onclick: () => dialogo.close() || excluirEvento(evento) }, t("comum.excluir")),
    );
  }
  const dialogo = criarDialogo({ titulo: t(evento ? "eventos.editar" : "eventos.novo"), conteudo: formulario, acoes });

  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    for (const no of [...Object.values(erros), erroGeral]) no.hidden = true;
    botaoSalvar.setAttribute("aria-busy", "true");
    const r = await armazem.salvar(
      { titulo: titulo.value, data: data.value, hora: hora.value || null, descricao: descricao.value, anual: anual.checked },
      evento?.id,
    );
    botaoSalvar.removeAttribute("aria-busy");
    if (!r.ok) {
      for (const [nome, codigo] of Object.entries(r.erros ?? {})) {
        if (!erros[nome]) continue;
        erros[nome].textContent = t(`eventos.erro.${nome}.${codigo}`);
        erros[nome].hidden = false;
      }
      if (!r.erros) {
        erroGeral.textContent = mensagemErro(r.erro);
        erroGeral.hidden = false;
      }
      return;
    }
    dialogo.close();
    const novo = lerDataIso(r.evento.data);
    calendario.selecionar(diaJuliano(novo.ano, novo.mes, novo.dia));
    redesenhar();
    avisar(t(evento ? "eventos.atualizado" : "eventos.criado"));
  });
  dialogo.addEventListener("close", () => dialogo.remove());
  dialogo.showModal();
  titulo.focus();
}

async function excluirEvento(evento) {
  const ok = await confirmar({
    titulo: t("eventos.excluirTitulo"),
    mensagem: t("eventos.excluirMensagem", { titulo: evento.titulo }),
    confirmar: t("comum.excluir"),
    perigo: true,
  });
  if (!ok) return;
  const r = await armazem.excluir(evento.id);
  if (!r.ok) return avisar(mensagemErro(r.erro));
  redesenhar();
  anunciar(t("eventos.excluido"));
}

$("#botaoNovoEvento").addEventListener("click", () => abrirEditor());

// ---- Conta ------------------------------------------------------------------------------

function mensagemErro(codigo) {
  const chave = `conta.erro.${codigo}`;
  const texto = t(chave);
  return texto === chave ? t("conta.erro.interno") : texto;
}

let conta = null;

function renderizarConta(estado) {
  const texto = $("#contaTexto");
  const acoes = $("#contaAcoes");
  acoes.replaceChildren();
  texto.removeAttribute("data-i18n");
  if (estado.conta) {
    definirTexto(texto, t("conta.conectada", { email: estado.conta.email }));
    acoes.append(
      el("button", { type: "button", class: "link-botao", onclick: encerrar }, t("conta.sair")),
      el("button", { type: "button", class: "link-botao link-botao--perigo", onclick: abrirExclusao }, t("conta.excluir")),
    );
  } else if (estado.disponivel) {
    definirTexto(texto, t("conta.soNavegador"));
    acoes.append(el("button", { type: "button", class: "botao botao--secundario botao--pequeno", id: "botaoEntrar", onclick: abrirLogin }, t("conta.entrarOuCriar")));
  } else {
    definirTexto(texto, estado.offline ? t("conta.offline") : t("conta.indisponivel"));
  }
}

async function carregarConta() {
  const estado = await estadoConta();
  conta = estado.conta;
  armazem = await abrirArmazemEventos(conta);
  renderizarConta(estado);
  redesenhar();
}

function abrirLogin() {
  let modo = "entrar";
  const email = el("input", { class: "entrada", type: "email", autocomplete: "email", required: true, id: "contaEmail" });
  const senha = el("input", { class: "entrada", type: "password", autocomplete: "current-password", required: true, minlength: "8", id: "contaSenha" });
  const ajudaSenha = el("span", { class: "campo__ajuda" });
  const erro = el("p", { class: "campo__erro", role: "alert", hidden: true });
  const abas = el(
    "div",
    { class: "segmentado", role: "group", "aria-label": t("conta.titulo") },
    ["entrar", "cadastrar"].map((m) => el("button", { type: "button", dataset: { modo: m }, "aria-pressed": String(m === modo) }, t(`conta.aba.${m}`))),
  );
  const formulario = el(
    "form",
    { class: "pilha", novalidate: true, id: "formConta" },
    abas,
    el("label", { class: "campo" }, el("span", { class: "campo__rotulo" }, t("conta.email")), email),
    el("label", { class: "campo" }, el("span", { class: "campo__rotulo" }, t("conta.senha")), senha, ajudaSenha),
    erro,
    el("p", { class: "texto-xs texto-fraco" }, t("conta.privacidade")),
  );
  const botao = el("button", { type: "submit", class: "botao botao--primario", form: "formConta" });
  const definirModo = (m) => {
    modo = m;
    for (const b of abas.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.modo === m));
    botao.textContent = t(`conta.acao.${m}`);
    senha.autocomplete = m === "cadastrar" ? "new-password" : "current-password";
    ajudaSenha.textContent = m === "cadastrar" ? t("conta.senhaAjuda") : "";
    erro.hidden = true;
  };
  abas.addEventListener("click", (e) => {
    const b = e.target.closest("[data-modo]");
    if (b) definirModo(b.dataset.modo);
  });
  definirModo(modo);
  const dialogo = criarDialogo({ titulo: t("conta.titulo"), conteudo: formulario, acoes: [botao] });

  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    erro.hidden = true;
    botao.setAttribute("aria-busy", "true");
    const r = await (modo === "cadastrar" ? cadastrar : entrar)(email.value, senha.value);
    botao.removeAttribute("aria-busy");
    if (!r.ok) {
      erro.textContent = mensagemErro(r.erro);
      erro.hidden = false;
      return;
    }
    senha.value = "";
    dialogo.close();
    await carregarConta();
    avisar(t("conta.bemVindo"));
    oferecerEnvioDosLocais();
  });
  dialogo.addEventListener("close", () => {
    dialogo.remove();
    $("#botaoEntrar")?.focus();
  });
  dialogo.showModal();
  email.focus();
}

async function oferecerEnvioDosLocais() {
  const locais = eventosLocais().length;
  if (!locais || armazem.origem !== "conta") return;
  const ok = await confirmar({
    titulo: t("conta.enviarTitulo"),
    mensagem: t("conta.enviarMensagem", { n: locais }),
    confirmar: t("conta.enviar"),
    cancelar: t("conta.manterLocal"),
  });
  if (!ok) return;
  const r = await enviarLocaisParaConta(armazem);
  redesenhar();
  avisar(r.falhas ? t("conta.enviadosParcial", { n: r.enviados, falhas: r.falhas }) : t("conta.enviados", { n: r.enviados }));
}

async function encerrar() {
  await sair();
  await carregarConta();
  avisar(t("conta.saiu"));
}

function abrirExclusao() {
  const senha = el("input", { class: "entrada", type: "password", autocomplete: "current-password", required: true, id: "senhaExclusao" });
  const erro = el("p", { class: "campo__erro", role: "alert", hidden: true });
  const botao = el("button", { type: "submit", class: "botao botao--perigo", form: "formExclusao" }, t("conta.excluirDefinitivo"));
  const formulario = el(
    "form",
    { class: "pilha", id: "formExclusao", novalidate: true },
    el("p", { class: "texto-suave texto-pequeno" }, t("conta.excluirMensagem")),
    el("label", { class: "campo" }, el("span", { class: "campo__rotulo" }, t("conta.senha")), senha),
    erro,
  );
  const dialogo = criarDialogo({ titulo: t("conta.excluir"), conteudo: formulario, acoes: [botao] });
  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    botao.setAttribute("aria-busy", "true");
    const r = await excluirConta(senha.value);
    botao.removeAttribute("aria-busy");
    if (!r.ok) {
      erro.textContent = mensagemErro(r.erro);
      erro.hidden = false;
      return;
    }
    dialogo.close();
    await carregarConta();
    avisar(t("conta.excluida"));
  });
  dialogo.addEventListener("close", () => dialogo.remove());
  dialogo.showModal();
  senha.focus();
}

// ---- Início ---------------------------------------------------------------------------------

// Abre em uma data específica com ?data=AAAA-MM-DD (validada).
const dataUrl = lerDataIso(parametros.get("data"));
const inicial = dataUrl ? diaJuliano(dataUrl.ano, dataUrl.mes, dataUrl.dia) : hojeJuliano;

calendario.definirHoje(hojeJuliano);
calendario.mostrar(inicial);
aplicarPais();
mostrarDia(inicial);
carregarConta();

agendarPorSegundo((agora) => {
  const p = partesNoFuso(agora, fusoHoje());
  const j = diaJuliano(p.ano, p.mes, p.dia);
  if (j === hojeJuliano) return;
  hoje = p;
  hojeJuliano = j;
  calendario.definirHoje(j);
  redesenhar();
}, () => relogio.agora());
