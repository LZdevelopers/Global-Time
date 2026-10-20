import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adiarAlarme,
  alarmesPerdidos,
  aposDisparo,
  proximoDisparo,
  proximoGeral,
  restaurarAlarmes,
  validarAlarme,
} from "../scripts/nucleo/alarmes.js";

const SP = "America/Sao_Paulo";
// 2026-10-19 (segunda-feira) 10:00 em Brasília = 13:00 UTC.
const AGORA = Date.UTC(2026, 9, 19, 13, 0, 0);

const semanal = (dias, hora = "07:00", fuso = SP) => ({ id: "x", hora, dias, data: null, fuso, ativo: true });

test("alarme semanal: hoje mais tarde", () => {
  // Segunda (1) às 18:00 → hoje 21:00 UTC.
  assert.equal(proximoDisparo(semanal([1], "18:00"), AGORA), Date.UTC(2026, 9, 19, 21, 0));
});

test("alarme semanal: horário de hoje já passou vai para a semana seguinte", () => {
  assert.equal(proximoDisparo(semanal([1], "07:00"), AGORA), Date.UTC(2026, 9, 26, 10, 0));
});

test("alarme semanal atravessa o fim de semana", () => {
  // Domingo (0) 08:00 → 2026-10-25 11:00 UTC.
  assert.equal(proximoDisparo(semanal([0], "08:00"), AGORA), Date.UTC(2026, 9, 25, 11, 0));
  // Vários dias: o mais próximo vence (terça 07:00).
  assert.equal(proximoDisparo(semanal([0, 2, 5]), AGORA), Date.UTC(2026, 9, 20, 10, 0));
});

test("alarme em outro fuso", () => {
  // Tóquio (UTC+9) terça 07:00 = segunda 22:00 UTC.
  assert.equal(proximoDisparo(semanal([2], "07:00", "Asia/Tokyo"), AGORA), Date.UTC(2026, 9, 19, 22, 0));
});

test("alarme único no passado é recusado", () => {
  const r = validarAlarme({ modo: "unico", hora: "09:00", data: "2026-10-19", fuso: SP }, AGORA);
  assert.equal(r.ok, false);
  assert.match(r.erros.hora, /já passou/);
  const ok = validarAlarme({ modo: "unico", hora: "11:00", data: "2026-10-19", fuso: SP, rotulo: "  Reunião  " }, AGORA);
  assert.equal(ok.ok, true);
  assert.equal(ok.alarme.rotulo, "Reunião");
  assert.equal(proximoDisparo(ok.alarme, AGORA), Date.UTC(2026, 9, 19, 14, 0));
});

test("validação de campos", () => {
  const r = validarAlarme({ modo: "semanal", hora: "25:00", dias: [], fuso: "Lugar/Inexistente" }, AGORA);
  assert.equal(r.ok, false);
  assert.ok(r.erros.hora && r.erros.dias && r.erros.fuso);
  const data = validarAlarme({ modo: "unico", hora: "08:00", data: "2026-02-30", fuso: SP }, AGORA);
  assert.ok(data.erros.data);
  const rotulo = validarAlarme({ modo: "semanal", hora: "08:00", dias: [1], fuso: SP, rotulo: "a".repeat(200) }, AGORA);
  assert.equal(rotulo.alarme.rotulo.length, 60);
});

test("hora inexistente no horário de verão toca logo após o salto", () => {
  // Nova York, 2026-03-08: 02:00 → 03:00. 02:30 não existe; toca às 03:30 EDT = 07:30 UTC.
  const alarme = { id: "ny", hora: "02:30", data: "2026-03-08", dias: [], fuso: "America/New_York", ativo: true };
  assert.equal(proximoDisparo(alarme, Date.UTC(2026, 2, 1)), Date.UTC(2026, 2, 8, 7, 30));
});

test("hora ambígua no fim do horário de verão toca na primeira ocorrência", () => {
  // Nova York, 2026-11-01: 01:30 acontece duas vezes; a primeira é EDT (05:30 UTC).
  const alarme = { id: "ny", hora: "01:30", data: "2026-11-01", dias: [], fuso: "America/New_York", ativo: true };
  assert.equal(proximoDisparo(alarme, Date.UTC(2026, 9, 20)), Date.UTC(2026, 10, 1, 5, 30));
});

test("soneca, desativação após disparo e próximo geral", () => {
  const unico = { id: "u", hora: "11:00", data: "2026-10-19", dias: [], fuso: SP, ativo: true };
  const adiado = adiarAlarme(unico, AGORA);
  assert.equal(proximoDisparo(adiado, AGORA), AGORA + 5 * 60 * 1000);
  assert.equal(aposDisparo(unico).ativo, false);
  assert.equal(aposDisparo(semanal([1])).ativo, true);
  assert.equal(proximoDisparo({ ...unico, ativo: false }, AGORA), null);
  const geral = proximoGeral([semanal([0], "08:00"), unico], AGORA);
  assert.equal(geral.alarme.id, "u");
});

test("alarmes perdidos enquanto a página estava fechada", () => {
  const unico = { id: "u", hora: "07:00", data: "2026-10-19", dias: [], fuso: SP, ativo: true };
  const perdidos = alarmesPerdidos([unico, semanal([3])], Date.UTC(2026, 9, 19, 0), AGORA);
  assert.equal(perdidos.length, 1);
  assert.equal(perdidos[0].alarme.id, "u");
  assert.deepEqual(alarmesPerdidos([unico], AGORA, AGORA - 1), []);
});

test("restaurar descarta dados corrompidos", () => {
  const lista = restaurarAlarmes([null, { hora: "xx" }, { id: "ok", hora: "07:00", dias: [1, 9], fuso: "x", ativo: 1 }]);
  assert.equal(lista.length, 1);
  assert.deepEqual(lista[0].dias, [1]);
  assert.equal(lista[0].fuso, SP);
  assert.deepEqual(restaurarAlarmes("lixo"), []);
});
