// Service worker do GlobalTime.
//
// Estratégias:
//  - /api/* : NUNCA interceptado. A rota de horário precisa ir sempre à rede;
//             uma resposta em cache seria um horário errado.
//  - páginas (navegação): rede primeiro, com limite de tempo; sem rede, usa o
//             cache e, por último, /offline.
//  - arquivos estáticos do próprio site: cache primeiro e atualização em
//             segundo plano (stale-while-revalidate).
//
// Atualização: a VERSAO é um hash do conteúdo gerado por `npm run gerar`.
// Uma versão nova é instalada em segundo plano e a página oferece o botão
// "Atualizar" (mensagem ATIVAR_AGORA). Se ninguém clicar, ela assume quando
// todas as abas do site forem fechadas — ninguém fica preso a uma versão.

const VERSAO = "4244c94eef7c";
const CACHE = `globaltime-${VERSAO}`;
const TEMPO_LIMITE_REDE_MS = 3500;

// @precache
const PRECACHE = [
  "/",
  "/assets/fontes/inter-latin-wght-normal.woff2",
  "/assets/fontes/plus-jakarta-sans-latin-wght-normal.woff2",
  "/assets/icones.svg",
  "/assets/icones/icone-192.png",
  "/assets/icones/icone-96.png",
  "/assets/marca/simbolo-branco.png",
  "/assets/marca/simbolo-preto.png",
  "/calculadoras",
  "/calendario",
  "/clima",
  "/contagem",
  "/conversor",
  "/cronometro",
  "/despertador",
  "/docs",
  "/estilos/app.css",
  "/favicon.ico",
  "/feriados",
  "/manifest.webmanifest",
  "/offline",
  "/pomodoro",
  "/relogio-mundial",
  "/scripts/dados/cidades.js",
  "/scripts/dados/feriados-estaduais.js",
  "/scripts/dados/feriados-municipais.js",
  "/scripts/dados/feriados-nacionais.js",
  "/scripts/dados/paises.js",
  "/scripts/dados/ufs.js",
  "/scripts/i18n/estado.js",
  "/scripts/i18n/idiomas.js",
  "/scripts/i18n/index.js",
  "/scripts/i18n/textos/ar.js",
  "/scripts/i18n/textos/de.js",
  "/scripts/i18n/textos/en.js",
  "/scripts/i18n/textos/es.js",
  "/scripts/i18n/textos/fr.js",
  "/scripts/i18n/textos/it.js",
  "/scripts/i18n/textos/ja.js",
  "/scripts/i18n/textos/ko.js",
  "/scripts/i18n/textos/ne.js",
  "/scripts/i18n/textos/nl.js",
  "/scripts/i18n/textos/pt-BR.js",
  "/scripts/i18n/textos/pt-BR/clima.js",
  "/scripts/i18n/textos/pt-BR/docs.js",
  "/scripts/i18n/textos/pt-BR/feriados.js",
  "/scripts/i18n/textos/pt-BR/fusos.js",
  "/scripts/i18n/textos/pt-BR/medir.js",
  "/scripts/i18n/textos/pt-BR/utilitarios.js",
  "/scripts/i18n/textos/pt-PT.js",
  "/scripts/i18n/textos/ru.js",
  "/scripts/i18n/textos/zh-CN.js",
  "/scripts/nucleo/alarmes.js",
  "/scripts/nucleo/alertas.js",
  "/scripts/nucleo/analogico.js",
  "/scripts/nucleo/armazenamento.js",
  "/scripts/nucleo/atalhos.js",
  "/scripts/nucleo/calculos.js",
  "/scripts/nucleo/calendario.js",
  "/scripts/nucleo/clima.js",
  "/scripts/nucleo/conta.js",
  "/scripts/nucleo/contagem-datas.js",
  "/scripts/nucleo/eventos.js",
  "/scripts/nucleo/feriados-paises.js",
  "/scripts/nucleo/feriados.js",
  "/scripts/nucleo/fuso-preferido.js",
  "/scripts/nucleo/fusos.js",
  "/scripts/nucleo/indicador-sincronizacao.js",
  "/scripts/nucleo/localidade.js",
  "/scripts/nucleo/medidores.js",
  "/scripts/nucleo/pagina.js",
  "/scripts/nucleo/pomodoro.js",
  "/scripts/nucleo/sincronizacao.js",
  "/scripts/nucleo/sistemas-calendario.js",
  "/scripts/nucleo/sol.js",
  "/scripts/nucleo/tempo.js",
  "/scripts/nucleo/ui.js",
  "/scripts/nucleo/unidades-clima.js",
  "/scripts/nucleo/voltas.js",
  "/scripts/paginas/calculadoras.js",
  "/scripts/paginas/calendario.js",
  "/scripts/paginas/clima.js",
  "/scripts/paginas/comum-temporizadores.js",
  "/scripts/paginas/contagem.js",
  "/scripts/paginas/conversor.js",
  "/scripts/paginas/cronometro.js",
  "/scripts/paginas/despertador.js",
  "/scripts/paginas/docs.js",
  "/scripts/paginas/feriados.js",
  "/scripts/paginas/inicio.js",
  "/scripts/paginas/offline.js",
  "/scripts/paginas/pomodoro.js",
  "/scripts/paginas/relogio-mundial.js",
  "/scripts/paginas/sol.js",
  "/scripts/paginas/temporizador.js",
  "/scripts/paginas/timestamp.js",
  "/scripts/tema-inicial.js",
  "/sol",
  "/temporizador",
  "/timestamp",
];
// /@precache

// Versões traduzidas (/en/cronometro…): não entram no pré-cache; a página
// pede (GUARDAR_IDIOMA) as do idioma em uso. Listas geradas por dev/gerar.mjs.
// @idiomas
const PREFIXOS_IDIOMA = ["/pt-pt","/en","/es","/fr","/de","/it","/nl","/ru","/ja","/zh-cn","/ko","/ne","/ar"];
const PAGINAS_TRADUZIDAS = ["/","/relogio-mundial","/conversor","/cronometro","/temporizador","/pomodoro","/despertador","/contagem","/calendario","/feriados","/sol","/clima","/calculadoras","/timestamp","/docs"];
// /@idiomas

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Falha de um item não pode impedir a instalação inteira.
      await Promise.all(PRECACHE.map((url) => guardar(cache, url)));
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes.filter((n) => (n.startsWith("globaltime-") || n.startsWith("brasil-time-")) && n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "ATIVAR_AGORA") self.skipWaiting();
  if (evento.data?.tipo === "GUARDAR_IDIOMA" && PREFIXOS_IDIOMA.includes(evento.data.prefixo)) {
    evento.waitUntil(guardarIdioma(evento.data.prefixo));
  }
});

async function guardarIdioma(prefixo) {
  const cache = await caches.open(CACHE);
  await Promise.all(
    PAGINAS_TRADUZIDAS.map(async (pagina) => {
      const url = pagina === "/" ? prefixo : `${prefixo}${pagina}`;
      if (!(await cache.match(url))) await guardar(cache, url);
    }),
  );
}

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // sempre rede, sem cache

  if (request.mode === "navigate") {
    evento.respondWith(navegacao(request));
    return;
  }

  evento.respondWith(estatico(request, evento));
});

async function navegacao(request) {
  const cache = await caches.open(CACHE);
  try {
    const resposta = await comLimite(fetch(request), TEMPO_LIMITE_REDE_MS);
    if (resposta.ok && resposta.type === "basic") {
      cache.put(chavePagina(request), resposta.clone());
    }
    return resposta;
  } catch {
    return (
      (await cache.match(chavePagina(request))) ||
      (await cache.match("/offline")) ||
      new Response("Sem conexão.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    );
  }
}

// Ignora a query string das páginas (ex.: /contagem?data=...) ao guardar.
function chavePagina(request) {
  const url = new URL(request.url);
  // /index e /en/index (ou /en/) são o mesmo que / e /en.
  const caminho = url.pathname.replace(/\.html$/, "").replace(/\/index$/, "").replace(/(.)\/$/, "$1") || "/";
  return new Request(url.origin + caminho);
}

async function estatico(request, evento) {
  const cache = await caches.open(CACHE);
  const emCache = await cache.match(request, { ignoreSearch: true });
  const daRede = fetch(request)
    .then((resposta) => {
      if (resposta.ok && resposta.type === "basic") cache.put(request, resposta.clone());
      return resposta;
    })
    .catch(() => null);

  if (emCache) {
    evento.waitUntil(daRede);
    return emCache;
  }
  return (await daRede) || new Response("", { status: 504 });
}

// Guarda uma URL no cache, exceto se a resposta veio de um redirecionamento:
// quem tem o navegador em outro idioma é levado de /cronometro a
// /en/cronometro, e uma resposta redirecionada servida do cache numa
// navegação é recusada pelo navegador (a página não abriria offline).
async function guardar(cache, url) {
  try {
    const resposta = await fetch(new Request(url, { cache: "reload" }));
    if (resposta.ok && !resposta.redirected) await cache.put(url, resposta);
  } catch {
    /* sem rede ou erro: fica de fora */
  }
}

function comLimite(promessa, ms) {
  return new Promise((resolver, rejeitar) => {
    const id = setTimeout(() => rejeitar(new Error("tempo esgotado")), ms);
    promessa.then(
      (valor) => {
        clearTimeout(id);
        resolver(valor);
      },
      (erro) => {
        clearTimeout(id);
        rejeitar(erro);
      },
    );
  });
}

// Clique numa notificação (temporizador, despertador, pomodoro) foca a aba.
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  evento.waitUntil(
    (async () => {
      const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const aba = abas.find((c) => "focus" in c);
      if (aba) return aba.focus();
      return self.clients.openWindow("/");
    })(),
  );
});
