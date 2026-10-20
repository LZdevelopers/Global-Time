import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESTADOS,
  RelogioSincronizado,
  calcularAmostra,
  escolherMelhorAmostra,
  lerCabecalhoDate,
} from "../scripts/nucleo/sincronizacao.js";

// Simula a rede: um relógio "real" (verdade), um relógio do aparelho errado
// e uma latência por requisição. performance.now() avança junto com a verdade.
function criarAmbiente({ erroAparelhoMs = 0, latencias = [40], falhar = false, cabecalho = null } = {}) {
  let verdade = Date.UTC(2026, 9, 19, 15, 0, 0);
  let perf = 1000;
  let chamada = 0;
  const avancar = (ms) => {
    verdade += ms;
    perf += ms;
  };
  const fetch = async (url, init) => {
    const latencia = latencias[Math.min(chamada, latencias.length - 1)];
    chamada += 1;
    if (falhar && url.startsWith("/api/")) {
      avancar(latencia);
      throw new TypeError("Failed to fetch");
    }
    avancar(latencia / 2);
    const servidor = verdade; // servidor lê o relógio no meio do caminho
    avancar(latencia / 2);
    if (url.startsWith("/api/")) {
      return { ok: true, status: 200, json: async () => ({ timestamp: servidor }), headers: new Map() };
    }
    if (cabecalho === null) throw new TypeError("Failed to fetch");
    return { ok: true, status: 200, headers: new Map([["date", new Date(Math.floor(servidor / 1000) * 1000).toUTCString()]]) };
  };
  return {
    relogio: new RelogioSincronizado({
      fetch,
      perfAgora: () => perf,
      localAgora: () => verdade + erroAparelhoMs,
      estaOnline: () => true,
    }),
    verdade: () => verdade,
    avancar,
    chamadas: () => chamada,
  };
}

test("calcularAmostra estima o horário do servidor no ponto médio", () => {
  const a = calcularAmostra({ p0: 100, p1: 180, local1: 5_000, servidorMs: 10_000 });
  assert.equal(a.rtt, 80);
  assert.equal(a.ancoraEpoch, 10_040);
  assert.equal(a.incertezaMs, 40);
  assert.equal(a.diferencaLocalMs, 5_040);
});

test("calcularAmostra com cabeçalho Date considera a resolução de 1 s", () => {
  const a = calcularAmostra({ p0: 0, p1: 100, local1: 0, servidorMs: 10_000, resolucaoMs: 1000 });
  assert.equal(a.ancoraEpoch, 10_550);
  assert.equal(a.incertezaMs, 550);
});

test("escolherMelhorAmostra prefere a menor latência", () => {
  const melhor = escolherMelhorAmostra([{ rtt: 90 }, { rtt: 20, id: "b" }, { rtt: 45 }]);
  assert.equal(melhor.id, "b");
});

test("lerCabecalhoDate rejeita valores inválidos ou implausíveis", () => {
  assert.ok(Number.isNaN(lerCabecalhoDate(null)));
  assert.ok(Number.isNaN(lerCabecalhoDate("lixo")));
  assert.ok(Number.isNaN(lerCabecalhoDate("Thu, 01 Jan 1970 00:00:00 GMT")));
  assert.equal(lerCabecalhoDate("Mon, 19 Oct 2026 15:00:00 GMT"), Date.UTC(2026, 9, 19, 15));
});

test("corrige um relógio do aparelho adiantado em 3 minutos", async () => {
  const amb = criarAmbiente({ erroAparelhoMs: 180_000, latencias: [120, 30, 80, 200, 60] });
  await amb.relogio.sincronizar({ amostras: 5 });
  assert.equal(amb.relogio.estado.status, ESTADOS.SINCRONIZADO);
  assert.equal(amb.relogio.estado.latenciaMs, 30, "deve escolher a amostra de menor latência");
  assert.ok(Math.abs(amb.relogio.agora() - amb.verdade()) < 1, "hora corrigida bate com a verdade");
  assert.ok(Math.abs(amb.relogio.estado.diferencaLocalMs + 180_000) < 1, "diferença negativa = aparelho adiantado");
  amb.relogio.parar();
});

test("continua avançando pelo relógio monotônico após sincronizar", async () => {
  const amb = criarAmbiente({ erroAparelhoMs: -42_000 });
  await amb.relogio.sincronizar({ amostras: 3 });
  amb.avancar(90 * 60 * 1000); // 1h30 depois
  assert.ok(Math.abs(amb.relogio.agora() - amb.verdade()) < 1);
  amb.relogio.parar();
});

test("sem a API, usa o cabeçalho Date com precisão limitada", async () => {
  const amb = criarAmbiente({ erroAparelhoMs: 10_000, falhar: true, cabecalho: true });
  await amb.relogio.sincronizar({ amostras: 3 });
  assert.equal(amb.relogio.estado.status, ESTADOS.LIMITADO);
  assert.equal(amb.relogio.estado.fonte, "cabecalho");
  assert.ok(Math.abs(amb.relogio.agora() - amb.verdade()) <= 1000, "erro dentro de 1 s");
  amb.relogio.parar();
});

test("sem nenhuma fonte, cai para o relógio local e informa", async () => {
  const amb = criarAmbiente({ erroAparelhoMs: 5_000, falhar: true, cabecalho: null });
  await amb.relogio.sincronizar({ amostras: 3 });
  assert.equal(amb.relogio.estado.status, ESTADOS.LOCAL);
  assert.equal(amb.relogio.estado.fonte, "local");
  assert.ok(amb.relogio.estado.erro);
  assert.equal(amb.relogio.agora(), amb.verdade() + 5_000);
  amb.relogio.parar();
});

test("falha posterior mantém a última correção válida", async () => {
  const amb = criarAmbiente({ erroAparelhoMs: 60_000 });
  await amb.relogio.sincronizar({ amostras: 3 });
  amb.relogio.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await amb.relogio.sincronizar({ amostras: 3, forcar: true });
  assert.ok(Math.abs(amb.relogio.agora() - amb.verdade()) < 1);
  assert.equal(amb.relogio.estado.fonte, "servidor");
  amb.relogio.parar();
});

test("resposta antiga não sobrescreve uma sincronização mais recente", async () => {
  let perf = 0;
  const verdade = Date.UTC(2026, 9, 19);
  const pendentes = [];
  const fetch = () =>
    new Promise((resolver) => pendentes.push(resolver));
  const relogio = new RelogioSincronizado({ fetch, perfAgora: () => perf, localAgora: () => verdade, estaOnline: () => true });

  const antiga = relogio.sincronizar({ amostras: 1 });
  const nova = relogio.sincronizar({ amostras: 1, forcar: true });

  // A rodada nova responde primeiro, com o horário correto (+0 s)...
  pendentes[1]({ ok: true, status: 200, json: async () => ({ timestamp: verdade }) });
  await nova;
  // ...e a antiga chega depois com um valor bem diferente (+1 h).
  pendentes[0]({ ok: true, status: 200, json: async () => ({ timestamp: verdade + 3_600_000 }) });
  await antiga;

  assert.ok(Math.abs(relogio.agora() - verdade) < 1, "a resposta antiga foi descartada");
  relogio.parar();
});

test("rejeita respostas com timestamp inválido", async () => {
  const relogio = new RelogioSincronizado({
    fetch: async (url) =>
      url.startsWith("/api/")
        ? { ok: true, status: 200, json: async () => ({ timestamp: "abc" }) }
        : Promise.reject(new TypeError("offline")),
    perfAgora: () => 0,
    localAgora: () => Date.UTC(2026, 0, 1),
    estaOnline: () => true,
  });
  await relogio.sincronizar({ amostras: 2 });
  assert.equal(relogio.estado.status, ESTADOS.LOCAL);
  relogio.parar();
});

test("detecta salto do relógio do sistema e ressincroniza", async () => {
  const amb = criarAmbiente();
  await amb.relogio.sincronizar({ amostras: 1 });
  const antes = amb.chamadas();
  // Relógio do sistema pula 1 h sem o monotônico avançar (ex.: ajuste manual).
  amb.relogio.localAgora = (() => {
    const base = amb.relogio.localAgora;
    return () => base() + 3_600_000;
  })();
  assert.equal(amb.relogio.verificarSalto(), true);
  await amb.relogio.emAndamento;
  assert.ok(amb.chamadas() > antes);
  amb.relogio.parar();
});
