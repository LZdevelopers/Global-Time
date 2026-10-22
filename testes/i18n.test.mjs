import assert from "node:assert/strict";
import { test } from "node:test";
import { IDIOMAS, escolherIdioma, idiomaDaTag } from "../scripts/i18n/idiomas.js";
import { definirDicionario, t } from "../scripts/i18n/estado.js";
import { normalizarTecla } from "../scripts/nucleo/atalhos.js";
import ptBR from "../scripts/i18n/textos/pt-BR.js";

test("escolha do idioma pelas preferências do navegador", () => {
  assert.equal(escolherIdioma(["pt-BR", "en"]), "pt-BR");
  assert.equal(escolherIdioma(["pt"]), "pt-BR");
  assert.equal(escolherIdioma(["pt-PT"]), "pt-PT");
  assert.equal(escolherIdioma(["pt-AO"]), "pt-PT");
  assert.equal(escolherIdioma(["en-GB", "pt-BR"]), "en");
  assert.equal(escolherIdioma(["eo", "es-MX"]), "es");
  assert.equal(escolherIdioma(["zh-TW"]), "zh-CN");
  assert.equal(escolherIdioma(["zh-Hans-CN"]), "zh-CN");
  assert.equal(escolherIdioma(["ar-EG"]), "ar");
  assert.equal(escolherIdioma(["ne-NP", "en"]), "ne");
  assert.equal(escolherIdioma(["xx", "yy"]), "pt-BR");
  assert.equal(escolherIdioma([]), "pt-BR");
  assert.equal(idiomaDaTag("de_AT"), "de");
  assert.equal(idiomaDaTag(""), null);
});

const marcadores = (texto) => [...String(texto).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function formas(valor) {
  return typeof valor === "object" ? Object.values(valor) : [valor];
}

for (const { codigo } of IDIOMAS.filter((i) => i.codigo !== "pt-BR")) {
  test(`dicionário ${codigo}: mesmas chaves, marcadores e plurais válidos`, async () => {
    const { default: dicionario } = await import(`../scripts/i18n/textos/${codigo}.js`);
    const faltando = Object.keys(ptBR).filter((k) => !(k in dicionario));
    const sobrando = Object.keys(dicionario).filter((k) => !(k in ptBR));
    assert.deepEqual(faltando, [], `faltam chaves em ${codigo}`);
    assert.deepEqual(sobrando, [], `chaves a mais em ${codigo}`);

    const categorias = new Intl.PluralRules(codigo).resolvedOptions().pluralCategories;
    for (const [chave, original] of Object.entries(ptBR)) {
      const traducao = dicionario[chave];
      const esperados = [...new Set(formas(original).flatMap(marcadores))].sort();
      if (typeof original === "object") {
        assert.equal(typeof traducao, "object", `${codigo} ${chave}: deveria ter formas de plural`);
        assert.ok("other" in traducao, `${codigo} ${chave}: falta a forma "other"`);
        for (const forma of Object.keys(traducao)) {
          assert.ok(categorias.includes(forma), `${codigo} ${chave}: forma de plural inválida "${forma}"`);
        }
      } else {
        assert.equal(typeof traducao, "string", `${codigo} ${chave}: deveria ser texto`);
      }
      for (const texto of formas(traducao)) {
        assert.ok(String(texto).trim().length > 0, `${codigo} ${chave}: texto vazio`);
        for (const m of marcadores(texto)) {
          assert.ok(esperados.includes(m), `${codigo} ${chave}: marcador desconhecido {${m}}`);
        }
      }
      // Todo marcador do original aparece em alguma forma (o {n} pode faltar
      // em formas como "one" de idiomas que escrevem o número por extenso).
      const usados = new Set(formas(traducao).flatMap(marcadores));
      for (const m of esperados) {
        if (m === "n" && typeof original === "object") continue;
        assert.ok(usados.has(m), `${codigo} ${chave}: falta o marcador {${m}}`);
      }
    }
  });
}

test("t(): plural, parâmetros e números no idioma", () => {
  definirDicionario("pt-BR", ptBR);
  assert.equal(t("tempo.dias", { n: 1 }), "1 dia");
  assert.equal(t("tempo.dias", { n: 1500 }), "1.500 dias");
  assert.equal(t("chave.que.nao.existe"), "chave.que.nao.existe");
});

test("atalhos: letras por caractere e, em alfabetos não latinos, pela posição", () => {
  assert.equal(normalizarTecla({ key: " ", code: "Space" }), "espaco");
  assert.equal(normalizarTecla({ key: "L", code: "KeyL" }), "l");
  assert.equal(normalizarTecla({ key: "д", code: "KeyL" }), "l");
  assert.equal(normalizarTecla({ key: "ㅣ", code: "KeyL" }), "l");
  assert.equal(normalizarTecla({ key: "?", code: "Slash" }), "?");
  assert.equal(normalizarTecla({ key: "+", code: "Equal" }), "+");
  assert.equal(normalizarTecla({ key: "Escape", code: "Escape" }), "Escape");
});
