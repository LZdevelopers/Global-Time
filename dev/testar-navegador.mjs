// Teste de fumaça em navegador real (Chrome/Edge headless via DevTools
// Protocol), sem dependências externas.
//
// Para cada página: carrega em desktop e em celular, coleta exceções de
// JavaScript, erros de console (inclui violações de CSP), requisições com
// falha, verifica rolagem horizontal e executa as verificações específicas de
// dev/verificacoes-navegador.mjs. Salva capturas de tela para revisão.
//
// Uso: npm run test:navegador
//      CHROME=/caminho/do/chrome npm run test:navegador
//      SO=/cronometro npm run test:navegador     (só uma página)
//      FUSO=Europe/Lisbon npm run test:navegador (simula um aparelho em outro fuso)
//      TEMA=dark npm run test:navegador          (abre as páginas no tema escuro)
//      IDIOMA=en npm run test:navegador          (abre as páginas em outro idioma)

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGINAS } from "./site.mjs";
import { VERIFICACOES } from "./verificacoes-navegador.mjs";
import ptBR from "../scripts/i18n/textos/pt-BR.js";
import { caminhoNoIdioma, infoIdioma } from "../scripts/i18n/idiomas.js";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PORTA_SITE = Number(process.env.PORTA) || 3100 + Math.floor(Math.random() * 600);
const PORTA_DEPURACAO = 9300 + Math.floor(Math.random() * 600);
const SAIDA = join(tmpdir(), "brasil-time-capturas", `${process.env.SO || "todas"}${process.env.FUSO ? `-${process.env.FUSO}` : ""}${process.env.TEMA ? `-${process.env.TEMA}` : ""}${process.env.IDIOMA ? `-${process.env.IDIOMA}` : ""}`.replace(/[^\w-]+/g, "_") || "inicio");
const BASE = `http://localhost:${PORTA_SITE}`;

const CANDIDATOS_CHROME = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function aguardarUrl(url, tentativas = 200) {
  for (let i = 0; i < tentativas; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 404) return r;
    } catch {
      /* ainda subindo */
    }
    await esperar(150);
  }
  throw new Error(`Sem resposta de ${url}`);
}

class Sessao {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pendentes = new Map();
    this.ouvintes = [];
    ws.addEventListener("message", (evento) => {
      const msg = JSON.parse(evento.data);
      if (msg.id && this.pendentes.has(msg.id)) {
        const { resolver, rejeitar } = this.pendentes.get(msg.id);
        this.pendentes.delete(msg.id);
        msg.error ? rejeitar(new Error(msg.error.message)) : resolver(msg.result);
      } else if (msg.method) {
        for (const ouvinte of this.ouvintes) ouvinte(msg);
      }
    });
  }

  static async conectar(url) {
    const ws = new WebSocket(url);
    await new Promise((resolver, rejeitar) => {
      ws.addEventListener("open", resolver, { once: true });
      ws.addEventListener("error", rejeitar, { once: true });
    });
    return new Sessao(ws);
  }

  enviar(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolver, rejeitar) => this.pendentes.set(id, { resolver, rejeitar }));
  }

  ouvir(callback) {
    this.ouvintes.push(callback);
  }

  async avaliar(expressao) {
    // userGesture: as verificações simulam cliques reais (a tela cheia só aceita gestos do usuário).
    const r = await this.enviar("Runtime.evaluate", { expression: expressao, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
}

async function main() {
  const chrome = CANDIDATOS_CHROME.find((c) => existsSync(c));
  if (!chrome) {
    console.error("Chrome/Edge não encontrado. Defina CHROME=/caminho/do/navegador.");
    process.exit(2);
  }

  rmSync(SAIDA, { recursive: true, force: true });
  mkdirSync(SAIDA, { recursive: true });

  const servidor = spawn(process.execPath, [join(RAIZ, "dev/servidor.mjs")], {
    env: { ...process.env, PORT: String(PORTA_SITE) },
    stdio: "ignore",
  });
  const perfil = join(tmpdir(), `brasil-time-perfil-${Date.now()}`);
  const navegador = spawn(
    chrome,
    [
      "--headless=new",
      `--remote-debugging-port=${PORTA_DEPURACAO}`,
      `--user-data-dir=${perfil}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars",
      "--autoplay-policy=no-user-gesture-required",
      // Idioma fixo: a Vercel (e o servidor local) redirecionam pelo
      // Accept-Language, e as verificações por página esperam português.
      "--lang=pt-BR",
      "--accept-lang=pt-BR",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const encerrar = () => {
    servidor.kill();
    navegador.kill();
  };
  process.on("exit", encerrar);

  let falhas = 0;
  const relatorio = [];

  try {
    await aguardarUrl(`${BASE}/`);
    await aguardarUrl(`http://127.0.0.1:${PORTA_DEPURACAO}/json/version`);
    const alvo = await (await fetch(`http://127.0.0.1:${PORTA_DEPURACAO}/json/new?about:blank`, { method: "PUT" })).json();
    const cdp = await Sessao.conectar(alvo.webSocketDebuggerUrl);

    await cdp.enviar("Page.enable");
    await cdp.enviar("Runtime.enable");
    await cdp.enviar("Log.enable");
    await cdp.enviar("Network.enable");
    await cdp.enviar("Network.setCacheDisabled", { cacheDisabled: true });
    // IDIOMA=en: abre as páginas no idioma escolhido. As verificações por página
    // (escritas para pt-BR) não rodam; em vez delas, conferimos lang/dir e se
    // alguma chave de tradução vazou para a tela.
    const IDIOMA = process.env.IDIOMA;
    if (IDIOMA && !infoIdioma(IDIOMA)) throw new Error(`Idioma desconhecido: ${IDIOMA}`);
    if (IDIOMA) {
      await cdp.enviar("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("gt:idioma", ${JSON.stringify(IDIOMA)});` });
    }
    if (process.env.TEMA) {
      await cdp.enviar("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem("gt:tema", ${JSON.stringify(process.env.TEMA)});` });
    }
    if (process.env.FUSO) await cdp.enviar("Emulation.setTimezoneOverride", { timezoneId: process.env.FUSO });

    let problemas = [];
    cdp.ouvir((msg) => {
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        problemas.push(`exceção: ${d.exception?.description?.split("\n")[0] ?? d.text}`);
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        problemas.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description).join(" ")}`);
      } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
        const e = msg.params.entry;
        // Respostas de erro provocadas de propósito pelos testes não são falhas.
        const esperado =
          (e.url?.includes("/rota-que-nao-existe") && e.text.includes("404")) ||
          (e.url?.includes("/api/hora") && e.text.includes("405")) ||
          (e.url?.includes("/api/eventos") && e.text.includes("401"));
        if (!esperado) {
          problemas.push(`log: ${e.text}${e.url ? ` (${e.url})` : ""}`);
        }
      } else if (msg.method === "Network.loadingFailed" && !msg.params.canceled) {
        problemas.push(`rede: ${msg.params.errorText} (${msg.params.type})`);
      }
    });

    // IDIOMA=en: as páginas indexáveis abrem na versão traduzida (/en/...); a
    // 404 num endereço com o prefixo; a offline (/offline) pela preferência salva.
    const noIdioma = (caminho) => (IDIOMA ? caminhoNoIdioma(caminho, IDIOMA) : caminho);
    const paginas = PAGINAS.map((p) => ({
      ...p,
      url: p.arquivo === "404.html" ? noIdioma("/rota-que-nao-existe") : p.semIndexar ? p.caminho : noIdioma(p.caminho),
    }))
      .filter((p) => !process.env.SO || p.caminho === process.env.SO);

    const telas = [
      { nome: "desktop", width: 1366, height: 900, mobile: false, deviceScaleFactor: 1 },
      { nome: "celular", width: 390, height: 844, mobile: true, deviceScaleFactor: 2 },
    ];

    for (const tela of telas) {
      await cdp.enviar("Emulation.setDeviceMetricsOverride", tela);
      for (const pagina of paginas) {
        problemas = [];
        await cdp.enviar("Page.navigate", { url: `${BASE}${pagina.url}` });
        // Espera a página carregar por completo (módulos já executados) antes
        // do tempo fixo: um intervalo só fixo falhava de vez em quando, com a
        // página ainda sem JavaScript, quando o carregamento atrasava.
        await esperar(300);
        for (let i = 0; i < 50; i += 1) {
          const pronto = await cdp.avaliar(`document.readyState === "complete" && location.href.startsWith(${JSON.stringify(`${BASE}${pagina.url}`)})`);
          if (pronto) break;
          await esperar(200);
        }
        await esperar(1300);

        const geral = await cdp.avaliar(`(() => ({
          titulo: document.title,
          h1: document.querySelectorAll("h1").length,
          rolagemHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
          larguraConteudo: document.documentElement.scrollWidth,
          alturaPagina: document.documentElement.scrollHeight,
          imagensSemAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
          botoesSemNome: [...document.querySelectorAll("button")].filter((b) => !(b.textContent.trim() || b.getAttribute("aria-label") || b.getAttribute("title"))).length,
          camposSemRotulo: [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].filter((c) => !(c.labels?.length || c.getAttribute("aria-label") || c.getAttribute("aria-labelledby"))).length,
          linksVazios: [...document.querySelectorAll("a")].filter((a) => !a.getAttribute("href")).length,
        }))()`);

        const erros = [...problemas];
        if (geral.h1 !== 1) erros.push(`esperado 1 <h1>, encontrado ${geral.h1}`);
        if (geral.rolagemHorizontal) erros.push(`rolagem horizontal (largura ${geral.larguraConteudo}px)`);
        if (geral.imagensSemAlt) erros.push(`${geral.imagensSemAlt} imagem(ns) sem alt`);
        if (geral.botoesSemNome) erros.push(`${geral.botoesSemNome} botão(ões) sem nome acessível`);
        if (geral.camposSemRotulo) erros.push(`${geral.camposSemRotulo} campo(s) sem rótulo`);
        if (geral.linksVazios) erros.push(`${geral.linksVazios} link(s) sem href`);

        const verificacoes = IDIOMA ? [] : (VERIFICACOES[pagina.caminho] ?? []);
        if (IDIOMA) {
          const idioma = await cdp.avaliar(`(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, texto: document.body.innerText + " " + [...document.querySelectorAll("[aria-label],[title],[placeholder]")].map((e) => [e.getAttribute("aria-label"), e.getAttribute("title"), e.getAttribute("placeholder")].join(" ")).join(" ") + " " + document.title }))()`);
          if (idioma.lang !== IDIOMA) erros.push(`lang="${idioma.lang}", esperado ${IDIOMA}`);
          if (idioma.dir !== infoIdioma(IDIOMA).dir) erros.push(`dir="${idioma.dir}"`);
          const vazadas = Object.keys(ptBR).filter((chave) => idioma.texto.includes(chave));
          if (vazadas.length) erros.push(`chaves sem tradução na tela: ${vazadas.slice(0, 8).join(", ")}`);
        }
        if (tela.nome === "desktop") {
          for (const v of verificacoes) {
            try {
              const resultado = await cdp.avaliar(`(async () => { ${v.codigo} })()`);
              if (resultado !== true) erros.push(`${v.nome}: ${JSON.stringify(resultado)}`);
            } catch (erro) {
              erros.push(`${v.nome}: ${erro.message.split("\n")[0]}`);
            }
          }
          // Erros de console gerados durante as próprias verificações.
          for (const p of problemas) if (!erros.includes(p)) erros.push(p);
        }

        // INTEIRA=1 captura a página inteira (útil para revisar a rolagem).
        const inteira = Boolean(process.env.INTEIRA);
        const captura = await cdp.enviar("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: inteira,
          ...(inteira ? { clip: { x: 0, y: 0, width: tela.width, height: Math.min(geral.alturaPagina, 6000), scale: 1 } } : {}),
        });
        const nomeArquivo = `${tela.nome}-${(pagina.caminho.slice(1) || "inicio").replace(/\//g, "_")}.png`;
        writeFileSync(join(SAIDA, nomeArquivo), Buffer.from(captura.data, "base64"));

        const ok = erros.length === 0;
        if (!ok) falhas += 1;
        relatorio.push({ tela: tela.nome, pagina: pagina.url, altura: geral.alturaPagina, ok, erros, verificacoes: tela.nome === "desktop" ? verificacoes.length : 0 });
        console.log(`${ok ? "✓" : "✗"} [${tela.nome}] ${pagina.url}${tela.nome === "desktop" && verificacoes.length ? ` (${verificacoes.length} verificações)` : ""}`);
        for (const erro of erros) console.log(`    ${erro}`);
      }
    }
    cdp.ws.close();
  } finally {
    encerrar();
  }

  writeFileSync(join(SAIDA, "relatorio.json"), JSON.stringify(relatorio, null, 2));
  console.log(`\nCapturas e relatório em: ${SAIDA}`);
  console.log(falhas ? `${falhas} página(s) com problemas.` : "Todas as páginas passaram.");
  process.exit(falhas ? 1 : 0);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
