import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONFIG_PADRAO,
  duracaoDaFase,
  normalizarConfig,
  posicaoNoCiclo,
  proximaFase,
  resumoDoPeriodo,
} from "../scripts/nucleo/pomodoro.js";

test("sequência foco → pausa curta → ... → pausa longa", () => {
  const ciclos = 4;
  let fase = "foco";
  let focos = 0;
  const sequencia = [];
  for (let i = 0; i < 9; i += 1) {
    if (fase === "foco") focos += 1;
    fase = proximaFase(fase, focos, ciclos);
    sequencia.push(fase);
  }
  assert.deepEqual(sequencia, ["curta", "foco", "curta", "foco", "curta", "foco", "longa", "foco", "curta"]);
});

test("posição no ciclo", () => {
  assert.equal(posicaoNoCiclo("foco", 0, 4), 1);
  assert.equal(posicaoNoCiclo("curta", 1, 4), 1);
  assert.equal(posicaoNoCiclo("foco", 3, 4), 4);
  assert.equal(posicaoNoCiclo("longa", 4, 4), 4);
  assert.equal(posicaoNoCiclo("foco", 4, 4), 1);
});

test("ajustes são limitados e têm padrão", () => {
  assert.deepEqual(normalizarConfig({}), { ...CONFIG_PADRAO });
  const c = normalizarConfig({ foco: "500", curta: -3, longa: "abc", ciclos: 1, autoPausa: 1 });
  assert.equal(c.foco, 180);
  assert.equal(c.curta, 1);
  assert.equal(c.longa, 15);
  assert.equal(c.ciclos, 2);
  assert.equal(c.autoPausa, true);
  assert.equal(duracaoDaFase("curta", c), 60_000);
});

test("resumo do período conta só etapas dentro do intervalo", () => {
  const historico = [
    { fase: "foco", duracaoMs: 1500_000, fimEpoch: 100 },
    { fase: "curta", duracaoMs: 300_000, fimEpoch: 200 },
    { fase: "foco", duracaoMs: 1500_000, fimEpoch: 1000 },
  ];
  assert.deepEqual(resumoDoPeriodo(historico, 0, 500), { focos: 1, focoMs: 1500_000, pausas: 1 });
});
