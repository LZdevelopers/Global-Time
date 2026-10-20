// Regras do Pomodoro (sem DOM). A contagem em si é a ContagemRegressiva de
// medidores.js; aqui ficam só a sequência de etapas, os ajustes e o resumo
// do histórico. Testado em testes/pomodoro.test.mjs.

import { t } from "../i18n/estado.js";
import { MS_MINUTO } from "./tempo.js";

// Etapas do ciclo → chave de tradução do nome.
export const FASES = Object.freeze({
  foco: "pomodoro.fase.foco",
  curta: "pomodoro.fase.curta",
  longa: "pomodoro.fase.longa",
});

/** Nome da etapa no idioma da interface: "Foco", "Pausa curta"… */
export function nomeFase(fase) {
  return t(FASES[fase] ?? FASES.foco);
}

export const CONFIG_PADRAO = Object.freeze({
  foco: 25,
  curta: 5,
  longa: 15,
  ciclos: 4,
  autoPausa: false,
  autoFoco: false,
  som: "sino",
  telaAtiva: false,
});

const LIMITES = { foco: [1, 180], curta: [1, 60], longa: [1, 120], ciclos: [2, 12] };

/** Ajustes válidos a partir de dados salvos ou digitados. */
export function normalizarConfig(dados = {}) {
  const config = { ...CONFIG_PADRAO };
  for (const [chave, [min, max]] of Object.entries(LIMITES)) {
    const n = Math.round(Number(dados[chave]));
    config[chave] = Number.isFinite(n) ? Math.min(Math.max(n, min), max) : CONFIG_PADRAO[chave];
  }
  config.autoPausa = Boolean(dados.autoPausa);
  config.autoFoco = Boolean(dados.autoFoco);
  if (typeof dados.som === "string") config.som = dados.som;
  config.telaAtiva = Boolean(dados.telaAtiva);
  return config;
}

export function duracaoDaFase(fase, config) {
  return (config[fase] ?? config.foco) * MS_MINUTO;
}

/**
 * Próxima etapa depois de concluir `fase`. `focosConcluidos` já inclui o foco
 * que acabou de terminar. A cada `ciclos` focos vem a pausa longa.
 */
export function proximaFase(fase, focosConcluidos, ciclos) {
  if (fase !== "foco") return "foco";
  return focosConcluidos > 0 && focosConcluidos % ciclos === 0 ? "longa" : "curta";
}

/** Posição (1..ciclos) do foco atual ou do foco que antecedeu a pausa. */
export function posicaoNoCiclo(fase, focosConcluidos, ciclos) {
  if (fase === "foco") return (focosConcluidos % ciclos) + 1;
  return focosConcluidos === 0 ? 1 : ((focosConcluidos - 1) % ciclos) + 1;
}

/** Totais das etapas concluídas entre [inicio, fim) (instantes em ms). */
export function resumoDoPeriodo(historico, inicio, fim) {
  const resumo = { focos: 0, focoMs: 0, pausas: 0 };
  for (const item of historico) {
    if (!(item.fimEpoch >= inicio && item.fimEpoch < fim)) continue;
    if (item.fase === "foco") {
      resumo.focos += 1;
      resumo.focoMs += item.duracaoMs;
    } else {
      resumo.pausas += 1;
    }
  }
  return resumo;
}
