// Consulta a serviços públicos de dados (feriados, clima, busca de cidades)
// feita pelas funções /api/feriados e /api/clima.
//
// O navegador nunca fala direto com esses serviços: a política de segurança
// do site só permite conexões com o próprio domínio (connect-src 'self'), e
// passar pela função deixa a CDN da Vercel guardar as respostas — muitos
// visitantes, poucas consultas aos serviços gratuitos.

import { ErroHttp, responder } from "./http.js";

const TEMPO_LIMITE_MS = 8000;
const AGENTE = "GlobalTime/2 (+https://global-time.lzdev.com.br)";

/**
 * GET em JSON com limite de tempo. Devolve { status, dados } para 2xx e 4xx
 * (o chamador decide o que um 404 significa); falha de rede, tempo esgotado
 * ou 5xx viram ErroHttp 502 "indisponivel".
 */
export async function buscarJson(url, { tempoLimiteMs = TEMPO_LIMITE_MS } = {}) {
  let resposta;
  try {
    resposta = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": AGENTE },
      signal: AbortSignal.timeout(tempoLimiteMs),
    });
  } catch {
    throw new ErroHttp(502, "indisponivel");
  }
  if (resposta.status >= 500) throw new ErroHttp(502, "indisponivel");
  if (resposta.status === 204) return { status: 204, dados: null };
  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    if (resposta.ok) throw new ErroHttp(502, "indisponivel");
  }
  return { status: resposta.status, dados };
}

/**
 * GET em texto (ex.: iCalendar), com as mesmas regras de buscarJson.
 * Devolve { status, texto }.
 */
export async function buscarTexto(url, { tempoLimiteMs = TEMPO_LIMITE_MS } = {}) {
  let resposta;
  try {
    resposta = await fetch(url, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(tempoLimiteMs) });
  } catch {
    throw new ErroHttp(502, "indisponivel");
  }
  if (resposta.status >= 500) throw new ErroHttp(502, "indisponivel");
  try {
    return { status: resposta.status, texto: await resposta.text() };
  } catch {
    throw new ErroHttp(502, "indisponivel");
  }
}

/**
 * Resposta que a CDN pode guardar por `segundos` e continuar servindo por
 * `revalidar` segundos enquanto busca a versão nova em segundo plano. O
 * navegador não guarda (max-age=0): quem decide o cache local é a página.
 */
export function responderComCache(res, corpo, { segundos, revalidar = segundos }) {
  const cdn = `public, s-maxage=${segundos}, stale-while-revalidate=${revalidar}`;
  responder(res, 200, corpo, {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": cdn,
    "Vercel-CDN-Cache-Control": cdn,
  });
}

/** Parâmetros da URL do pedido (req.query não existe no servidor local). */
export function parametros(req) {
  return new URL(req.url, "http://local").searchParams;
}

/** Recusa métodos que não sejam GET/HEAD. */
export function exigirGet(req) {
  if (req.method !== "GET" && req.method !== "HEAD") throw new ErroHttp(405, "metodo");
}
