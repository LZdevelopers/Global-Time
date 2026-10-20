// Calendário reutilizável com visões anual, mensal e semanal.
//
// Uma data de referência (o dia selecionado) é preservada ao trocar de visão.
// Segue o padrão de grade do ARIA: uma única célula fica na ordem de
// tabulação (tabindex roving) e as setas movem a seleção.
//   ← → ↑ ↓       dia anterior/seguinte, semana anterior/seguinte
//   PageUp/Down   período anterior/seguinte (ano, mês ou semana)
//   Home          hoje
//   Enter         abre o dia (aoAtivar)
//
// `obterEventos(inicio, fim)` recebe dias julianos e devolve
// [{ juliano, nome, tipo, folga?, hora? }] — o componente não sabe de onde
// vêm os dados (feriados, contagens, eventos pessoais).

import { locale, t } from "../i18n/estado.js";
import {
  capitalizar,
  deDiaJuliano,
  diaJuliano,
  diasNoMes,
  formatarDataExtenso,
  formatarMesAno,
  inicialDiaSemana,
  nomeDiaSemana,
  nomeMes,
  semanaIso,
} from "./tempo.js";
import { el, icone } from "./ui.js";

const VISOES = ["ano", "mes", "semana"];

/** Primeiro dia da semana no idioma (0 = domingo, 1 = segunda). */
export function primeiroDiaSemana() {
  try {
    const info = new Intl.Locale(locale());
    const semana = info.getWeekInfo?.() ?? info.weekInfo;
    if (semana?.firstDay) return semana.firstDay % 7;
  } catch {
    /* sem informação: domingo */
  }
  return 0;
}

/** Classe da marca de um evento: feriado, facultativo, comemorativa, contagem, pessoal. */
export function classeMarca(evento) {
  if (evento.tipo === "pessoal") return "pessoal";
  if (evento.tipo === "contagem") return "contagem";
  if (evento.folga) return "feriado";
  if (evento.tipo === "facultativo") return "facultativo";
  return "comemorativa";
}

/** Classe do selo de um evento para listas e painéis. */
export function classeSeloEvento(evento) {
  const marca = classeMarca(evento);
  if (marca === "pessoal" || marca === "contagem") return "selo selo--acento";
  if (marca === "feriado") return "selo selo--perigo";
  if (marca === "facultativo") return "selo selo--alerta";
  return "selo selo--comemorativa";
}

/** Legenda das marcas. */
export function legendaCalendario({ contagens = false, pessoais = false } = {}) {
  const itens = [
    ["feriado", "calendario.legenda.feriado"],
    ["facultativo", "calendario.legenda.facultativo"],
    ["comemorativa", "calendario.legenda.comemorativa"],
  ];
  if (pessoais) itens.push(["pessoal", "calendario.legenda.pessoal"]);
  if (contagens) itens.push(["contagem", "calendario.legenda.contagem"]);
  return el(
    "div",
    { class: "legenda", "aria-label": t("calendario.legenda") },
    itens.map(([classe, chave]) =>
      el("span", {}, el("span", { class: `calendario__marca calendario__marca--${classe}`, "aria-hidden": "true" }), t(chave)),
    ),
  );
}

export function criarCalendario({
  obterEventos,
  aoSelecionar,
  aoAtivar,
  aoMudarVisao,
  visoes = VISOES,
  visao: visaoInicial = visoes[0],
  compacto = false,
}) {
  const inicioSemana = primeiroDiaSemana();
  const idTitulo = `cal-${Math.random().toString(36).slice(2, 8)}`;
  const titulo = el("h2", { id: idTitulo, class: "calendario__titulo", "aria-live": "polite" });
  const botaoAnterior = el("button", { type: "button", class: "botao botao--fantasma botao--icone botao--pequeno" }, icone("anterior"));
  const botaoProximo = el("button", { type: "button", class: "botao botao--fantasma botao--icone botao--pequeno" }, icone("proximo"));
  const botaoHoje = el("button", { type: "button", class: "botao botao--secundario botao--pequeno" }, t("comum.hoje"));
  const seletorVisao =
    visoes.length > 1
      ? el(
          "div",
          { class: "segmentado", role: "group", "aria-label": t("calendario.visao") },
          visoes.map((v) => el("button", { type: "button", dataset: { visao: v }, "aria-pressed": "false" }, t(`calendario.visao.${v}`))),
        )
      : null;
  const corpo = el("div", { class: "calendario__corpo" });

  const elemento = el(
    "div",
    { class: `calendario${compacto ? " calendario--compacto" : ""}` },
    el(
      "div",
      { class: "calendario__topo" },
      titulo,
      el("div", { class: "calendario__navegacao" }, seletorVisao, el("div", { class: "calendario__setas" }, botaoAnterior, botaoHoje, botaoProximo)),
    ),
    corpo,
  );

  const estado = { visao: visaoInicial, selecionado: null, hoje: null };
  let celulas = new Map();

  // ---- Ajudas ------------------------------------------------------------
  const inicioDaSemana = (juliano) => juliano - ((deDiaJuliano(juliano).diaSemana - inicioSemana + 7) % 7);
  const diasSemanaOrdenados = () => Array.from({ length: 7 }, (_, i) => (inicioSemana + i) % 7);

  function eventosPorDia(inicio, fim) {
    const porDia = new Map();
    for (const evento of obterEventos(inicio, fim)) {
      if (!porDia.has(evento.juliano)) porDia.set(evento.juliano, []);
      porDia.get(evento.juliano).push(evento);
    }
    return porDia;
  }

  function rotuloCelula(juliano, eventos) {
    const partes = [formatarDataExtenso(deDiaJuliano(juliano))];
    if (juliano === estado.hoje) partes.push(t("tempo.hoje"));
    for (const e of eventos) partes.push(`${t(`calendario.tipo.${e.tipo}`)}: ${e.nome}`);
    return partes.join(", ");
  }

  function celula(juliano, eventos, { mesDaGrade, conteudo }) {
    const d = deDiaJuliano(juliano);
    const classes = ["calendario__dia"];
    if (mesDaGrade != null && d.mes !== mesDaGrade) classes.push("calendario__dia--fora");
    if (d.diaSemana === 0 || d.diaSemana === 6) classes.push("calendario__dia--fim-semana");
    if (juliano === estado.hoje) classes.push("calendario__dia--hoje");
    if (eventos.some((e) => e.folga)) classes.push("calendario__dia--feriado");
    if (eventos.some((e) => e.tipo === "pessoal")) classes.push("calendario__dia--pessoal");
    if (eventos.length) classes.push("calendario__dia--com-eventos");
    const no = el(
      "div",
      {
        class: classes.join(" "),
        role: "gridcell",
        tabindex: juliano === estado.selecionado ? "0" : "-1",
        "aria-selected": String(juliano === estado.selecionado),
        "aria-label": rotuloCelula(juliano, eventos),
        dataset: { juliano: String(juliano) },
      },
      conteudo(d),
    );
    celulas.set(juliano, no);
    return no;
  }

  const marcas = (eventos, limite = 4) =>
    eventos.length
      ? el(
          "span",
          { class: "calendario__marcas", "aria-hidden": "true" },
          eventos.slice(0, limite).map((e) => el("span", { class: `calendario__marca calendario__marca--${classeMarca(e)}` })),
        )
      : null;

  const numero = (d) => el("span", { class: "calendario__numero", "aria-hidden": "true" }, String(d.dia));

  const cabecalhoSemana = (curto) =>
    el(
      "div",
      { class: "calendario__linha", role: "row" },
      diasSemanaOrdenados().map((i) =>
        el("div", { class: "calendario__semana", role: "columnheader", "aria-label": nomeDiaSemana(i) }, curto(i)),
      ),
    );

  // ---- Visão mensal -----------------------------------------------------------
  function gradeMes(ano, mes, porDia, { mini = false } = {}) {
    const primeiro = diaJuliano(ano, mes, 1);
    const ultimo = diaJuliano(ano, mes, diasNoMes(ano, mes));
    const inicio = inicioDaSemana(primeiro);
    const semanas = Math.ceil((ultimo - inicio + 1) / 7);
    const idMes = `${idTitulo}-${ano}-${mes}`;
    const linhas = [cabecalhoSemana((i) => (mini ? inicialDiaSemana(i) : nomeDiaSemana(i, true)))];
    for (let s = 0; s < semanas; s += 1) {
      const linha = el("div", { class: "calendario__linha", role: "row" });
      for (let i = 0; i < 7; i += 1) {
        const juliano = inicio + s * 7 + i;
        const d = deDiaJuliano(juliano);
        if (mini && d.mes !== mes) {
          linha.append(el("div", { class: "calendario__vazio", role: "gridcell", "aria-hidden": "true" }));
          continue;
        }
        const eventos = porDia.get(juliano) ?? [];
        const principal = eventos.find((e) => e.folga) ?? eventos[0];
        linha.append(
          celula(juliano, eventos, {
            mesDaGrade: mes,
            conteudo: () => [
              numero(d),
              mini ? null : marcas(eventos),
              !mini && principal ? el("span", { class: "calendario__rotulo", "aria-hidden": "true" }, principal.nome) : null,
            ],
          }),
        );
      }
      linhas.push(linha);
    }
    return el("div", { class: "calendario__grade", role: "grid", "aria-labelledby": mini ? idMes : idTitulo }, linhas);
  }

  function renderizarMes() {
    const d = deDiaJuliano(estado.selecionado);
    titulo.textContent = capitalizar(formatarMesAno(d.ano, d.mes));
    const primeiro = inicioDaSemana(diaJuliano(d.ano, d.mes, 1));
    const porDia = eventosPorDia(primeiro, primeiro + 42);
    corpo.replaceChildren(gradeMes(d.ano, d.mes, porDia));
  }

  // ---- Visão anual: 12 meses compactos ---------------------------------------------
  function renderizarAno() {
    const { ano } = deDiaJuliano(estado.selecionado);
    titulo.textContent = String(ano);
    const porDia = eventosPorDia(diaJuliano(ano, 1, 1), diaJuliano(ano, 12, 31));
    const meses = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      return el(
        "section",
        { class: "calendario__mes" },
        el(
          "h3",
          { class: "calendario__mes-titulo", id: `${idTitulo}-${ano}-${mes}` },
          el(
            "button",
            { type: "button", class: "calendario__mes-botao", dataset: { mes: String(mes) }, title: t("calendario.abrirMes") },
            capitalizar(nomeMes(mes)),
          ),
        ),
        gradeMes(ano, mes, porDia, { mini: true }),
      );
    });
    corpo.replaceChildren(el("div", { class: "calendario__ano" }, meses));
  }

  // ---- Visão semanal: 7 colunas com a lista de eventos de cada dia ----------------
  function renderizarSemana() {
    const inicio = inicioDaSemana(estado.selecionado);
    const fim = inicio + 6;
    const a = deDiaJuliano(inicio);
    const b = deDiaJuliano(fim);
    titulo.textContent = t("calendario.tituloSemana", {
      numero: semanaIso(a.ano, a.mes, a.dia),
      periodo: `${formatarDataExtenso(a, { comSemana: false, comAno: a.ano !== b.ano })} – ${formatarDataExtenso(b, { comSemana: false })}`,
    });
    const porDia = eventosPorDia(inicio, fim);
    const linha = el("div", { class: "calendario__linha calendario__linha--semana", role: "row" });
    for (let j = inicio; j <= fim; j += 1) {
      const eventos = (porDia.get(j) ?? []).slice().sort((x, y) => (x.hora ?? "").localeCompare(y.hora ?? ""));
      linha.append(
        celula(j, eventos, {
          conteudo: (d) => [
            el(
              "span",
              { class: "calendario__cabeca-dia", "aria-hidden": "true" },
              el("span", { class: "calendario__nome-dia" }, nomeDiaSemana(d.diaSemana, true)),
              numero(d),
            ),
            el(
              "ul",
              { class: "calendario__lista", "aria-hidden": "true" },
              eventos.map((e) =>
                el(
                  "li",
                  { class: `calendario__item calendario__item--${classeMarca(e)}` },
                  e.hora ? el("span", { class: "calendario__hora" }, e.hora) : null,
                  e.nome,
                ),
              ),
            ),
          ],
        }),
      );
    }
    corpo.replaceChildren(el("div", { class: "calendario__grade calendario__grade--semana", role: "grid", "aria-labelledby": idTitulo }, linha));
  }

  // ---- Renderização e navegação --------------------------------------------------------
  const ROTULOS_SETAS = {
    ano: ["calendario.anoAnterior", "calendario.proximoAno"],
    mes: ["calendario.mesAnterior", "calendario.proximoMes"],
    semana: ["calendario.semanaAnterior", "calendario.proximaSemana"],
  };

  function renderizar() {
    celulas = new Map();
    if (estado.selecionado == null) estado.selecionado = estado.hoje ?? diaJuliano(2000, 1, 1);
    elemento.dataset.visao = estado.visao;
    const [anterior, proximo] = ROTULOS_SETAS[estado.visao];
    botaoAnterior.setAttribute("aria-label", t(anterior));
    botaoAnterior.title = t(anterior);
    botaoProximo.setAttribute("aria-label", t(proximo));
    botaoProximo.title = t(proximo);
    for (const botao of seletorVisao?.querySelectorAll("button") ?? []) {
      botao.setAttribute("aria-pressed", String(botao.dataset.visao === estado.visao));
    }
    if (estado.visao === "ano") renderizarAno();
    else if (estado.visao === "semana") renderizarSemana();
    else renderizarMes();
  }

  /** Mesmo período (ano, mês ou semana) que o dia já exibido? */
  function mesmoPeriodo(a, b) {
    const x = deDiaJuliano(a);
    const y = deDiaJuliano(b);
    if (estado.visao === "ano") return x.ano === y.ano;
    if (estado.visao === "mes") return x.ano === y.ano && x.mes === y.mes;
    return inicioDaSemana(a) === inicioDaSemana(b);
  }

  function selecionar(juliano, { focar = false, avisar = true } = {}) {
    const anterior = estado.selecionado;
    estado.selecionado = juliano;
    if (anterior == null || !mesmoPeriodo(anterior, juliano) || !celulas.has(juliano)) {
      renderizar();
    } else {
      for (const [j, no] of celulas) {
        no.setAttribute("aria-selected", String(j === juliano));
        no.tabIndex = j === juliano ? 0 : -1;
      }
    }
    if (focar) celulas.get(juliano)?.focus();
    if (avisar) aoSelecionar?.(juliano);
  }

  function mudarPeriodo(delta, { focar = false } = {}) {
    const d = deDiaJuliano(estado.selecionado);
    if (estado.visao === "semana") return selecionar(estado.selecionado + 7 * delta, { focar });
    if (estado.visao === "ano") {
      const ano = d.ano + delta;
      return selecionar(diaJuliano(ano, d.mes, Math.min(d.dia, diasNoMes(ano, d.mes))), { focar });
    }
    let { ano, mes } = d;
    mes += delta;
    while (mes < 1) {
      mes += 12;
      ano -= 1;
    }
    while (mes > 12) {
      mes -= 12;
      ano += 1;
    }
    return selecionar(diaJuliano(ano, mes, Math.min(d.dia, diasNoMes(ano, mes))), { focar });
  }

  function definirVisao(visao, { focar = false } = {}) {
    if (!visoes.includes(visao)) return;
    estado.visao = visao;
    renderizar();
    if (focar) celulas.get(estado.selecionado)?.focus();
    aoMudarVisao?.(visao);
  }

  botaoAnterior.addEventListener("click", () => mudarPeriodo(-1));
  botaoProximo.addEventListener("click", () => mudarPeriodo(1));
  botaoHoje.addEventListener("click", () => {
    if (estado.hoje != null) selecionar(estado.hoje);
  });
  seletorVisao?.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-visao]");
    if (botao) definirVisao(botao.dataset.visao);
  });

  corpo.addEventListener("click", (evento) => {
    const mes = evento.target.closest("[data-mes]");
    if (mes) {
      const { ano } = deDiaJuliano(estado.selecionado);
      estado.selecionado = diaJuliano(ano, Number(mes.dataset.mes), 1);
      definirVisao("mes", { focar: true });
      aoSelecionar?.(estado.selecionado);
      return;
    }
    const alvo = evento.target.closest("[data-juliano]");
    if (!alvo) return;
    const juliano = Number(alvo.dataset.juliano);
    if (juliano === estado.selecionado && evento.detail > 1) aoAtivar?.(juliano);
    selecionar(juliano, { focar: true });
  });

  corpo.addEventListener("keydown", (evento) => {
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
    if (!evento.target.closest?.("[data-juliano]")) return;
    const atual = estado.selecionado;
    const rtl = getComputedStyle(elemento).direction === "rtl";
    const movimentos = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -7, ArrowDown: 7 };
    if (evento.key in movimentos) {
      evento.preventDefault();
      selecionar(atual + movimentos[evento.key], { focar: true });
    } else if (evento.key === "PageUp" || evento.key === "PageDown") {
      evento.preventDefault();
      mudarPeriodo(evento.key === "PageUp" ? -1 : 1, { focar: true });
    } else if (evento.key === "Home") {
      evento.preventDefault();
      if (estado.hoje != null) selecionar(estado.hoje, { focar: true });
    } else if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      aoAtivar?.(atual);
    }
  });

  return {
    elemento,
    selecionar,
    mudarPeriodo,
    definirVisao,
    atualizar: renderizar,
    /** Mostra o dia `juliano` (selecionado) sem avisar. */
    mostrar(juliano) {
      estado.selecionado = juliano;
      renderizar();
    },
    definirHoje(juliano) {
      estado.hoje = juliano;
    },
    get estado() {
      return { ...estado };
    },
  };
}
