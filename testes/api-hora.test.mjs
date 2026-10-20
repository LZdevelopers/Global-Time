import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/hora.js";

function resposta() {
  const r = {
    statusCode: 0,
    cabecalhos: {},
    corpo: undefined,
    setHeader(nome, valor) {
      this.cabecalhos[nome.toLowerCase()] = valor;
    },
    end(corpo) {
      this.corpo = corpo;
    },
  };
  return r;
}

test("GET devolve o timestamp atual em milissegundos, sem cache", () => {
  const res = resposta();
  const antes = Date.now();
  handler({ method: "GET" }, res);
  const depois = Date.now();
  assert.equal(res.statusCode, 200);
  const { timestamp } = JSON.parse(res.corpo);
  assert.ok(Number.isInteger(timestamp));
  assert.ok(timestamp >= antes && timestamp <= depois);
  assert.match(res.cabecalhos["cache-control"], /no-store/);
  assert.equal(res.cabecalhos["cdn-cache-control"], "no-store");
  assert.match(res.cabecalhos["content-type"], /application\/json/);
});

test("corpo pequeno e sem informações internas", () => {
  const res = resposta();
  handler({ method: "GET" }, res);
  assert.deepEqual(Object.keys(JSON.parse(res.corpo)), ["timestamp"]);
  assert.ok(res.corpo.length < 40);
});

test("métodos não permitidos recebem 405 com Allow", () => {
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    const res = resposta();
    handler({ method }, res);
    assert.equal(res.statusCode, 405, method);
    assert.equal(res.cabecalhos.allow, "GET, HEAD, OPTIONS");
    assert.match(res.cabecalhos["cache-control"], /no-store/);
  }
});

test("HEAD e OPTIONS", () => {
  const head = resposta();
  handler({ method: "HEAD" }, head);
  assert.equal(head.statusCode, 200);
  assert.equal(head.corpo, undefined);

  const options = resposta();
  handler({ method: "OPTIONS" }, options);
  assert.equal(options.statusCode, 204);
});
