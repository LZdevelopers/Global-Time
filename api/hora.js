// GET /api/hora → { "timestamp": <milissegundos Unix do servidor> }
//
// Usado pelo navegador para estimar a diferença entre o relógio do aparelho e
// o do servidor (ver scripts/nucleo/sincronizacao.js). O relógio do servidor
// da Vercel é mantido por NTP; não é uma fonte atômica oficial, e a resposta
// não promete precisão absoluta.
//
// A resposta nunca pode vir de cache: um timestamp guardado seria um horário
// errado. Por isso os cabeçalhos no-store aqui e em vercel.json, e o service
// worker ignora esta rota.

const CABECALHOS_COMUNS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function responder(res, status, corpo, extras = {}) {
  const texto = corpo == null ? "" : JSON.stringify(corpo);
  res.statusCode = status;
  for (const [nome, valor] of Object.entries({ ...CABECALHOS_COMUNS, ...extras })) {
    res.setHeader(nome, valor);
  }
  res.end(texto);
}

export default function handler(req, res) {
  // Lido o mais cedo possível para não somar o tempo de processamento.
  const timestamp = Date.now();

  try {
    if (req.method === "OPTIONS") {
      return responder(res, 204, null, { Allow: "GET, HEAD, OPTIONS" });
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return responder(res, 405, { erro: "Método não permitido" }, { Allow: "GET, HEAD, OPTIONS" });
    }
    if (req.method === "HEAD") {
      res.statusCode = 200;
      for (const [nome, valor] of Object.entries(CABECALHOS_COMUNS)) res.setHeader(nome, valor);
      return res.end();
    }
    return responder(res, 200, { timestamp });
  } catch {
    // Nenhum detalhe interno é exposto.
    return responder(res, 500, { erro: "Erro interno" });
  }
}
