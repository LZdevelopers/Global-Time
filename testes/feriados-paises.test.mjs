import assert from "node:assert/strict";
import { test } from "node:test";
import { CALENDARIOS_GOOGLE, feriadosDoIcs, normalizarFeriado } from "../api/feriados.js";
import { PAISES_RELOGIO } from "../scripts/dados/paises.js";
import { CIDADES, codigoPais } from "../scripts/dados/cidades.js";
import { eventoDoFeriado } from "../scripts/nucleo/feriados-paises.js";
import { diaJuliano } from "../scripts/nucleo/tempo.js";

test("países do calendário são os do relógio mundial", () => {
  for (const cidade of CIDADES) assert.ok(PAISES_RELOGIO.includes(codigoPais(cidade)), `sem código: ${cidade.pais}`);
  assert.equal(new Set(PAISES_RELOGIO).size, PAISES_RELOGIO.length);
  assert.ok(PAISES_RELOGIO.includes("BR"));
});

test("API de feriados: só os campos usados, validados", () => {
  const item = {
    date: "2026-01-06",
    localName: "Heilige Drei Könige",
    name: "Epiphany",
    countryCode: "DE",
    global: false,
    counties: ["DE-BW", "DE-BY", "DE-ST"],
    types: ["Public"],
  };
  assert.deepEqual(normalizarFeriado(item), {
    data: "2026-01-06",
    nome: "Heilige Drei Könige",
    nomeIngles: "Epiphany",
    tipos: ["Public"],
    nacional: false,
    regioes: ["DE-BW", "DE-BY", "DE-ST"],
  });
  assert.equal(normalizarFeriado({ date: "06/01/2026", localName: "x" }), null);
  assert.equal(normalizarFeriado({ date: "2026-01-06" }), null);
});

test("feriado vira evento na data civil, com tipo pela categoria da fonte", () => {
  const base = { data: "2026-12-25", nome: "Christmas Day", nomeIngles: "Christmas Day", nacional: true, regioes: null };
  const natal = eventoDoFeriado({ ...base, tipos: ["Public", "Bank"] }, "US");
  assert.equal(natal.juliano, diaJuliano(2026, 12, 25));
  assert.equal(natal.tipo, "nacional");
  assert.equal(natal.folga, true);
  assert.equal(natal.nomeIngles, null); // igual ao nome local: não repete
  assert.equal(eventoDoFeriado({ ...base, nacional: false, tipos: ["Public"] }, "US").tipo, "regional");
  assert.equal(eventoDoFeriado({ ...base, nacional: false, tipos: ["Public"] }, "US").folga, false);
  assert.equal(eventoDoFeriado({ ...base, tipos: ["Optional"] }, "US").tipo, "opcional");
  const setorial = eventoDoFeriado({ ...base, tipos: ["School", "Authorities"] }, "US");
  assert.equal(setorial.tipo, "setorial");
  assert.deepEqual(setorial.setores, ["School", "Authorities"]);
  assert.equal(eventoDoFeriado({ ...base, tipos: ["Observance"] }, "US").tipo, "comemorativa");
  assert.equal(eventoDoFeriado({ ...base, data: "25/12/2026", tipos: ["Public"] }, "US"), null);
});

test("feriados do Nepal vêm do iCalendar do Google: folga ou data comemorativa, só do ano pedido", () => {
  assert.ok(PAISES_RELOGIO.includes("NP") && CALENDARIOS_GOOGLE.NP);
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20261021",
    "DTEND;VALUE=DATE:20261022",
    "DESCRIPTION:Public holiday",
    "SUMMARY:Dashami (Dashain)",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20260914",
    "DESCRIPTION:Observance\nTo hide observances\, go to Google Calendar Setting",
    "  s > Holidays in Nepal",
    "SUMMARY:Hartalika Teej",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE:20251002",
    "DESCRIPTION:Public holiday",
    "SUMMARY:Dashami (Dashain)",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const lista = feriadosDoIcs(ics, 2026);
  assert.deepEqual(
    lista.map((f) => [f.data, f.nome, f.tipos[0]]),
    [
      ["2026-09-14", "Hartalika Teej", "Observance"],
      ["2026-10-21", "Dashami (Dashain)", "Public"],
    ],
  );
  assert.equal(eventoDoFeriado(lista[1], "NP").tipo, "nacional");
  assert.equal(eventoDoFeriado(lista[0], "NP").tipo, "comemorativa");
  assert.deepEqual(feriadosDoIcs(ics, 2027), []);
});
