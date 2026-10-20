// Nascer e pôr do sol para uma cidade ou coordenada (cálculo NOAA local,
// sem rede). A localização do aparelho só é pedida após clique explícito.
// A cidade inicial é a preferida (fuso do aparelho ou escolha manual).

import "../i18n/index.js";
import { idiomaAtual, numero, t } from "../i18n/estado.js";
import { gravar, ler } from "../nucleo/armazenamento.js";
import { cidadePreferida } from "../nucleo/fuso-preferido.js";
import { calcularSol, coordenadasValidas, formatarCoordenadas } from "../nucleo/sol.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import {
  FUSO_BRASILIA,
  capitalizar,
  dataIso,
  deDiaJuliano,
  diaJuliano,
  doisDigitos,
  formatarDataExtenso,
  formatarDataIntl,
  formatarHora,
  fusoValido,
  lerDataIso,
  nomeDiaSemana,
  partesNoFuso,
} from "../nucleo/tempo.js";
import { CIDADES, buscarCidade, nomeCidade, opcoesCidades, rotuloCidade } from "../dados/cidades.js";
import { $, $$, definirTexto, el, preencherSelect } from "../nucleo/ui.js";

const relogio = obterRelogio();
const CHAVE = "sol:config";

const campoCidade = $("#campoCidade");
const campoData = $("#campoData");
const campoLat = $("#campoLat");
const campoLon = $("#campoLon");
const campoFuso = $("#campoFuso");

const salvo = ler(CHAVE, {}) ?? {};
let origem = salvo.origem === "coordenadas" ? "coordenadas" : "cidade";

const cidadeInicial = buscarCidade(salvo.cidade)?.id ?? cidadePreferida()?.id ?? "brasilia";
preencherSelect(campoCidade, opcoesCidades(), cidadeInicial);

// Fusos disponíveis para coordenadas: os das cidades + o do aparelho.
const fusoAparelho = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
})();
const fusos = [...new Set([...(fusoAparelho && fusoValido(fusoAparelho) ? [fusoAparelho] : []), ...CIDADES.map((c) => c.fuso)])];
preencherSelect(
  campoFuso,
  fusos.map((fuso) => {
    const cidade = CIDADES.find((c) => c.fuso === fuso);
    return {
      valor: fuso,
      rotulo: fuso === fusoAparelho ? t("sol.fusoDoAparelho", { fuso }) : cidade ? `${fuso} (${nomeCidade(cidade)})` : fuso,
    };
  }),
  fusoValido(salvo.fuso) ? salvo.fuso : (buscarCidade(cidadeInicial)?.fuso ?? FUSO_BRASILIA),
);
if (coordenadasValidas(salvo.lat, salvo.lon)) {
  campoLat.value = String(salvo.lat);
  campoLon.value = String(salvo.lon);
}

// ---- Local selecionado ------------------------------------------------------------
function lerNumero(campo) {
  const texto = campo.value.trim().replace(",", ".");
  return texto === "" ? Number.NaN : Number(texto);
}

function localAtual() {
  if (origem === "cidade") {
    const cidade = buscarCidade(campoCidade.value) ?? buscarCidade("brasilia");
    return { nome: rotuloCidade(cidade), lat: cidade.lat, lon: cidade.lon, fuso: cidade.fuso };
  }
  const lat = lerNumero(campoLat);
  const lon = lerNumero(campoLon);
  if (!coordenadasValidas(lat, lon)) return null;
  return { nome: t("sol.coordenadasInformadas"), lat, lon, fuso: campoFuso.value || FUSO_BRASILIA };
}

function definirOrigem(nova) {
  origem = nova;
  for (const botao of $$("[data-origem]")) botao.setAttribute("aria-pressed", String(botao.dataset.origem === nova));
  $("#grupoCidade").hidden = nova !== "cidade";
  $("#grupoCoordenadas").hidden = nova !== "coordenadas";
  if (nova === "coordenadas" && campoLat.value === "") {
    // Parte da cidade escolhida, para o usuário só ajustar.
    const cidade = buscarCidade(campoCidade.value);
    if (cidade) {
      campoLat.value = String(cidade.lat);
      campoLon.value = String(cidade.lon);
      campoFuso.value = cidade.fuso;
    }
  }
  calcular();
}
for (const botao of $$("[data-origem]")) botao.addEventListener("click", () => definirOrigem(botao.dataset.origem));

// ---- Cálculo e exibição ----------------------------------------------------------
const hora = (instante, fuso) => formatarHora(partesNoFuso(instante, fuso), false);

function duracaoTexto(ms) {
  const minutos = Math.round(ms / 60000);
  return t("sol.duracao", { h: Math.floor(minutos / 60), min: doisDigitos(minutos % 60) });
}

/** "seg, 19/10" em português; dia da semana e data curta no formato do idioma nos demais. */
function diaCurto(d) {
  const semana = nomeDiaSemana(d.diaSemana, true);
  const data = idiomaAtual() === "pt-BR" ? `${doisDigitos(d.dia)}/${doisDigitos(d.mes)}` : formatarDataIntl(d, { day: "2-digit", month: "2-digit" });
  return `${semana}, ${data}`;
}

function minutosDoDia(instante, fuso) {
  const p = partesNoFuso(instante, fuso);
  return p.hora * 60 + p.minuto + p.segundo / 60;
}

function posicionar(barra, inicio, fim) {
  barra.style.left = `${(inicio / 1440) * 100}%`;
  barra.style.width = `${(Math.max(0, fim - inicio) / 1440) * 100}%`;
}

function calcular() {
  const local = localAtual();
  const erro = $("#erroCoordenadas");
  if (!local) {
    erro.hidden = false;
    erro.textContent = t("sol.erroCoordenadas");
    campoLat.setAttribute("aria-invalid", "true");
    campoLon.setAttribute("aria-invalid", "true");
    return;
  }
  erro.hidden = true;
  campoLat.removeAttribute("aria-invalid");
  campoLon.removeAttribute("aria-invalid");

  let data = lerDataIso(campoData.value);
  if (!data) {
    const hoje = partesNoFuso(relogio.agora(), local.fuso);
    data = { ano: hoje.ano, mes: hoje.mes, dia: hoje.dia };
    campoData.value = dataIso(data.ano, data.mes, data.dia);
  }

  gravar(CHAVE, {
    origem,
    cidade: campoCidade.value,
    lat: lerNumero(campoLat),
    lon: lerNumero(campoLon),
    fuso: campoFuso.value,
  });

  const r = calcularSol(data, local.lat, local.lon, local.fuso);
  const { fuso } = local;

  definirTexto($("#tituloResultado"), `${local.nome} · ${capitalizar(formatarDataExtenso(data))}`);
  definirTexto($("#localResultado"), t("sol.localResultado", { coordenadas: formatarCoordenadas(local.lat, local.lon), fuso }));

  definirTexto($("#valorNascer"), r.nascer != null ? hora(r.nascer, fuso) : "—");
  definirTexto($("#valorPor"), r.por != null ? hora(r.por, fuso) : "—");
  definirTexto(
    $("#valorDuracao"),
    r.status === "dia-polar" ? t("sol.duracaoTotal") : r.status === "noite-polar" ? t("sol.duracaoNula") : duracaoTexto(r.duracaoMs),
  );
  definirTexto($("#valorMeioDia"), hora(r.meioDia, fuso));

  const c = r.crepusculo;
  const textoCrep = {
    "claro-toda-noite": t("sol.claroTodaNoite"),
    "sem-crepusculo": t("sol.semCrepusculo"),
  };
  definirTexto($("#valorCrepInicio"), c.status === "normal" ? hora(c.inicio, fuso) : textoCrep[c.status]);
  definirTexto($("#valorCrepFim"), c.status === "normal" ? hora(c.fim, fuso) : textoCrep[c.status]);

  const aviso = $("#avisoPolar");
  if (r.status === "dia-polar") {
    aviso.hidden = false;
    definirTexto($("#textoPolar"), t("sol.diaPolar"));
  } else if (r.status === "noite-polar") {
    aviso.hidden = false;
    definirTexto($("#textoPolar"), `${t("sol.noitePolar")}${c.status === "normal" ? ` ${t("sol.noitePolarClaridade")}` : ""}`);
  } else {
    aviso.hidden = true;
  }

  // Barra do dia (0h–24h no horário local).
  const luz = $("#barraLuz");
  const crep = $("#barraCrepusculo");
  if (r.status === "dia-polar") posicionar(luz, 0, 1440);
  else if (r.status === "noite-polar") posicionar(luz, 0, 0);
  else posicionar(luz, minutosDoDia(r.nascer, fuso), minutosDoDia(r.por, fuso));
  if (c.status === "claro-toda-noite") posicionar(crep, 0, 1440);
  else if (c.status === "normal") posicionar(crep, minutosDoDia(c.inicio, fuso), minutosDoDia(c.fim, fuso));
  else posicionar(crep, 0, 0);

  // Tabela dos próximos 7 dias.
  const base = diaJuliano(data.ano, data.mes, data.dia);
  $("#tabelaSemana").replaceChildren(
    ...Array.from({ length: 7 }, (_, i) => {
      const d = deDiaJuliano(base + i);
      const dia = calcularSol(d, local.lat, local.lon, fuso);
      const celula = (texto) => el("td", { class: "numero" }, texto);
      return el(
        "tr",
        {},
        el("td", {}, diaCurto(d)),
        celula(dia.nascer != null ? hora(dia.nascer, fuso) : "—"),
        celula(dia.por != null ? hora(dia.por, fuso) : "—"),
        celula(dia.status === "dia-polar" ? t("sol.duracaoDiaPolar") : dia.status === "noite-polar" ? t("sol.duracaoNoitePolar") : duracaoTexto(dia.duracaoMs)),
      );
    }),
  );
}

campoCidade.addEventListener("change", calcular);
campoData.addEventListener("change", calcular);
campoFuso.addEventListener("change", calcular);
for (const campo of [campoLat, campoLon]) campo.addEventListener("input", calcular);
$("#formSol").addEventListener("submit", (evento) => {
  evento.preventDefault();
  calcular();
});

// ---- Geolocalização (só com clique) ----------------------------------------------------
const botaoLocalizacao = $("#botaoLocalizacao");
const estadoLocalizacao = $("#estadoLocalizacao");
if (!("geolocation" in navigator) || !window.isSecureContext) {
  botaoLocalizacao.disabled = true;
  definirTexto(estadoLocalizacao, t("sol.geoIndisponivel"));
}
botaoLocalizacao.addEventListener("click", () => {
  botaoLocalizacao.setAttribute("aria-busy", "true");
  definirTexto(estadoLocalizacao, t("sol.geoObtendo"));
  navigator.geolocation.getCurrentPosition(
    (posicao) => {
      botaoLocalizacao.removeAttribute("aria-busy");
      campoLat.value = posicao.coords.latitude.toFixed(4);
      campoLon.value = posicao.coords.longitude.toFixed(4);
      if (fusoAparelho && fusoValido(fusoAparelho)) campoFuso.value = fusoAparelho;
      definirTexto(estadoLocalizacao, t("sol.geoPrecisao", { metros: numero(Math.round(posicao.coords.accuracy)) }));
      calcular();
    },
    (erro) => {
      botaoLocalizacao.removeAttribute("aria-busy");
      const mensagens = { 1: "sol.geoNegada", 2: "sol.geoIndeterminada", 3: "sol.geoDemorou" };
      definirTexto(estadoLocalizacao, t(mensagens[erro.code] ?? "sol.geoFalhou"));
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
  );
});

// ---- Início -------------------------------------------------------------------------------
{
  const local = (origem === "cidade" ? buscarCidade(campoCidade.value) : null) ?? { fuso: campoFuso.value || FUSO_BRASILIA };
  const hoje = partesNoFuso(relogio.agora(), local.fuso);
  campoData.value = dataIso(hoje.ano, hoje.mes, hoje.dia);
}
definirOrigem(origem);
