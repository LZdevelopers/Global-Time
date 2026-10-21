import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { IDIOMAS, caminhoNoIdioma, caminhoSemIdioma, idiomaDoCaminho, prefixoIdioma } from "../scripts/i18n/idiomas.js";
import { definirDicionario, urlLocal } from "../scripts/i18n/estado.js";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (arquivo) => readFileSync(join(RAIZ, arquivo), "utf8");

test("prefixo e idioma do caminho", () => {
  assert.equal(prefixoIdioma("pt-BR"), "");
  assert.equal(prefixoIdioma("zh-CN"), "/zh-cn");
  assert.equal(idiomaDoCaminho("/en/cronometro"), "en");
  assert.equal(idiomaDoCaminho("/pt-pt"), "pt-PT");
  assert.equal(idiomaDoCaminho("/cronometro"), null);
  assert.equal(idiomaDoCaminho("/english"), null);
  assert.equal(caminhoSemIdioma("/ja/docs"), "/docs");
  assert.equal(caminhoSemIdioma("/ja"), "/");
});

test("mesmo caminho em outro idioma", () => {
  assert.equal(caminhoNoIdioma("/", "en"), "/en");
  assert.equal(caminhoNoIdioma("/en", "pt-BR"), "/");
  assert.equal(caminhoNoIdioma("/en/feriados", "ar"), "/ar/feriados");
  assert.equal(caminhoNoIdioma("/cronometro", "zh-CN"), "/zh-cn/cronometro");
});

test("urlLocal segue o idioma atual e preserva busca e âncora", () => {
  definirDicionario("fr", {});
  assert.equal(urlLocal("/contagem?data=2026-12-25#x"), "/fr/contagem?data=2026-12-25#x");
  definirDicionario("pt-BR");
  assert.equal(urlLocal("/docs#sincronizacao"), "/docs#sincronizacao");
});

test("páginas geradas: lang, dir, canonical e hreflang", () => {
  const en = ler("en/cronometro.html");
  assert.match(en, /<html lang="en" dir="ltr">/);
  assert.match(en, /<link rel="canonical" href="https:\/\/[^"]+\/en\/cronometro" \/>/);
  assert.equal((en.match(/rel="alternate" hreflang=/g) ?? []).length, IDIOMAS.length + 1);
  assert.match(en, /hreflang="x-default" href="https:\/\/[^"]+\/cronometro"/);
  assert.doesNotMatch(en, /href="\/cronometro"/, "links internos devem apontar para /en/...");

  const ar = ler("ar/index.html");
  assert.match(ar, /<html lang="ar" dir="rtl">/);
  assert.match(ar, /<option value="ar" selected /);

  const pt = ler("cronometro.html");
  assert.match(pt, /hreflang="en" href="https:\/\/[^"]+\/en\/cronometro"/);
});

test("documentação: um só texto por versão; idiomas sem tradução apontam para /en/docs", () => {
  const en = ler("en/docs.html");
  assert.doesNotMatch(en, /data-docs-idioma="pt"/);
  assert.match(en, /data-docs-idioma="en">/);
  const fr = ler("fr/docs.html");
  assert.match(fr, /<link rel="canonical" href="https:\/\/[^"]+\/en\/docs" \/>/);
  assert.doesNotMatch(fr, /hreflang=/);
  assert.match(fr, /<p id="docsAvisoIdioma" class="docs__aviso" data-i18n/);
  const ptpt = ler("pt-pt/docs.html");
  assert.doesNotMatch(ptpt, /data-docs-idioma="en"/);
});

test("sitemap lista as versões com conteúdo próprio, sem repetir", () => {
  const locs = [...ler("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length);
  assert.ok(locs.some((u) => u.endsWith("/en/cronometro")));
  assert.ok(locs.some((u) => u.endsWith("/en/docs")));
  assert.ok(!locs.some((u) => u.endsWith("/fr/docs")));
  assert.ok(!locs.some((u) => /\/(404|offline)$/.test(u)));
});

// As regras de Accept-Language do vercel.json, aplicadas como a Vercel faz
// (expressão casando com o valor inteiro do cabeçalho).
const regras = JSON.parse(ler("vercel.json")).redirects.filter((r) => r.source === "/" && r.has?.[0]?.key === "accept-language");
function destino(cabecalho) {
  const regra = regras.find((r) => new RegExp(`^(?:${r.has[0].value})$`).test(cabecalho));
  return regra?.destination ?? null;
}

test("Accept-Language: primeiro idioma decide; português do Brasil fica na raiz", () => {
  assert.equal(destino("en-US,en;q=0.9"), "/en");
  assert.equal(destino("EN-gb"), "/en");
  assert.equal(destino("pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"), null);
  assert.equal(destino("pt"), null);
  assert.equal(destino("pt-PT,pt;q=0.9"), "/pt-pt");
  assert.equal(destino("pt-AO"), "/pt-pt");
  assert.equal(destino("zh-TW,zh;q=0.9"), "/zh-cn");
  assert.equal(destino("es-419,es;q=0.9"), "/es");
  assert.equal(destino("ar-SA"), "/ar");
  assert.equal(destino("*"), null);
  assert.equal(destino(""), null);
  // Sem confundir prefixos: "de" não pode casar com "de-..." de outro idioma
  // nem "en" com "eu" etc.
  assert.equal(destino("eu-ES,es;q=0.8"), null);
  assert.equal(destino("ens"), null);
});

test("redirecionamentos de idioma respeitam o cookie de escolha manual", () => {
  const todas = JSON.parse(ler("vercel.json")).redirects;
  const porCabecalho = todas.filter((r) => r.has?.some((c) => c.key === "accept-language"));
  assert.ok(porCabecalho.length > 0);
  for (const r of porCabecalho) assert.deepEqual(r.missing, [{ type: "cookie", key: "gt_idioma" }]);
  for (const r of todas.filter((r) => r.has?.some((c) => c.key === "gt_idioma" || c.key === "accept-language"))) {
    assert.equal(r.permanent, false);
    assert.ok(!r.source.startsWith("/api"));
  }
});
