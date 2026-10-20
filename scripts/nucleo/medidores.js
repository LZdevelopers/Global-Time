// Máquinas de estado do cronômetro e da contagem regressiva.
//
// Durante a sessão, o tempo decorrido é medido com performance.now(), que é
// monotônico: ajustes no relógio do sistema não alteram a medição. Para
// sobreviver a uma recarga da página guardamos também o instante civil
// (Date.now()) em que a medição começou — performance.now() recomeça do zero
// a cada carregamento, então só o relógio civil permite continuar a contagem.
//
// Sem DOM: os relógios são injetáveis para testes.

const relogiosPadrao = {
  perfAgora: () => performance.now(),
  epochAgora: () => Date.now(),
};

export class Cronometro {
  constructor(relogios = {}) {
    this.relogios = { ...relogiosPadrao, ...relogios };
    this.status = "parado";
    this.acumuladoMs = 0;
    this.inicioPerf = null;
    this.inicioEpoch = null;
    this.voltas = [];
  }

  get rodando() {
    return this.status === "rodando";
  }

  decorrido() {
    if (!this.rodando) return this.acumuladoMs;
    return this.acumuladoMs + Math.max(0, this.relogios.perfAgora() - this.inicioPerf);
  }

  iniciar() {
    if (this.rodando) return;
    this.inicioPerf = this.relogios.perfAgora();
    this.inicioEpoch = this.relogios.epochAgora();
    this.status = "rodando";
  }

  pausar() {
    if (!this.rodando) return;
    this.acumuladoMs = this.decorrido();
    this.inicioPerf = null;
    this.inicioEpoch = null;
    this.status = "pausado";
  }

  alternar() {
    if (this.rodando) this.pausar();
    else this.iniciar();
  }

  zerar() {
    this.status = "parado";
    this.acumuladoMs = 0;
    this.inicioPerf = null;
    this.inicioEpoch = null;
    this.voltas = [];
  }

  /** Registra uma volta com o tempo total atual. Retorna o total ou null. */
  registrarVolta() {
    if (!this.rodando) return null;
    const total = this.decorrido();
    const anterior = this.voltas.at(-1) ?? 0;
    // Duas voltas no mesmo milissegundo não têm significado.
    if (total <= anterior) return null;
    this.voltas.push(total);
    return total;
  }

  /** Tempo da volta em andamento (desde a última volta registrada). */
  voltaAtual() {
    return this.decorrido() - (this.voltas.at(-1) ?? 0);
  }

  /**
   * Lista as voltas com duração, diferença para a volta anterior e marcação
   * da melhor e da pior (só quando há pelo menos duas voltas).
   */
  voltasDetalhadas() {
    return detalharVoltas(this.voltas);
  }

  serializar() {
    return {
      versao: 2,
      status: this.status,
      acumuladoMs: this.acumuladoMs,
      inicioEpoch: this.inicioEpoch,
      voltas: [...this.voltas],
    };
  }

  static restaurar(dados, relogios = {}) {
    const cronometro = new Cronometro(relogios);
    if (!dados || typeof dados !== "object") return cronometro;

    const acumulado = numeroNaoNegativo(dados.acumuladoMs);
    const voltas = Array.isArray(dados.voltas)
      ? dados.voltas.map(Number).filter((v) => Number.isFinite(v) && v > 0)
      : [];
    // Voltas precisam ser crescentes; descarta dados corrompidos.
    const voltasValidas = voltas.every((v, i) => i === 0 || v > voltas[i - 1]) ? voltas : [];

    cronometro.voltas = voltasValidas;
    cronometro.acumuladoMs = acumulado;

    if (dados.status === "rodando" && Number.isFinite(dados.inicioEpoch)) {
      // Tempo que passou enquanto a página estava fechada ou recarregando.
      // Se o relógio do sistema voltou no tempo, não descontamos nada.
      const fora = Math.max(0, cronometro.relogios.epochAgora() - dados.inicioEpoch);
      cronometro.acumuladoMs = acumulado + fora;
      cronometro.iniciar();
    } else if (acumulado > 0 || voltasValidas.length) {
      cronometro.status = "pausado";
    }
    return cronometro;
  }
}

export function detalharVoltas(totais) {
  const lista = totais.map((total, i) => {
    const voltaMs = total - (i === 0 ? 0 : totais[i - 1]);
    return { numero: i + 1, totalMs: total, voltaMs, diferencaMs: null, melhor: false, pior: false };
  });

  for (let i = 1; i < lista.length; i += 1) {
    lista[i].diferencaMs = lista[i].voltaMs - lista[i - 1].voltaMs;
  }

  if (lista.length >= 2) {
    const duracoes = lista.map((v) => v.voltaMs);
    const minimo = Math.min(...duracoes);
    const maximo = Math.max(...duracoes);
    if (minimo !== maximo) {
      lista.find((v) => v.voltaMs === minimo).melhor = true;
      lista.findLast((v) => v.voltaMs === maximo).pior = true;
    }
  }
  return lista;
}

export class ContagemRegressiva {
  constructor(duracaoMs = 0, relogios = {}) {
    this.relogios = { ...relogiosPadrao, ...relogios };
    this.duracaoMs = numeroNaoNegativo(duracaoMs);
    this.restanteMs = this.duracaoMs;
    this.status = this.duracaoMs > 0 ? "pronto" : "vazio";
    this.fimPerf = null;
    this.fimEpoch = null;
  }

  get rodando() {
    return this.status === "rodando";
  }

  restante() {
    if (!this.rodando) return this.restanteMs;
    return Math.max(0, this.fimPerf - this.relogios.perfAgora());
  }

  progresso() {
    if (this.duracaoMs <= 0) return 0;
    return Math.min(1, Math.max(0, 1 - this.restante() / this.duracaoMs));
  }

  definirDuracao(ms) {
    this.duracaoMs = numeroNaoNegativo(ms);
    this.restanteMs = this.duracaoMs;
    this.fimPerf = null;
    this.fimEpoch = null;
    this.status = this.duracaoMs > 0 ? "pronto" : "vazio";
  }

  iniciar() {
    if (this.rodando) return false;
    if (this.status === "concluido") this.restanteMs = this.duracaoMs;
    if (this.restanteMs <= 0) return false;
    this.fimPerf = this.relogios.perfAgora() + this.restanteMs;
    this.fimEpoch = this.relogios.epochAgora() + this.restanteMs;
    this.status = "rodando";
    return true;
  }

  pausar() {
    if (!this.rodando) return;
    this.restanteMs = this.restante();
    this.fimPerf = null;
    this.fimEpoch = null;
    this.status = this.restanteMs > 0 ? "pausado" : "concluido";
  }

  alternar() {
    if (this.rodando) this.pausar();
    else this.iniciar();
  }

  reiniciar() {
    this.restanteMs = this.duracaoMs;
    this.fimPerf = null;
    this.fimEpoch = null;
    this.status = this.duracaoMs > 0 ? "pronto" : "vazio";
  }

  /** Soma (ou subtrai) tempo à contagem atual. */
  ajustar(deltaMs) {
    if (this.rodando) {
      const novoRestante = Math.max(0, this.restante() + deltaMs);
      this.fimPerf = this.relogios.perfAgora() + novoRestante;
      this.fimEpoch = this.relogios.epochAgora() + novoRestante;
      this.duracaoMs = Math.max(this.duracaoMs + deltaMs, novoRestante);
    } else {
      this.restanteMs = Math.max(0, this.restanteMs + deltaMs);
      this.duracaoMs = Math.max(this.duracaoMs + deltaMs, this.restanteMs);
      if (this.status === "concluido" && this.restanteMs > 0) this.status = "pausado";
    }
  }

  /** Deve ser chamada a cada quadro; retorna true no instante em que termina. */
  verificar() {
    if (this.rodando && this.restante() <= 0) {
      this.status = "concluido";
      this.restanteMs = 0;
      this.fimPerf = null;
      this.fimEpoch = null;
      return true;
    }
    return false;
  }

  serializar() {
    return {
      versao: 2,
      status: this.status,
      duracaoMs: this.duracaoMs,
      restanteMs: this.rodando ? this.restante() : this.restanteMs,
      fimEpoch: this.fimEpoch,
    };
  }

  /**
   * Restaura o estado salvo. Se a contagem terminou enquanto a página estava
   * fechada, o resultado fica em `terminouEm` (instante civil do fim).
   */
  static restaurar(dados, relogios = {}) {
    const contagem = new ContagemRegressiva(0, relogios);
    if (!dados || typeof dados !== "object") return contagem;

    contagem.duracaoMs = numeroNaoNegativo(dados.duracaoMs);
    contagem.restanteMs = Math.min(numeroNaoNegativo(dados.restanteMs), contagem.duracaoMs);
    contagem.terminouEm = null;

    const statusValidos = ["vazio", "pronto", "pausado", "concluido"];
    if (dados.status === "rodando" && Number.isFinite(dados.fimEpoch)) {
      const restante = dados.fimEpoch - contagem.relogios.epochAgora();
      if (restante > 0) {
        contagem.restanteMs = Math.min(restante, contagem.duracaoMs || restante);
        contagem.status = "pausado";
        contagem.iniciar();
      } else {
        contagem.restanteMs = 0;
        contagem.status = "concluido";
        contagem.terminouEm = dados.fimEpoch;
      }
    } else if (statusValidos.includes(dados.status)) {
      contagem.status = dados.status;
    } else {
      contagem.status = contagem.duracaoMs > 0 ? "pronto" : "vazio";
    }

    if (contagem.duracaoMs <= 0 && contagem.status !== "concluido") contagem.status = "vazio";
    return contagem;
  }
}

function numeroNaoNegativo(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
