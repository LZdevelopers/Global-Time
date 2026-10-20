import assert from "node:assert/strict";
import { test } from "node:test";
import { csvVoltas, formatarCronometro, formatarDiferencaVolta, textoVoltas } from "../scripts/nucleo/voltas.js";

test("formata tempo de cronômetro abaixo e acima de 1 hora", () => {
  assert.equal(formatarCronometro(0), "00:00,00");
  assert.equal(formatarCronometro(83_456), "01:23,45");
  assert.equal(formatarCronometro(3_600_000), "01:00:00,00");
  assert.equal(formatarCronometro(3_723_990), "01:02:03,99");
});

test("formata diferença entre voltas com sinal", () => {
  assert.equal(formatarDiferencaVolta(null), "—");
  assert.equal(formatarDiferencaVolta(520), "+0,52 s");
  assert.equal(formatarDiferencaVolta(-1070), "−1,07 s");
  assert.equal(formatarDiferencaVolta(0), "±0,00 s");
  assert.equal(formatarDiferencaVolta(62_100), "+01:02,10");
});

test("CSV tem BOM, separador ; e valores exatos em ms", () => {
  const csv = csvVoltas([10_000, 25_000, 32_000], 40_000);
  assert.ok(csv.startsWith("﻿"));
  const linhas = csv.slice(1).trim().split("\r\n");
  assert.equal(linhas.length, 5);
  assert.equal(linhas[0].split(";")[0], "Volta");
  // Volta 2: 15 s, +5,00 s em relação à volta 1, pior volta.
  assert.deepEqual(linhas[2].split(";"), ["2", "00:15,00", "+5,00 s", "00:25,00", "15000", "25000", "pior"]);
  // Volta 3: 7 s, melhor.
  assert.equal(linhas[3].split(";").at(-1), "melhor");
  assert.deepEqual(linhas[4].split(";"), ["Tempo total", "00:40,00", "", "", "", "40000", ""]);
});

test("texto copiável lista voltas e total", () => {
  const texto = textoVoltas([10_000, 25_000], 30_000);
  assert.match(texto, /tempo total 00:30,00/);
  assert.match(texto, /1\t00:10,00 \(melhor\)/);
  assert.match(texto, /2\t00:15,00 \(pior\)\t\+5,00 s\t00:25,00/);
});
