import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizarLista, ocorrencias, validarEvento } from "../scripts/nucleo/eventos.js";
import { diaJuliano } from "../scripts/nucleo/tempo.js";

test("validação limpa o texto e exige título e data válidos", () => {
  const r = validarEvento({ titulo: "  Reunião\n\tsemanal  ", data: "2026-10-20", hora: "09:05", descricao: "linha 1\r\nlinha 2" });
  assert.equal(r.ok, true);
  assert.equal(r.evento.titulo, "Reunião semanal");
  assert.equal(r.evento.descricao, "linha 1\nlinha 2");
  assert.equal(r.evento.hora, "09:05");
  assert.equal(r.evento.anual, false);
  assert.match(r.evento.id, /^[0-9a-f]{24}$/);
  assert.deepEqual(validarEvento({ titulo: "", data: "2026-13-01" }).erros, { titulo: "obrigatorio", data: "invalida" });
  assert.deepEqual(validarEvento({ titulo: "a", data: "2026-01-01", hora: "7:00" }).erros, { hora: "invalida" });
});

test("título longo é cortado; HTML fica como texto", () => {
  const r = validarEvento({ titulo: `<img src=x>${"a".repeat(200)}`, data: "2026-01-01" });
  assert.equal(r.evento.titulo.length, 100);
  assert.ok(r.evento.titulo.startsWith("<img"));
});

test("lista salva descarta itens inválidos e duplicados", () => {
  const ok = validarEvento({ titulo: "A", data: "2026-01-01" }, { id: "abcdefgh1" }).evento;
  const lista = normalizarLista([ok, { ...ok }, { id: "x", titulo: "curto" }, null, { id: "ijklmnop2", titulo: "B", data: "nada" }]);
  assert.deepEqual(lista.map((e) => e.id), ["abcdefgh1"]);
  assert.deepEqual(normalizarLista("lixo"), []);
});

test("ocorrências: evento único e anual, inclusive 29 de fevereiro", () => {
  const unico = validarEvento({ titulo: "Show", data: "2026-07-10", hora: "21:00" }, { id: "unico0001" }).evento;
  const anual = validarEvento({ titulo: "Aniversário", data: "2024-02-29", anual: true }, { id: "anual0001" }).evento;
  const r = ocorrencias([unico, anual], diaJuliano(2025, 1, 1), diaJuliano(2028, 12, 31));
  const datas = r.map((o) => new Date(o.juliano * 86400000).toISOString().slice(0, 10));
  assert.deepEqual(datas, ["2025-02-28", "2026-02-28", "2026-07-10", "2027-02-28", "2028-02-29"]);
  // Anual não aparece antes do ano original.
  assert.equal(ocorrencias([anual], diaJuliano(2020, 1, 1), diaJuliano(2023, 12, 31)).length, 0);
});
