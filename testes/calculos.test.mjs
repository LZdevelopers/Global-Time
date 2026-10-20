import test from "node:test";
import assert from "node:assert/strict";
import {
  civilParaTimestamp,
  converterUnidades,
  descreverCalendario,
  diasUteisEntre,
  diferencaEntreDatas,
  duracaoEntreHorarios,
  formatarIsoNoFuso,
  formatarRelativo,
  formatarRfc2822,
  lerNumero,
  lerTimestamp,
  somarDias,
} from "../scripts/nucleo/calculos.js";

const d = (ano, mes, dia) => ({ ano, mes, dia });

test("diferença entre datas: dias, semanas e calendário", () => {
  const r = diferencaEntreDatas(d(2026, 1, 1), d(2026, 12, 31));
  assert.equal(r.dias, 364);
  assert.equal(r.semanas, 52);
  assert.equal(r.diasAlemSemanas, 0);
  assert.deepEqual([r.anos, r.meses, r.diasCalendario], [0, 11, 30]);
});

test("diferença atravessa ano bissexto", () => {
  assert.equal(diferencaEntreDatas(d(2024, 2, 28), d(2024, 3, 1)).dias, 2);
  assert.equal(diferencaEntreDatas(d(2023, 2, 28), d(2023, 3, 1)).dias, 1);
  const r = diferencaEntreDatas(d(2020, 2, 29), d(2024, 2, 29));
  assert.deepEqual([r.anos, r.meses, r.diasCalendario], [4, 0, 0]);
  assert.equal(r.dias, 1461);
});

test("diferença de calendário com fim de mês", () => {
  const r = diferencaEntreDatas(d(2026, 1, 31), d(2026, 3, 1));
  assert.deepEqual([r.anos, r.meses, r.diasCalendario], [0, 1, 1]);
  assert.equal(descreverCalendario(r), "1 mês e 1 dia");
  const r2 = diferencaEntreDatas(d(2026, 1, 31), d(2026, 2, 28));
  // Convenção de fim de mês: 31/jan + 1 mês = 28/fev.
  assert.deepEqual([r2.meses, r2.diasCalendario], [1, 0]);
  assert.equal(r2.dias, 28);
});

test("diferença negativa quando a data final é anterior", () => {
  const r = diferencaEntreDatas(d(2026, 3, 10), d(2026, 3, 1));
  assert.equal(r.dias, -9);
  assert.equal(r.negativa, true);
  assert.equal(r.diasCalendario, 9);
  assert.equal(descreverCalendario(diferencaEntreDatas(d(2026, 3, 1), d(2026, 3, 1))), "0 dias");
});

test("dias úteis descontam fim de semana e feriado nacional", () => {
  // 16 a 20/nov/2026: segunda a sexta; 20/nov é Consciência Negra.
  assert.equal(diasUteisEntre(d(2026, 11, 16), d(2026, 11, 20)), 4);
  // Semana inteira de 16 a 22 (inclui sábado e domingo).
  assert.equal(diasUteisEntre(d(2026, 11, 16), d(2026, 11, 22)), 4);
  // Ordem invertida dá o mesmo resultado.
  assert.equal(diasUteisEntre(d(2026, 11, 20), d(2026, 11, 16)), 4);
});

test("pontos facultativos contam como úteis", () => {
  // Carnaval 2026: 16 e 17/fev são pontos facultativos.
  assert.equal(diasUteisEntre(d(2026, 2, 16), d(2026, 2, 20)), 5);
});

test("dias úteis com feriado estadual", () => {
  // 9/jul/2026 (quinta) — Revolução Constitucionalista, feriado em SP.
  assert.equal(diasUteisEntre(d(2026, 7, 6), d(2026, 7, 10)), 5);
  assert.equal(diasUteisEntre(d(2026, 7, 6), d(2026, 7, 10), { uf: "SP" }), 4);
});

test("somar dias úteis pula fim de semana e feriado", () => {
  // Quinta 19/nov + 1 dia útil: sexta 20 é feriado → segunda 23.
  assert.deepEqual(somarDias(d(2026, 11, 19), 1, { uteis: true }), { ano: 2026, mes: 11, dia: 23, diaSemana: 1 });
  // Sexta 13/nov + 5 úteis: 16,17,18,19,23 → 23/nov.
  assert.equal(somarDias(d(2026, 11, 13), 5, { uteis: true }).dia, 23);
  // Subtrair.
  assert.equal(somarDias(d(2026, 11, 23), -1, { uteis: true }).dia, 19);
  // Corridos atravessando o ano.
  assert.deepEqual(somarDias(d(2026, 12, 31), 1), { ano: 2027, mes: 1, dia: 1, diaSemana: 5 });
});

test("duração entre horários, inclusive passando da meia-noite", () => {
  const r = duracaoEntreHorarios("08:30", "17:45", 60);
  assert.equal(r.texto, "8:15");
  assert.equal(r.decimal, 8.25);
  assert.equal(r.viraDia, false);
  const noite = duracaoEntreHorarios("22:00", "06:30");
  assert.equal(noite.texto, "8:30");
  assert.equal(noite.viraDia, true);
  assert.equal(duracaoEntreHorarios("10:00", "10:00").texto, "0:00");
  assert.equal(duracaoEntreHorarios("25:00", "10:00"), null);
  assert.equal(duracaoEntreHorarios("10:00", "11:00", -5), null);
  assert.ok(duracaoEntreHorarios("10:00", "11:00", 90).erro);
});

test("conversão de unidades e leitura de números", () => {
  const r = converterUnidades(90, "minutos");
  assert.equal(r.horas, 1.5);
  assert.equal(r.segundos, 5400);
  assert.equal(converterUnidades(1, "semanas").dias, 7);
  assert.equal(lerNumero("1.234,5"), 1234.5);
  assert.equal(lerNumero("1234.5"), 1234.5);
  assert.ok(Number.isNaN(lerNumero("abc")));
  assert.ok(Number.isNaN(lerNumero("")));
  assert.equal(converterUnidades(Number.NaN, "horas"), null);
  assert.equal(converterUnidades(1, "anos"), null);
});

test("timestamp: detecção de segundos e milissegundos", () => {
  assert.deepEqual(lerTimestamp("1760900000"), { ms: 1760900000000, unidade: "s", detectada: true });
  assert.equal(lerTimestamp("1760900000000").unidade, "ms");
  assert.equal(lerTimestamp("1760900000000").ms, 1760900000000);
  assert.equal(lerTimestamp("-86400").ms, -86400000);
  assert.equal(lerTimestamp("1760900000", "ms").ms, 1760900000);
  assert.equal(lerTimestamp("1 760 900 000").ms, 1760900000000);
  assert.ok(lerTimestamp("12abc").erro);
  assert.ok(lerTimestamp("").erro);
  assert.ok(lerTimestamp("99999999999999999999").erro);
});

test("formatação ISO 8601 e RFC 2822", () => {
  const ms = Date.UTC(2026, 9, 19, 20, 0, 0, 5);
  assert.equal(formatarIsoNoFuso(ms, "UTC"), "2026-10-19T20:00:00.005Z");
  assert.equal(formatarIsoNoFuso(ms, "America/Sao_Paulo"), "2026-10-19T17:00:00.005-03:00");
  assert.equal(formatarIsoNoFuso(ms, "Asia/Kolkata"), "2026-10-20T01:30:00.005+05:30");
  assert.equal(formatarRfc2822(ms, "America/Sao_Paulo"), "Mon, 19 Oct 2026 17:00:00 -0300");
  assert.equal(formatarRfc2822(0, "UTC"), "Thu, 01 Jan 1970 00:00:00 +0000");
});

test("tempo relativo", () => {
  const agora = Date.UTC(2026, 9, 19);
  assert.equal(formatarRelativo(agora - 3 * 86400000, agora), "há 3 dias");
  assert.equal(formatarRelativo(agora + 2 * 3600000, agora), "em 2 horas");
  assert.equal(formatarRelativo(agora, agora), "agora");
});

test("data/hora de Brasília para timestamp", () => {
  const r = civilParaTimestamp({ ano: 2026, mes: 10, dia: 19, hora: 17, minuto: 0 }, "America/Sao_Paulo");
  assert.equal(r.situacao, "normal");
  assert.equal(r.instantes[0], Date.UTC(2026, 9, 19, 20, 0, 0));
  assert.ok(civilParaTimestamp({ ano: 2026, mes: 2, dia: 30 }).erro);
  assert.ok(civilParaTimestamp({ ano: 2026, mes: 2, dia: 1, hora: 24 }).erro);
  // Nova York, início do horário de verão: 02:30 de 8/mar/2026 não existe.
  assert.equal(civilParaTimestamp({ ano: 2026, mes: 3, dia: 8, hora: 2, minuto: 30 }, "America/New_York").situacao, "inexistente");
});
