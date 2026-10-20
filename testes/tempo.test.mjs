import { test } from "node:test";
import assert from "node:assert/strict";
import {
  civilParaInstantes,
  dataCivilValida,
  deslocamentoMinutos,
  diaDoAno,
  formatarDeslocamento,
  formatarDiferencaFuso,
  formatarDuracao,
  fusoValido,
  lerDataIso,
  lerHora,
  partesNoFuso,
  semanaIso,
} from "../scripts/nucleo/tempo.js";

test("partesNoFuso converte um instante UTC para Brasília", () => {
  const instante = Date.UTC(2026, 9, 19, 15, 4, 5); // 15:04:05 UTC
  assert.deepEqual(partesNoFuso(instante, "America/Sao_Paulo"), {
    ano: 2026, mes: 10, dia: 19, hora: 12, minuto: 4, segundo: 5, diaSemana: 1,
  });
});

test("partesNoFuso muda o dia quando necessário", () => {
  const instante = Date.UTC(2026, 0, 1, 2, 30); // 02:30 UTC = 23:30 do dia anterior em Brasília
  const p = partesNoFuso(instante, "America/Sao_Paulo");
  assert.equal(`${p.ano}-${p.mes}-${p.dia} ${p.hora}:${p.minuto}`, "2025-12-31 23:30");
});

test("deslocamentos dos quatro fusos brasileiros", () => {
  const instante = Date.UTC(2026, 6, 1, 12);
  assert.equal(deslocamentoMinutos(instante, "America/Noronha"), -120);
  assert.equal(deslocamentoMinutos(instante, "America/Sao_Paulo"), -180);
  assert.equal(deslocamentoMinutos(instante, "America/Manaus"), -240);
  assert.equal(deslocamentoMinutos(instante, "America/Rio_Branco"), -300);
});

test("deslocamento respeita horário de verão de outras regiões", () => {
  assert.equal(deslocamentoMinutos(Date.UTC(2026, 0, 15), "Europe/Lisbon"), 0);
  assert.equal(deslocamentoMinutos(Date.UTC(2026, 6, 15), "Europe/Lisbon"), 60);
  assert.equal(deslocamentoMinutos(Date.UTC(2026, 0, 15), "America/New_York"), -300);
  assert.equal(deslocamentoMinutos(Date.UTC(2026, 6, 15), "America/New_York"), -240);
  assert.equal(deslocamentoMinutos(Date.UTC(2026, 0, 15), "Asia/Kolkata"), 330);
});

test("Brasil não tem mais horário de verão (desde 2019)", () => {
  assert.equal(deslocamentoMinutos(Date.UTC(2026, 0, 15), "America/Sao_Paulo"), -180);
  // Em 2018 ainda havia horário de verão em São Paulo.
  assert.equal(deslocamentoMinutos(Date.UTC(2018, 0, 15), "America/Sao_Paulo"), -120);
});

test("civilParaInstantes: horário normal", () => {
  const r = civilParaInstantes({ ano: 2026, mes: 10, dia: 19, hora: 12 }, "America/Sao_Paulo");
  assert.equal(r.situacao, "normal");
  assert.equal(r.instantes[0], Date.UTC(2026, 9, 19, 15));
});

test("civilParaInstantes: hora inexistente no início do horário de verão", () => {
  // Lisboa, 29/03/2026: 01:00 → 02:00. 01:30 não existe.
  const r = civilParaInstantes({ ano: 2026, mes: 3, dia: 29, hora: 1, minuto: 30 }, "Europe/Lisbon");
  assert.equal(r.situacao, "inexistente");
  const p = partesNoFuso(r.instantes[0], "Europe/Lisbon");
  assert.equal(`${p.hora}:${p.minuto}`, "2:30");
});

test("civilParaInstantes: hora ambígua no fim do horário de verão", () => {
  // Lisboa, 25/10/2026: 02:00 → 01:00. 01:30 acontece duas vezes.
  const r = civilParaInstantes({ ano: 2026, mes: 10, dia: 25, hora: 1, minuto: 30 }, "Europe/Lisbon");
  assert.equal(r.situacao, "ambigua");
  assert.equal(r.instantes.length, 2);
  assert.equal(r.instantes[1] - r.instantes[0], 60 * 60 * 1000);
  assert.equal(r.instantes[0], Date.UTC(2026, 9, 25, 0, 30));
});

test("formatarDuracao", () => {
  assert.equal(formatarDuracao(0), "00:00:00");
  assert.equal(formatarDuracao(3_723_456, { centesimos: true }), "01:02:03,45");
  assert.equal(formatarDuracao(59_999, { horas: "auto" }), "00:59");
  assert.equal(formatarDuracao(1001, { arredondar: "cima" }), "00:00:02");
  assert.equal(formatarDuracao(100 * 3_600_000), "100:00:00");
});

test("formatação de deslocamentos e diferenças", () => {
  assert.equal(formatarDeslocamento(-180), "UTC−03:00");
  assert.equal(formatarDeslocamento(330), "UTC+05:30");
  assert.equal(formatarDeslocamento(0), "UTC");
  assert.equal(formatarDiferencaFuso(0), "Mesmo horário");
  assert.equal(formatarDiferencaFuso(-120), "−2 h");
  assert.equal(formatarDiferencaFuso(510), "+8 h 30 min");
});

test("validação de datas e horas", () => {
  assert.equal(dataCivilValida(2024, 2, 29), true);
  assert.equal(dataCivilValida(2026, 2, 29), false);
  assert.equal(lerDataIso("2026-02-30"), null);
  assert.deepEqual(lerDataIso("2026-12-25"), { ano: 2026, mes: 12, dia: 25 });
  assert.equal(lerHora("24:00"), null);
  assert.deepEqual(lerHora("07:05"), { hora: 7, minuto: 5, segundo: 0 });
  assert.equal(fusoValido("America/Sao_Paulo"), true);
  assert.equal(fusoValido("Marte/Olympus"), false);
  assert.equal(fusoValido("<script>"), false);
});

test("semana ISO e dia do ano", () => {
  assert.equal(semanaIso(2026, 1, 1), 1);
  assert.equal(semanaIso(2027, 1, 1), 53); // sexta-feira: pertence à semana 53 de 2026
  assert.equal(diaDoAno(2024, 12, 31), 366);
});
