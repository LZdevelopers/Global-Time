// Teste do PWA em navegador real: registro do service worker, pré-cache,
// exclusão da API de horário do cache e funcionamento offline (simulado
// derrubando o servidor local, o que também derruba o fetch do próprio SW).
//
// Uso: npm run test:pwa

import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PORTA_SITE = 3700 + Math.floor(Math.random() * 200);
const PORTA_DEPURACAO = 9900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORTA_SITE}`;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((c) => c && existsSync(c));

if (!chrome) {
  console.error("Chrome/Edge não encontrado. Defina CHROME=/caminho/do/navegador.");
  process.exit(2);
}

async function aguardar(url) {
  for (let i = 0; i < 200; i += 1) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {
      /* subindo */
    }
    await esperar(150);
  }
  throw new Error(`Sem resposta de ${url}`);
}

function subirServidor() {
  return spawn(process.execPath, [join(RAIZ, "dev/servidor.mjs")], {
    env: { ...process.env, PORT: String(PORTA_SITE) },
    stdio: "ignore",
  });
}

let servidor = subirServidor();
const perfil = join(tmpdir(), `brasil-time-pwa-${Date.now()}`);
const navegador = spawn(
  chrome,
  ["--headless=new", `--remote-debugging-port=${PORTA_DEPURACAO}`, `--user-data-dir=${perfil}`, "--no-first-run", "about:blank"],
  { stdio: "ignore" },
);

const resultados = [];
function verificar(nome, ok, detalhe = "") {
  resultados.push(ok);
  console.log(`${ok ? "✓" : "✗"} ${nome}${ok || !detalhe ? "" : ` — ${JSON.stringify(detalhe)}`}`);
}

try {
  await aguardar(`${BASE}/`);
  await aguardar(`http://127.0.0.1:${PORTA_DEPURACAO}/json/version`);
  const alvo = await (await fetch(`http://127.0.0.1:${PORTA_DEPURACAO}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pendentes = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendentes.has(m.id)) {
      pendentes.get(m.id)(m);
      pendentes.delete(m.id);
    }
  });
  const enviar = (method, params = {}) =>
    new Promise((r) => {
      const meu = ++id;
      pendentes.set(meu, r);
      ws.send(JSON.stringify({ id: meu, method, params }));
    });
  const avaliar = async (expr) => {
    const m = await enviar("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description);
    return m.result?.result?.value;
  };
  const navegar = async (url, ms = 1500) => {
    await enviar("Page.navigate", { url });
    await esperar(ms);
  };

  await enviar("Page.enable");
  await enviar("Runtime.enable");

  // 1. Registro do SW (localhost exige ?sw=1).
  await navegar(`${BASE}/?sw=1`, 2500);
  const ativo = await avaliar(`
    const reg = await navigator.serviceWorker.ready;
    return Boolean(reg.active);`);
  verificar("service worker registrado e ativo", ativo === true, ativo);

  // Recarrega para a página passar a ser controlada pelo SW.
  await navegar(`${BASE}/`, 2500);
  const controlada = await avaliar(`return Boolean(navigator.serviceWorker.controller);`);
  verificar("página controlada pelo service worker", controlada === true, controlada);

  // 2. Pré-cache.
  const cache = await avaliar(`
    const nomes = await caches.keys();
    const nome = nomes.find((n) => n.startsWith("globaltime-"));
    const c = await caches.open(nome);
    const chaves = (await c.keys()).map((r) => new URL(r.url).pathname);
    return { nome, total: chaves.length, chaves };`);
  const essenciais = ["/", "/cronometro", "/temporizador", "/feriados", "/offline", "/estilos/app.css", "/scripts/nucleo/sincronizacao.js"];
  const faltando = essenciais.filter((u) => !cache.chaves.includes(u));
  verificar(`pré-cache com ${cache.total} itens (${cache.nome})`, faltando.length === 0, { faltando });

  // 3. API de horário nunca entra no cache.
  const apiNoCache = await avaliar(`
    await fetch("/api/hora", { cache: "no-store" });
    await fetch("/api/hora");
    for (const nome of await caches.keys()) {
      const c = await caches.open(nome);
      for (const r of await c.keys()) if (new URL(r.url).pathname.startsWith("/api/")) return r.url;
    }
    return false;`);
  verificar("/api/hora fora de todos os caches", apiNoCache === false, apiNoCache);

  const valoresDiferentes = await avaliar(`
    const a = (await (await fetch("/api/hora")).json()).timestamp;
    await new Promise((r) => setTimeout(r, 50));
    const b = (await (await fetch("/api/hora")).json()).timestamp;
    return b > a;`);
  verificar("respostas da API não são reaproveitadas", valoresDiferentes === true, valoresDiferentes);

  // 4. Offline: derruba o servidor.
  servidor.kill();
  await esperar(500);

  await navegar(`${BASE}/cronometro`, 4500);
  const cronometroOffline = await avaliar(`return document.querySelector("h1")?.textContent?.trim();`);
  verificar("cronômetro abre sem servidor", Boolean(cronometroOffline) && !/conex/i.test(cronometroOffline), cronometroOffline);

  await navegar(`${BASE}/`, 6000);
  const seloOffline = await avaliar(`return document.querySelector("#seloSync")?.textContent;`);
  verificar(
    "relógio offline informa que não está sincronizado",
    /aparelho|Offline|limitada/i.test(seloOffline || ""),
    seloOffline,
  );

  await navegar(`${BASE}/pagina-que-nunca-foi-visitada`, 4500);
  const paginaOffline = await avaliar(`return document.title;`);
  verificar("página desconhecida offline mostra /offline", /conexão/i.test(paginaOffline || ""), paginaOffline);

  // 5. Volta o servidor.
  servidor = subirServidor();
  await aguardar(`${BASE}/`);
  await navegar(`${BASE}/`, 3000);
  const seloOnline = await avaliar(`return document.querySelector("#seloSync")?.textContent;`);
  verificar("ao voltar a rede, sincroniza de novo", /Sincronizado/.test(seloOnline || ""), seloOnline);

  ws.close();
} catch (erro) {
  console.error(erro);
  resultados.push(false);
} finally {
  servidor.kill();
  navegador.kill();
  await esperar(300);
  try {
    rmSync(perfil, { recursive: true, force: true });
  } catch {
    /* perfil em uso */
  }
}

const falhas = resultados.filter((r) => !r).length;
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : "\nPWA: todas as verificações passaram.");
process.exit(falhas ? 1 : 0);
