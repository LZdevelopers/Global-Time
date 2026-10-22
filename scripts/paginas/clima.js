// Página do clima: condições atuais, próximas horas (com gráfico de
// temperatura), próximos dias (com mínimas e máximas), chuva e detalhes do
// lugar escolhido — pela busca, pela localização do aparelho (com permissão)
// ou, na primeira visita, pela localização aproximada do IP.
//
// Os horários mostrados são os do lugar (a Open-Meteo responde no fuso dele);
// a hora local ao vivo usa o relógio sincronizado do site nesse fuso.
// A previsão é consultada de novo a cada 10 minutos com a página visível —
// nunca junto com o relógio, que atualiza a cada segundo.

import "../i18n/index.js";
import { locale, numero, t } from "../i18n/estado.js";
import {
  DIAS_CONFIAVEIS,
  LIMITE_ATUAL_MS,
  VALIDADE_PREVISAO_MS,
  aparencia,
  buscarCidades,
  condicao,
  descricaoLugar,
  dia,
  faixaUv,
  grau,
  horaDoTexto,
  indiceHoje,
  lerHorario,
  lugarPorIp,
  lugarSalvo,
  nomeDoLugar,
  obterPrevisao,
  periodosDeChuva,
  picoDeChuva,
  pontoCardeal,
  posicaoDoAparelho,
  proximasHoras,
  salvarLugar,
  somaChuva,
  textoCondicao,
} from "../nucleo/clima.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import { capitalizar, diaJuliano, diaSemana, doisDigitos, formatarDataIntl, nomeDiaSemana, partesNoFuso } from "../nucleo/tempo.js";
import { $, agendarPorSegundo, anunciar, definirTexto, el, icone, trocarIcone } from "../nucleo/ui.js";

const relogio = obterRelogio();
const HORAS_LINHA = 48;

let lugar = lugarSalvo();
let previsao = null; // { dados, recebidoEm, desatualizado }
let carregando = false;
let erro = null;

// ---- Formatação --------------------------------------------------------------------
const decimal = (v, casas = 1) => numero(v, { maximumFractionDigits: casas });
const mm = (v) => t("clima.mm", { valor: decimal(v) });
const porcento = (v) => t("clima.porcento", { valor: numero(Math.round(v)) });
const kmh = (v) => t("clima.kmh", { valor: numero(Math.round(v)) });
const temValor = (v) => v != null && Number.isFinite(v);

/** Propriedades CSS pelo CSSOM (a política de segurança bloqueia o atributo style). */
function comEstilo(no, propriedades) {
  for (const [nome, valor] of Object.entries(propriedades)) no.style.setProperty(nome, valor);
  return no;
}

function direcao(graus) {
  const ponto = pontoCardeal(graus);
  return ponto ? t(`clima.direcao.${ponto}`) : "";
}

/** "Hoje", "Amanhã" ou "sáb., 24/10" para a data "AAAA-MM-DD" do lugar. */
function rotuloDia(data, hoje, { curto = true } = {}) {
  const d = lerHorario(data);
  const h = lerHorario(hoje);
  const diferenca = diaJuliano(d.ano, d.mes, d.dia) - diaJuliano(h.ano, h.mes, h.dia);
  if (diferenca === 0) return capitalizar(t("tempo.hoje"));
  if (diferenca === 1) return capitalizar(t("tempo.amanha"));
  const semana = capitalizar(nomeDiaSemana(diaSemana(d.ano, d.mes, d.dia), curto));
  return curto ? semana : `${semana}, ${formatarDataIntl(d, { day: "numeric", month: "long" })}`;
}

const dataCurta = (data) => formatarDataIntl(lerHorario(data), { day: "numeric", month: "short" });

// ---- A. Agora --------------------------------------------------------------------------
function renderizarAgora(dados) {
  const a = dados.atual;
  const c = condicao(a.weather_code, a.is_day !== 0);
  const hoje = dia(dados, indiceHoje(dados));
  const secao = $("#agora");
  const { tema, periodo } = aparencia(dados);
  secao.dataset.tema = tema;
  secao.dataset.periodo = periodo;

  definirTexto($("#tituloLugar"), lugar.nome || t("clima.minhaLocalizacao"));
  const detalhe = [lugar.regiao !== lugar.nome ? lugar.regiao : null, lugar.pais ?? regiaoPorCodigo(lugar.codigoPais)].filter(Boolean).join(", ");
  definirTexto($("#detalheLugar"), lugar.origem === "ip" ? [detalhe, t("clima.aproximado")].filter(Boolean).join(" · ") : detalhe || " ");
  trocarIcone($("#iconeAgora"), c.icone);
  definirTexto($("#tempAgora"), grau(a.temperature_2m));
  definirTexto($("#condicaoAgora"), textoCondicao(c.codigo));
  definirTexto($("#sensacaoAgora"), temValor(a.apparent_temperature) ? t("clima.sensacaoDe", { valor: grau(a.apparent_temperature) }) : " ");
  definirTexto(
    $("#minMaxAgora"),
    temValor(hoje.min) && temValor(hoje.max) ? t("clima.minMax", { min: grau(hoje.min), max: grau(hoje.max) }) : " ",
  );

  const itens = [
    ["gota", "clima.umidade", temValor(a.relative_humidity_2m) ? porcento(a.relative_humidity_2m) : null],
    ["vento", "clima.vento", temValor(a.wind_speed_10m) ? `${kmh(a.wind_speed_10m)} ${direcao(a.wind_direction_10m)}`.trim() : null],
    ["clima-chuva", "clima.precipitacao", temValor(a.precipitation) ? mm(a.precipitation) : null],
    ["clima-sol", "clima.uv", temValor(a.uv_index) ? `${decimal(a.uv_index)} · ${t(`clima.uvFaixa.${faixaUv(a.uv_index)}`)}` : null],
  ].filter(([, , valor]) => valor != null);
  $("#indicadoresAgora").replaceChildren(
    ...itens.map(([nomeIcone, chave, valor]) => el("div", {}, el("dt", {}, icone(nomeIcone, "icone--sm"), t(chave)), el("dd", {}, valor))),
  );
}

/** Nome do país pelo código (lugar por IP só traz o código). */
function regiaoPorCodigo(codigo) {
  if (!codigo) return null;
  try {
    return new Intl.DisplayNames([locale()], { type: "region" }).of(codigo);
  } catch {
    return codigo;
  }
}

function mostrarEstadoDados() {
  const area = $("#estadoDados");
  const partes = [];
  if (carregando) partes.push(el("span", {}, t("clima.atualizando")));
  if (previsao) {
    const hora = horaDoTexto(previsao.dados.atual.time);
    const antigo = Date.now() - (previsao.dados.obtidoEm ?? previsao.recebidoEm) > LIMITE_ATUAL_MS;
    if (previsao.desatualizado || antigo) {
      partes.push(el("span", { class: "clima-agora__alerta" }, t("clima.dadosAntigos", { hora })));
    } else if (!carregando) {
      partes.push(el("span", {}, t("clima.dadosDas", { hora })));
    }
  } else if (erro && !carregando) {
    partes.push(el("span", { class: "clima-agora__alerta" }, t(erro === "rede" ? "clima.erroRede" : "clima.erroFonte")));
  }
  if ((erro || previsao?.desatualizado) && !carregando) {
    partes.push(el("button", { type: "button", class: "link-botao", onclick: () => carregar({ forcar: true }) }, t("comum.tentarNovamente")));
  }
  area.replaceChildren(...partes);
}

// ---- B. Próximas horas -----------------------------------------------------------------
const LARGURA_COLUNA = 60; // unidades do viewBox por hora (as colunas têm a mesma largura)
const ALTURA_GRAFICO = 56;

/** Linha de temperatura alinhada às colunas das horas (SVG sem dependências). */
function graficoTemperatura(horas) {
  const temps = horas.map((h) => h.temp).filter(temValor);
  if (temps.length < 2) return null;
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const faixa = max - min || 1;
  const largura = horas.length * LARGURA_COLUNA;
  const y = (v) => 6 + (1 - (v - min) / faixa) * (ALTURA_GRAFICO - 12);
  const pontos = horas
    .map((h, i) => (temValor(h.temp) ? `${(i + 0.5) * LARGURA_COLUNA},${y(h.temp).toFixed(1)}` : null))
    .filter(Boolean);
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "linha-horas__grafico");
  svg.setAttribute("viewBox", `0 0 ${largura} ${ALTURA_GRAFICO}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const area = document.createElementNS(NS, "path");
  area.setAttribute("class", "linha-horas__area");
  area.setAttribute("d", `M${pontos[0].split(",")[0]},${ALTURA_GRAFICO} L${pontos.join(" L")} L${pontos.at(-1).split(",")[0]},${ALTURA_GRAFICO} Z`);
  const linha = document.createElementNS(NS, "polyline");
  linha.setAttribute("class", "linha-horas__linha");
  linha.setAttribute("points", pontos.join(" "));
  svg.append(area, linha);
  return svg;
}

function renderizarHoras(dados) {
  const horas = proximasHoras(dados, HORAS_LINHA);
  const hoje = dados.atual.time.slice(0, 10);
  // Três faixas alinhadas pelas mesmas colunas: hora/condição/temperatura, a
  // curva de temperatura e a chuva (chance em barra e volume). Cada hora tem
  // um rótulo completo para leitores de tela; as faixas visuais ficam ocultas.
  const colunas = [];
  const chuvas = [];
  horas.forEach((h, n) => {
    const c = condicao(h.codigo, h.diurno);
    const hora = horaDoTexto(h.time);
    const novoDia = n > 0 && hora === "00:00";
    const prob = temValor(h.prob) ? h.prob : null;
    const chuva = temValor(h.mm) && h.mm > 0 ? mm(h.mm) : null;
    const classe = `${n === 0 ? " coluna-hora--agora" : ""}${novoDia ? " coluna-hora--novo-dia" : ""}`;
    const descricao = [
      n === 0 ? t("clima.agora") : `${rotuloDia(h.time.slice(0, 10), hoje)} ${hora}`,
      grau(h.temp),
      textoCondicao(c.codigo),
      prob != null ? t("clima.chanceChuva", { valor: porcento(prob) }) : null,
      chuva,
    ]
      .filter(Boolean)
      .join(", ");
    colunas.push(
      el(
        "li",
        { class: `coluna-hora${classe}`, "aria-label": descricao },
        el("span", { class: "coluna-hora__dia", "aria-hidden": "true" }, novoDia ? rotuloDia(h.time.slice(0, 10), hoje) : " "),
        el("span", { class: "coluna-hora__hora", "aria-hidden": "true" }, n === 0 ? t("clima.agora") : hora),
        icone(c.icone, "coluna-hora__icone"),
        el("span", { class: "coluna-hora__temp", "aria-hidden": "true" }, grau(h.temp)),
      ),
    );
    chuvas.push(
      comEstilo(
        el(
          "div",
          { class: `coluna-chuva${classe}${prob ? "" : " coluna-chuva--zero"}` },
          el("span", { class: "coluna-chuva__chance" }, prob != null ? porcento(prob) : "—"),
          el("span", { class: "coluna-chuva__barra" }),
          el("span", { class: "coluna-chuva__mm" }, chuva ?? " "),
        ),
        { "--chance": String((prob ?? 0) / 100) },
      ),
    );
  });
  const trilho = comEstilo(
    el(
      "div",
      { class: "linha-horas__trilho" },
      el("ol", { class: "linha-horas__colunas" }, colunas),
      graficoTemperatura(horas),
      el("div", { class: "linha-horas__chuva", "aria-hidden": "true" }, chuvas),
    ),
    { "--horas": String(horas.length) },
  );
  $("#linhaHoras").replaceChildren(trilho);
}

// ---- C. Próximos dias --------------------------------------------------------------------
function renderizarDias(dados) {
  const inicio = indiceHoje(dados);
  const dias = dados.dias.time.slice(inicio).map((_, n) => dia(dados, inicio + n));
  const hoje = dados.atual.time.slice(0, 10);
  const mins = dias.map((d) => d.min).filter(temValor);
  const maxs = dias.map((d) => d.max).filter(temValor);
  const piso = Math.min(...mins);
  const teto = Math.max(...maxs);
  const faixa = teto - piso || 1;

  const linhas = [];
  dias.forEach((d, n) => {
    if (n === DIAS_CONFIAVEIS) linhas.push(el("p", { class: "lista-dias__aviso texto-xs texto-fraco" }, t("clima.tendencia")));
    const c = condicao(d.codigo, true);
    const texto = textoCondicao(c.codigo);
    const prob = temValor(d.prob) ? d.prob : null;
    const inicioBarra = temValor(d.min) ? ((d.min - piso) / faixa) * 100 : 0;
    const fimBarra = temValor(d.max) ? ((d.max - piso) / faixa) * 100 : 100;
    const resumo = el(
      "summary",
      { class: "dia-clima__resumo" },
      el("span", { class: "dia-clima__nome" }, el("strong", {}, rotuloDia(d.data, hoje)), el("span", { class: "dia-clima__data" }, dataCurta(d.data))),
      el("span", { class: "dia-clima__condicao", title: texto }, icone(c.icone), el("span", { class: "sr-only" }, texto)),
      el(
        "span",
        { class: `dia-clima__chance${prob ? "" : " dia-clima__chance--zero"}` },
        prob ? [icone("gota", "icone--sm"), el("span", { class: "sr-only" }, t("clima.chanceChuvaRotulo")), porcento(prob)] : "",
      ),
      el("span", { class: "dia-clima__min" }, el("span", { class: "sr-only" }, t("clima.minima")), grau(d.min)),
      el(
        "span",
        { class: "dia-clima__faixa", "aria-hidden": "true" },
        comEstilo(el("span", { class: "dia-clima__intervalo" }), {
          "inset-inline-start": `${inicioBarra}%`,
          "inset-inline-end": `${100 - fimBarra}%`,
        }),
      ),
      el("span", { class: "dia-clima__max" }, el("span", { class: "sr-only" }, t("clima.maxima")), grau(d.max)),
    );
    const itens = [
      [t("clima.condicao"), texto],
      temValor(d.sensacaoMin) && temValor(d.sensacaoMax)
        ? [t("clima.sensacao"), t("clima.minMax", { min: grau(d.sensacaoMin), max: grau(d.sensacaoMax) })]
        : null,
      prob != null ? [t("clima.chanceChuvaRotulo"), porcento(prob)] : null,
      temValor(d.mm) ? [t("clima.chuvaPrevista"), temValor(d.horasChuva) && d.horasChuva > 0 ? t("clima.mmEmHoras", { mm: mm(d.mm), n: Math.round(d.horasChuva) }) : mm(d.mm)] : null,
      temValor(d.vento)
        ? [t("clima.vento"), [kmh(d.vento), direcao(d.direcao), temValor(d.rajadas) ? t("clima.rajadasDe", { valor: kmh(d.rajadas) }) : null].filter(Boolean).join(" · ")]
        : null,
      temValor(d.uv) ? [t("clima.uvMax"), `${decimal(d.uv)} · ${t(`clima.uvFaixa.${faixaUv(d.uv)}`)}`] : null,
      d.nascer ? [t("clima.nascer"), horaDoTexto(d.nascer)] : null,
      d.por ? [t("clima.por"), horaDoTexto(d.por)] : null,
    ].filter(Boolean);
    linhas.push(
      el(
        "details",
        { class: "dia-clima" },
        resumo,
        el(
          "div",
          { class: "dia-clima__corpo" },
          el("p", { class: "dia-clima__titulo" }, rotuloDia(d.data, hoje, { curto: false })),
          el("dl", { class: "lista-dados lista-dados--linha" }, itens.map(([dt, dd]) => el("div", {}, el("dt", {}, dt), el("dd", {}, dd)))),
        ),
      ),
    );
  });
  $("#listaDias").replaceChildren(...linhas);
  definirTexto($("#tituloDias"), t("clima.proximosDiasN", { n: dias.length }));
}

// ---- D. Chuva -------------------------------------------------------------------------------
function renderizarChuva(dados) {
  const horas = proximasHoras(dados, HORAS_LINHA);
  const hoje = dados.atual.time.slice(0, 10);
  const proximas24 = horas.slice(0, 24);
  const pico = picoDeChuva(proximas24);
  const soma24 = somaChuva(proximas24);
  const blocos = [];

  if (!pico || (pico.prob < 10 && soma24 === 0)) {
    blocos.push(el("p", { class: "clima-chuva__destaque" }, t("clima.semChuva24")));
  } else {
    blocos.push(
      el(
        "p",
        { class: "clima-chuva__destaque" },
        t("clima.pico24", {
          valor: porcento(pico.prob),
          quando: `${rotuloDia(pico.time.slice(0, 10), hoje).toLowerCase()} ${horaDoTexto(pico.time)}`,
        }),
      ),
      el("p", { class: "texto-suave texto-pequeno" }, t("clima.total24", { mm: mm(soma24) })),
    );
  }

  const periodos = periodosDeChuva(horas, 40);
  if (periodos.length) {
    blocos.push(
      el("h3", { class: "clima-chuva__subtitulo" }, t("clima.periodosChuva")),
      el(
        "ul",
        { class: "clima-chuva__periodos" },
        periodos.map((p) =>
          el(
            "li",
            {},
            el("strong", {}, `${rotuloDia(p.inicio.slice(0, 10), hoje)}, ${horaDoTexto(p.inicio)}–${fimDoPeriodo(p.fim)}`),
            el("span", {}, [t("clima.ate", { valor: porcento(p.probMax) }), p.mm > 0 ? mm(p.mm) : null, t("clima.horasN", { n: p.horas })].filter(Boolean).join(" · ")),
          ),
        ),
      ),
    );
  } else if (pico) {
    blocos.push(el("p", { class: "texto-suave texto-pequeno" }, t("clima.semPeriodos")));
  }

  // Dias da semana com mais chance (só os confiáveis).
  const inicio = indiceHoje(dados);
  const diasChuvosos = dados.dias.time
    .slice(inicio, inicio + DIAS_CONFIAVEIS)
    .map((_, n) => dia(dados, inicio + n))
    .filter((d) => temValor(d.prob) && d.prob >= 50);
  if (diasChuvosos.length) {
    blocos.push(
      el("h3", { class: "clima-chuva__subtitulo" }, t("clima.diasChuvosos")),
      el(
        "ul",
        { class: "clima-chuva__periodos" },
        diasChuvosos.map((d) =>
          el(
            "li",
            {},
            el("strong", {}, rotuloDia(d.data, hoje)),
            el(
              "span",
              {},
              [
                porcento(d.prob),
                temValor(d.mm) && d.mm > 0 ? mm(d.mm) : null,
                temValor(d.horasChuva) && d.horasChuva > 0 ? t("clima.horasN", { n: Math.round(d.horasChuva) }) : null,
              ]
                .filter(Boolean)
                .join(" · "),
            ),
          ),
        ),
      ),
    );
  }
  $("#resumoChuva").replaceChildren(...blocos);
}

/** Fim de um período: a hora seguinte à última hora com chuva ("16:00" → "17:00"). */
function fimDoPeriodo(ultima) {
  const h = (Number(horaDoTexto(ultima).slice(0, 2)) + 1) % 24;
  return `${doisDigitos(h)}:00`;
}

// ---- E. Detalhes ------------------------------------------------------------------------------
function renderizarDetalhes(dados) {
  const a = dados.atual;
  const hoje = dia(dados, indiceHoje(dados));
  const itens = [
    ["termometro", "clima.sensacao", temValor(a.apparent_temperature) ? grau(a.apparent_temperature) : null],
    ["gota", "clima.umidade", temValor(a.relative_humidity_2m) ? porcento(a.relative_humidity_2m) : null],
    ["vento", "clima.vento", temValor(a.wind_speed_10m) ? `${kmh(a.wind_speed_10m)} ${direcao(a.wind_direction_10m)}`.trim() : null],
    ["vento", "clima.rajadas", temValor(a.wind_gusts_10m) ? kmh(a.wind_gusts_10m) : null],
    ["clima-sol", "clima.uv", temValor(a.uv_index) ? `${decimal(a.uv_index)} · ${t(`clima.uvFaixa.${faixaUv(a.uv_index)}`)}` : null],
    ["clima-sol", "clima.uvMax", temValor(hoje.uv) ? `${decimal(hoje.uv)} · ${t(`clima.uvFaixa.${faixaUv(hoje.uv)}`)}` : null],
    ["nascer-sol", "clima.nascer", hoje.nascer ? horaDoTexto(hoje.nascer) : null],
    ["por-sol", "clima.por", hoje.por ? horaDoTexto(hoje.por) : null],
    ["clima-chuva", "clima.chuvaHoje", temValor(hoje.mm) ? mm(hoje.mm) : null],
    ["clima-nuvem", "clima.nebulosidade", temValor(a.cloud_cover) ? porcento(a.cloud_cover) : null],
    ["olho", "clima.visibilidade", temValor(a.visibility) ? t("clima.km", { valor: decimal(a.visibility / 1000) }) : null],
    ["pressao", "clima.pressao", temValor(a.pressure_msl) ? t("clima.hpa", { valor: numero(Math.round(a.pressure_msl)) }) : null],
  ].filter(([, , valor]) => valor != null);
  $("#listaDetalhes").replaceChildren(
    ...itens.map(([nomeIcone, chave, valor]) =>
      el("div", { class: "clima-detalhes__item" }, el("dt", {}, icone(nomeIcone, "icone--sm"), t(chave)), el("dd", {}, valor)),
    ),
  );
}

// ---- Carregar e mostrar ---------------------------------------------------------------------
function renderizar() {
  const temLugar = Boolean(lugar);
  $("#semLugar").hidden = temLugar;
  $("#painelClima").hidden = !temLugar;
  if (!temLugar) return;
  if (previsao) {
    const dados = previsao.dados;
    renderizarAgora(dados);
    renderizarHoras(dados);
    renderizarDias(dados);
    renderizarChuva(dados);
    renderizarDetalhes(dados);
    atualizarHoraLocal(relogio.agora());
  } else {
    definirTexto($("#tituloLugar"), lugar.nome || t("clima.minhaLocalizacao"));
    definirTexto($("#detalheLugar"), descricaoLugar({ ...lugar, nome: null }));
  }
  $("#painelClima").setAttribute("aria-busy", String(carregando));
  mostrarEstadoDados();
}

let consulta = 0;
async function carregar({ forcar = false } = {}) {
  if (!lugar) return renderizar();
  const minha = ++consulta;
  const alvo = lugar;
  carregando = true;
  erro = null;
  renderizar();
  try {
    const r = await obterPrevisao(alvo.lat, alvo.lon, { forcar });
    if (minha !== consulta) return;
    previsao = r;
    erro = r.desatualizado ? r.erro : null;
  } catch (e) {
    if (minha !== consulta) return;
    erro = e.message;
  }
  carregando = false;
  renderizar();
}

function usarLugar(novo) {
  lugar = novo;
  salvarLugar(novo);
  previsao = null;
  carregar();
  anunciar(t("clima.lugarEscolhido", { lugar: descricaoLugar(novo) }));
}

// ---- Hora local do lugar ------------------------------------------------------------------------
function atualizarHoraLocal(agora) {
  if (!previsao?.dados?.fuso) return;
  try {
    const p = partesNoFuso(agora, previsao.dados.fuso);
    definirTexto($("#horaLocal"), `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`);
  } catch {
    /* fuso desconhecido pela plataforma */
  }
}
agendarPorSegundo(atualizarHoraLocal, () => relogio.agora());

// Atualização periódica: só com a página visível e a cópia vencida.
function talvezAtualizar() {
  if (document.visibilityState !== "visible" || carregando || !lugar) return;
  if (!previsao || Date.now() - previsao.recebidoEm >= VALIDADE_PREVISAO_MS) carregar({ forcar: true });
}
setInterval(talvezAtualizar, 60 * 1000);
document.addEventListener("visibilitychange", talvezAtualizar);

// ---- Busca de cidades ---------------------------------------------------------------------------
const campoBusca = $("#campoBusca");
const listaResultados = $("#resultadosBusca");
const estadoBusca = $("#estadoBusca");
let buscaAtual = 0;
let esperaBusca = null;

function fecharResultados() {
  listaResultados.hidden = true;
  listaResultados.replaceChildren();
}

async function buscar(texto) {
  const minha = ++buscaAtual;
  if (texto.length < 2) {
    fecharResultados();
    definirTexto(estadoBusca, "");
    return;
  }
  definirTexto(estadoBusca, t("clima.buscando"));
  let resultados;
  try {
    resultados = await buscarCidades(texto);
  } catch {
    if (minha === buscaAtual) definirTexto(estadoBusca, t("clima.buscaIndisponivel"));
    return;
  }
  if (minha !== buscaAtual) return;
  if (!resultados.length) {
    fecharResultados();
    definirTexto(estadoBusca, t("clima.nenhumaCidade"));
    return;
  }
  definirTexto(estadoBusca, t("clima.resultados", { n: resultados.length }));
  listaResultados.replaceChildren(
    ...resultados.map((r) =>
      el(
        "li",
        {},
        el(
          "button",
          {
            type: "button",
            class: "resultado-busca",
            onclick: () => {
              fecharResultados();
              campoBusca.value = "";
              definirTexto(estadoBusca, "");
              usarLugar({ nome: r.nome, regiao: r.regiao, pais: r.pais, codigoPais: r.codigoPais, lat: r.lat, lon: r.lon, origem: "busca" });
              $("#tituloLugar").scrollIntoView?.({ block: "nearest" });
            },
          },
          el("strong", {}, r.nome),
          el("span", {}, [r.regiao, r.subregiao !== r.nome && r.subregiao !== r.regiao ? r.subregiao : null, r.pais].filter(Boolean).join(" · ")),
        ),
      ),
    ),
  );
  listaResultados.hidden = false;
}

campoBusca.addEventListener("input", () => {
  clearTimeout(esperaBusca);
  esperaBusca = setTimeout(() => buscar(campoBusca.value.trim()), 350);
});
$("#formBusca").addEventListener("submit", (evento) => {
  evento.preventDefault();
  clearTimeout(esperaBusca);
  buscar(campoBusca.value.trim());
});
campoBusca.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && !listaResultados.hidden) {
    evento.preventDefault();
    fecharResultados();
  } else if (evento.key === "ArrowDown" && !listaResultados.hidden) {
    evento.preventDefault();
    listaResultados.querySelector("button")?.focus();
  }
});
listaResultados.addEventListener("keydown", (evento) => {
  const botoes = [...listaResultados.querySelectorAll("button")];
  const i = botoes.indexOf(document.activeElement);
  if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
    evento.preventDefault();
    const proximo = botoes[i + (evento.key === "ArrowDown" ? 1 : -1)];
    (proximo ?? campoBusca).focus();
  } else if (evento.key === "Escape") {
    fecharResultados();
    campoBusca.focus();
  }
});

// ---- Localização do aparelho ------------------------------------------------------------------
$("#botaoLocalizacao").addEventListener("click", async () => {
  const botao = $("#botaoLocalizacao");
  botao.setAttribute("aria-busy", "true");
  definirTexto(estadoBusca, t("clima.obtendoLocalizacao"));
  try {
    const { lat, lon } = await posicaoDoAparelho();
    let nome = null;
    try {
      nome = await nomeDoLugar(lat, lon);
    } catch {
      /* sem nome: mostra "Sua localização" */
    }
    definirTexto(estadoBusca, "");
    usarLugar({ nome: nome?.nome ?? null, regiao: nome?.regiao ?? null, pais: nome?.pais ?? null, codigoPais: nome?.codigoPais ?? null, lat, lon, origem: "gps" });
  } catch (e) {
    definirTexto(estadoBusca, t(e.message === "negado" ? "clima.localizacaoNegada" : "clima.localizacaoIndisponivel"));
  } finally {
    botao.removeAttribute("aria-busy");
  }
});

// ---- Início ---------------------------------------------------------------------------------------
if (lugar) {
  carregar();
} else {
  renderizar();
  // Primeira visita: localização aproximada pelo IP (só na Vercel), sem pedir permissão.
  lugarPorIp().then((aproximado) => {
    if (!aproximado || lugar) return;
    lugar = aproximado;
    salvarLugar(aproximado);
    carregar();
  });
}
