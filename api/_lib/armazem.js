// Armazenamento das contas e dos eventos.
//
// Produção: Upstash Redis pela API REST (sem pacotes), criado pelo
// Marketplace da Vercel, que injeta as variáveis:
//   KV_REST_API_URL e KV_REST_API_TOKEN
// (os nomes UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN também valem).
//
// Sem essas variáveis as contas ficam indisponíveis — o site continua
// funcionando, com eventos salvos só no navegador.
//
// Desenvolvimento e testes: GT_ARMAZEM=memoria usa um mapa em memória (perde
// tudo ao reiniciar). Nunca é ligado automaticamente.

import { ErroHttp } from "./http.js";

function configuracaoUpstash() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

// ---- Upstash (REST) ----------------------------------------------------------
async function upstash(comandos) {
  const { url, token } = configuracaoUpstash();
  const resposta = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(comandos),
    // Sem resposta em 8 s, desiste em vez de segurar a função até o limite.
    signal: AbortSignal.timeout(8000),
  }).catch(() => {
    throw new ErroHttp(503, "armazem-indisponivel");
  });
  if (!resposta.ok) throw new ErroHttp(503, "armazem-indisponivel");
  const resultados = await resposta.json();
  return resultados.map((r) => {
    if (r.error) throw new ErroHttp(503, "armazem-indisponivel");
    return r.result;
  });
}

// ---- Memória (desenvolvimento) ---------------------------------------------------
const memoria = new Map();
const expira = new Map();

function vivo(chave) {
  const ate = expira.get(chave);
  if (ate != null && ate <= Date.now()) {
    memoria.delete(chave);
    expira.delete(chave);
  }
  return memoria.has(chave);
}

function executarMemoria([nome, chave, ...args]) {
  vivo(chave);
  switch (nome) {
    case "GET":
      return memoria.has(chave) ? memoria.get(chave) : null;
    case "SET": {
      const nx = args.includes("NX");
      if (nx && memoria.has(chave)) return null;
      memoria.set(chave, args[0]);
      const ex = args.indexOf("EX");
      if (ex >= 0) expira.set(chave, Date.now() + Number(args[ex + 1]) * 1000);
      else expira.delete(chave);
      return "OK";
    }
    case "DEL":
      return [chave, ...args].reduce((n, k) => n + (memoria.delete(k) ? 1 : 0), 0);
    case "INCR": {
      const valor = Number(memoria.get(chave) ?? 0) + 1;
      memoria.set(chave, String(valor));
      return valor;
    }
    case "EXPIRE":
      if (!memoria.has(chave) || (args.includes("NX") && expira.has(chave))) return 0;
      expira.set(chave, Date.now() + Number(args[0]) * 1000);
      return 1;
    case "HSET": {
      const mapa = memoria.get(chave) ?? new Map();
      for (let i = 0; i < args.length; i += 2) mapa.set(args[i], args[i + 1]);
      memoria.set(chave, mapa);
      return 1;
    }
    case "HDEL": {
      const mapa = memoria.get(chave);
      return mapa?.delete(args[0]) ? 1 : 0;
    }
    case "HGET":
      return memoria.get(chave)?.get(args[0]) ?? null;
    case "HVALS":
      return [...(memoria.get(chave)?.values() ?? [])];
    case "HLEN":
      return memoria.get(chave)?.size ?? 0;
    default:
      throw new Error(`Comando não suportado em memória: ${nome}`);
  }
}

// ---- Interface -----------------------------------------------------------------
export function armazemDisponivel() {
  return process.env.GT_ARMAZEM === "memoria" || configuracaoUpstash() !== null;
}

/** Executa comandos Redis em sequência: [["GET", "k"], ["SET", "k", "v"]]. */
export async function executar(...comandos) {
  if (process.env.GT_ARMAZEM === "memoria") return comandos.map(executarMemoria);
  if (!configuracaoUpstash()) throw new ErroHttp(503, "contas-indisponiveis");
  return upstash(comandos);
}

/** Só para testes: limpa o armazenamento em memória. */
export function limparMemoria() {
  memoria.clear();
  expira.clear();
}
