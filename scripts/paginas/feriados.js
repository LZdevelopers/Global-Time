// Página de feriados: lista anual por localidade, filtros, feriadões,
// próximo feriado, calendário mensal e exportação para agendas.

import "../i18n/index.js";
import { idiomaAtual, t } from "../i18n/estado.js";
import { gravar, ler } from "../nucleo/armazenamento.js";
import { classeSeloEvento, criarCalendario, legendaCalendario } from "../nucleo/calendario.js";
import {
  analisarFeriadao,
  eventosDoAno,
  eventosNoIntervalo,
  gerarIcs,
  linkGoogleAgenda,
  observacaoVisivel,
  parcialTraduzido,
} from "../nucleo/feriados.js";
import { ligarSeletorLocalidade, textoCobertura } from "../nucleo/localidade.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import {
  FUSO_BRASILIA,
  capitalizar,
  deDiaJuliano,
  diaJuliano,
  doisDigitos,
  formatarDataExtenso,
  formatarDataIntl,
  formatarMesAno,
  nomeDiaSemana,
  nomeMes,
  partesNoFuso,
} from "../nucleo/tempo.js";
import { $, agendarPorSegundo, anunciar, avisar, baixarArquivo, definirTexto, el, icone } from "../nucleo/ui.js";

const relogio = obterRelogio();

// Os feriados são do Brasil: o "hoje" usado aqui é o de Brasília.
const FILTROS = [
  { chave: "todos", teste: () => true },
  { chave: "feriados", teste: (e) => e.folga },
  { chave: "facultativos", teste: (e) => e.tipo === "facultativo" },
  { chave: "comemorativas", teste: (e) => e.tipo === "comemorativa" },
];

let hoje = partesNoFuso(relogio.agora(), FUSO_BRASILIA);
let hojeJuliano = diaJuliano(hoje.ano, hoje.mes, hoje.dia);
const ANO_MINIMO = hoje.ano - 5;
const ANO_MAXIMO = hoje.ano + 5;

const parametros = new URLSearchParams(location.search);
const anoUrl = Number(parametros.get("ano"));
let ano = Number.isInteger(anoUrl) && anoUrl >= ANO_MINIMO && anoUrl <= ANO_MAXIMO ? anoUrl : hoje.ano;

const salvo = ler("feriados:selecao", {}) ?? {};
let filtro = FILTROS.some((f) => f.chave === salvo.filtro) ? salvo.filtro : "todos";

const localidade = ligarSeletorLocalidade($("#selectUf"), $("#selectMunicipio"), {
  aoMudar: () => {
    renderizar();
    anunciar(t("feriados.listaAtualizada"));
  },
});

function opcoesLocal() {
  const { uf, municipio } = localidade.selecao;
  return { uf: uf || null, municipio: municipio || null };
}

/** "02/11" em português; dia e mês curtos no formato do idioma nos demais. */
function dataCurta(juliano) {
  const d = deDiaJuliano(juliano);
  if (idiomaAtual() === "pt-BR") return `${doisDigitos(d.dia)}/${doisDigitos(d.mes)}`;
  return formatarDataIntl(d, { day: "2-digit", month: "2-digit" });
}

function rotuloTipo(evento) {
  if (evento.tipo === "estadual") return `${evento.rotuloTipo} · ${evento.uf}`;
  if (evento.tipo === "municipal") return `${evento.rotuloTipo} · ${evento.municipio}`;
  return evento.rotuloTipo;
}

function relativo(juliano) {
  const diff = juliano - hojeJuliano;
  if (diff === 0) return t("tempo.hoje");
  if (diff === 1) return t("tempo.amanha");
  if (diff === -1) return t("tempo.ontem");
  return diff > 0 ? t("feriados.faltam", { n: diff }) : t("feriados.ha", { n: -diff });
}

/** Texto do selo de feriadão/emenda, ou null. */
function textoFeriadao(evento) {
  if (!evento.folga) return null;
  const d = deDiaJuliano(evento.juliano);
  if (d.diaSemana === 0 || d.diaSemana === 6) return null;
  const analise = analisarFeriadao(evento.juliano, opcoesLocal());
  if (analise.tipo === "feriadao") {
    return t("feriados.feriadao", { n: analise.dias, inicio: dataCurta(analise.inicio), fim: dataCurta(analise.fim) });
  }
  if (analise.tipo === "emenda") {
    const ponte = deDiaJuliano(analise.ponte);
    return t("feriados.emenda", { dia: nomeDiaSemana(ponte.diaSemana), data: dataCurta(analise.ponte), n: analise.dias });
  }
  return null;
}

function nomeArquivo(base) {
  const { uf, municipio } = opcoesLocal();
  const local = [uf, municipio].filter(Boolean).join("-") || "nacional";
  return `${base}-${local}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "-")
    .toLowerCase();
}

function nomeCalendario() {
  const { uf, municipio } = opcoesLocal();
  const lugar = municipio || uf || t("feriados.brasil");
  return `${t("feriados.nomeCalendario", { ano: String(ano), lugar })} (GlobalTime)`;
}

function exportarIcs(eventos, arquivo) {
  baixarArquivo(`${arquivo}.ics`, gerarIcs(eventos, { nome: nomeCalendario() }), "text/calendar;charset=utf-8");
  avisar(t("feriados.exportados", { n: eventos.length }));
}

function criarItem(evento) {
  const d = deDiaJuliano(evento.juliano);
  const passado = evento.juliano < hojeJuliano;
  const feriadao = textoFeriadao(evento);
  const meta = [capitalizar(nomeDiaSemana(d.diaSemana)), relativo(evento.juliano)];
  if (evento.parcial) meta.splice(1, 0, parcialTraduzido(evento.parcial));
  if (feriadao) meta.push(feriadao);
  const acao = (props, nome) => el(props.href ? "a" : "button", { class: "botao botao--fantasma botao--icone botao--mini", ...props }, icone(nome, "icone--sm"));

  return el(
    "li",
    { class: `evento${passado ? " evento--passado" : ""}`, id: `evento-${evento.id}` },
    el(
      "div",
      { class: "evento__data", "aria-hidden": "true" },
      el("span", { class: "evento__dia" }, doisDigitos(d.dia)),
      el("span", { class: "evento__mes" }, nomeMes(d.mes, true).replace(".", "")),
    ),
    el(
      "div",
      { class: "evento__conteudo" },
      el(
        "div",
        { class: "evento__topo" },
        el("h4", { class: "evento__nome" }, el("span", { class: "sr-only" }, `${formatarDataExtenso(d, { comAno: false })}: `), evento.nome),
        el("span", { class: classeSeloEvento(evento) }, rotuloTipo(evento)),
      ),
      el("p", { class: "evento__meta" }, meta.join(" · ")),
      observacaoVisivel(evento) ? el("p", { class: "evento__meta texto-xs" }, evento.observacao) : null,
    ),
    el(
      "div",
      { class: "evento__acoes" },
      acao(
        {
          href: linkGoogleAgenda(evento),
          target: "_blank",
          rel: "noopener noreferrer",
          title: "Google Agenda",
          "aria-label": t("feriados.acaoGoogle", { nome: evento.nome }),
        },
        "calendario",
      ),
      acao(
        {
          type: "button",
          title: t("feriados.baixarIcs"),
          "aria-label": t("feriados.acaoIcs", { nome: evento.nome }),
          onclick: () => exportarIcs([evento], nomeArquivo(evento.id)),
        },
        "baixar",
      ),
      evento.fonte
        ? acao(
            {
              href: evento.fonte,
              target: "_blank",
              rel: "noopener noreferrer",
              title: evento.baseLegal ?? t("feriados.baseLegal"),
              "aria-label": t(evento.baseLegal ? "feriados.acaoFonteLei" : "feriados.acaoFonte", { nome: evento.nome, lei: evento.baseLegal ?? "" }),
            },
            "link",
          )
        : null,
    ),
  );
}

let eventosAno = [];

function renderizarFiltros() {
  const caixa = $("#filtros");
  caixa.replaceChildren(
    ...FILTROS.map((f) =>
      el(
        "button",
        {
          type: "button",
          class: "ficha",
          "aria-pressed": String(f.chave === filtro),
          dataset: { filtro: f.chave },
          onclick: () => {
            filtro = f.chave;
            gravar("feriados:selecao", { ...(ler("feriados:selecao", {}) ?? {}), filtro });
            renderizarLista();
            renderizarFiltros();
          },
        },
        t(`feriados.filtro.${f.chave}`),
        " ",
        el("span", { class: "ficha__contagem" }, String(eventosAno.filter(f.teste).length)),
      ),
    ),
  );
}

function eventosFiltrados() {
  const teste = FILTROS.find((f) => f.chave === filtro).teste;
  return eventosAno.filter(teste);
}

function renderizarLista() {
  const lista = eventosFiltrados();
  const area = $("#listaMeses");
  const folgas = eventosAno.filter((e) => e.folga).length;
  definirTexto($("#resumoLista"), `${t("feriados.resumoDatas", { n: lista.length })} · ${t("feriados.resumoFolgas", { n: folgas })}`);
  if (!lista.length) {
    area.replaceChildren(el("div", { class: "estado-vazio" }, el("strong", {}, t("feriados.vazioTitulo")), t("feriados.vazioTexto")));
    return;
  }
  const meses = new Map();
  for (const evento of lista) {
    if (!meses.has(evento.data.mes)) meses.set(evento.data.mes, []);
    meses.get(evento.data.mes).push(evento);
  }
  const proximaVisivel = lista.find((e) => e.juliano >= hojeJuliano);
  $("#botaoProximas").hidden = !proximaVisivel || proximaVisivel === lista[0];
  $("#botaoProximas").dataset.alvo = proximaVisivel ? `evento-${proximaVisivel.id}` : "";
  area.replaceChildren(
    ...[...meses].map(([mes, eventos]) =>
      el(
        "section",
        { class: "mes-eventos", "aria-label": capitalizar(formatarMesAno(ano, mes)) },
        el("h3", { class: "mes-eventos__titulo" }, capitalizar(nomeMes(mes))),
        el("ul", { class: "lista-eventos" }, eventos.map(criarItem)),
      ),
    ),
  );
}

function renderizarProximo() {
  const proximo = eventosNoIntervalo(hojeJuliano, hojeJuliano + 400, {
    ...opcoesLocal(),
    comemorativas: false,
    facultativos: false,
  }).find((e) => e.folga);
  if (!proximo) return;
  const faltam = proximo.juliano - hojeJuliano;
  definirTexto($("#tituloProximo"), proximo.nome);
  definirTexto($("#dataProximo"), `${capitalizar(formatarDataExtenso(proximo.data))} · ${rotuloTipo(proximo)}`);
  definirTexto(
    $("#faltaProximo"),
    faltam === 0 ? t("feriados.eHoje") : faltam === 1 ? capitalizar(t("tempo.amanha")) : capitalizar(t("feriados.faltam", { n: faltam })),
  );
  definirTexto($("#feriadaoProximo"), textoFeriadao(proximo) ?? "");
}

// ---- Calendário e detalhes do dia --------------------------------------------
const calendario = criarCalendario({
  compacto: true,
  visoes: ["mes"],
  obterEventos: (inicio, fim) => eventosNoIntervalo(inicio, fim, opcoesLocal()),
  aoSelecionar: (juliano) => {
    mostrarDia(juliano);
    const anoSelecionado = deDiaJuliano(juliano).ano;
    if (anoSelecionado !== ano && anoSelecionado >= ANO_MINIMO && anoSelecionado <= ANO_MAXIMO) {
      ano = anoSelecionado;
      renderizarAno();
    }
  },
});
$("#areaCalendario").append(calendario.elemento, legendaCalendario());

function mostrarDia(juliano) {
  const d = deDiaJuliano(juliano);
  definirTexto($("#tituloDia"), capitalizar(formatarDataExtenso(d)));
  const eventos = eventosNoIntervalo(juliano, juliano, opcoesLocal());
  const fimDeSemana = d.diaSemana === 0 || d.diaSemana === 6;
  const situacao = eventos.some((e) => e.folga)
    ? "calendario.situacao.feriado"
    : fimDeSemana
      ? "calendario.situacao.fimDeSemana"
      : "calendario.situacao.util";
  const itens = [el("p", { class: "texto-suave" }, `${t(situacao)} · ${relativo(juliano)}`)];
  for (const evento of eventos) {
    const feriadao = textoFeriadao(evento);
    itens.push(
      el(
        "div",
        { class: "pilha pilha--sm" },
        el("span", { class: classeSeloEvento(evento) }, rotuloTipo(evento)),
        el("strong", { class: "evento__nome" }, evento.nome + (evento.parcial ? ` (${parcialTraduzido(evento.parcial)})` : "")),
        feriadao ? el("span", { class: "texto-suave" }, feriadao) : null,
      ),
    );
  }
  if (!eventos.length) itens.push(el("p", { class: "texto-fraco" }, t("feriados.diaVazio")));
  $("#eventosDia").replaceChildren(...itens);
}

// ---- Ano ---------------------------------------------------------------------
function atualizarUrl() {
  const { uf, municipio } = opcoesLocal();
  const novos = new URLSearchParams();
  if (uf) novos.set("uf", uf);
  if (municipio) novos.set("municipio", municipio);
  if (ano !== hoje.ano) novos.set("ano", String(ano));
  const busca = novos.toString();
  history.replaceState(null, "", `${location.pathname}${busca ? `?${busca}` : ""}`);
}

function renderizarAno() {
  eventosAno = eventosDoAno(ano, opcoesLocal());
  definirTexto($("#tituloAno"), t("feriados.titulo", { ano: String(ano) }));
  definirTexto($("#anoAtual"), String(ano));
  $("#anoAnterior").disabled = ano <= ANO_MINIMO;
  $("#anoProximo").disabled = ano >= ANO_MAXIMO;
  renderizarFiltros();
  renderizarLista();
  atualizarUrl();
}

function renderizar() {
  const { uf, municipio } = opcoesLocal();
  definirTexto($("#textoCobertura"), textoCobertura(uf, municipio));
  renderizarAno();
  renderizarProximo();
  const estado = calendario.estado;
  calendario.atualizar();
  if (estado.selecionado != null) mostrarDia(estado.selecionado);
}

function mudarAno(delta) {
  const novo = Math.min(ANO_MAXIMO, Math.max(ANO_MINIMO, ano + delta));
  if (novo === ano) return;
  ano = novo;
  renderizarAno();
  const { mes } = deDiaJuliano(calendario.estado.selecionado);
  const mesCalendario = ano === hoje.ano ? hoje.mes : mes;
  calendario.mostrar(diaJuliano(ano, mesCalendario, 1));
  mostrarDia(calendario.estado.selecionado);
}

$("#botaoProximas").addEventListener("click", (evento) => {
  const alvo = document.getElementById(evento.currentTarget.dataset.alvo);
  if (!alvo) return;
  alvo.tabIndex = -1;
  alvo.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  alvo.focus({ preventScroll: true });
});
$("#anoAnterior").addEventListener("click", () => mudarAno(-1));
$("#anoProximo").addEventListener("click", () => mudarAno(1));
$("#botaoExportar").addEventListener("click", () => {
  const lista = eventosFiltrados();
  if (!lista.length) {
    avisar(t("feriados.nadaExportar"));
    return;
  }
  exportarIcs(lista, nomeArquivo(`feriados-${ano}${filtro === "todos" ? "" : `-${filtro}`}`));
});

// ---- Inicialização e virada do dia ----------------------------------------------
calendario.definirHoje(hojeJuliano);
calendario.mostrar(ano === hoje.ano ? hojeJuliano : diaJuliano(ano, 1, 1));
renderizar();
mostrarDia(calendario.estado.selecionado);

agendarPorSegundo((agora) => {
  const p = partesNoFuso(agora, FUSO_BRASILIA);
  const j = diaJuliano(p.ano, p.mes, p.dia);
  if (j === hojeJuliano) return;
  hoje = p;
  hojeJuliano = j;
  calendario.definirHoje(j);
  renderizar();
}, () => relogio.agora());
