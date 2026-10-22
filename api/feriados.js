// Feriados de outros países para o calendário, a partir da Nager.Date
// (https://date.nager.at — gratuita, sem chave, licença MIT). Países que a
// Nager não cobre e têm calendário público de feriados do Google (iCalendar,
// sem chave) usam essa fonte — hoje só o Nepal, cujos feriados seguem o
// calendário Bikram Sambat e mudam de data todo ano. O Google publica só
// alguns anos para trás e o ano corrente.
//
// GET /api/feriados?pais=DE&ano=2026
//   → { pais, ano, feriados: [{ data, nome, nomeIngles, tipos, nacional, regioes }] }
// GET /api/feriados?paises=1
//   → { paises: ["AR", "AU", …] }  países do relógio mundial com dados na fonte
//
// Só aceita os países do relógio mundial (scripts/dados/paises.js). Os
// feriados do Brasil não passam por aqui: o site tem dados próprios, com
// estados e capitais.

import { PAISES_RELOGIO } from "../scripts/dados/paises.js";
import { buscarJson, buscarTexto, exigirGet, parametros, responderComCache } from "./_lib/externo.js";
import { ErroHttp, rota } from "./_lib/http.js";

const BASE = "https://date.nager.at/api/v3";
const ANO_MIN = 1975;
const ANO_MAX = 2099;
const UM_DIA = 24 * 60 * 60;

// País → id do calendário de feriados do Google.
export const CALENDARIOS_GOOGLE = Object.freeze({ NP: "en.np" });
const urlGoogle = (id) => `https://calendar.google.com/calendar/ical/${encodeURIComponent(`${id}#holiday@group.v.calendar.google.com`)}/public/basic.ics`;

/** Item da Nager.Date → formato do site (só os campos usados, validados). */
export function normalizarFeriado(item) {
  if (!item || typeof item.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return null;
  const texto = (valor) => (typeof valor === "string" ? valor.trim().slice(0, 120) : "");
  const nome = texto(item.localName) || texto(item.name);
  if (!nome) return null;
  const tipos = Array.isArray(item.types) ? item.types.filter((t) => typeof t === "string").slice(0, 6) : [];
  const regioes = Array.isArray(item.counties) ? item.counties.filter((r) => typeof r === "string").slice(0, 40) : null;
  return {
    data: item.date,
    nome,
    nomeIngles: texto(item.name) || null,
    tipos: tipos.length ? tipos : ["Public"],
    nacional: item.global !== false,
    regioes: regioes?.length ? regioes : null,
  };
}

/**
 * Eventos de dia inteiro de um iCalendar de feriados do Google → formato do
 * site, só do ano pedido. A descrição diz "Public holiday" (folga) ou
 * "Observance" (data comemorativa). Os nomes vêm em inglês.
 */
export function feriadosDoIcs(texto, ano) {
  // Linhas dobradas (RFC 5545): continuação começa com espaço ou tab.
  const linhas = String(texto).replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const desescapar = (v) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
  const feriados = [];
  const vistos = new Set();
  let atual = null;
  for (const linha of linhas) {
    if (linha === "BEGIN:VEVENT") atual = {};
    else if (linha === "END:VEVENT" && atual) {
      const m = /^(\d{4})(\d{2})(\d{2})$/.exec(atual.inicio ?? "");
      const nome = (atual.resumo ?? "").slice(0, 120);
      if (m && Number(m[1]) === ano && nome) {
        const data = `${m[1]}-${m[2]}-${m[3]}`;
        if (!vistos.has(`${data}|${nome}`)) {
          vistos.add(`${data}|${nome}`);
          const publico = /^public holiday/i.test(atual.descricao ?? "");
          feriados.push({ data, nome, nomeIngles: null, tipos: [publico ? "Public" : "Observance"], nacional: true, regioes: null });
        }
      }
      atual = null;
    } else if (atual) {
      const i = linha.indexOf(":");
      if (i < 0) continue;
      const [campo] = linha.slice(0, i).split(";");
      const valor = linha.slice(i + 1);
      if (campo === "DTSTART") atual.inicio = valor.trim();
      else if (campo === "SUMMARY") atual.resumo = desescapar(valor);
      else if (campo === "DESCRIPTION") atual.descricao = desescapar(valor);
    }
  }
  return feriados.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

export default rota(async (req, res) => {
  exigirGet(req);
  const busca = parametros(req);

  if (busca.has("paises")) {
    const { status, dados } = await buscarJson(`${BASE}/AvailableCountries`);
    if (status !== 200 || !Array.isArray(dados)) throw new ErroHttp(502, "indisponivel");
    const disponiveis = new Set([...dados.map((p) => p?.countryCode), ...Object.keys(CALENDARIOS_GOOGLE)]);
    return responderComCache(res, { paises: PAISES_RELOGIO.filter((p) => disponiveis.has(p)) }, { segundos: UM_DIA, revalidar: 7 * UM_DIA });
  }

  const pais = String(busca.get("pais") || "").toUpperCase();
  const ano = Number(busca.get("ano"));
  if (!PAISES_RELOGIO.includes(pais)) throw new ErroHttp(400, "pais-invalido");
  if (!Number.isInteger(ano) || ano < ANO_MIN || ano > ANO_MAX) throw new ErroHttp(400, "ano-invalido");

  if (CALENDARIOS_GOOGLE[pais]) {
    const { status, texto } = await buscarTexto(urlGoogle(CALENDARIOS_GOOGLE[pais]));
    if (status !== 200 || !texto.includes("BEGIN:VCALENDAR")) throw new ErroHttp(502, "indisponivel");
    const feriados = feriadosDoIcs(texto, ano);
    if (!feriados.length) throw new ErroHttp(404, "sem-dados");
    return responderComCache(res, { pais, ano, feriados }, { segundos: UM_DIA, revalidar: 7 * UM_DIA });
  }

  const { status, dados } = await buscarJson(`${BASE}/PublicHolidays/${ano}/${pais}`);
  // 404/204: a fonte não cobre o país (ou o ano).
  if (status === 404 || status === 204) throw new ErroHttp(404, "sem-dados");
  if (status !== 200 || !Array.isArray(dados)) throw new ErroHttp(502, "indisponivel");
  const feriados = dados.map(normalizarFeriado).filter(Boolean);
  return responderComCache(res, { pais, ano, feriados }, { segundos: UM_DIA, revalidar: 7 * UM_DIA });
});
