import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularSol, coordenadasValidas, formatarCoordenadas } from "../scripts/nucleo/sol.js";
import { partesNoFuso } from "../scripts/nucleo/tempo.js";

const minutosLocais = (instante, fuso) => {
  const p = partesNoFuso(instante, fuso);
  return p.hora * 60 + p.minuto + p.segundo / 60;
};

function aproximado(instante, fuso, hhmm, tolerancia = 3) {
  const [h, m] = hhmm.split(":").map(Number);
  const diff = Math.abs(minutosLocais(instante, fuso) - (h * 60 + m));
  assert.ok(diff <= tolerancia, `esperado ~${hhmm}, diferença de ${diff.toFixed(1)} min`);
}

test("Londres no solstício de junho (valores publicados pela NOAA: 04:43 / 21:21 BST)", () => {
  const r = calcularSol({ ano: 2026, mes: 6, dia: 21 }, 51.507, -0.128, "Europe/London");
  assert.equal(r.status, "normal");
  aproximado(r.nascer, "Europe/London", "04:43");
  aproximado(r.por, "Europe/London", "21:21");
  aproximado(r.meioDia, "Europe/London", "13:02", 2);
});

test("Brasília no solstício de junho (~06:37 / ~17:49)", () => {
  const r = calcularSol({ ano: 2026, mes: 6, dia: 21 }, -15.794, -47.882, "America/Sao_Paulo");
  aproximado(r.nascer, "America/Sao_Paulo", "06:36");
  aproximado(r.por, "America/Sao_Paulo", "17:48");
  assert.ok(r.duracaoMs > 11 * 3600e3 && r.duracaoMs < 11.5 * 3600e3);
  assert.ok(r.crepusculo.inicio < r.nascer && r.crepusculo.fim > r.por);
});

test("meio-dia solar segue a longitude e a equação do tempo", () => {
  // No equinócio, a equação do tempo é ~+7 min; em Greenwich o meio-dia ≈ 12:07 UTC.
  const r = calcularSol({ ano: 2026, mes: 3, dia: 20 }, 0, 0, "UTC");
  aproximado(r.meioDia, "UTC", "12:07", 2);
  // Dia e noite quase iguais no equador.
  assert.ok(Math.abs(r.duracaoMs - 12 * 3600e3) < 10 * 60e3);
});

test("eventos caem na data civil local perto da linha de data", () => {
  for (const [lat, lon, fuso] of [[-36.849, 174.763, "Pacific/Auckland"], [21.307, -157.858, "Pacific/Honolulu"]]) {
    const r = calcularSol({ ano: 2026, mes: 1, dia: 10 }, lat, lon, fuso);
    for (const instante of [r.nascer, r.por, r.meioDia]) {
      assert.equal(partesNoFuso(instante, fuso).dia, 10);
    }
  }
});

test("dia polar e noite polar", () => {
  const junho = calcularSol({ ano: 2026, mes: 6, dia: 21 }, 69.649, 18.956, "Europe/Oslo");
  assert.equal(junho.status, "dia-polar");
  assert.equal(junho.nascer, null);
  assert.equal(junho.duracaoMs, 24 * 3600e3);
  assert.equal(junho.crepusculo.status, "claro-toda-noite");

  const dezembro = calcularSol({ ano: 2026, mes: 12, dia: 21 }, 69.649, 18.956, "Europe/Oslo");
  assert.equal(dezembro.status, "noite-polar");
  assert.equal(dezembro.duracaoMs, 0);
  assert.equal(dezembro.crepusculo.status, "normal");

  const polo = calcularSol({ ano: 2026, mes: 12, dia: 21 }, 89, 0, "UTC");
  assert.equal(polo.crepusculo.status, "sem-crepusculo");
});

test("validação e formatação de coordenadas", () => {
  assert.equal(coordenadasValidas(-15.8, -47.9), true);
  assert.equal(coordenadasValidas(91, 0), false);
  assert.equal(coordenadasValidas(0, -181), false);
  assert.equal(coordenadasValidas(Number.NaN, 0), false);
  assert.equal(formatarCoordenadas(-23.55, -46.633), "23,55° S, 46,633° O");
});
