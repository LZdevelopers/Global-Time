// Utilidades HTTP das funções de conta e eventos (pasta _lib: a Vercel não a
// publica como rota).
//
// Proteções aplicadas a toda rota que muda dados:
//  - corpo somente JSON (Content-Type), com limite de tamanho;
//  - cabeçalho Origin igual ao host (bloqueia formulários de outros sites —
//    defesa contra CSRF somada ao cookie SameSite=Lax);
//  - respostas sem cache e sem detalhes internos.

const LIMITE_CORPO = 16 * 1024;

const CABECALHOS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function responder(res, status, corpo, extras = {}) {
  res.statusCode = status;
  for (const [nome, valor] of Object.entries({ ...CABECALHOS, ...extras })) res.setHeader(nome, valor);
  res.end(corpo == null ? "" : JSON.stringify(corpo));
}

/** Erro com status HTTP e código para a interface traduzir. */
export class ErroHttp extends Error {
  constructor(status, codigo) {
    super(codigo);
    this.status = status;
    this.codigo = codigo;
  }
}

/** Lê o corpo JSON (req.body na Vercel; o fluxo no servidor local). */
export async function lerJson(req) {
  const tipo = String(req.headers["content-type"] || "");
  if (!tipo.toLowerCase().startsWith("application/json")) throw new ErroHttp(415, "tipo-invalido");
  // Na Vercel, req.body já vem analisado (e lança erro se o JSON for inválido).
  let corpo;
  try {
    corpo = req.body;
  } catch {
    throw new ErroHttp(400, "json-invalido");
  }
  if (corpo !== undefined) {
    if (typeof corpo === "object" && corpo !== null && !Array.isArray(corpo)) return corpo;
    if (typeof corpo === "string") return analisar(corpo);
    throw new ErroHttp(400, "json-invalido");
  }
  let total = 0;
  const partes = [];
  for await (const parte of req) {
    total += parte.length;
    if (total > LIMITE_CORPO) throw new ErroHttp(413, "corpo-grande");
    partes.push(parte);
  }
  return analisar(Buffer.concat(partes).toString("utf8"));
}

function analisar(texto) {
  if (texto.length > LIMITE_CORPO) throw new ErroHttp(413, "corpo-grande");
  try {
    const valor = JSON.parse(texto || "{}");
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error();
    return valor;
  } catch {
    throw new ErroHttp(400, "json-invalido");
  }
}

/** Recusa pedidos que mudam dados vindos de outra origem. */
export function exigirMesmaOrigem(req) {
  const origem = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!origem || !host) throw new ErroHttp(403, "origem-invalida");
  try {
    if (new URL(origem).host !== host) throw new Error();
  } catch {
    throw new ErroHttp(403, "origem-invalida");
  }
}

/** IP do cliente para limitar tentativas (cabeçalho da Vercel ou conexão). */
export function ipCliente(req) {
  const encaminhado = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return encaminhado || req.socket?.remoteAddress || "desconhecido";
}

/** true se o pedido chegou por HTTPS (cookie Secure). */
export function seguro(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "");
  if (proto) return proto.split(",")[0].trim() === "https";
  const host = String(req.headers.host || "");
  return !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

/** Envolve o handler: converte ErroHttp e falhas inesperadas em JSON. */
export function rota(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (erro) {
      if (erro instanceof ErroHttp) return responder(res, erro.status, { erro: erro.codigo });
      console.error(erro);
      return responder(res, 500, { erro: "interno" });
    }
  };
}
