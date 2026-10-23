import assert from "node:assert/strict";
import { test } from "node:test";
import { obterSistema, sistemaPreferido, sistemasDisponiveis } from "../scripts/nucleo/sistemas-calendario.js";
import { deDiaJuliano, diaJuliano } from "../scripts/nucleo/tempo.js";

const j = (ano, mes, dia) => diaJuliano(ano, mes, dia);
const iso = (juliano) => {
  const d = deDiaJuliano(juliano);
  return `${d.ano}-${String(d.mes).padStart(2, "0")}-${String(d.dia).padStart(2, "0")}`;
};

test("sistemas: o gregoriano vem primeiro e valores desconhecidos caem nele", () => {
  assert.equal(sistemasDisponiveis()[0], "gregory");
  assert.equal(obterSistema("klingon").id, "gregory");
  assert.equal(sistemaPreferido("klingon"), "gregory");
  assert.equal(sistemaPreferido("hebrew"), "hebrew");
});

test("gregoriano: meses e anos de sempre", () => {
  const g = obterSistema("gregory");
  assert.equal(g.inicioMes(j(2026, 2, 15)), j(2026, 2, 1));
  assert.equal(g.fimMes(j(2028, 2, 3)), j(2028, 2, 29));
  assert.equal(g.mesesDoAno(j(2026, 7, 1)).length, 12);
  assert.equal(iso(g.moverMes(j(2026, 1, 31), 1)), "2026-02-28");
  assert.equal(iso(g.moverMes(j(2026, 1, 15), -1)), "2025-12-15");
  assert.equal(iso(g.moverAno(j(2028, 2, 29), 1)), "2029-02-28");
});

test("hegírico (Umm al-Qura): Ramadã de 1447 começa em 18/02/2026", () => {
  const h = obterSistema("islamic-umalqura");
  const dia = j(2026, 3, 1);
  assert.equal(iso(h.inicioMes(dia)), "2026-02-18");
  const tamanho = h.fimMes(dia) - h.inicioMes(dia) + 1;
  assert.ok(tamanho === 29 || tamanho === 30);
  const meses = h.mesesDoAno(dia);
  assert.equal(meses.length, 12);
  // Meses contíguos, cobrindo o ano inteiro.
  for (let i = 1; i < meses.length; i += 1) assert.equal(meses[i].inicio, meses[i - 1].fim + 1);
});

test("hebraico: ano bissexto tem 13 meses; Rosh Hashaná 5787 em 12/09/2026", () => {
  const h = obterSistema("hebrew");
  assert.equal(iso(h.inicioAno(j(2026, 10, 23))), "2026-09-12");
  assert.equal(h.mesesDoAno(j(2026, 10, 23)).length, 13);
  assert.equal(h.mesesDoAno(j(2025, 10, 23)).length, 12);
});

test("etíope: o 13º mês tem 5 ou 6 dias", () => {
  const e = obterSistema("ethiopic");
  const meses = e.mesesDoAno(j(2026, 10, 23));
  assert.equal(meses.length, 13);
  const ultimo = meses.at(-1);
  assert.ok([5, 6].includes(ultimo.fim - ultimo.inicio + 1));
});

test("chinês: voltar um ano mantém o mesmo mês mesmo com mês intercalar no meio", () => {
  const c = obterSistema("chinese");
  // 23/10/2026 é o 14º dia do 9º mês; o ano anterior teve o 6º mês intercalar.
  const antes = c.moverAno(j(2026, 10, 23), -1);
  assert.equal(c.dia(antes), 14);
  assert.match(c.data(antes), /9/);
  assert.equal(c.moverAno(antes, 1), j(2026, 10, 23));
});

test("navegar mês a mês percorre o ano e volta ao ponto de partida", () => {
  for (const id of sistemasDisponiveis()) {
    const s = obterSistema(id);
    const inicio = j(2026, 10, 23);
    const n = s.mesesDoAno(inicio).length;
    let k = inicio;
    for (let i = 0; i < n; i += 1) k = s.moverMes(k, 1);
    for (let i = 0; i < n; i += 1) k = s.moverMes(k, -1);
    assert.equal(s.inicioMes(k), s.inicioMes(inicio), id);
  }
});
