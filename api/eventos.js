// /api/eventos — eventos pessoais da conta da sessão.
//
//   GET                       → { eventos: [...] }
//   POST { titulo, data, … }  → cria; { evento }
//   PUT ?id=… { … }           → atualiza; { evento }
//   DELETE ?id=…              → exclui
//
// Cada conta só lê e altera a própria chave (eventos:<id da conta>), e o id
// vem da sessão — nunca do pedido. A validação é a mesma do navegador
// (scripts/nucleo/eventos.js).

import { executar } from "./_lib/armazem.js";
import { exigirConta } from "./_lib/contas.js";
import { ErroHttp, exigirMesmaOrigem, lerJson, responder, rota } from "./_lib/http.js";
import { LIMITE_EVENTOS, normalizarLista, validarEvento } from "../scripts/nucleo/eventos.js";

const RE_ID = /^[A-Za-z0-9_-]{8,40}$/;

function idDaUrl(req) {
  const id = new URL(req.url, "http://x").searchParams.get("id");
  if (!id || !RE_ID.test(id)) throw new ErroHttp(400, "id-invalido");
  return id;
}

export default rota(async (req, res) => {
  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method)) throw new ErroHttp(405, "metodo-nao-permitido");
  if (req.method !== "GET") exigirMesmaOrigem(req);
  const conta = await exigirConta(req);
  const chave = `eventos:${conta.id}`;

  if (req.method === "GET") {
    const [valores] = await executar(["HVALS", chave]);
    const eventos = normalizarLista((valores ?? []).map((v) => JSON.parse(v)));
    return responder(res, 200, { eventos });
  }

  if (req.method === "DELETE") {
    await executar(["HDEL", chave, idDaUrl(req)]);
    return responder(res, 200, { ok: true });
  }

  const corpo = await lerJson(req);

  if (req.method === "POST") {
    const [quantidade] = await executar(["HLEN", chave]);
    if (quantidade >= LIMITE_EVENTOS) throw new ErroHttp(409, "limite-eventos");
    const r = validarEvento(corpo);
    if (!r.ok) return responder(res, 400, { erro: "evento-invalido", campos: r.erros });
    await executar(["HSET", chave, r.evento.id, JSON.stringify(r.evento)]);
    return responder(res, 201, { evento: r.evento });
  }

  // PUT
  const id = idDaUrl(req);
  const [atual] = await executar(["HGET", chave, id]);
  if (!atual) throw new ErroHttp(404, "evento-inexistente");
  const r = validarEvento(corpo, { id, criadoEm: JSON.parse(atual).criadoEm });
  if (!r.ok) return responder(res, 400, { erro: "evento-invalido", campos: r.erros });
  await executar(["HSET", chave, id, JSON.stringify(r.evento)]);
  return responder(res, 200, { evento: r.evento });
});
