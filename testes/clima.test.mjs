import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CODIGOS_CONDICAO,
  aparencia,
  condicao,
  faixaUv,
  grau,
  horaDoTexto,
  indiceHoje,
  indiceHoraAtual,
  periodosDeChuva,
  picoDeChuva,
  pontoCardeal,
  proximasHoras,
  somaChuva,
} from "../scripts/nucleo/clima.js";
import { coordenada, idiomaFonte, localPorCabecalhos, normalizarResultado } from "../api/clima.js";
import { IDIOMAS } from "../scripts/i18n/idiomas.js";
import ptBR from "../scripts/i18n/textos/pt-BR.js";

// Previsão mínima no formato da Open-Meteo (horários já no fuso do lugar).
function previsao({ agora = "2026-10-22T15:15", horas = 72 } = {}) {
  const inicio = Date.UTC(2026, 9, 22, 0);
  const time = Array.from({ length: horas }, (_, i) => new Date(inicio + i * 3600e3).toISOString().slice(0, 16));
  return {
    atual: { time: agora, weather_code: 0, is_day: 1, temperature_2m: 22.6 },
    horas: {
      time,
      temperature_2m: time.map((_, i) => 20 + (i % 5)),
      precipitation_probability: time.map((_, i) => (i >= 17 && i <= 19 ? 80 : 5)),
      precipitation: time.map((_, i) => (i >= 17 && i <= 19 ? 1.25 : 0)),
      weather_code: time.map(() => 3),
      is_day: time.map(() => 1),
    },
    dias: { time: ["2026-10-21", "2026-10-22", "2026-10-23"] },
  };
}

test("condições: código WMO → tema e ícone, com lua à noite", () => {
  assert.deepEqual(condicao(0, true), { codigo: 0, tema: "limpo", icone: "clima-sol", noite: false });
  assert.equal(condicao(0, false).icone, "clima-lua");
  assert.equal(condicao(2, false).icone, "clima-lua-nuvem");
  assert.equal(condicao(63).tema, "chuva");
  assert.equal(condicao(95).tema, "tempestade");
  assert.equal(condicao(75).tema, "neve");
  assert.equal(condicao(45).tema, "neblina");
  // Código desconhecido não inventa condição: cai em "nublado".
  assert.equal(condicao(42).codigo, 3);
  assert.deepEqual(aparencia({ atual: { weather_code: 61, is_day: 0 } }), { tema: "chuva", periodo: "noite" });
});

test("todo código de condição tem texto em todos os idiomas", async () => {
  for (const { codigo } of IDIOMAS) {
    const dicionario = codigo === "pt-BR" ? ptBR : (await import(`../scripts/i18n/textos/${codigo}.js`)).default;
    for (const c of CODIGOS_CONDICAO) assert.ok(dicionario[`clima.cond.${c}`], `${codigo}: falta clima.cond.${c}`);
  }
});

test("vento, UV e temperatura", () => {
  assert.equal(pontoCardeal(0), "n");
  assert.equal(pontoCardeal(73), "l");
  assert.equal(pontoCardeal(350), "n");
  assert.equal(pontoCardeal(225), "so");
  assert.equal(pontoCardeal(null), null);
  assert.equal(faixaUv(2.9), "baixo");
  assert.equal(faixaUv(6), "alto");
  assert.equal(faixaUv(11), "extremo");
  assert.equal(grau(22.6), "23°");
  assert.equal(grau(-0.4), "0°");
  assert.equal(grau(null), "—");
});

test("hora atual e dia de hoje vêm do horário local do lugar, sem conversão", () => {
  const p = previsao();
  assert.equal(horaDoTexto("2026-10-22T15:15"), "15:15");
  assert.equal(p.horas.time[indiceHoraAtual(p)], "2026-10-22T15:00");
  assert.equal(indiceHoje(p), 1);
  const horas = proximasHoras(p, 48);
  assert.equal(horas.length, 48);
  assert.equal(horas[0].time, "2026-10-22T15:00");
  // Não inventa horas além do que a fonte forneceu.
  assert.equal(proximasHoras(previsao({ horas: 20 }), 48).length, 5);
});

test("chuva: períodos, pico e soma", () => {
  const horas = proximasHoras(previsao(), 24);
  const periodos = periodosDeChuva(horas, 40);
  assert.equal(periodos.length, 1);
  assert.deepEqual(periodos[0], { inicio: "2026-10-22T17:00", fim: "2026-10-22T19:00", probMax: 80, mm: 3.8, horas: 3 });
  assert.equal(picoDeChuva(horas).time, "2026-10-22T17:00");
  assert.equal(somaChuva(horas), 3.8);
  assert.equal(picoDeChuva([{ prob: 0 }]), null);
});

test("API do clima: coordenadas, idioma, resultados e IP", () => {
  assert.equal(coordenada("-23.7664", 90), -23.77);
  assert.equal(coordenada("91", 90), null);
  assert.equal(coordenada("", 90), null);
  assert.equal(coordenada("abc", 180), null);
  assert.equal(idiomaFonte("zh-CN"), "zh");
  assert.equal(idiomaFonte("<script>"), "en");
  assert.deepEqual(
    normalizarResultado({ id: 1, name: "Umuarama", latitude: -23.76639, longitude: -53.325, feature_code: "PPL", country_code: "br", country: "Brasil", admin1: "Paraná", timezone: "America/Sao_Paulo" }),
    { id: 1, nome: "Umuarama", regiao: "Paraná", subregiao: null, pais: "Brasil", codigoPais: "BR", lat: -23.77, lon: -53.32, fuso: "America/Sao_Paulo" },
  );
  // Aeroportos e outros lugares não habitados ficam de fora.
  assert.equal(normalizarResultado({ name: "Aeroporto", latitude: 1, longitude: 1, feature_code: "AIRP" }), null);
  assert.equal(localPorCabecalhos({}), null);
  assert.deepEqual(
    localPorCabecalhos({ "x-vercel-ip-city": "S%C3%A3o%20Paulo", "x-vercel-ip-country": "BR", "x-vercel-ip-country-region": "SP", "x-vercel-ip-latitude": "-23.5475", "x-vercel-ip-longitude": "-46.63611" }),
    { nome: "São Paulo", regiao: "SP", codigoPais: "BR", lat: -23.55, lon: -46.64 },
  );
});

test("unidades: padrão pelo país do visitante e conversões", async () => {
  const u = await import("../scripts/nucleo/unidades-clima.js");
  assert.deepEqual(u.unidadesDoPais("BR"), { temperatura: "c", vento: "kmh", chuva: "mm", distancia: "km", pressao: "hpa" });
  assert.deepEqual(u.unidadesDoPais("US"), { temperatura: "f", vento: "mph", chuva: "pol", distancia: "mi", pressao: "inhg" });
  assert.deepEqual(u.unidadesDoPais("GB"), { temperatura: "c", vento: "mph", chuva: "mm", distancia: "mi", pressao: "hpa" });
  assert.equal(u.unidadesDoPais("RU").pressao, "mmhg");
  assert.equal(u.unidadesDoPais("JP").vento, "ms");
  assert.equal(u.unidadesDoPais("CA").pressao, "kpa");
  assert.deepEqual(u.unidadesDoPais(null), u.unidadesDoPais("BR"));
  // Toda unidade de um costume existe na lista da grandeza.
  for (const pais of ["US", "GB", "CA", "RU", "NO", "IS", "JP", "KR", "CN"]) {
    for (const [g, unidade] of Object.entries(u.unidadesDoPais(pais))) assert.ok(u.UNIDADES[g].includes(unidade), `${pais} ${g}`);
  }
  assert.equal(u.grau(0, "f"), "32°");
  assert.equal(u.grau(22.6, "f"), "73°");
  assert.equal(u.grau(-17.8, "f"), "0°");
  assert.equal(u.grau(22.6), "23°");
  assert.ok(Math.abs(u.converterVento(36, "ms") - 10) < 1e-9);
  assert.ok(Math.abs(u.converterVento(16.09344, "mph") - 10) < 1e-9);
  assert.ok(Math.abs(u.converterChuva(25.4, "pol") - 1) < 1e-9);
  assert.equal(u.converterDistancia(24140, "km"), 24.14);
  assert.ok(Math.abs(u.converterDistancia(1609.344, "mi") - 1) < 1e-9);
  assert.equal(u.converterPressao(1013, "kpa"), 101.3);
  assert.equal(Math.round(u.converterPressao(1013.25, "mmhg")), 760);
  assert.equal(Math.round(u.converterPressao(1013.25, "inhg") * 100) / 100, 29.92);
  assert.equal(u.formatarMedida("vento", 36, "ms"), "10 m/s");
  assert.equal(u.formatarMedida("pressao", 1013.25, "inhg"), "29,92 inHg");
  assert.equal(u.simboloUnidade("kmh"), "km/h");
});
