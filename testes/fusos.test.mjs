import assert from "node:assert/strict";
import { test } from "node:test";
import {
  diferencaEntreFusos,
  emHorarioComercial,
  lerListaCidades,
  lerParametrosConversor,
  planejarReuniao,
  resolverZona,
  validarListaCidades,
} from "../scripts/nucleo/fusos.js";
import { civilParaInstante, civilParaInstantes, partesNoFuso } from "../scripts/nucleo/tempo.js";

const utc = (texto) => Date.parse(texto);

test("Lisboa 2026-03-29 01:30 não existe (início do horário de verão)", () => {
  const r = civilParaInstantes({ ano: 2026, mes: 3, dia: 29, hora: 1, minuto: 30 }, "Europe/Lisbon");
  assert.equal(r.situacao, "inexistente");
  assert.equal(r.instantes[0], utc("2026-03-29T01:30:00Z"));
  const p = partesNoFuso(r.instantes[0], "Europe/Lisbon");
  assert.deepEqual([p.hora, p.minuto], [2, 30]);
});

test("Lisboa 2026-10-25 01:30 é ambígua (fim do horário de verão)", () => {
  const r = civilParaInstantes({ ano: 2026, mes: 10, dia: 25, hora: 1, minuto: 30 }, "Europe/Lisbon");
  assert.equal(r.situacao, "ambigua");
  assert.deepEqual(r.instantes, [utc("2026-10-25T00:30:00Z"), utc("2026-10-25T01:30:00Z")]);
});

test("Nova York: hora pulada e hora repetida em 2026", () => {
  const pulada = civilParaInstantes({ ano: 2026, mes: 3, dia: 8, hora: 2, minuto: 30 }, "America/New_York");
  assert.equal(pulada.situacao, "inexistente");
  const repetida = civilParaInstantes({ ano: 2026, mes: 11, dia: 1, hora: 1, minuto: 30 }, "America/New_York");
  assert.equal(repetida.situacao, "ambigua");
  assert.equal(repetida.instantes[1] - repetida.instantes[0], 3600000);
});

test("fusos do Brasil sem horário de verão", () => {
  const r = civilParaInstantes({ ano: 2026, mes: 11, dia: 1, hora: 0, minuto: 0 }, "America/Sao_Paulo");
  assert.equal(r.situacao, "normal");
  assert.equal(r.instantes[0], utc("2026-11-01T03:00:00Z"));
  const instante = utc("2026-07-01T15:00:00Z");
  assert.equal(diferencaEntreFusos(instante, "America/Sao_Paulo", "America/Rio_Branco"), -120);
  assert.equal(diferencaEntreFusos(instante, "America/Sao_Paulo", "America/Manaus"), -60);
  assert.equal(diferencaEntreFusos(instante, "America/Sao_Paulo", "America/Noronha"), 60);
});

test("conversão São Paulo → Lisboa e Tóquio em 2026-07-01 12:00", () => {
  const instante = civilParaInstante({ ano: 2026, mes: 7, dia: 1, hora: 12, minuto: 0 }, "America/Sao_Paulo");
  const lisboa = partesNoFuso(instante, "Europe/Lisbon");
  const toquio = partesNoFuso(instante, "Asia/Tokyo");
  assert.deepEqual([lisboa.dia, lisboa.hora], [1, 16]);
  assert.deepEqual([toquio.dia, toquio.hora], [2, 0]);
});

test("horário comercial: seg–sex, 9h às 18h", () => {
  assert.equal(emHorarioComercial({ diaSemana: 1, hora: 9 }), true);
  assert.equal(emHorarioComercial({ diaSemana: 5, hora: 17 }), true);
  assert.equal(emHorarioComercial({ diaSemana: 5, hora: 18 }), false);
  assert.equal(emHorarioComercial({ diaSemana: 3, hora: 8 }), false);
  assert.equal(emHorarioComercial({ diaSemana: 6, hora: 10 }), false);
  assert.equal(emHorarioComercial({ diaSemana: 0, hora: 10 }), false);
});

test("resolverZona aceita cidade ou IANA e rejeita lixo", () => {
  assert.equal(resolverZona("lisboa").fuso, "Europe/Lisbon");
  assert.equal(resolverZona("Asia/Kolkata").fuso, "Asia/Kolkata");
  assert.equal(resolverZona("Marte/Base"), null);
  assert.equal(resolverZona("<script>"), null);
  assert.equal(resolverZona(""), null);
});

test("parâmetros do conversor são validados", () => {
  assert.deepEqual(lerParametrosConversor("?de=lisboa&para=sao-paulo&data=2026-03-29&hora=01:30"), {
    de: "lisboa",
    para: "sao-paulo",
    data: "2026-03-29",
    hora: "01:30",
  });
  assert.deepEqual(lerParametrosConversor("?de=xyz&para=%3Cb%3E&data=2026-02-30&hora=25:00"), {});
});

test("listas de cidades: sem duplicatas, só conhecidas, com limite", () => {
  assert.deepEqual(lerListaCidades("lisboa,toquio,lisboa,nada,dubai,sydney"), ["lisboa", "toquio", "dubai"]);
  assert.deepEqual(validarListaCidades(["brasilia", 3, "x", "brasilia"]), ["brasilia"]);
  assert.equal(validarListaCidades("nao-lista"), null);
});

test("planejador: Brasília, Lisboa e Nova York em dia útil", () => {
  const { linhas, janelas } = planejarReuniao(
    ["America/Sao_Paulo", "Europe/Lisbon", "America/New_York"],
    { ano: 2026, mes: 7, dia: 1 },
  );
  assert.equal(linhas.length, 24);
  // Julho: Brasília UTC−3, Lisboa UTC+1, Nova York UTC−4.
  // Comum: 10h–14h em Brasília (Lisboa 14h–18h, NY 9h–13h).
  assert.deepEqual(janelas, [{ inicio: 10, fim: 14 }]);
  assert.equal(linhas[10].locais[1].partes.hora, 14);
});

test("planejador: sem janela no fim de semana", () => {
  const { janelas } = planejarReuniao(["America/Sao_Paulo", "Asia/Tokyo"], { ano: 2026, mes: 7, dia: 4 });
  assert.deepEqual(janelas, []);
});

test("nome legível do fuso do navegador", async () => {
  const { nomeDoFuso, cidadeDoFuso } = await import("../scripts/dados/cidades.js");
  assert.equal(nomeDoFuso("Europe/Lisbon"), "Lisboa");
  assert.equal(nomeDoFuso("America/Sao_Paulo"), "Brasília");
  assert.equal(nomeDoFuso("America/Argentina/Cordoba"), "Cordoba");
  assert.equal(nomeDoFuso("America/El_Salvador"), "El Salvador");
  assert.equal(cidadeDoFuso("Marte/Base"), null);
});
