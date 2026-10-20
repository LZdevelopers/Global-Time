// Conta do usuário e armazenamento dos eventos pessoais no navegador.
//
// Com sessão aberta, os eventos ficam na conta (/api/eventos, Upstash Redis
// na Vercel) e aparecem em qualquer aparelho. Sem conta — ou quando o
// servidor não tem contas configuradas —, ficam só neste navegador
// (localStorage). A interface deixa claro qual é o caso.

import { ler, gravar, remover } from "./armazenamento.js";
import { normalizarLista, validarEvento } from "./eventos.js";

const CHAVE_LOCAL = "eventos";

async function pedir(url, { metodo = "GET", corpo } = {}) {
  let resposta;
  try {
    resposta = await fetch(url, {
      method: metodo,
      credentials: "same-origin",
      cache: "no-store",
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    return { ok: false, status: 0, erro: "sem-conexao" };
  }
  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }
  return { ok: resposta.ok, status: resposta.status, erro: dados?.erro ?? (resposta.ok ? null : "interno"), dados };
}

/** { disponivel, conta: { email } | null, offline? } */
export async function estadoConta() {
  const r = await pedir("/api/conta");
  if (!r.ok) return { disponivel: false, conta: null, offline: r.status === 0 };
  return { disponivel: Boolean(r.dados.disponivel), conta: r.dados.conta ?? null };
}

export const cadastrar = (email, senha) => pedir("/api/conta", { metodo: "POST", corpo: { acao: "cadastrar", email, senha } });
export const entrar = (email, senha) => pedir("/api/conta", { metodo: "POST", corpo: { acao: "entrar", email, senha } });
export const sair = () => pedir("/api/conta", { metodo: "POST", corpo: { acao: "sair" } });
export const excluirConta = (senha) => pedir("/api/conta", { metodo: "DELETE", corpo: { senha } });

// ---- Eventos -------------------------------------------------------------------

/** Eventos salvos neste navegador. */
export function eventosLocais() {
  return normalizarLista(ler(CHAVE_LOCAL, []));
}

function gravarLocais(lista) {
  if (lista.length) gravar(CHAVE_LOCAL, lista);
  else remover(CHAVE_LOCAL);
}

/**
 * Armazém de eventos: { origem, lista, salvar, excluir }.
 * `origem` é "conta" ou "local". As operações devolvem { ok, erro, erros? }.
 */
export async function abrirArmazemEventos(conta) {
  if (conta) {
    const r = await pedir("/api/eventos");
    if (r.ok) {
      let lista = normalizarLista(r.dados.eventos);
      return {
        origem: "conta",
        get lista() {
          return lista;
        },
        async salvar(entrada, id) {
          const resposta = id
            ? await pedir(`/api/eventos?id=${encodeURIComponent(id)}`, { metodo: "PUT", corpo: entrada })
            : await pedir("/api/eventos", { metodo: "POST", corpo: entrada });
          if (!resposta.ok) return { ok: false, erro: resposta.erro, erros: resposta.dados?.campos };
          const evento = resposta.dados.evento;
          lista = [...lista.filter((e) => e.id !== evento.id), evento];
          return { ok: true, evento };
        },
        async excluir(id) {
          const resposta = await pedir(`/api/eventos?id=${encodeURIComponent(id)}`, { metodo: "DELETE" });
          if (resposta.ok) lista = lista.filter((e) => e.id !== id);
          return { ok: resposta.ok, erro: resposta.erro };
        },
      };
    }
  }

  let lista = eventosLocais();
  return {
    origem: "local",
    get lista() {
      return lista;
    },
    async salvar(entrada, id) {
      const anterior = id ? lista.find((e) => e.id === id) : null;
      const r = validarEvento(entrada, { id: anterior?.id, criadoEm: anterior?.criadoEm });
      if (!r.ok) return { ok: false, erro: "evento-invalido", erros: r.erros };
      lista = [...lista.filter((e) => e.id !== r.evento.id), r.evento];
      gravarLocais(lista);
      return { ok: true, evento: r.evento };
    },
    async excluir(id) {
      lista = lista.filter((e) => e.id !== id);
      gravarLocais(lista);
      return { ok: true };
    },
  };
}

/** Envia os eventos deste navegador para a conta; remove os que foram enviados. */
export async function enviarLocaisParaConta(armazem) {
  const locais = eventosLocais();
  let enviados = 0;
  const restantes = [];
  for (const evento of locais) {
    const r = await armazem.salvar(evento);
    if (r.ok) enviados += 1;
    else restantes.push(evento);
  }
  gravarLocais(restantes);
  return { enviados, falhas: restantes.length };
}
