// Peças compartilhadas pelo temporizador e pelo Pomodoro: disparo do fim da
// contagem, notificações, bloqueio de tela e escolha de som.

import "../i18n/index.js";
import { t } from "../i18n/estado.js";
import { BloqueioTela, SONS, estadoNotificacao, pedirPermissaoNotificacao, prepararAudio, tocarSom } from "../nucleo/alertas.js";
import { definirTexto, el } from "../nucleo/ui.js";

/**
 * Agenda a verificação do fim de uma ContagemRegressiva.
 *
 * Em abas em segundo plano, o Chrome limita timers encadeados (cada um criado
 * por outro timer) a uma execução por minuto depois de alguns minutos. Por
 * isso o fim é agendado com UM setTimeout criado a partir da ação do usuário
 * (iniciar, continuar) ou do carregamento — e não pelo laço de animação.
 * Quando a aba volta a ficar visível, conferimos de novo.
 */
export function criarDisparo(contagem, aoTerminar) {
  let id = null;

  const conferir = () => {
    if (contagem.verificar()) {
      cancelar();
      aoTerminar();
      return;
    }
    if (contagem.rodando) agendar();
  };

  function agendar() {
    clearTimeout(id);
    id = null;
    if (!contagem.rodando) return;
    id = setTimeout(conferir, contagem.restante() + 15);
  }

  function cancelar() {
    clearTimeout(id);
    id = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && contagem.rodando) conferir();
  });

  return { agendar, cancelar, conferir };
}

/** Liga o texto de estado e o botão "Ativar notificações". */
export function ligarNotificacoes(elEstado, botao) {
  const atualizar = () => {
    const estado = estadoNotificacao();
    definirTexto(elEstado, t(`avisos.notificacao.${estado}`));
    botao.hidden = estado !== "default";
  };
  botao.addEventListener("click", async () => {
    botao.setAttribute("aria-busy", "true");
    await pedirPermissaoNotificacao();
    botao.removeAttribute("aria-busy");
    atualizar();
  });
  atualizar();
}

/**
 * Checkbox "manter a tela ligada": o bloqueio só fica ativo enquanto a
 * contagem roda e o usuário marcou a opção.
 */
export function ligarBloqueioTela(checkbox, elEstado, aoMudarPreferencia) {
  const bloqueio = new BloqueioTela();
  let rodando = false;

  if (!BloqueioTela.disponivel()) {
    checkbox.checked = false;
    checkbox.disabled = true;
    definirTexto(elEstado, t("avisos.tela.naoSuportado"));
    return { sincronizar() {} };
  }

  const descrever = () => {
    if (!checkbox.checked) definirTexto(elEstado, t("avisos.tela.enquantoConta"));
    else if (bloqueio.ativo) definirTexto(elEstado, t("avisos.tela.ativo"));
    else definirTexto(elEstado, t("avisos.tela.aoComecar"));
  };

  const sincronizar = (estaRodando = rodando) => {
    rodando = estaRodando;
    if (checkbox.checked && rodando) {
      if (!bloqueio.ativo) bloqueio.ativar().then(descrever);
    } else if (bloqueio.ativo || bloqueio.desejado) {
      bloqueio.desativar().then(descrever);
    }
    descrever();
  };

  bloqueio.addEventListener("mudanca", descrever);
  checkbox.addEventListener("change", () => {
    aoMudarPreferencia?.(checkbox.checked);
    sincronizar();
  });
  descrever();
  return { sincronizar };
}

/** Preenche o <select> de sons e liga o botão de teste. */
export function ligarSons(select, botaoTestar, obterVolume) {
  select.replaceChildren(...Object.keys(SONS).map((chave) => el("option", { value: chave }, t(`sons.${chave}`))));
  botaoTestar?.addEventListener("click", () => {
    prepararAudio();
    tocarSom(select.value, obterVolume());
  });
}
