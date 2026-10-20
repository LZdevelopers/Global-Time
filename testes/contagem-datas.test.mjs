import assert from "node:assert/strict";
import { test } from "node:test";
import {
  configuracaoPreset,
  decompor,
  formatarCompacto,
  instanteAlvo,
  lerParametrosContagem,
  montarParametros,
  validarListaSalva,
} from "../scripts/nucleo/contagem-datas.js";

const ler = (busca) => lerParametrosContagem(new URLSearchParams(busca));

test("lê parâmetros válidos", () => {
  assert.deepEqual(ler("titulo=Viagem&data=2026-12-20&hora=08:30&fuso=Europe/Lisbon"), {
    titulo: "Viagem",
    data: "2026-12-20",
    hora: "08:30",
    fuso: "Europe/Lisbon",
  });
});

test("ignora parâmetros inválidos com padrões seguros", () => {
  assert.equal(ler("data=2026-02-30"), null);
  assert.equal(ler("data=amanhã"), null);
  assert.equal(ler("titulo=x"), null);
  const r = ler("data=2026-12-20&hora=99:99&fuso=Lugar/Falso");
  assert.equal(r.hora, "00:00");
  assert.equal(r.fuso, "America/Sao_Paulo");
});

test("título é limitado e continua texto puro", () => {
  const longo = ler(`data=2026-12-20&titulo=${"x".repeat(300)}`);
  assert.equal(longo.titulo.length, 80);
  const script = ler(`data=2026-12-20&titulo=${encodeURIComponent('<img src=x onerror="alert(1)">\n')}`);
  // Mantido como texto (será exibido via textContent), só com controles removidos.
  assert.equal(script.titulo, '<img src=x onerror="alert(1)">');
});

test("ida e volta do link", () => {
  const config = { titulo: "Prova & entrega", data: "2027-01-15", hora: "14:00", fuso: "America/Manaus" };
  assert.deepEqual(lerParametrosContagem(new URLSearchParams(montarParametros(config))), config);
});

test("instante alvo respeita o fuso", () => {
  assert.equal(instanteAlvo({ data: "2026-12-25", hora: "00:00", fuso: "America/Sao_Paulo" }), Date.UTC(2026, 11, 25, 3));
  assert.ok(Number.isNaN(instanteAlvo({ data: "x", hora: "00:00", fuso: "America/Sao_Paulo" })));
});

test("presets de Natal e Ano Novo escolhem a próxima ocorrência", () => {
  const agora = Date.UTC(2026, 9, 19, 13);
  assert.equal(configuracaoPreset("natal", agora).data, "2026-12-25");
  assert.equal(configuracaoPreset("ano-novo", agora).data, "2027-01-01");
  assert.equal(configuracaoPreset("ano-novo", agora).titulo, "Ano Novo 2027");
  // Já é Natal em Brasília → próximo Natal.
  const natal = Date.UTC(2026, 11, 25, 12);
  assert.equal(configuracaoPreset("natal", natal).data, "2027-12-25");
  assert.equal(configuracaoPreset("inexistente", agora), null);
});

test("decomposição e formato compacto", () => {
  const ms = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000 + 999;
  assert.deepEqual(decompor(ms), { dias: 2, horas: 3, minutos: 4, segundos: 5 });
  assert.deepEqual(decompor(-ms), { dias: 2, horas: 3, minutos: 4, segundos: 5 });
  assert.equal(formatarCompacto(ms), "2d 03:04:05");
  assert.equal(formatarCompacto(65000), "00:01:05");
});

test("lista salva é validada", () => {
  const lista = validarListaSalva([
    { id: "a", titulo: "Ok", data: "2026-12-01", hora: "10:00", fuso: "America/Sao_Paulo" },
    { id: "b", data: "ruim" },
    "lixo",
    null,
  ]);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, "a");
  assert.deepEqual(validarListaSalva({}), []);
});
