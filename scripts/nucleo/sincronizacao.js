// Sincronização do relógio do navegador com o horário do servidor.
//
// Como funciona (detalhes em /docs#sincronizacao):
//  1. Para cada medição anotamos performance.now() no envio (p0) e no
//     recebimento (p1) de GET /api/hora, que devolve o timestamp do servidor.
//  2. Supomos que o servidor leu o relógio no meio da viagem: no instante p1
//     a hora do servidor é aproximadamente  servidor + (p1 − p0) / 2.
//  3. Das 3–5 medições iniciais, usamos a de menor latência (RTT): é a que
//     menos sofre com filas e atrasos assimétricos da rede.
//  4. A partir daí a hora exibida avança com performance.now(), que é
//     monotônico e não muda se alguém ajustar o relógio do sistema.
//  5. A incerteza informada é a metade do RTT da medição escolhida: é o
//     limite do erro *causado pela rede* na hipótese de que o servidor está
//     certo. Não é garantia de precisão absoluta — o servidor da Vercel não é
//     um relógio atômico, ele mesmo é sincronizado via NTP.
//
// Hierarquia de fontes:
//  "servidor"  → /api/hora (resolução de milissegundos)
//  "cabecalho" → cabeçalho HTTP Date de um arquivo estático (resolução de
//                1 segundo, sujeito a proxies) — usado só se a API falhar
//  "local"     → relógio do próprio aparelho, sem correção.
//
// O módulo não toca no DOM. Dependências (fetch, relógios) são injetáveis
// para os testes.

export const ESTADOS = Object.freeze({
  SINCRONIZANDO: "sincronizando",
  SINCRONIZADO: "sincronizado",
  LIMITADO: "limitado",
  LOCAL: "local",
  OFFLINE: "offline",
});

const PADROES = {
  urlApi: "/api/hora",
  urlCabecalho: "/robots.txt",
  amostrasIniciais: 5,
  amostrasPeriodicas: 3,
  intervaloRessincronizacaoMs: 10 * 60 * 1000,
  intervaloRetentativaMs: 60 * 1000,
  tempoLimiteMs: 5000,
  saltoMaximoMs: 2000,
  intervaloVerificacaoMs: 5000,
};

// Timestamps fora desta janela indicam resposta inválida (ex.: proxy quebrado).
const TIMESTAMP_MINIMO = Date.UTC(2020, 0, 1);
const TIMESTAMP_MAXIMO = Date.UTC(2200, 0, 1);

export function timestampPlausivel(valor) {
  return Number.isFinite(valor) && valor > TIMESTAMP_MINIMO && valor < TIMESTAMP_MAXIMO;
}

/**
 * Transforma uma medição bruta em uma âncora de tempo.
 * `servidorMs` é o valor lido no servidor; `resolucaoMs` é a granularidade
 * desse valor (1 para a API, 1000 para o cabeçalho Date, que é truncado).
 */
export function calcularAmostra({ p0, p1, local1, servidorMs, resolucaoMs = 1 }) {
  const rtt = Math.max(0, p1 - p0);
  // O cabeçalho Date trunca para o segundo: a hora real está em
  // [valor, valor + 1000). Usamos o meio do intervalo como estimativa.
  const centroResolucao = resolucaoMs > 1 ? resolucaoMs / 2 : 0;
  const servidorEmP1 = servidorMs + centroResolucao + rtt / 2;
  return {
    rtt,
    ancoraPerf: p1,
    ancoraEpoch: servidorEmP1,
    // Positivo = o relógio do aparelho está atrasado.
    diferencaLocalMs: servidorEmP1 - local1,
    incertezaMs: rtt / 2 + centroResolucao,
  };
}

/** Escolhe a amostra de menor latência (empate: a mais recente). */
export function escolherMelhorAmostra(amostras) {
  let melhor = null;
  for (const amostra of amostras) {
    if (!melhor || amostra.rtt <= melhor.rtt) melhor = amostra;
  }
  return melhor;
}

export function lerCabecalhoDate(valor) {
  if (!valor) return Number.NaN;
  const ms = Date.parse(valor);
  return timestampPlausivel(ms) ? ms : Number.NaN;
}

export class RelogioSincronizado extends EventTarget {
  constructor(opcoes = {}) {
    super();
    this.opcoes = { ...PADROES, ...opcoes };
    this.fetch = opcoes.fetch ?? globalThis.fetch?.bind(globalThis);
    this.perfAgora = opcoes.perfAgora ?? (() => performance.now());
    this.localAgora = opcoes.localAgora ?? (() => Date.now());
    this.estaOnline = opcoes.estaOnline ?? (() => globalThis.navigator?.onLine ?? true);

    this.ancora = null;
    this.estado = {
      status: ESTADOS.SINCRONIZANDO,
      fonte: "local",
      latenciaMs: null,
      incertezaMs: null,
      diferencaLocalMs: null,
      ultimaSincronizacao: null,
      amostras: 0,
      erro: null,
    };

    this.sequencia = 0;
    this.sequenciaAplicada = 0;
    this.emAndamento = null;
    this.idRessincronizacao = null;
    this.idVerificacao = null;
    this.referenciaSalto = null;
  }

  /** Hora atual em milissegundos Unix, pela melhor fonte disponível. */
  agora() {
    if (!this.ancora) return this.localAgora();
    return this.ancora.epoch + (this.perfAgora() - this.ancora.perf);
  }

  iniciar() {
    this.sincronizar({ amostras: this.opcoes.amostrasIniciais });
    this.agendarVerificacaoDeSalto();
    return this;
  }

  parar() {
    clearTimeout(this.idRessincronizacao);
    clearInterval(this.idVerificacao);
    this.idRessincronizacao = null;
    this.idVerificacao = null;
  }

  /**
   * Executa uma rodada de medições. Rodadas simultâneas são reaproveitadas, e
   * uma rodada antiga que termine depois de uma mais nova é descartada.
   */
  sincronizar({ amostras = this.opcoes.amostrasPeriodicas, forcar = false } = {}) {
    if (this.emAndamento && !forcar) return this.emAndamento;

    const minhaSequencia = ++this.sequencia;
    // Ressincronizações de rotina não mudam o selo, para não piscar a cada 10 min.
    if (!this.ancora || forcar) this.atualizarEstado({ status: ESTADOS.SINCRONIZANDO });

    const rodada = this.executarRodada(minhaSequencia, amostras).finally(() => {
      if (this.emAndamento === rodada) this.emAndamento = null;
    });
    this.emAndamento = rodada;
    return rodada;
  }

  async executarRodada(minhaSequencia, quantidade) {
    const amostras = [];
    let ultimoErro = null;

    for (let i = 0; i < quantidade; i += 1) {
      try {
        amostras.push(await this.medirApi());
      } catch (erro) {
        ultimoErro = erro;
        // Se a primeira já falhou por rede, não insistimos nas demais.
        if (amostras.length === 0) break;
      }
    }

    if (minhaSequencia < this.sequenciaAplicada) return this.estado;

    if (amostras.length > 0) {
      this.aplicar(minhaSequencia, escolherMelhorAmostra(amostras), "servidor", amostras.length);
      this.agendarRessincronizacao(this.opcoes.intervaloRessincronizacaoMs);
      return this.estado;
    }

    // Fonte alternativa: cabeçalho Date.
    try {
      const amostra = await this.medirCabecalho();
      if (minhaSequencia < this.sequenciaAplicada) return this.estado;
      this.aplicar(minhaSequencia, amostra, "cabecalho", 1, ultimoErro);
      this.agendarRessincronizacao(this.opcoes.intervaloRetentativaMs);
      return this.estado;
    } catch (erro) {
      ultimoErro = erro;
    }

    if (minhaSequencia < this.sequenciaAplicada) return this.estado;
    this.sequenciaAplicada = minhaSequencia;

    // Sem nenhuma fonte: mantém a âncora anterior se existir (o relógio continua
    // corrigido pela última sincronização) e avisa o estado.
    const offline = !this.estaOnline();
    this.atualizarEstado({
      status: offline ? ESTADOS.OFFLINE : this.ancora ? this.estado.status : ESTADOS.LOCAL,
      erro: mensagemErro(ultimoErro, offline),
      ...(this.ancora ? {} : { fonte: "local", diferencaLocalMs: null, incertezaMs: null, latenciaMs: null }),
    });
    this.agendarRessincronizacao(this.opcoes.intervaloRetentativaMs);
    return this.estado;
  }

  aplicar(sequencia, amostra, fonte, quantidade, erro = null) {
    this.sequenciaAplicada = sequencia;
    this.ancora = { perf: amostra.ancoraPerf, epoch: amostra.ancoraEpoch };
    this.referenciaSalto = { perf: this.perfAgora(), local: this.localAgora() };
    this.atualizarEstado({
      status: fonte === "servidor" ? ESTADOS.SINCRONIZADO : ESTADOS.LIMITADO,
      fonte,
      latenciaMs: amostra.rtt,
      incertezaMs: amostra.incertezaMs,
      diferencaLocalMs: amostra.diferencaLocalMs,
      ultimaSincronizacao: this.agora(),
      amostras: quantidade,
      erro: erro ? mensagemErro(erro, false) : null,
    });
  }

  async medirApi() {
    const url = `${this.opcoes.urlApi}?t=${Math.random().toString(36).slice(2)}`;
    const p0 = this.perfAgora();
    const resposta = await this.buscar(url, { method: "GET" });
    const p1 = this.perfAgora();
    const local1 = this.localAgora();

    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const corpo = await resposta.json();
    const servidorMs = Number(corpo?.timestamp);
    if (!timestampPlausivel(servidorMs)) throw new Error("Resposta inválida");

    return calcularAmostra({ p0, p1, local1, servidorMs, resolucaoMs: 1 });
  }

  async medirCabecalho() {
    const p0 = this.perfAgora();
    const resposta = await this.buscar(this.opcoes.urlCabecalho, { method: "HEAD" });
    const p1 = this.perfAgora();
    const local1 = this.localAgora();
    const servidorMs = lerCabecalhoDate(resposta.headers.get("date"));
    if (!Number.isFinite(servidorMs)) throw new Error("Cabeçalho Date ausente");
    return calcularAmostra({ p0, p1, local1, servidorMs, resolucaoMs: 1000 });
  }

  async buscar(url, init) {
    if (!this.fetch) throw new Error("fetch indisponível");
    const controlador = typeof AbortController === "function" ? new AbortController() : null;
    const limite = setTimeout(() => controlador?.abort(), this.opcoes.tempoLimiteMs);
    try {
      return await this.fetch(url, {
        ...init,
        cache: "no-store",
        credentials: "omit",
        signal: controlador?.signal,
      });
    } finally {
      clearTimeout(limite);
    }
  }

  agendarRessincronizacao(ms) {
    clearTimeout(this.idRessincronizacao);
    this.idRessincronizacao = setTimeout(() => this.sincronizar(), ms);
  }

  /**
   * performance.now() pode parar enquanto o computador está suspenso, e o
   * relógio do sistema pode ser ajustado. Comparamos os dois periodicamente:
   * se divergirem além do limite, a âncora não é mais confiável.
   */
  agendarVerificacaoDeSalto() {
    clearInterval(this.idVerificacao);
    this.idVerificacao = setInterval(() => this.verificarSalto(), this.opcoes.intervaloVerificacaoMs);
  }

  verificarSalto() {
    if (!this.referenciaSalto) return false;
    const decorridoPerf = this.perfAgora() - this.referenciaSalto.perf;
    const decorridoLocal = this.localAgora() - this.referenciaSalto.local;
    this.referenciaSalto = { perf: this.perfAgora(), local: this.localAgora() };
    if (Math.abs(decorridoLocal - decorridoPerf) > this.opcoes.saltoMaximoMs) {
      this.sincronizar({ amostras: this.opcoes.amostrasPeriodicas, forcar: true });
      return true;
    }
    return false;
  }

  /** Chamado quando a aba volta a ficar visível ou a rede volta. */
  aoRetomar() {
    const ultima = this.estado.ultimaSincronizacao;
    const desatualizado = !ultima || this.agora() - ultima > 60 * 1000;
    this.verificarSalto();
    if (desatualizado || this.estado.status !== ESTADOS.SINCRONIZADO) {
      this.sincronizar({ amostras: this.opcoes.amostrasPeriodicas });
    }
  }

  atualizarEstado(parcial) {
    this.estado = { ...this.estado, ...parcial };
    this.dispatchEvent(new CustomEvent("estado", { detail: this.estado }));
  }
}

function mensagemErro(erro, offline) {
  if (offline) return "Sem conexão com a internet.";
  if (!erro) return null;
  if (erro.name === "AbortError") return "O servidor demorou para responder.";
  return "Não foi possível consultar o servidor de horário.";
}

// Instância compartilhada pela página (criada sob demanda).
let instancia = null;

export function obterRelogio() {
  if (!instancia) {
    instancia = new RelogioSincronizado().iniciar();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") instancia.aoRetomar();
    });
    window.addEventListener("online", () => instancia.aoRetomar());
    window.addEventListener("offline", () =>
      instancia.atualizarEstado({ status: ESTADOS.OFFLINE, erro: mensagemErro(null, true) }),
    );
    window.addEventListener("pageshow", (evento) => {
      if (evento.persisted) instancia.aoRetomar();
    });
  }
  return instancia;
}
