// Clima para a página /clima e o resumo da página inicial.
//
// Fontes (gratuitas, sem chave; exigem atribuição, feita na página do clima):
//  - previsão: Open-Meteo (https://open-meteo.com, CC BY 4.0);
//  - busca de cidades: geocodificação da Open-Meteo (dados GeoNames);
//  - nome do lugar a partir de coordenadas: Nominatim/OpenStreetMap (ODbL),
//    que pede no máximo uma consulta por segundo — o cache da CDN e as
//    coordenadas arredondadas fazem a mesma região reaproveitar a resposta.
//
// GET /api/clima?lat=-23.77&lon=-53.33          → previsão (atual, por hora, 16 dias)
// GET /api/clima?busca=Umuarama&idioma=pt       → { resultados: [...] }
// GET /api/clima?lat=…&lon=…&lugar=1&idioma=pt  → { lugar: { nome, regiao, pais, codigoPais } }
// GET /api/clima?local=ip                       → { local } aproximado pelo IP (cabeçalhos da Vercel) ou null
//
// Coordenadas são arredondadas a 2 casas (~1 km): basta para o clima, protege
// a localização exata de quem usa o GPS e aumenta os acertos de cache.

import { buscarJson, exigirGet, parametros, responderComCache } from "./_lib/externo.js";
import { ErroHttp, responder, rota } from "./_lib/http.js";

const PREVISAO = "https://api.open-meteo.com/v1/forecast";
const GEOCODIFICACAO = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSO = "https://nominatim.openstreetmap.org/reverse";

// Maior horizonte que a Open-Meteo oferece (16 dias). A página avisa que os
// últimos dias são tendência, menos confiáveis que os primeiros.
export const DIAS_PREVISAO = 16;

const ATUAL = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "uv_index",
  "visibility",
];
const POR_HORA = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "is_day",
  "wind_speed_10m",
];
const POR_DIA = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "sunrise",
  "sunset",
  "uv_index_max",
  "precipitation_sum",
  "precipitation_hours",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
];

const DEZ_MINUTOS = 10 * 60;
const UM_DIA = 24 * 60 * 60;

/** Número dentro do intervalo, arredondado a 2 casas; senão null. */
export function coordenada(texto, limite) {
  if (texto == null || String(texto).trim() === "") return null;
  const valor = Number(texto);
  if (!Number.isFinite(valor) || Math.abs(valor) > limite) return null;
  return Math.round(valor * 100) / 100;
}

/** Código de idioma de 2 letras para as fontes ("zh-CN" → "zh"); padrão "en". */
export function idiomaFonte(texto) {
  const base = String(texto || "").slice(0, 2).toLowerCase();
  return /^[a-z]{2}$/.test(base) ? base : "en";
}

const textoCurto = (valor, max = 80) => (typeof valor === "string" && valor.trim() ? valor.trim().slice(0, max) : null);

/** Resultado da geocodificação → formato do site (só lugares habitados). */
export function normalizarResultado(item) {
  if (!item || typeof item.name !== "string") return null;
  if (item.feature_code && !String(item.feature_code).startsWith("PPL")) return null;
  const lat = coordenada(item.latitude, 90);
  const lon = coordenada(item.longitude, 180);
  if (lat == null || lon == null) return null;
  return {
    id: Number.isFinite(item.id) ? item.id : null,
    nome: textoCurto(item.name),
    regiao: textoCurto(item.admin1),
    subregiao: textoCurto(item.admin2),
    pais: textoCurto(item.country),
    codigoPais: textoCurto(item.country_code, 2)?.toUpperCase() ?? null,
    lat,
    lon,
    fuso: textoCurto(item.timezone, 64),
  };
}

async function previsao(res, lat, lon) {
  const url = new URL(PREVISAO);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: "auto",
    forecast_days: String(DIAS_PREVISAO),
    current: ATUAL.join(","),
    hourly: POR_HORA.join(","),
    daily: POR_DIA.join(","),
    wind_speed_unit: "kmh",
    timeformat: "iso8601",
  });
  const { status, dados } = await buscarJson(url);
  if (status !== 200 || !dados?.current || !dados?.hourly || !dados?.daily) throw new ErroHttp(502, "indisponivel");
  // A Open-Meteo devolve os horários já no fuso local do lugar ("2026-10-22T15:00").
  return responderComCache(
    res,
    {
      obtidoEm: Date.now(),
      fuso: dados.timezone,
      abreviacaoFuso: dados.timezone_abbreviation ?? null,
      elevacao: dados.elevation ?? null,
      atual: dados.current,
      horas: dados.hourly,
      dias: dados.daily,
    },
    { segundos: DEZ_MINUTOS, revalidar: 5 * 60 },
  );
}

async function buscarCidades(res, texto, idioma) {
  const url = new URL(GEOCODIFICACAO);
  url.search = new URLSearchParams({ name: texto, count: "10", language: idioma, format: "json" });
  const { status, dados } = await buscarJson(url);
  if (status !== 200) throw new ErroHttp(502, "indisponivel");
  const resultados = (dados?.results ?? []).map(normalizarResultado).filter(Boolean).slice(0, 8);
  return responderComCache(res, { resultados }, { segundos: UM_DIA, revalidar: 7 * UM_DIA });
}

async function nomeDoLugar(res, lat, lon, idioma) {
  const url = new URL(REVERSO);
  url.search = new URLSearchParams({ lat: String(lat), lon: String(lon), format: "jsonv2", zoom: "10", "accept-language": idioma });
  const { status, dados } = await buscarJson(url);
  if (status !== 200 || !dados || dados.error) throw new ErroHttp(404, "sem-dados");
  const e = dados.address ?? {};
  const lugar = {
    nome: textoCurto(e.city ?? e.town ?? e.village ?? e.municipality ?? e.county ?? dados.name),
    regiao: textoCurto(e.state ?? e.region),
    pais: textoCurto(e.country),
    codigoPais: textoCurto(e.country_code, 2)?.toUpperCase() ?? null,
  };
  return responderComCache(res, { lugar }, { segundos: 30 * UM_DIA, revalidar: 30 * UM_DIA });
}

/**
 * Local aproximado pelo IP, com os cabeçalhos que a Vercel acrescenta em
 * produção (no servidor local eles não existem e a resposta é null). Nunca
 * vai para cache compartilhado: cada visitante tem o seu.
 */
export function localPorCabecalhos(cabecalhos) {
  const ler = (nome) => {
    const valor = cabecalhos[nome];
    if (typeof valor !== "string" || !valor) return null;
    try {
      return decodeURIComponent(valor);
    } catch {
      return valor;
    }
  };
  const lat = coordenada(ler("x-vercel-ip-latitude"), 90);
  const lon = coordenada(ler("x-vercel-ip-longitude"), 180);
  if (lat == null || lon == null) return null;
  return {
    nome: textoCurto(ler("x-vercel-ip-city")),
    regiao: textoCurto(ler("x-vercel-ip-country-region"), 10),
    codigoPais: textoCurto(ler("x-vercel-ip-country"), 2)?.toUpperCase() ?? null,
    lat,
    lon,
  };
}

export default rota(async (req, res) => {
  exigirGet(req);
  const busca = parametros(req);

  if (busca.get("local") === "ip") {
    return responder(res, 200, { local: localPorCabecalhos(req.headers) }, { "Cache-Control": "private, no-store" });
  }

  const idioma = idiomaFonte(busca.get("idioma"));

  if (busca.has("busca")) {
    const texto = String(busca.get("busca")).trim().slice(0, 80);
    if (texto.length < 2) throw new ErroHttp(400, "busca-curta");
    return buscarCidades(res, texto, idioma);
  }

  const lat = coordenada(busca.get("lat"), 90);
  const lon = coordenada(busca.get("lon"), 180);
  if (lat == null || lon == null) throw new ErroHttp(400, "coordenadas-invalidas");
  if (busca.has("lugar")) return nomeDoLugar(res, lat, lon, idioma);
  return previsao(res, lat, lon);
});
