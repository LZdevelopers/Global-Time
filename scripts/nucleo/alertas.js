// Sons de alarme, notificações do sistema e bloqueio de tela (Wake Lock).
//
// Limitações da plataforma, tratadas aqui e explicadas na interface:
//  - Navegadores só liberam áudio depois de uma interação do usuário. Por isso
//    `prepararAudio()` deve ser chamada dentro de um clique (ex.: "Iniciar").
//  - Notificações exigem permissão, que só pedimos após um clique explícito.
//  - Wake Lock é liberado automaticamente quando a aba fica oculta; nós o
//    pedimos de novo quando ela volta a ficar visível.

export const SONS = Object.freeze({
  bipe: { nome: "Bipe", notas: [[880, 0, 0.16], [880, 0.24, 0.16], [880, 0.48, 0.16]], onda: "square", pausa: 0.9, volume: 0.09 },
  sino: { nome: "Sino", notas: [[1318.5, 0, 1.4], [987.8, 0.5, 1.6]], onda: "sine", pausa: 1.2, volume: 0.22 },
  digital: { nome: "Digital", notas: [[1046.5, 0, 0.08], [1046.5, 0.12, 0.08], [1046.5, 0.24, 0.08], [1046.5, 0.36, 0.08]], onda: "square", pausa: 0.6, volume: 0.08 },
  suave: { nome: "Suave", notas: [[523.25, 0, 0.5], [659.25, 0.35, 0.5], [783.99, 0.7, 0.9]], onda: "sine", pausa: 1.4, volume: 0.25 },
  urgente: { nome: "Urgente", notas: [[988, 0, 0.12], [740, 0.14, 0.12], [988, 0.28, 0.12], [740, 0.42, 0.12]], onda: "sawtooth", pausa: 0.25, volume: 0.07 },
});

let contexto = null;

/** Cria/retoma o AudioContext. Chame dentro de um gesto do usuário. */
export function prepararAudio() {
  const Classe = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Classe) return null;
  if (!contexto) contexto = new Classe();
  if (contexto.state === "suspended") contexto.resume().catch(() => {});
  return contexto;
}

export function audioDisponivel() {
  return Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);
}

/** Toca o padrão uma vez. Retorna a duração em segundos. */
export function tocarSom(chave = "bipe", volumeRelativo = 1) {
  const som = SONS[chave] ?? SONS.bipe;
  const ctx = prepararAudio();
  if (!ctx) return 0;

  const inicio = ctx.currentTime + 0.03;
  let fim = 0;
  for (const [frequencia, deslocamento, duracao] of som.notas) {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    const t0 = inicio + deslocamento;
    const pico = Math.max(0.0002, som.volume * volumeRelativo);
    osc.type = som.onda;
    osc.frequency.setValueAtTime(frequencia, t0);
    ganho.gain.setValueAtTime(0.0001, t0);
    ganho.gain.exponentialRampToValueAtTime(pico, t0 + 0.012);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duracao + 0.05);
    fim = Math.max(fim, deslocamento + duracao);
  }
  return fim;
}

/**
 * Alarme que toca em ciclos até ser parado (ou uma vez, se `repetir` for
 * falso). Para automaticamente após `limiteMs` para não tocar para sempre
 * numa aba esquecida.
 */
export class Alarme {
  constructor() {
    this.idCiclo = null;
    this.idLimite = null;
    this.tocando = false;
  }

  tocar({ som = "bipe", repetir = true, volume = 1, limiteMs = 5 * 60 * 1000 } = {}) {
    this.parar();
    this.tocando = true;
    const ciclo = () => {
      if (!this.tocando) return;
      const duracao = tocarSom(som, volume);
      if (!repetir) {
        this.idCiclo = setTimeout(() => this.parar(), (duracao + 0.2) * 1000);
        return;
      }
      const pausa = (SONS[som] ?? SONS.bipe).pausa;
      this.idCiclo = setTimeout(ciclo, (duracao + pausa) * 1000);
    };
    ciclo();
    this.idLimite = setTimeout(() => this.parar(), limiteMs);
    // Sem interação prévia o navegador bloqueia a vibração (e registra erro).
    if ("vibrate" in navigator && navigator.userActivation?.hasBeenActive !== false) {
      try {
        navigator.vibrate(repetir ? [400, 200, 400, 200, 400] : [300]);
      } catch {
        /* vibração indisponível */
      }
    }
  }

  parar() {
    this.tocando = false;
    clearTimeout(this.idCiclo);
    clearTimeout(this.idLimite);
    this.idCiclo = null;
    this.idLimite = null;
  }
}

// ---- Notificações -------------------------------------------------------

export function estadoNotificacao() {
  if (!("Notification" in globalThis)) return "indisponivel";
  return Notification.permission; // "default" | "granted" | "denied"
}

/** Pede permissão. Deve ser chamada a partir de um clique. */
export async function pedirPermissaoNotificacao() {
  if (!("Notification" in globalThis)) return "indisponivel";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Mostra uma notificação, preferindo o service worker (funciona em mais plataformas). */
export async function notificar(titulo, corpo, { tag = "globaltime" } = {}) {
  if (estadoNotificacao() !== "granted") return false;
  const opcoes = {
    body: corpo,
    tag,
    renotify: true,
    requireInteraction: true,
    icon: "/assets/icones/icone-192.png",
    badge: "/assets/icones/icone-96.png",
    lang: "pt-BR",
  };
  try {
    const registro = await navigator.serviceWorker?.getRegistration?.();
    if (registro) {
      await registro.showNotification(titulo, opcoes);
      return true;
    }
  } catch {
    /* tenta o construtor abaixo */
  }
  try {
    new Notification(titulo, opcoes);
    return true;
  } catch {
    return false;
  }
}

// ---- Wake Lock ----------------------------------------------------------

export class BloqueioTela extends EventTarget {
  constructor() {
    super();
    this.desejado = false;
    this.sentinela = null;
    this.aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible" && this.desejado && !this.sentinela) {
        this.adquirir();
      }
    };
    document.addEventListener("visibilitychange", this.aoMudarVisibilidade);
  }

  static disponivel() {
    return "wakeLock" in navigator;
  }

  get ativo() {
    return Boolean(this.sentinela);
  }

  async ativar() {
    this.desejado = true;
    return this.adquirir();
  }

  async adquirir() {
    if (!BloqueioTela.disponivel()) return false;
    try {
      this.sentinela = await navigator.wakeLock.request("screen");
      this.sentinela.addEventListener("release", () => {
        this.sentinela = null;
        this.emitir();
      });
      this.emitir();
      return true;
    } catch {
      this.sentinela = null;
      this.emitir();
      return false;
    }
  }

  async desativar() {
    this.desejado = false;
    const sentinela = this.sentinela;
    this.sentinela = null;
    try {
      await sentinela?.release();
    } catch {
      /* já liberado */
    }
    this.emitir();
  }

  emitir() {
    this.dispatchEvent(new CustomEvent("mudanca", { detail: { ativo: this.ativo, desejado: this.desejado } }));
  }
}
