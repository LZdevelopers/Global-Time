// Mantém os blocos repetidos das páginas a partir de dev/site.mjs:
//  - <head> comum (metadados, Open Graph, ícones, fontes, CSS);
//  - cabeçalho com navegação e painel de ferramentas;
//  - rodapé (com o seletor de idioma);
//  - textos marcados com data-i18n / data-i18n-attr, preenchidos em português
//    do Brasil a partir de scripts/i18n/textos/pt-BR.js (o navegador traduz
//    para os outros idiomas);
//  - sitemap.xml;
//  - versão e lista de pré-cache do service worker (sw.js).
//
// Não é uma etapa de build: o resultado é salvo nos próprios arquivos e
// versionado no git. A Vercel publica os arquivos como estão.
//
// Uso: node dev/gerar.mjs           (escreve)
//      node dev/gerar.mjs --checar  (falha se algo estiver desatualizado)

import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { GRUPOS, PAGINAS, SITE, SITE_URL, paginasDoGrupo } from "./site.mjs";
import { IDIOMAS } from "../scripts/i18n/idiomas.js";
import ptBR from "../scripts/i18n/textos/pt-BR.js";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const CHECAR = process.argv.includes("--checar");

// Símbolo da marca: versão preta no tema claro e branca no escuro (o CSS
// mostra só a do tema atual). A logo original fica em logos/.
const SIMBOLO = `<img class="marca__simbolo marca__simbolo--preto" src="/assets/marca/simbolo-preto.png" width="32" height="32" alt="" /><img class="marca__simbolo marca__simbolo--branco" src="/assets/marca/simbolo-branco.png" width="32" height="32" alt="" />`;

const icone = (nome, classe = "") =>
  `<svg class="icone${classe ? ` ${classe}` : ""}" aria-hidden="true" focusable="false"><use href="/assets/icones.svg#${nome}"/></svg>`;

const escapar = (texto) =>
  String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Texto em português marcado para tradução. */
const tr = (chave, tag = "span", extras = "") => `<${tag}${extras} data-i18n="${chave}">${escapar(ptBR[chave])}</${tag}>`;

function blocoHead(pagina) {
  const titulo = pagina.tituloCompleto ? pagina.titulo : `${pagina.titulo} | ${SITE.nome}`;
  const url = `${SITE_URL}${pagina.caminho === "/" ? "/" : pagina.caminho}`;
  const linhas = [
    `<meta charset="utf-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />`,
    `<title>${escapar(titulo)}</title>`,
    `<meta name="description" content="${escapar(pagina.descricao)}" />`,
    `<meta name="gt:pagina" content="${pagina.id}" />`,
  ];
  if (pagina.semIndexar) {
    linhas.push(`<meta name="robots" content="noindex" />`);
  } else {
    linhas.push(
      `<link rel="canonical" href="${url}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${SITE.nome}" />`,
      `<meta property="og:locale" content="pt_BR" />`,
      `<meta property="og:title" content="${escapar(pagina.titulo)}" />`,
      `<meta property="og:description" content="${escapar(pagina.descricao)}" />`,
      `<meta property="og:url" content="${url}" />`,
      `<meta property="og:image" content="${SITE_URL}/assets/marca/og.png" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="GlobalTime — hora certa sincronizada e ferramentas de tempo" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapar(pagina.titulo)}" />`,
      `<meta name="twitter:description" content="${escapar(pagina.descricao)}" />`,
      `<meta name="twitter:image" content="${SITE_URL}/assets/marca/og.png" />`,
    );
  }
  linhas.push(
    `<meta name="theme-color" content="#ffffff" />`,
    `<meta name="color-scheme" content="light dark" />`,
    `<link rel="icon" href="/favicon.ico" sizes="32x32" />`,
    `<link rel="icon" href="/assets/icones/icone-192.png" type="image/png" sizes="192x192" />`,
    `<link rel="apple-touch-icon" href="/assets/icones/apple-touch-icon.png" />`,
    `<link rel="manifest" href="/manifest.webmanifest" />`,
    `<link rel="preload" href="/assets/fontes/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />`,
    `<link rel="preload" href="/assets/fontes/plus-jakarta-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />`,
    `<link rel="stylesheet" href="/estilos/app.css" />`,
    `<script src="/scripts/tema-inicial.js"></script>`,
    `<script type="module" src="/scripts/nucleo/pagina.js"></script>`,
  );
  if (pagina.caminho === "/") {
    const dados = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.nome,
      url: `${SITE_URL}/`,
      description: SITE.descricao,
      inLanguage: IDIOMAS.map((i) => i.codigo),
    };
    linhas.push(`<script type="application/ld+json">${JSON.stringify(dados)}</script>`);
  }
  return linhas.map((l) => `    ${l}`).join("\n");
}

function linkAtual(pagina, alvo) {
  return pagina.caminho === alvo.caminho ? ` aria-current="page"` : "";
}

function chaveRotuloNav(p) {
  return ptBR[`paginas.${p.id}.rotuloNav`] ? `paginas.${p.id}.rotuloNav` : `paginas.${p.id}.rotulo`;
}

function blocoCabecalho(pagina) {
  const nav = PAGINAS.filter((p) => p.nav)
    .sort((a, b) => a.nav - b.nav)
    .map((p) => tr(chaveRotuloNav(p), "a", ` href="${p.caminho}"${linkAtual(pagina, p)}`))
    .join("\n          ");

  const grupos = GRUPOS.map((grupo) => {
    const itens = paginasDoGrupo(grupo.id)
      .map((p) => `<li><a href="${p.caminho}"${linkAtual(pagina, p)}>${icone(p.icone)}${tr(`paginas.${p.id}.rotulo`)}</a></li>`)
      .join("\n                ");
    return `<div>
              ${tr(`grupos.${grupo.id}`, "h2")}
              <ul>
                ${itens}
              </ul>
            </div>`;
  }).join("\n            ");

  return `    ${tr("comum.pularConteudo", "a", ` class="pular-conteudo" href="#conteudo"`)}
    <header class="cabecalho">
      <div class="container cabecalho__conteudo">
        <a class="marca" href="/" aria-label="${escapar(ptBR["comum.marcaInicio"])}" data-i18n-attr="aria-label:comum.marcaInicio">
          ${SIMBOLO}
          <span class="marca__nome">Global<span>Time</span></span>
        </a>
        <nav class="nav-principal" aria-label="${escapar(ptBR["comum.navPrincipal"])}" data-i18n-attr="aria-label:comum.navPrincipal">
          ${nav}
        </nav>
        <div class="cabecalho__acoes">
          <button id="botaoTema" class="botao botao--fantasma botao--icone" type="button" aria-pressed="false" aria-label="${escapar(ptBR["comum.temaEscuro"])}" title="${escapar(ptBR["comum.temaEscuro"])}">
            ${icone("tema-escuro")}
          </button>
          <button id="botaoMenu" class="botao botao--secundario botao--pequeno" type="button" aria-expanded="false" aria-controls="painelFerramentas">
            ${icone("grade", "icone--sm")}${tr("comum.ferramentas")}
          </button>
        </div>
      </div>
    </header>
    <div id="painelFerramentas" class="painel-ferramentas" hidden>
      <nav aria-label="${escapar(ptBR["comum.todasFerramentas"])}" data-i18n-attr="aria-label:comum.todasFerramentas">
        <div class="container painel-ferramentas__conteudo">
            ${grupos}
        </div>
      </nav>
    </div>`;
}

// Rodapé de uma linha: as ferramentas já estão no menu "Ferramentas".
function blocoRodape() {
  const opcoes = IDIOMAS.map((i) => `<option value="${i.codigo}" lang="${i.codigo}">${escapar(i.nome)}</option>`).join("");
  return `    <footer class="rodape">
      <div class="container rodape__conteudo">
        <span>© <span data-ano-atual>${new Date().getFullYear()}</span> GlobalTime · ${tr("comum.por")} <a href="${SITE.urlAutor}" rel="noopener">${SITE.autor}</a></span>
        <span class="rodape__links">
          ${tr("comum.documentacao", "a", ` href="/docs"`)}
          ${tr("comum.atalhos", "button", ` type="button" class="rodape__botao" data-abrir-atalhos`)}
          <label class="rodape__idioma">
            ${icone("globo", "icone--sm")}
            ${tr("comum.idioma", "span", ` class="sr-only"`)}
            <select id="seletorIdioma">${opcoes}</select>
          </label>
        </span>
      </div>
    </footer>`;
}

function substituirBloco(html, nome, conteudo, arquivo) {
  const re = new RegExp(`(<!-- @${nome} -->)[\\s\\S]*?(\\s*<!-- /@${nome} -->)`);
  if (!re.test(html)) throw new Error(`${arquivo}: marcador <!-- @${nome} --> não encontrado`);
  return html.replace(re, `$1\n${conteudo}$2`);
}

// Preenche em português os textos marcados para tradução:
//  - <tag data-i18n="chave">texto</tag> (só elementos sem filhos);
//  - data-i18n-attr="atributo:chave;outro:chave".
const RE_TEXTO = /(<([a-z][a-z0-9]*)\b[^>]*?\sdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g;
const RE_ATRIBUTOS = /<[a-z][^>]*?\sdata-i18n-attr="([^"]+)"[^>]*>/g;

function preencherTextos(html, arquivo) {
  const valor = (chave) => {
    const v = ptBR[chave];
    if (typeof v !== "string") throw new Error(`${arquivo}: chave de tradução inexistente (ou de plural) no HTML: ${chave}`);
    return escapar(v);
  };
  html = html.replace(RE_TEXTO, (_m, abre, _tag, chave, _texto, fecha) => `${abre}${valor(chave)}${fecha}`);
  html = html.replace(RE_ATRIBUTOS, (tag, spec) => {
    let saida = tag;
    for (const par of spec.split(";")) {
      const [atributo, chave] = par.split(":").map((x) => x.trim());
      const re = new RegExp(`(\\s${atributo}=")[^"]*(")`);
      saida = re.test(saida)
        ? saida.replace(re, (_m, a, b) => `${a}${valor(chave)}${b}`)
        : saida.replace(" data-i18n-attr=", ` ${atributo}="${valor(chave)}" data-i18n-attr=`);
    }
    return saida;
  });
  // data-i18n em elemento com filhos não seria traduzido corretamente.
  const sobra = html.match(/<[a-z][^>]*\sdata-i18n="([^"]+)"[^>]*>\s*<(?!\/)/);
  if (sobra) throw new Error(`${arquivo}: data-i18n="${sobra[1]}" em elemento com filhos; envolva o texto num <span>.`);
  return html;
}

async function listarArquivos(dir, filtro) {
  const saida = [];
  for (const item of await readdir(join(RAIZ, dir), { withFileTypes: true })) {
    const caminho = join(dir, item.name);
    if (item.isDirectory()) saida.push(...(await listarArquivos(caminho, filtro)));
    else if (filtro(item.name)) saida.push(caminho.split(sep).join("/"));
  }
  return saida;
}

let desatualizados = 0;

async function escrever(arquivo, conteudo) {
  const caminho = join(RAIZ, arquivo);
  let atual = null;
  try {
    atual = await readFile(caminho, "utf8");
  } catch {
    atual = null;
  }
  if (atual === conteudo) return;
  desatualizados += 1;
  if (CHECAR) {
    console.error(`desatualizado: ${arquivo}`);
    return;
  }
  await writeFile(caminho, conteudo);
  console.log(`atualizado: ${arquivo}`);
}

// ---- Páginas -------------------------------------------------------------
for (const pagina of PAGINAS) {
  let html = await readFile(join(RAIZ, pagina.arquivo), "utf8");
  html = substituirBloco(html, "head", blocoHead(pagina), pagina.arquivo);
  html = substituirBloco(html, "cabecalho", blocoCabecalho(pagina), pagina.arquivo);
  html = substituirBloco(html, "rodape", blocoRodape(), pagina.arquivo);
  html = preencherTextos(html, pagina.arquivo);
  await escrever(pagina.arquivo, html);
}

// ---- Sitemap ---------------------------------------------------------------
const urls = PAGINAS.filter((p) => !p.semIndexar)
  .map(
    (p) =>
      `  <url>\n    <loc>${SITE_URL}${p.caminho}</loc>\n    <priority>${p.prioridade ?? "0.8"}</priority>\n  </url>`,
  )
  .join("\n");
await escrever(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);

await escrever(
  "robots.txt",
  `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
);

// ---- Service worker --------------------------------------------------------
// Pré-cache: todas as páginas (pela URL limpa) e os arquivos estáticos,
// inclusive os dicionários de todos os idiomas (funcionam offline).
// A versão é um hash do conteúdo: qualquer mudança gera um novo sw.js, o que
// faz o navegador instalar a atualização.
const estaticos = [
  "/estilos/app.css",
  "/assets/icones.svg",
  "/assets/marca/simbolo-preto.png",
  "/assets/marca/simbolo-branco.png",
  "/assets/icones/icone-192.png",
  "/assets/icones/icone-96.png",
  "/favicon.ico",
  "/manifest.webmanifest",
  ...(await listarArquivos("assets/fontes", (n) => n.endsWith(".woff2"))).map((c) => `/${c}`),
  ...(await listarArquivos("scripts", (n) => n.endsWith(".js"))).map((c) => `/${c}`),
];
const paginasCache = PAGINAS.filter((p) => p.arquivo !== "404.html").map((p) => p.caminho);
const precache = [...paginasCache, ...estaticos].sort();

const hash = createHash("sha256");
for (const pagina of PAGINAS) hash.update(await readFile(join(RAIZ, pagina.arquivo)));
for (const arquivo of estaticos) {
  try {
    hash.update(await readFile(join(RAIZ, arquivo.slice(1))));
  } catch {
    throw new Error(`Arquivo do pré-cache não existe: ${arquivo}`);
  }
}
const versao = hash.digest("hex").slice(0, 12);

let sw = await readFile(join(RAIZ, "sw.js"), "utf8");
sw = sw.replace(/const VERSAO = "[^"]*";/, `const VERSAO = "${versao}";`);
const lista = `const PRECACHE = [\n${precache.map((u) => `  "${u}",`).join("\n")}\n];`;
if (!/\/\/ @precache\n[\s\S]*?\n\/\/ \/@precache/.test(sw)) throw new Error("sw.js: marcador // @precache não encontrado");
sw = sw.replace(/(\/\/ @precache\n)[\s\S]*?(\n\/\/ \/@precache)/, (_, abre, fecha) => `${abre}${lista}${fecha}`);
await escrever("sw.js", sw);

if (CHECAR && desatualizados > 0) {
  console.error(`\n${desatualizados} arquivo(s) desatualizado(s). Rode: npm run gerar`);
  process.exit(1);
}
console.log(CHECAR ? "Tudo em dia." : `Concluído (versão do SW: ${versao}).`);
