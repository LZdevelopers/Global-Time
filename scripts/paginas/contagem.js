// Contagem regressiva para datas, com link compartilhável e lista salva.
// O link só aceita parâmetros validados; o título vai para a tela via
// textContent (nunca como HTML).

import "../i18n/index.js";
import { t } from "../i18n/estado.js";
import { cidadePreferida, fusoPreferido } from "../nucleo/fuso-preferido.js";
import { gravar, ler } from "../nucleo/armazenamento.js";
import {
  configuracaoPreset,
  decompor,
  formatarCompacto,
  instanteAlvo,
  lerParametrosContagem,
  montarParametros,
  validarListaSalva,
  LIMITE_TITULO,
} from "../nucleo/contagem-datas.js";
import { limparTexto } from "../nucleo/alarmes.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import {
  FUSO_BRASILIA,
  capitalizar,
  dataIso,
  doisDigitos,
  formatarDataCurta,
  formatarDataExtenso,
  formatarDuracaoExtenso,
  formatarHora,
  lerDataIso,
  partesNoFuso,
} from "../nucleo/tempo.js";
import { CIDADES, nomeCidade, opcoesCidades } from "../dados/cidades.js";
import {
  $,
  $$,
  agendarPorSegundo,
  anunciar,
  avisar,
  copiarTexto,
  criarTitulo,
  definirTexto,
  el,
  icone,
  preencherSelect,
} from "../nucleo/ui.js";

const CHAVE_LISTA = "contagem:lista";
const rolagem = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const relogio = obterRelogio();
const definirTitulo = criarTitulo();

const campoTitulo = $("#campoTitulo");
const campoData = $("#campoData");
const campoHora = $("#campoHora");
const campoFuso = $("#campoFuso");

let config = null;
let alvo = Number.NaN;
let jaChegou = false;

// ---- Fuso: o select lista cidades; a configuração guarda o fuso IANA ----------
// Padrão: a cidade do fuso preferido (o do aparelho ou o escolhido no início).
const cidadePadrao = cidadePreferida() ?? CIDADES.find((c) => c.id === "brasilia");
preencherSelect(campoFuso, opcoesCidades(), cidadePadrao.id);

function cidadeDoFuso(fuso) {
  return CIDADES.find((c) => c.fuso === fuso) ?? null;
}

function selecionarFuso(fuso) {
  const cidade = cidadeDoFuso(fuso);
  if (cidade) {
    campoFuso.value = cidade.id;
    return;
  }
  // Fuso válido que não está na lista de cidades (veio por link).
  let opcao = [...campoFuso.options].find((o) => o.value === `fuso:${fuso}`);
  if (!opcao) {
    opcao = el("option", { value: `fuso:${fuso}` }, fuso);
    campoFuso.prepend(opcao);
  }
  campoFuso.value = opcao.value;
}

function fusoSelecionado() {
  const valor = campoFuso.value;
  if (valor.startsWith("fuso:")) return valor.slice(5);
  return CIDADES.find((c) => c.id === valor)?.fuso ?? FUSO_BRASILIA;
}

function nomeLocal(fuso) {
  const cidade = cidadeDoFuso(fuso);
  return cidade ? nomeCidade(cidade) : fuso;
}

// ---- Aplicar configuração -------------------------------------------------------
function aplicar(nova, { atualizarUrl = true } = {}) {
  const instante = instanteAlvo(nova);
  if (!Number.isFinite(instante)) return false;
  config = nova;
  alvo = instante;
  jaChegou = alvo <= relogio.agora();

  campoTitulo.value = config.titulo;
  campoData.value = config.data;
  campoHora.value = config.hora;
  selecionarFuso(config.fuso);

  definirTexto($("#tituloContagem"), config.titulo || t("paginas.contagem.rotulo"));
  const d = lerDataIso(config.data);
  let texto = t("contagem.alvo", { data: capitalizar(formatarDataExtenso(d)), hora: config.hora, lugar: nomeLocal(config.fuso) });
  // O mesmo instante no fuso preferido do usuário, quando o horário é outro.
  const preferido = fusoPreferido();
  const noAlvo = partesNoFuso(alvo, config.fuso);
  const local = partesNoFuso(alvo, preferido.fuso);
  if (formatarHora(noAlvo, false) !== formatarHora(local, false) || noAlvo.dia !== local.dia) {
    texto += ` ${t("contagem.alvoNoSeuFuso", { hora: formatarHora(local, false), data: formatarDataCurta(local), lugar: preferido.nome })}`;
  }
  definirTexto($("#alvoContagem"), texto);

  if (atualizarUrl) history.replaceState(null, "", `${location.pathname}?${montarParametros(config)}`);
  atualizar(relogio.agora());
  return true;
}

function atualizar(agora) {
  if (!config) return;
  const diferenca = alvo - agora;
  const passou = diferenca <= 0;
  const partes = decompor(diferenca);
  definirTexto($("#blocoDias"), String(partes.dias));
  definirTexto($("#blocoHoras"), doisDigitos(partes.horas));
  definirTexto($("#blocoMinutos"), doisDigitos(partes.minutos));
  definirTexto($("#blocoSegundos"), doisDigitos(partes.segundos));
  $("#painelContagem").classList.toggle("contagem-passada", passou);

  if (passou) {
    definirTexto(
      $("#estadoContagem"),
      Math.abs(diferenca) < 1000 ? t("contagem.chegou") : t("contagem.passouHa", { duracao: formatarDuracaoExtenso(-diferenca) }),
    );
    definirTitulo(t("contagem.tituloPassou", { titulo: config.titulo || t("paginas.contagem.rotulo") }));
    if (!jaChegou) {
      jaChegou = true;
      anunciar(t("contagem.anuncioChegou", { titulo: config.titulo || t("paginas.contagem.rotulo") }), "assertive");
    }
  } else {
    definirTexto($("#estadoContagem"), t("contagem.faltam", { duracao: formatarDuracaoExtenso(diferenca) }));
    definirTitulo(formatarCompacto(diferenca));
  }
}

// ---- Formulário e presets ---------------------------------------------------------
$("#formContagem").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const nova = {
    titulo: limparTexto(campoTitulo.value, LIMITE_TITULO),
    data: campoData.value,
    hora: campoHora.value || "00:00",
    fuso: fusoSelecionado(),
  };
  const ok = aplicar(nova);
  const erro = $("#erroForm");
  erro.hidden = ok;
  erro.textContent = ok ? "" : t("contagem.erroData");
  campoData.toggleAttribute("aria-invalid", !ok);
  if (ok) $("#painelContagem").scrollIntoView({ behavior: rolagem(), block: "start" });
});

for (const botao of $$("[data-preset]")) {
  botao.addEventListener("click", () => {
    const preset = configuracaoPreset(botao.dataset.preset, relogio.agora(), fusoSelecionado());
    if (preset) aplicar(preset);
  });
}

// ---- Compartilhar ----------------------------------------------------------------
$("#botaoCopiarLink").addEventListener("click", async () => {
  if (!config) return;
  const link = `${location.origin}${location.pathname}?${montarParametros(config)}`;
  avisar(t((await copiarTexto(link)) ? "contagem.linkCopiado" : "comum.naoCopiou"));
});

// ---- Lista salva -------------------------------------------------------------------
function lerLista() {
  return validarListaSalva(ler(CHAVE_LISTA, []));
}

function renderizarLista() {
  const lista = lerLista();
  $("#listaSalvas").replaceChildren(
    ...lista.map((item) => {
      const d = lerDataIso(item.data);
      return el(
        "li",
        {},
        el(
          "a",
          { href: `?${montarParametros(item)}` },
          item.titulo || t("contagem.semTitulo"),
          el("span", {}, t("contagem.itemSalvo", { data: formatarDataCurta(d), hora: item.hora, lugar: nomeLocal(item.fuso) })),
        ),
        el(
          "button",
          {
            type: "button",
            class: "botao botao--fantasma botao--icone botao--mini",
            "aria-label": t("contagem.remover", { titulo: item.titulo || t("paginas.contagem.rotulo") }),
            title: t("comum.remover"),
            onclick: () => {
              gravar(CHAVE_LISTA, lerLista().filter((i) => i.id !== item.id));
              renderizarLista();
            },
          },
          icone("lixeira", "icone--sm"),
        ),
      );
    }),
  );
  $("#semSalvas").hidden = lista.length > 0;
}

$("#listaSalvas").addEventListener("click", (evento) => {
  const link = evento.target.closest("a");
  if (!link) return;
  evento.preventDefault();
  const lida = lerParametrosContagem(new URL(link.href).searchParams);
  if (lida) {
    aplicar(lida);
    $("#painelContagem").scrollIntoView({ behavior: rolagem(), block: "start" });
  }
});

$("#botaoSalvar").addEventListener("click", () => {
  if (!config) return;
  const lista = lerLista();
  const igual = lista.find(
    (i) => i.titulo === config.titulo && i.data === config.data && i.hora === config.hora && i.fuso === config.fuso,
  );
  if (igual) {
    avisar(t("contagem.jaSalva"));
    return;
  }
  lista.push({ id: `c${Date.now().toString(36)}`, ...config });
  gravar(CHAVE_LISTA, lista);
  renderizarLista();
  avisar(t("contagem.salva"));
});

window.addEventListener("storage", (evento) => {
  if (evento.key === `bt:${CHAVE_LISTA}`) renderizarLista();
});

// ---- Início -------------------------------------------------------------------------
const doLink = lerParametrosContagem(new URLSearchParams(location.search));
if (!doLink || !aplicar(doLink, { atualizarUrl: false })) {
  if (location.search && new URLSearchParams(location.search).has("data")) {
    avisar(t("contagem.linkInvalido"));
  }
  aplicar(configuracaoPreset("natal", relogio.agora(), cidadePadrao.fuso), { atualizarUrl: false });
}
renderizarLista();

// Data padrão do formulário personalizado: hoje, se nada estiver preenchido.
if (!campoData.value) {
  const hoje = partesNoFuso(relogio.agora(), cidadePadrao.fuso);
  campoData.value = dataIso(hoje.ano, hoje.mes, hoje.dia);
}

agendarPorSegundo(atualizar, () => relogio.agora());
// A primeira sincronização pode corrigir o "agora"; recalcula na hora.
relogio.addEventListener("estado", () => atualizar(relogio.agora()));
