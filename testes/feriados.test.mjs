import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  analisarFeriadao,
  contarDiasUteis,
  eventosDoAno,
  gerarIcs,
  pascoa,
  resolverRegra,
  somarDiasUteis,
} from "../scripts/nucleo/feriados.js";
import { FERIADOS_ESTADUAIS } from "../scripts/dados/feriados-estaduais.js";
import { FERIADOS_MUNICIPAIS } from "../scripts/dados/feriados-municipais.js";
import { UFS } from "../scripts/dados/ufs.js";
import { dataIso, diaJuliano } from "../scripts/nucleo/tempo.js";

const iso = (d) => dataIso(d.ano, d.mes, d.dia);
const porId = (eventos, idBase) => eventos.find((e) => e.idBase === idBase);
const j = (texto) => {
  const [a, m, d] = texto.split("-").map(Number);
  return diaJuliano(a, m, d);
};

describe("Páscoa e datas móveis", () => {
  test("Domingo de Páscoa em vários anos", () => {
    const esperado = {
      2000: "2000-04-23",
      2019: "2019-04-21",
      2024: "2024-03-31",
      2025: "2025-04-20",
      2026: "2026-04-05",
      2027: "2027-03-28",
      2038: "2038-04-25",
      2285: "2285-03-22",
    };
    for (const [ano, data] of Object.entries(esperado)) assert.equal(iso(pascoa(Number(ano))), data, `Páscoa ${ano}`);
  });

  test("Carnaval, Cinzas, Sexta-feira Santa e Corpus Christi em 2026", () => {
    const eventos = eventosDoAno(2026);
    assert.equal(porId(eventos, "carnaval-segunda").iso, "2026-02-16");
    assert.equal(porId(eventos, "carnaval-terca").iso, "2026-02-17");
    assert.equal(porId(eventos, "quarta-de-cinzas").iso, "2026-02-18");
    assert.equal(porId(eventos, "paixao-de-cristo").iso, "2026-04-03");
    assert.equal(porId(eventos, "corpus-christi").iso, "2026-06-04");
  });

  test("classificação legal: Carnaval e Corpus Christi são pontos facultativos, Sexta Santa é feriado", () => {
    const eventos = eventosDoAno(2026);
    assert.equal(porId(eventos, "carnaval-terca").tipo, "facultativo");
    assert.equal(porId(eventos, "carnaval-terca").folga, false);
    assert.equal(porId(eventos, "corpus-christi").tipo, "facultativo");
    assert.equal(porId(eventos, "paixao-de-cristo").tipo, "nacional");
    assert.equal(porId(eventos, "paixao-de-cristo").folga, true);
  });

  test("Dia das Mães e Dia dos Pais (segundo domingo)", () => {
    assert.equal(iso(resolverRegra({ tipo: "nesimo", mes: 5, diaSemana: 0, n: 2 }, 2026)), "2026-05-10");
    assert.equal(iso(resolverRegra({ tipo: "nesimo", mes: 8, diaSemana: 0, n: 2 }, 2026)), "2026-08-09");
  });

  test("regra domingoSeguinte (data magna de SC)", () => {
    // 11/08/2026 é terça → domingo 16/08; 11/08/2024 já é domingo.
    assert.equal(iso(resolverRegra({ tipo: "domingoSeguinte", mes: 8, dia: 11 }, 2026)), "2026-08-16");
    assert.equal(iso(resolverRegra({ tipo: "domingoSeguinte", mes: 8, dia: 11 }, 2024)), "2024-08-11");
    assert.equal(porId(eventosDoAno(2026, { uf: "SC" }), "sc-data-magna").iso, "2026-08-16");
  });
});

describe("Calendário federal e mudança de ano", () => {
  test("2026 tem 10 feriados nacionais e 9 pontos facultativos (Portaria MGI nº 11.460/2025)", () => {
    const eventos = eventosDoAno(2026, { comemorativas: false });
    assert.deepEqual(
      eventos.filter((e) => e.tipo === "nacional").map((e) => e.iso),
      ["2026-01-01", "2026-04-03", "2026-04-21", "2026-05-01", "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25"],
    );
    assert.deepEqual(
      eventos.filter((e) => e.tipo === "facultativo").map((e) => e.iso),
      ["2026-02-16", "2026-02-17", "2026-02-18", "2026-04-20", "2026-06-04", "2026-06-05", "2026-10-28", "2026-12-24", "2026-12-31"],
    );
    assert.equal(porId(eventos, "vespera-de-natal").parcial, "após as 13h");
  });

  test("emendas de 2026 não se repetem em 2027", () => {
    const eventos = eventosDoAno(2027);
    assert.equal(eventos.some((e) => e.idBase.startsWith("ponto-facultativo-2026")), false);
    assert.equal(porId(eventos, "paixao-de-cristo").iso, "2027-03-26");
    assert.equal(porId(eventos, "confraternizacao-universal").iso, "2027-01-01");
  });

  test("Consciência Negra é nacional só a partir de 2024", () => {
    assert.equal(porId(eventosDoAno(2023), "consciencia-negra"), undefined);
    assert.equal(porId(eventosDoAno(2024), "consciencia-negra").iso, "2024-11-20");
  });

  test("ids de evento são únicos por ano e incluem o ano", () => {
    const eventos = eventosDoAno(2026, { uf: "SP", municipio: "São Paulo" });
    assert.equal(new Set(eventos.map((e) => e.id)).size, eventos.length);
    assert.ok(eventos.every((e) => e.id.endsWith("-2026")));
  });
});

describe("Feriados estaduais e municipais", () => {
  test("SP: Revolução Constitucionalista em 09/07", () => {
    const evento = porId(eventosDoAno(2026, { uf: "SP" }), "sp-revolucao-constitucionalista");
    assert.equal(evento.iso, "2026-07-09");
    assert.equal(evento.tipo, "estadual");
    assert.equal(evento.folga, true);
  });

  test("RJ: São Jorge em 23/04; Consciência Negra estadual não duplica a nacional desde 2024", () => {
    const eventos = eventosDoAno(2026, { uf: "RJ" });
    assert.equal(porId(eventos, "rj-sao-jorge").iso, "2026-04-23");
    assert.equal(eventos.filter((e) => e.iso === "2026-11-20" && e.folga).length, 1);
  });

  test("estaduais só aparecem com a UF escolhida", () => {
    assert.equal(porId(eventosDoAno(2026), "sp-revolucao-constitucionalista"), undefined);
    assert.equal(porId(eventosDoAno(2026, { uf: "RJ" }), "sp-revolucao-constitucionalista"), undefined);
  });

  test("São Paulo (capital): aniversário em 25/01, só com o município escolhido", () => {
    assert.equal(porId(eventosDoAno(2026, { uf: "SP", municipio: "São Paulo" }), "sp-sao-paulo-aniversario").iso, "2026-01-25");
    assert.equal(porId(eventosDoAno(2026, { uf: "SP" }), "sp-sao-paulo-aniversario"), undefined);
  });

  test("dados estaduais e municipais são válidos", () => {
    const siglas = new Set(UFS.map((u) => u.sigla));
    for (const d of [...FERIADOS_ESTADUAIS, ...FERIADOS_MUNICIPAIS]) {
      assert.ok(siglas.has(d.uf), `${d.id}: UF inválida`);
      assert.ok(d.nome && d.base_legal && d.fonte, `${d.id}: campos obrigatórios`);
      assert.ok(resolverRegra(d.regra, 2026), `${d.id}: regra não resolve`);
    }
    for (const d of FERIADOS_MUNICIPAIS) assert.equal(d.municipio, UFS.find((u) => u.sigla === d.uf).capital);
  });
});

describe("Feriadões e dias úteis", () => {
  test("Tiradentes 2026 (terça): emenda possível na segunda 20/04 → 4 dias", () => {
    const analise = analisarFeriadao(j("2026-04-21"));
    assert.equal(analise.tipo, "emenda");
    assert.equal(analise.ponte, j("2026-04-20"));
    assert.equal(analise.dias, 4);
  });

  test("Sexta-feira Santa: feriadão de 3 dias", () => {
    const analise = analisarFeriadao(j("2026-04-03"));
    assert.equal(analise.tipo, "feriadao");
    assert.equal(analise.dias, 3);
    assert.equal(analise.inicio, j("2026-04-03"));
    assert.equal(analise.fim, j("2026-04-05"));
  });

  test("feriado na quarta não forma feriadão nem emenda de um dia", () => {
    // 01/01/2025 caiu numa quarta-feira.
    assert.equal(analisarFeriadao(j("2025-01-01")).tipo, null);
  });

  test("feriado no fim de semana não é analisado", () => {
    // 2026-11-15 é domingo.
    assert.equal(analisarFeriadao(j("2026-11-15")).tipo, null);
  });

  test("dias úteis em abril de 2026 (nacional): 22 dias de semana − 2 feriados = 20", () => {
    assert.equal(contarDiasUteis(j("2026-04-01"), j("2026-04-30")), 20);
  });

  test("dias úteis consideram feriado estadual", () => {
    // Julho/2026: 23 dias de semana; 09/07 (quinta) é feriado em SP.
    assert.equal(contarDiasUteis(j("2026-07-01"), j("2026-07-31")), 23);
    assert.equal(contarDiasUteis(j("2026-07-01"), j("2026-07-31"), { uf: "SP" }), 22);
  });

  test("somar dias úteis pula fim de semana e feriado", () => {
    // Quinta 02/04/2026 + 1 dia útil → segunda 06/04 (sexta 03 é Sexta-feira Santa).
    assert.equal(somarDiasUteis(j("2026-04-02"), 1), j("2026-04-06"));
  });
});

describe("Exportação iCalendar", () => {
  const eventos = eventosDoAno(2026, { uf: "SP" });
  const ics = gerarIcs(eventos, { nome: "Feriados, teste; 2026", agora: Date.UTC(2026, 9, 19, 12, 0, 0) });

  test("usa CRLF e estrutura VCALENDAR", () => {
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.equal(ics.replace(/\r\n/g, "").includes("\n"), false);
    assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, eventos.length);
  });

  test("eventos de dia inteiro com DTEND no dia seguinte", () => {
    const desdobrado = ics.replace(/\r\n /g, "");
    assert.ok(desdobrado.includes("DTSTART;VALUE=DATE:20261225\r\nDTEND;VALUE=DATE:20261226"));
    assert.ok(desdobrado.includes("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101"));
    assert.ok(desdobrado.includes("DTSTAMP:20261019T120000Z"));
  });

  test("escapa vírgulas e ponto e vírgula", () => {
    const desdobrado = ics.replace(/\r\n /g, "");
    assert.ok(desdobrado.includes("X-WR-CALNAME:Feriados\\, teste\\; 2026"));
  });

  test("dobra linhas em no máximo 75 octetos", () => {
    const codificador = new TextEncoder();
    for (const linha of ics.split("\r\n")) assert.ok(codificador.encode(linha).length <= 75, linha);
    assert.ok(ics.includes("\r\n "), "deveria haver linhas dobradas");
  });

  test("UIDs únicos", () => {
    const uids = ics.match(/^UID:.*$/gm);
    assert.equal(new Set(uids).size, uids.length);
  });
});
