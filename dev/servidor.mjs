// Servidor local que imita o comportamento da Vercel o suficiente para
// desenvolver e testar: URLs limpas (cleanUrls), 404.html, redirecionamentos
// (com as condições has/missing de cabeçalho, cookie e host, e $1 no destino)
// e cabeçalhos de vercel.json, e as funções em /api executadas com Node.
//
// Uso: npm run dev            → http://localhost:3000
//      PORT=8080 npm run dev

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PORTA = Number(process.env.PORT) || 3000;

// Contas e eventos: sem Upstash configurado, o servidor local usa um
// armazenamento em memória (apagado ao reiniciar) para permitir testar o
// cadastro e o login. Em produção isso nunca acontece sozinho.
if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) process.env.GT_ARMAZEM ??= "memoria";
const config = JSON.parse(await readFile(join(RAIZ, "vercel.json"), "utf8"));

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

// Pastas que a Vercel não publica (.vercelignore) também não são servidas aqui.
const BLOQUEADOS = ["/dev/", "/testes/", "/.git/", "/node_modules/"];

// Converte padrões do vercel.json ("/api/(.*)", "/paginas/:pagina*",
// "/(cronometro|docs)") em RegExp. O ponto só é literal quando não escapado.
function padraoParaRegex(fonte) {
  const corpo = fonte
    .replace(/(?<!\\)\./g, "\\.")
    .replace(/:(\w+)\*/g, "(.*)")
    .replace(/:(\w+)/g, "([^/]+)");
  return new RegExp(`^${corpo}$`);
}

function lerCookies(req) {
  const saida = {};
  for (const parte of String(req.headers.cookie || "").split(";")) {
    const i = parte.indexOf("=");
    if (i > 0) saida[parte.slice(0, i).trim()] = parte.slice(i + 1).trim();
  }
  return saida;
}

// Condições has/missing: o valor (se houver) é uma expressão regular que
// precisa casar com o valor inteiro, como na Vercel.
function valorDaCondicao(req, condicao) {
  if (condicao.type === "header") return req.headers[condicao.key.toLowerCase()];
  if (condicao.type === "cookie") return lerCookies(req)[condicao.key];
  if (condicao.type === "host") return String(req.headers.host || "").replace(/:\d+$/, "");
  return undefined;
}

function satisfaz(req, condicao) {
  const valor = valorDaCondicao(req, condicao);
  if (valor === undefined) return false;
  return condicao.value === undefined || new RegExp(`^(?:${condicao.value})$`).test(valor);
}

const aplica = (regra, req) =>
  (regra.has ?? []).every((c) => satisfaz(req, c)) && !(regra.missing ?? []).some((c) => satisfaz(req, c));

const regrasCabecalho = config.headers.map((r) => ({ ...r, re: padraoParaRegex(r.source) }));
const redirecionamentos = config.redirects.map((r) => ({ ...r, re: padraoParaRegex(r.source) }));

function aplicarCabecalhos(req, res, caminho) {
  for (const regra of regrasCabecalho) {
    if (regra.re.test(caminho) && aplica(regra, req)) {
      for (const { key, value } of regra.headers) {
        // Localmente servimos em HTTP: o upgrade quebraria os recursos.
        const valor = key === "Content-Security-Policy" ? value.replace(/;\s*upgrade-insecure-requests/, "") : value;
        res.setHeader(key, valor);
      }
    }
  }
}

async function existeArquivo(caminho) {
  try {
    return (await stat(caminho)).isFile();
  } catch {
    return false;
  }
}

async function resolverArquivo(caminhoUrl) {
  const seguro = normalize(decodeURIComponent(caminhoUrl)).replace(/^([/\\])+/, "");
  const absoluto = join(RAIZ, seguro);
  if (!absoluto.startsWith(RAIZ) || seguro.split(sep).some((p) => p.startsWith(".") && p.length > 1)) {
    return null;
  }
  if (caminhoUrl === "/" || caminhoUrl === "") return join(RAIZ, "index.html");
  if (await existeArquivo(absoluto)) return absoluto;
  if (await existeArquivo(join(absoluto, "index.html"))) return join(absoluto, "index.html");
  if (!extname(absoluto) && (await existeArquivo(`${absoluto}.html`))) return `${absoluto}.html`;
  return null;
}

async function executarFuncao(nome, req, res) {
  const arquivo = join(RAIZ, "api", `${nome}.js`);
  if (!/^[\w-]+$/.test(nome) || !(await existeArquivo(arquivo))) return false;
  const modulo = await import(`${pathToFileURL(arquivo).href}?v=${Date.now()}`);
  await modulo.default(req, res);
  return true;
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let caminho = url.pathname;

  try {
    if (BLOQUEADOS.some((b) => caminho.startsWith(b))) caminho = "/__bloqueado__";

    for (const r of redirecionamentos) {
      const casou = r.re.exec(caminho);
      if (casou && aplica(r, req)) {
        const destino = r.destination.replace(/\$(\d+)/g, (_m, n) => casou[Number(n)] ?? "");
        res.writeHead(r.permanent ? 308 : 307, { Location: destino + url.search });
        return res.end();
      }
    }

    // cleanUrls: /pagina.html → /pagina ; /index → /
    if (caminho.endsWith(".html")) {
      const limpo = caminho.replace(/\.html$/, "").replace(/\/index$/, "/") || "/";
      res.writeHead(308, { Location: limpo + url.search });
      return res.end();
    }
    if (caminho.length > 1 && caminho.endsWith("/")) {
      res.writeHead(308, { Location: caminho.replace(/\/+$/, "") + url.search });
      return res.end();
    }

    aplicarCabecalhos(req, res, caminho);

    if (caminho.startsWith("/api/")) {
      if (await executarFuncao(caminho.slice(5), req, res)) return;
    }

    const arquivo = await resolverArquivo(caminho);
    if (!arquivo) {
      res.statusCode = 404;
      res.setHeader("Content-Type", TIPOS[".html"]);
      return res.end(await readFile(join(RAIZ, "404.html")));
    }

    const conteudo = await readFile(arquivo);
    res.statusCode = 200;
    res.setHeader("Content-Type", TIPOS[extname(arquivo)] || "application/octet-stream");
    if (!res.hasHeader("Cache-Control")) res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("Date", new Date().toUTCString());
    res.end(req.method === "HEAD" ? undefined : conteudo);
  } catch (erro) {
    console.error(erro);
    res.statusCode = 500;
    res.end("Erro interno");
  }
});

servidor.listen(PORTA, () => {
  console.log(`GlobalTime em http://localhost:${PORTA}`);
});
