// Fonte única sobre as páginas do site: rotas, navegação, ícones, sitemap e
// pré-cache do service worker. Os textos (rótulos, títulos e descrições) vêm
// do dicionário scripts/i18n/textos/pt-BR.js, chaves `paginas.<id>.*`.
// Depois de editar, rode `npm run gerar`.

import ptBR from "../scripts/i18n/textos/pt-BR.js";

// Endereço público de produção, usado em canonical, Open Graph e sitemap.
// AJUSTE para o domínio real antes de publicar (ou defina SITE_URL no ambiente
// ao rodar `npm run gerar`).
export const SITE_URL = (process.env.SITE_URL || "https://global-time.lzdev.com.br").replace(/\/$/, "");

export const SITE = {
  nome: "GlobalTime",
  descricao: ptBR["site.descricao"],
  autor: "LZdev",
  urlAutor: "https://lzdev.com.br/",
};

export const GRUPOS = ["relogios", "medir", "calendario", "utilitarios"].map((id) => ({
  id,
  titulo: ptBR[`grupos.${id}`],
}));

// `nav: n` → aparece na barra principal (desktop), na posição n.
const DEFINICOES = [
  { id: "inicio", arquivo: "index.html", caminho: "/", icone: "relogio", grupo: "relogios", nav: 1, prioridade: "1.0", tituloCompleto: true },
  { id: "relogio-mundial", arquivo: "relogio-mundial.html", caminho: "/relogio-mundial", icone: "globo", grupo: "relogios", nav: 5 },
  { id: "conversor", arquivo: "conversor.html", caminho: "/conversor", icone: "conversor", grupo: "relogios" },
  { id: "tela-cheia", arquivo: "tela-cheia.html", caminho: "/tela-cheia", icone: "tela-cheia", grupo: "relogios" },
  { id: "cronometro", arquivo: "cronometro.html", caminho: "/cronometro", icone: "cronometro", grupo: "medir", nav: 2 },
  { id: "temporizador", arquivo: "temporizador.html", caminho: "/temporizador", icone: "temporizador", grupo: "medir", nav: 3 },
  { id: "pomodoro", arquivo: "pomodoro.html", caminho: "/pomodoro", icone: "foco", grupo: "medir" },
  { id: "despertador", arquivo: "despertador.html", caminho: "/despertador", icone: "despertador", grupo: "medir" },
  { id: "contagem", arquivo: "contagem.html", caminho: "/contagem", icone: "contagem", grupo: "medir" },
  { id: "calendario", arquivo: "calendario.html", caminho: "/calendario", icone: "calendario", grupo: "calendario", nav: 4 },
  { id: "feriados", arquivo: "feriados.html", caminho: "/feriados", icone: "feriado", grupo: "calendario" },
  { id: "sol", arquivo: "sol.html", caminho: "/sol", icone: "sol", grupo: "calendario" },
  { id: "calculadoras", arquivo: "calculadoras.html", caminho: "/calculadoras", icone: "calculadora", grupo: "utilitarios" },
  { id: "timestamp", arquivo: "timestamp.html", caminho: "/timestamp", icone: "codigo", grupo: "utilitarios" },
  { id: "docs", arquivo: "docs.html", caminho: "/docs", icone: "info", grupo: null },
  { id: "404", arquivo: "404.html", caminho: "/404", semIndexar: true },
  { id: "offline", arquivo: "offline.html", caminho: "/offline", semIndexar: true },
];

function texto(id, campo) {
  const valor = ptBR[`paginas.${id}.${campo}`];
  if (valor == null && campo !== "rotuloNav") throw new Error(`Falta paginas.${id}.${campo} em pt-BR.js`);
  return valor;
}

export const PAGINAS = DEFINICOES.map((p) => ({
  ...p,
  rotulo: texto(p.id, "rotulo"),
  rotuloNav: texto(p.id, "rotuloNav") ?? texto(p.id, "rotulo"),
  titulo: texto(p.id, "titulo"),
  descricao: texto(p.id, "descricao"),
}));

export function paginasDoGrupo(grupo) {
  return PAGINAS.filter((p) => p.grupo === grupo);
}
