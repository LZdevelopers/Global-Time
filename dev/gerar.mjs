// Mantém os blocos repetidos das páginas a partir de dev/site.mjs:
//  - <head> comum (metadados, Open Graph, ícones, fontes, CSS);
//  - cabeçalho com navegação e painel de ferramentas;
//  - rodapé (com o seletor de idioma);
//  - textos marcados com data-i18n / data-i18n-attr, preenchidos em português
//    do Brasil a partir de scripts/i18n/textos/pt-BR.js (o navegador traduz
//    para os outros idiomas);
//  - versões traduzidas de cada página indexável (en/, es/, pt-pt/…), com
//    lang, dir, título, descrição, canonical e hreflang próprios;
//  - sitemap.xml e robots.txt;
//  - redirecionamentos de idioma do vercel.json (Accept-Language e cookie);
//  - versão e lista de pré-cache do service worker (sw.js).
//
// Não é uma etapa de build: o resultado é salvo nos próprios arquivos e
// versionado no git. A Vercel publica os arquivos como estão.
//
// Uso: node dev/gerar.mjs           (escreve)
//      node dev/gerar.mjs --checar  (falha se algo estiver desatualizado)

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { GRUPOS, PAGINAS, SITE, SITE_URL, paginasDoGrupo } from "./site.mjs";
import { IDIOMA_PADRAO, IDIOMAS, caminhoNoIdioma, prefixoIdioma } from "../scripts/i18n/idiomas.js";
import ptBR from "../scripts/i18n/textos/pt-BR.js";

const DICIONARIOS = Object.fromEntries(
  await Promise.all(
    IDIOMAS.map(async (i) => [i.codigo, i.codigo === IDIOMA_PADRAO ? ptBR : (await import(`../scripts/i18n/textos/${i.codigo}.js`)).default]),
  ),
);
/** Texto no idioma, com o português como reserva (igual a t() no navegador). */
const textoEm = (codigo, chave) => DICIONARIOS[codigo][chave] ?? ptBR[chave];

// A documentação longa existe em português e inglês; nos demais idiomas a
// página mostra o texto em inglês, e por isso aponta (canonical) para /en/docs
// e fica fora do sitemap e do hreflang.
const IDIOMAS_DOCS = ["pt-BR", "pt-PT", "en"];
const temVersaoPropria = (pagina, codigo) => pagina.id !== "docs" || IDIOMAS_DOCS.includes(codigo);

const urlAbsoluta = (pagina, codigo) => `${SITE_URL}${caminhoNoIdioma(pagina.caminho, codigo)}`;
const localeOg = (codigo) => (codigo.includes("-") ? codigo.replace("-", "_") : codigo);

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

function blocoHead(pagina, codigo = IDIOMA_PADRAO) {
  const tituloPagina = textoEm(codigo, `paginas.${pagina.id}.titulo`);
  const descricao = textoEm(codigo, `paginas.${pagina.id}.descricao`);
  const titulo = pagina.tituloCompleto ? tituloPagina : `${tituloPagina} | ${SITE.nome}`;
  const url = urlAbsoluta(pagina, temVersaoPropria(pagina, codigo) ? codigo : "en");
  const linhas = [
    `<meta charset="utf-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />`,
    `<title>${escapar(titulo)}</title>`,
    `<meta name="description" content="${escapar(descricao)}" />`,
    `<meta name="gt:pagina" content="${pagina.id}" />`,
  ];
  if (pagina.semIndexar) {
    linhas.push(`<meta name="robots" content="noindex" />`);
  } else {
    linhas.push(`<link rel="canonical" href="${url}" />`);
    // hreflang: todas as versões equivalentes; x-default é a raiz, que leva
    // cada visitante ao próprio idioma pelo Accept-Language.
    if (temVersaoPropria(pagina, codigo)) {
      for (const i of IDIOMAS.filter((i) => temVersaoPropria(pagina, i.codigo))) {
        linhas.push(`<link rel="alternate" hreflang="${i.codigo}" href="${urlAbsoluta(pagina, i.codigo)}" />`);
      }
      linhas.push(`<link rel="alternate" hreflang="x-default" href="${urlAbsoluta(pagina, IDIOMA_PADRAO)}" />`);
    }
    linhas.push(
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${SITE.nome}" />`,
      `<meta property="og:locale" content="${localeOg(codigo)}" />`,
      `<meta property="og:title" content="${escapar(tituloPagina)}" />`,
      `<meta property="og:description" content="${escapar(descricao)}" />`,
      `<meta property="og:url" content="${url}" />`,
      `<meta property="og:image" content="${SITE_URL}/assets/marca/og.png" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${escapar(textoEm(codigo, "paginas.inicio.titulo"))}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapar(tituloPagina)}" />`,
      `<meta name="twitter:description" content="${escapar(descricao)}" />`,
      `<meta name="twitter:image" content="${SITE_URL}/assets/marca/og.png" />`,
    );
  }
  linhas.push(
    `<meta name="theme-color" content="#ffffff" />`,
    `<meta name="color-scheme" content="light dark" />`,
    // Favicon: o Google Search pede ícone quadrado em múltiplo de 48 px e
    // usa o declarado na página inicial (favicon.ico tem 16, 32 e 48 px).
    `<link rel="icon" href="/favicon.ico" sizes="48x48" />`,
    `<link rel="icon" href="/assets/icones/icone-96.png" type="image/png" sizes="96x96" />`,
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
      alternateName: "Global Time",
      url: urlAbsoluta(pagina, codigo),
      description: textoEm(codigo, "site.descricao"),
      inLanguage: codigo,
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
          <button id="botaoTema" class="botao botao--fantasma botao--icone" type="button" aria-pressed="false" aria-label="${escapar(ptBR["comum.temaEscuro"])}" title="${escapar(ptBR["comum.temaEscuro"])}" data-i18n-attr="aria-label:comum.temaEscuro;title:comum.temaEscuro">
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

// Preenche no idioma (português por padrão) os textos marcados para tradução:
//  - <tag data-i18n="chave">texto</tag> (só elementos sem filhos);
//  - data-i18n-attr="atributo:chave;outro:chave".
const RE_TEXTO = /(<([a-z][a-z0-9]*)\b[^>]*?\sdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g;
const RE_ATRIBUTOS = /<[a-z][^>]*?\sdata-i18n-attr="([^"]+)"[^>]*>/g;

function preencherTextos(html, arquivo, codigo = IDIOMA_PADRAO) {
  const valor = (chave) => {
    const v = textoEm(codigo, chave);
    if (typeof v !== "string") throw new Error(`${arquivo}: chave de tradução inexistente (ou de plural) no HTML: ${chave}`);
    // {ano}: o ano corrente, como o rodapé (o JavaScript atualiza na página).
    return escapar(v.replace("{ano}", String(new Date().getFullYear())));
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
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, conteudo);
  console.log(`atualizado: ${arquivo}`);
}

// ---- Páginas -------------------------------------------------------------
// ---- Páginas em português (arquivos-fonte) ---------------------------------------
const htmlPortugues = new Map();
for (const pagina of PAGINAS) {
  let html = await readFile(join(RAIZ, pagina.arquivo), "utf8");
  html = substituirBloco(html, "head", blocoHead(pagina), pagina.arquivo);
  html = substituirBloco(html, "cabecalho", blocoCabecalho(pagina), pagina.arquivo);
  html = substituirBloco(html, "rodape", blocoRodape(), pagina.arquivo);
  html = preencherTextos(html, pagina.arquivo);
  await escrever(pagina.arquivo, html);
  htmlPortugues.set(pagina.id, html);
}

// ---- Versões traduzidas -------------------------------------------------------------
// Geradas a partir do HTML em português: o buscador recebe cada idioma já
// traduzido, sem depender do JavaScript. 404 e offline não têm versões (são
// traduzidas no navegador, pois respondem por qualquer endereço).
const PAGINAS_TRADUZIDAS = PAGINAS.filter((p) => !p.semIndexar);
const IDIOMAS_TRADUZIDOS = IDIOMAS.filter((i) => i.codigo !== IDIOMA_PADRAO);
const RE_LINK_PAGINA = new RegExp(
  `href="/(${PAGINAS_TRADUZIDAS.filter((p) => p.caminho !== "/").map((p) => p.caminho.slice(1)).join("|")})?(?=["?#])([^"]*)"`,
  "g",
);

function arquivoTraduzido(pagina, codigo) {
  return `${prefixoIdioma(codigo).slice(1)}/${pagina.arquivo}`;
}

function traduzirPagina(pagina, codigo) {
  const info = IDIOMAS.find((i) => i.codigo === codigo);
  const arquivo = arquivoTraduzido(pagina, codigo);
  let html = htmlPortugues.get(pagina.id);
  html = html.replace(/<html lang="pt-BR">/, `<html lang="${codigo}" dir="${info.dir}">`);
  html = substituirBloco(html, "head", blocoHead(pagina, codigo), arquivo);
  html = preencherTextos(html, arquivo, codigo);
  // Links internos para a versão no mesmo idioma.
  html = html.replace(RE_LINK_PAGINA, (_m, pagina = "", resto) => `href="${caminhoNoIdioma(`/${pagina}`, codigo)}${resto}"`);
  html = html.replace(`<option value="${codigo}" `, `<option value="${codigo}" selected `);
  if (pagina.id === "docs") html = docsNoIdioma(html, codigo, arquivo);
  return html;
}

// docs.html tem o texto em português e em inglês; cada versão leva só um.
function docsNoIdioma(html, codigo, arquivo) {
  const portugues = codigo.startsWith("pt");
  const remover = portugues ? "en" : "pt";
  const inicio = html.search(new RegExp(`<article [^>]*data-docs-idioma="${remover}"`));
  const fim = html.indexOf("</article>", inicio);
  if (inicio < 0 || fim < 0) throw new Error(`${arquivo}: artigo data-docs-idioma="${remover}" não encontrado`);
  html = html.slice(0, inicio).replace(/\s+$/, "") + html.slice(fim + "</article>".length);
  if (!portugues) {
    html = html.replace(/(<article [^>]*data-docs-idioma="en") hidden>/, "$1>");
    if (codigo !== "en") html = html.replace(/(<p id="docsAvisoIdioma" [^>]*?) hidden/, "$1");
  }
  return html;
}

for (const idioma of IDIOMAS_TRADUZIDOS) {
  for (const pagina of PAGINAS_TRADUZIDAS) {
    await escrever(arquivoTraduzido(pagina, idioma.codigo), traduzirPagina(pagina, idioma.codigo));
  }
}

// ---- Sitemap ---------------------------------------------------------------
// Todas as versões com conteúdo próprio (as alternativas de idioma estão no
// hreflang de cada página).
const urls = IDIOMAS.flatMap((idioma) =>
  PAGINAS_TRADUZIDAS.filter((p) => temVersaoPropria(p, idioma.codigo)).map(
    (p) => `  <url>\n    <loc>${urlAbsoluta(p, idioma.codigo)}</loc>\n    <priority>${p.prioridade ?? "0.8"}</priority>\n  </url>`,
  ),
).join("\n");
await escrever(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);

await escrever(
  "robots.txt",
  `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
);

// ---- Redirecionamentos de idioma (vercel.json) ------------------------------------------
// Nas páginas em português (raiz), a Vercel leva à versão traduzida:
//  1. cookie gt_idioma (escolha manual no seletor), senão
//  2. primeiro idioma do Accept-Language, se houver versão dele.
// Os buscadores rastreiam sem Accept-Language nem cookie e recebem cada URL
// como ela é. Endereços com prefixo (/en/...) nunca são redirecionados.
const semDiferenciarCaixa = (texto) => texto.replace(/[a-z]/gi, (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`);
function padraoAcceptLanguage(codigo) {
  const [base] = codigo.split("-");
  // pt-PT inclui as variantes que seguem a norma europeia (como idiomaDaTag).
  const tag =
    codigo === "pt-PT"
      ? `${semDiferenciarCaixa("pt")}-(?:${["PT", "AO", "MZ", "CV", "GW", "ST", "TL", "MO"].map(semDiferenciarCaixa).join("|")})(?:-[A-Za-z0-9]+)*`
      : `${semDiferenciarCaixa(base)}(?:[-_][A-Za-z0-9]+)*`;
  return `^\\s*${tag}\\s*(?:[;,].*)?$`;
}
const fontePaginas = `/(${PAGINAS_TRADUZIDAS.filter((p) => p.caminho !== "/").map((p) => p.caminho.slice(1)).join("|")})`;
const ehRegraDeIdioma = (r) =>
  [...(r.has ?? []), ...(r.missing ?? [])].some((c) => c.key === "gt_idioma" || c.key === "accept-language");
const regrasIdioma = [];
for (const condicao of ["cookie", "cabecalho"]) {
  for (const idioma of IDIOMAS_TRADUZIDOS) {
    const prefixo = prefixoIdioma(idioma.codigo);
    const filtro =
      condicao === "cookie"
        ? { has: [{ type: "cookie", key: "gt_idioma", value: idioma.codigo }] }
        : {
            has: [{ type: "header", key: "accept-language", value: padraoAcceptLanguage(idioma.codigo) }],
            missing: [{ type: "cookie", key: "gt_idioma" }],
          };
    regrasIdioma.push(
      { source: "/", ...filtro, destination: prefixo, permanent: false },
      { source: fontePaginas, ...filtro, destination: `${prefixo}/$1`, permanent: false },
    );
  }
}
const vercel = JSON.parse(await readFile(join(RAIZ, "vercel.json"), "utf8"));
const outras = vercel.redirects.filter((r) => !ehRegraDeIdioma(r));
// Depois do redirecionamento do domínio antigo (regras com host) e antes das demais.
const corte = outras.findIndex((r) => !r.has?.some((c) => c.type === "host"));
vercel.redirects = [...outras.slice(0, corte), ...regrasIdioma, ...outras.slice(corte)];
await escrever("vercel.json", `${JSON.stringify(vercel, null, 2)}
`);

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
const listasIdioma = [
  `const PREFIXOS_IDIOMA = ${JSON.stringify(IDIOMAS_TRADUZIDOS.map((i) => prefixoIdioma(i.codigo)))};`,
  `const PAGINAS_TRADUZIDAS = ${JSON.stringify(PAGINAS_TRADUZIDAS.map((p) => p.caminho))};`,
].join("\n");
if (!/\/\/ @idiomas\n[\s\S]*?\n\/\/ \/@idiomas/.test(sw)) throw new Error("sw.js: marcador // @idiomas não encontrado");
sw = sw.replace(/(\/\/ @idiomas\n)[\s\S]*?(\n\/\/ \/@idiomas)/, (_, abre, fecha) => `${abre}${listasIdioma}${fecha}`);
await escrever("sw.js", sw);

if (CHECAR && desatualizados > 0) {
  console.error(`\n${desatualizados} arquivo(s) desatualizado(s). Rode: npm run gerar`);
  process.exit(1);
}
console.log(CHECAR ? "Tudo em dia." : `Concluído (versão do SW: ${versao}).`);
