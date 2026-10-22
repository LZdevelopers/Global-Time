// Demonstração: abre o site como se fosse um visitante de outro país.
//
// Sobe o servidor local e abre um Chrome novo (perfil limpo, sem cookies nem
// escolhas salvas) com:
//  - o idioma do navegador do visitante (Accept-Language e navigator.languages)
//    → a "Vercel" local redireciona para a versão no idioma dele;
//  - o fuso horário do visitante (pelo DevTools Protocol, como o painel
//    Sensors) → relógio, país do calendário e próximo feriado;
//  - a localização por IP do visitante (IP_FALSO no servidor local) → clima.
//
// Uso: npm run demo -- paris        (lista de lugares: npm run demo -- ajuda)
//      PORT=4000 npm run demo -- toquio
// Feche a janela do Chrome para encerrar.

import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PORTA = Number(process.env.PORT) || 3333;
const PORTA_DEPURACAO = 9900 + Math.floor(Math.random() * 90);

// Um lugar por idioma do site. Cidade/região/país como a Vercel envia.
const VISITANTES = {
  umuarama: { idioma: "pt-BR,pt", fuso: "America/Sao_Paulo", ip: "-23.77,-53.32,Umuarama,PR,BR" },
  lisboa: { idioma: "pt-PT,pt", fuso: "Europe/Lisbon", ip: "38.72,-9.14,Lisbon,11,PT" },
  "nova-york": { idioma: "en-US,en", fuso: "America/New_York", ip: "40.71,-74.01,New York,NY,US" },
  londres: { idioma: "en-GB,en", fuso: "Europe/London", ip: "51.51,-0.13,London,ENG,GB" },
  madri: { idioma: "es-ES,es", fuso: "Europe/Madrid", ip: "40.42,-3.70,Madrid,M,ES" },
  "cidade-do-mexico": { idioma: "es-MX,es", fuso: "America/Mexico_City", ip: "19.43,-99.13,Mexico City,CMX,MX" },
  paris: { idioma: "fr-FR,fr", fuso: "Europe/Paris", ip: "48.86,2.35,Paris,IDF,FR" },
  berlim: { idioma: "de-DE,de", fuso: "Europe/Berlin", ip: "52.52,13.40,Berlin,BE,DE" },
  roma: { idioma: "it-IT,it", fuso: "Europe/Rome", ip: "41.90,12.50,Rome,62,IT" },
  amsterda: { idioma: "nl-NL,nl", fuso: "Europe/Amsterdam", ip: "52.37,4.90,Amsterdam,NH,NL" },
  moscou: { idioma: "ru-RU,ru", fuso: "Europe/Moscow", ip: "55.76,37.62,Moscow,MOW,RU" },
  toquio: { idioma: "ja-JP,ja", fuso: "Asia/Tokyo", ip: "35.68,139.69,Tokyo,13,JP" },
  pequim: { idioma: "zh-CN,zh", fuso: "Asia/Shanghai", ip: "39.90,116.41,Beijing,BJ,CN" },
  seul: { idioma: "ko-KR,ko", fuso: "Asia/Seoul", ip: "37.57,126.98,Seoul,11,KR" },
  cairo: { idioma: "ar-EG,ar", fuso: "Africa/Cairo", ip: "30.04,31.24,Cairo,C,EG" },
  // Fuso UTC+5:45; feriados do calendário vêm do Google (a Nager não cobre o Nepal).
  katmandu: { idioma: "ne-NP,ne,en-US,en", fuso: "Asia/Kathmandu", ip: "27.72,85.32,Kathmandu,P3,NP" },
};

const nome = (process.argv[2] || "").toLowerCase();
const visitante = VISITANTES[nome];
if (!visitante) {
  console.log("Uso: npm run demo -- <lugar>\n\nLugares:");
  for (const [id, v] of Object.entries(VISITANTES)) console.log(`  ${id.padEnd(18)} ${v.idioma.split(",")[0].padEnd(6)} ${v.fuso}`);
  process.exit(nome && nome !== "ajuda" ? 1 : 0);
}

const chrome = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((c) => c && existsSync(c));
if (!chrome) {
  console.error("Chrome/Edge não encontrado. Defina CHROME=/caminho/do/navegador.");
  process.exit(2);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function aguardar(url) {
  for (let i = 0; i < 100; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status < 500) return r;
    } catch {
      /* ainda subindo */
    }
    await esperar(150);
  }
  throw new Error(`Sem resposta de ${url}`);
}

const servidor = spawn(process.execPath, [join(RAIZ, "dev/servidor.mjs")], {
  env: { ...process.env, PORT: String(PORTA), IP_FALSO: visitante.ip },
  stdio: "ignore",
});
const perfil = join(tmpdir(), `globaltime-demo-${Date.now()}`);
const [lat, lon] = visitante.ip.split(",").map(Number);
const lingua = visitante.idioma.split(",")[0];
const navegador = spawn(
  chrome,
  [
    `--remote-debugging-port=${PORTA_DEPURACAO}`,
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "--no-default-browser-check",
    `--lang=${lingua}`,
    `--accept-lang=${visitante.idioma}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

function encerrar() {
  servidor.kill();
  navegador.kill();
  try {
    rmSync(perfil, { recursive: true, force: true });
  } catch {
    /* o Chrome ainda pode estar soltando os arquivos */
  }
}
navegador.on("exit", () => {
  encerrar();
  process.exit(0);
});
process.on("SIGINT", () => {
  encerrar();
  process.exit(0);
});

await aguardar(`http://localhost:${PORTA}/api/hora`);
const versao = await (await aguardar(`http://127.0.0.1:${PORTA_DEPURACAO}/json/version`)).json();

// Uma conexão com o navegador inteiro; cada aba nova é pausada até receber o
// fuso (e a posição), assim nenhuma página roda no fuso real do PC.
const ws = new WebSocket(versao.webSocketDebuggerUrl);
await new Promise((ok, erro) => {
  ws.addEventListener("open", ok, { once: true });
  ws.addEventListener("error", erro, { once: true });
});
let id = 0;
const pendentes = new Map();
const enviar = (method, params = {}, sessionId) => {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params, sessionId }));
  return new Promise((ok, erro) => pendentes.set(n, { ok, erro }));
};
ws.addEventListener("message", async (evento) => {
  const msg = JSON.parse(evento.data);
  if (msg.id && pendentes.has(msg.id)) {
    const { ok, erro } = pendentes.get(msg.id);
    pendentes.delete(msg.id);
    return msg.error ? erro(new Error(msg.error.message)) : ok(msg.result);
  }
  if (msg.method === "Target.attachedToTarget") {
    const { sessionId, targetInfo, waitingForDebugger } = msg.params;
    if (targetInfo.type === "page") {
      await enviar("Emulation.setTimezoneOverride", { timezoneId: visitante.fuso }, sessionId).catch(() => {});
      await enviar("Emulation.setGeolocationOverride", { latitude: lat, longitude: lon, accuracy: 50 }, sessionId).catch(() => {});
    }
    if (waitingForDebugger) await enviar("Runtime.runIfWaitingForDebugger", {}, sessionId).catch(() => {});
  }
});

await enviar("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
// "Usar minha localização" responde com a posição do visitante — a não ser que
// uma política da empresa bloqueie a geolocalização no Chrome.
await enviar("Browser.grantPermissions", { permissions: ["geolocation"], origin: `http://localhost:${PORTA}` }).catch(() => {});

const abas = (await enviar("Target.getTargets")).targetInfos.filter((t) => t.type === "page");
await enviar("Target.createTarget", { url: `http://localhost:${PORTA}/` });
for (const aba of abas) await enviar("Target.closeTarget", { targetId: aba.targetId }).catch(() => {});

console.log(`Demonstração: visitante de ${nome}`);
console.log(`  idioma do navegador: ${visitante.idioma}`);
console.log(`  fuso horário:        ${visitante.fuso}`);
console.log(`  localização por IP:  ${visitante.ip}`);
console.log(`  site:                http://localhost:${PORTA}/ (abre já redirecionado)`);
console.log("Feche a janela do Chrome (ou Ctrl+C aqui) para encerrar.");
