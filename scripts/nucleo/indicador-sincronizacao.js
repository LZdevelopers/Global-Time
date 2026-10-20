// Selo de estado da sincronização, linha de detalhe e janela "Detalhes".
// Mostra latência e incerteza medidas, sem prometer precisão absoluta.

import { numero, t } from "../i18n/estado.js";
import { fusoPreferido } from "./fuso-preferido.js";
import { ESTADOS } from "./sincronizacao.js";
import { formatarDiferencaCurta, formatarHora, partesNoFuso } from "./tempo.js";
import { anunciar, criarDialogo, el } from "./ui.js";

// Chave do texto e classe visual de cada estado.
const SELOS = {
  [ESTADOS.SINCRONIZANDO]: { chave: "sync.sincronizando", classe: "selo--acento selo--pulsando" },
  [ESTADOS.SINCRONIZADO]: { chave: "sync.sincronizado", classe: "selo--sucesso" },
  [ESTADOS.LIMITADO]: { chave: "sync.limitado", classe: "selo--alerta" },
  [ESTADOS.LOCAL]: { chave: "sync.local", classe: "selo--alerta" },
  [ESTADOS.OFFLINE]: { chave: "sync.offline", classe: "selo--perigo" },
};

function ms(valor) {
  return t("tempo.unidade.ms", { n: numero(Math.round(valor)) });
}

/** Frase curta sobre o relógio do aparelho. */
export function resumoDiferenca(estado) {
  if (estado.diferencaLocalMs == null) return null;
  const diferenca = estado.diferencaLocalMs;
  // Abaixo de 0,1 s (ou dentro da incerteza) a diferença é imperceptível e
  // não distinguível do ruído da medição.
  const margem = Math.max(estado.incertezaMs ?? 0, 100);
  if (Math.abs(diferenca) <= margem) return t("sync.aparelhoEmDia");
  // diferenca > 0: o servidor está à frente, logo o aparelho está atrasado.
  const valor = formatarDiferencaCurta(Math.abs(diferenca)).replace(/^\+/, "");
  return t(diferenca > 0 ? "sync.aparelhoAtrasado" : "sync.aparelhoAdiantado", { valor });
}

export function textoSelo(estado) {
  if (estado.status === ESTADOS.OFFLINE && estado.fonte !== "local") {
    return { texto: t("sync.offlineUltima"), classe: "selo--alerta" };
  }
  const selo = SELOS[estado.status] ?? SELOS[ESTADOS.LOCAL];
  return { texto: t(selo.chave), classe: selo.classe };
}

export function textoDetalhe(estado) {
  switch (estado.status) {
    case ESTADOS.SINCRONIZANDO:
      return t("sync.detalhe.sincronizando");
    case ESTADOS.SINCRONIZADO:
      return `${resumoDiferenca(estado)} ${t("sync.detalhe.medida", { latencia: ms(estado.latenciaMs), incerteza: ms(estado.incertezaMs) })}`;
    case ESTADOS.LIMITADO:
      return t("sync.detalhe.limitado", { incerteza: ms(estado.incertezaMs) });
    case ESTADOS.OFFLINE:
      return t(estado.fonte !== "local" ? "sync.detalhe.offlineCorrigido" : "sync.detalhe.offlineLocal");
    default:
      return t("sync.detalhe.falhou");
  }
}

/**
 * Liga um selo (<span class="selo">), uma linha de detalhe opcional e um botão
 * de detalhes opcional ao relógio sincronizado.
 */
export function ligarIndicador(relogio, { selo, detalhe, botaoDetalhes } = {}) {
  let statusAnterior = null;

  const atualizar = (estado) => {
    if (selo) {
      const { texto, classe } = textoSelo(estado);
      selo.className = `selo ${classe}`;
      selo.textContent = texto;
    }
    // A linha de detalhe só aparece quando há algo a resolver; os números da
    // medição ficam na janela "Precisão do relógio".
    if (detalhe) {
      detalhe.textContent = textoDetalhe(estado);
      detalhe.hidden = estado.status === ESTADOS.SINCRONIZADO || estado.status === ESTADOS.SINCRONIZANDO;
    }
    // Anuncia só mudanças de estado relevantes, nunca a cada segundo.
    if (statusAnterior && statusAnterior !== estado.status && estado.status !== ESTADOS.SINCRONIZANDO) {
      anunciar(t("sync.anuncio", { estado: textoSelo(estado).texto }));
    }
    statusAnterior = estado.status;
  };

  relogio.addEventListener("estado", (evento) => atualizar(evento.detail));
  atualizar(relogio.estado);

  botaoDetalhes?.addEventListener("click", () => abrirDetalhes(relogio));
}

export function abrirDetalhes(relogio) {
  const lista = el("dl", { class: "lista-dados" });
  const botaoSincronizar = el("button", { type: "button", class: "botao botao--primario" }, t("sync.sincronizarAgora"));
  const fontes = { servidor: t("sync.fonte.servidor"), cabecalho: t("sync.fonte.cabecalho"), local: t("sync.fonte.local") };

  const preencher = () => {
    const e = relogio.estado;
    const { fuso, nome } = fusoPreferido();
    const diferenca =
      e.diferencaLocalMs == null
        ? "—"
        : e.diferencaLocalMs === 0
          ? t("sync.nenhuma")
          : t(e.diferencaLocalMs > 0 ? "sync.atrasadoValor" : "sync.adiantadoValor", {
              valor: formatarDiferencaCurta(Math.abs(e.diferencaLocalMs)).slice(1),
            });
    const linhas = [
      [t("sync.campo.estado"), textoSelo(e).texto],
      [t("sync.campo.fonte"), fontes[e.fonte] ?? e.fonte],
      [t("sync.campo.ultima"), e.ultimaSincronizacao ? `${formatarHora(partesNoFuso(e.ultimaSincronizacao, fuso))} (${nome})` : "—"],
      [t("sync.campo.medicoes"), e.amostras ? String(e.amostras) : "—"],
      [t("sync.campo.latencia"), e.latenciaMs != null ? ms(e.latenciaMs) : "—"],
      [t("sync.campo.incerteza"), e.incertezaMs != null ? `±${ms(e.incertezaMs)}` : "—"],
      [t("sync.campo.diferenca"), diferenca],
    ];
    lista.replaceChildren(...linhas.map(([dt, dd]) => el("div", {}, el("dt", {}, dt), el("dd", {}, dd))));
    botaoSincronizar.removeAttribute("aria-busy");
  };

  const dialogo = criarDialogo({
    titulo: t("sync.tituloDialogo"),
    conteudo: [
      lista,
      el(
        "p",
        { class: "texto-xs texto-fraco dica-rodape-atalhos" },
        `${t("sync.explicacao")} `,
        el("a", { href: "/docs#sincronizacao" }, t("sync.entenda")),
      ),
    ],
    acoes: [botaoSincronizar],
  });

  const aoMudar = () => preencher();
  relogio.addEventListener("estado", aoMudar);
  botaoSincronizar.addEventListener("click", () => {
    botaoSincronizar.setAttribute("aria-busy", "true");
    relogio.sincronizar({ amostras: 5, forcar: true }).finally(preencher);
  });
  dialogo.addEventListener("close", () => {
    relogio.removeEventListener("estado", aoMudar);
    dialogo.remove();
  });
  preencher();
  dialogo.showModal();
}
