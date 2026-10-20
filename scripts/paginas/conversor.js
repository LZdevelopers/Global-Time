// Conversor de fuso horário (com tratamento de horário de verão) e
// planejador de reuniões entre cidades.

import "../i18n/index.js";
import { t } from "../i18n/estado.js";
import { buscarCidade, nomeCidade, opcoesCidades } from "../dados/cidades.js";
import { cidadePreferida } from "../nucleo/fuso-preferido.js";
import { ler, gravar } from "../nucleo/armazenamento.js";
import {
  diferencaEntreFusos,
  fusosDisponiveis,
  lerParametrosConversor,
  planejarReuniao,
  resolverZona,
  validarListaCidades,
} from "../nucleo/fusos.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import {
  capitalizar,
  civilParaInstantes,
  dataIso,
  deslocamentoMinutos,
  diferencaDias,
  doisDigitos,
  formatarDataExtenso,
  formatarDeslocamento,
  formatarDiferencaFuso,
  formatarHora,
  fusoValido,
  lerDataIso,
  lerHora,
  partesNoFuso,
  outroDia,
} from "../nucleo/tempo.js";
import { $, anunciar, avisar, copiarTexto, el, icone, preencherSelect } from "../nucleo/ui.js";

const relogio = obterRelogio();
const OUTRO = "__iana";
const MAX_REUNIAO = 5;

// ---- Conversor -----------------------------------------------------------------
const campos = {
  origem: $("#origem"),
  destino: $("#destino"),
  origemIana: $("#origemIana"),
  destinoIana: $("#destinoIana"),
  data: $("#data"),
  hora: $("#hora"),
};

// Padrão: da cidade do fuso preferido para Lisboa (ou para Brasília, se a
// cidade preferida não for brasileira).
const preferida = cidadePreferida();
const origemPadrao = preferida?.id ?? "brasilia";
const destinoPadrao = !preferida || preferida.pais === "Brasil" ? (origemPadrao === "lisboa" ? "brasilia" : "lisboa") : "brasilia";
const opcoesZona = [...opcoesCidades(), { valor: OUTRO, rotulo: t("conversor.outroFuso"), grupo: t("conversor.outros") }];
preencherSelect(campos.origem, opcoesZona, origemPadrao);
preencherSelect(campos.destino, opcoesZona, destinoPadrao);

// Sugestões de fusos IANA (somente os que a plataforma conhece).
$("#listaFusosIana").append(...fusosDisponiveis().map((f) => el("option", { value: f })));

let escolhaAmbigua = 0;
let ultimoResultado = null;

function definirZona(lado, id) {
  const zona = resolverZona(id);
  if (!zona) return;
  if (zona.cidade) {
    campos[lado].value = zona.id;
  } else {
    campos[lado].value = OUTRO;
    campos[`${lado}Iana`].value = zona.fuso;
  }
  alternarIana(lado);
}

function alternarIana(lado) {
  const outro = campos[lado].value === OUTRO;
  document.querySelector(`[data-iana-para="${lado}"]`).hidden = !outro;
}

/** Zona selecionada em um lado: { id, nome, fuso } ou null se inválida. */
function zona(lado) {
  if (campos[lado].value !== OUTRO) return resolverZona(campos[lado].value);
  const entrada = campos[`${lado}Iana`];
  const texto = entrada.value.trim();
  const valido = texto && fusoValido(texto) ? resolverZona(texto) : null;
  const erro = $(`#${lado}IanaErro`);
  entrada.setAttribute("aria-invalid", String(Boolean(texto) && !valido));
  erro.hidden = !texto || Boolean(valido);
  return valido;
}

function preencherAgora() {
  const z = zona("origem");
  const p = partesNoFuso(relogio.agora(), z?.fuso ?? preferida?.fuso ?? "America/Sao_Paulo");
  campos.data.value = dataIso(p.ano, p.mes, p.dia);
  campos.hora.value = `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`;
}

function descreverLado(partes, z, instante) {
  return t("conversor.lado", {
    hora: formatarHora(partes, false),
    data: capitalizar(formatarDataExtenso(partes)),
    lugar: z.nome,
    utc: formatarDeslocamento(deslocamentoMinutos(instante, z.fuso)),
  });
}

function linha(dt, dd) {
  return el("div", {}, el("dt", {}, dt), el("dd", {}, dd));
}

function converter() {
  const resultado = $("#resultado");
  const escolha = $("#escolhaAmbigua");
  const origem = zona("origem");
  const destino = zona("destino");
  const data = lerDataIso(campos.data.value);
  const hora = lerHora(campos.hora.value);
  ultimoResultado = null;
  $("#botaoCopiarLink").disabled = true;

  if (!origem || !destino || !data || !hora) {
    escolha.hidden = true;
    resultado.replaceChildren(
      el("p", { class: "texto-suave" }, t(!origem || !destino ? "conversor.escolhaFuso" : "conversor.preencha")),
    );
    return;
  }

  const civil = { ...data, ...hora };
  const { situacao, instantes } = civilParaInstantes(civil, origem.fuso);
  if (situacao !== "ambigua") escolhaAmbigua = 0;
  const instante = instantes[Math.min(escolhaAmbigua, instantes.length - 1)];

  const pOrigem = partesNoFuso(instante, origem.fuso);
  const pDestino = partesNoFuso(instante, destino.fuso);
  const dias = diferencaDias(pOrigem, pDestino);
  const mudancaDia = dias === 1 ? t("conversor.diaSeguinte") : dias === -1 ? t("conversor.diaAnterior") : dias ? t("conversor.dias", { n: dias, sinal: dias > 0 ? "+" : "" }) : null;
  const diferenca = diferencaEntreFusos(instante, origem.fuso, destino.fuso);

  const avisos = [];
  if (situacao === "inexistente") {
    avisos.push(
      el(
        "div",
        { class: "aviso aviso--alerta" },
        icone("alerta"),
        el(
          "p",
          {},
          el("strong", {}, `${t("conversor.inexistente", { hora: campos.hora.value, lugar: origem.nome })} `),
          t("conversor.inexistenteExplicacao", { hora: formatarHora(pOrigem, false) }),
        ),
      ),
    );
  }

  resultado.replaceChildren(
    el("p", { class: "resultado-grande" }, formatarHora(pDestino, false)),
    el(
      "p",
      { class: "texto-suave" },
      t("conversor.dataEm", { data: capitalizar(formatarDataExtenso(pDestino)), lugar: destino.nome }),
      mudancaDia ? el("span", { class: "selo selo--acento selo--sem-ponto selo--espaco" }, mudancaDia) : null,
    ),
    ...avisos,
    el(
      "dl",
      { class: "lista-dados" },
      linha(t("conversor.origem"), descreverLado(pOrigem, origem, instante)),
      linha(t("conversor.destino"), descreverLado(pDestino, destino, instante)),
      linha(t("conversor.diferenca"), diferenca === 0 ? t("tempo.mesmoHorario") : t("conversor.noDestino", { diferenca: formatarDiferencaFuso(diferenca) })),
      linha("UTC", new Date(instante).toISOString().replace(".000Z", "Z")),
    ),
  );

  if (situacao === "ambigua") {
    const nome = "ocorrencia";
    escolha.replaceChildren(
      el(
        "div",
        { class: "aviso aviso--alerta" },
        icone("alerta"),
        el(
          "p",
          {},
          el("strong", {}, `${t("conversor.ambigua", { hora: campos.hora.value, lugar: origem.nome })} `),
          t("conversor.ambiguaExplicacao"),
        ),
      ),
      el(
        "fieldset",
        { class: "pilha pilha--sm" },
        el("legend", { class: "sr-only" }, t("conversor.ocorrencia")),
        instantes.map((instanteOpcao, i) =>
          el(
            "label",
            { class: "opcao" },
            el("input", {
              type: "radio",
              name: nome,
              value: String(i),
              checked: i === escolhaAmbigua,
              onchange: () => {
                escolhaAmbigua = i;
                converter();
                document.querySelector(`input[name="${nome}"][value="${i}"]`)?.focus();
              },
            }),
            el(
              "span",
              { class: "opcao__texto" },
              el("strong", {}, t(i === 0 ? "conversor.primeira" : "conversor.segunda")),
              el("span", {}, `${formatarDeslocamento(deslocamentoMinutos(instanteOpcao, origem.fuso))} · ${new Date(instanteOpcao).toISOString().slice(11, 16)} UTC`),
            ),
          ),
        ),
      ),
    );
    escolha.hidden = false;
  } else {
    escolha.hidden = true;
  }

  ultimoResultado = { origem, destino, data: campos.data.value, hora: campos.hora.value, pDestino };
  $("#botaoCopiarLink").disabled = false;
}

for (const lado of ["origem", "destino"]) {
  campos[lado].addEventListener("change", () => {
    alternarIana(lado);
    if (campos[lado].value === OUTRO) campos[`${lado}Iana`].focus();
    converter();
  });
  campos[`${lado}Iana`].addEventListener("input", converter);
}
campos.data.addEventListener("input", converter);
campos.hora.addEventListener("input", converter);

$("#botaoAgora").addEventListener("click", () => {
  preencherAgora();
  converter();
});

$("#botaoInverter").addEventListener("click", () => {
  const anterior = ultimoResultado;
  const [vo, vd] = [campos.origem.value, campos.destino.value];
  const [io, id] = [campos.origemIana.value, campos.destinoIana.value];
  campos.origem.value = vd;
  campos.destino.value = vo;
  campos.origemIana.value = id;
  campos.destinoIana.value = io;
  alternarIana("origem");
  alternarIana("destino");
  // Mantém o mesmo instante: a nova origem recebe a hora que era o resultado.
  if (anterior) {
    const p = anterior.pDestino;
    campos.data.value = dataIso(p.ano, p.mes, p.dia);
    campos.hora.value = `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`;
  }
  escolhaAmbigua = 0;
  converter();
  anunciar(t("conversor.invertidos"));
});

$("#formConversor").addEventListener("submit", (evento) => evento.preventDefault());

$("#botaoCopiarLink").addEventListener("click", async () => {
  if (!ultimoResultado) return;
  const params = new URLSearchParams({
    de: ultimoResultado.origem.id,
    para: ultimoResultado.destino.id,
    data: ultimoResultado.data,
    hora: ultimoResultado.hora,
  });
  const url = `${location.origin}/conversor?${params}`;
  avisar(t((await copiarTexto(url)) ? "conversor.linkCopiado" : "comum.naoCopiou"));
});

// Estado inicial: parâmetros da URL (validados) ou agora, da cidade preferida para o destino padrão.
const parametros = lerParametrosConversor(location.search);
if (parametros.de) definirZona("origem", parametros.de);
if (parametros.para) definirZona("destino", parametros.para);
alternarIana("origem");
alternarIana("destino");
if (parametros.data && parametros.hora) {
  campos.data.value = parametros.data;
  campos.hora.value = parametros.hora;
} else {
  preencherAgora();
  if (parametros.data) campos.data.value = parametros.data;
  if (parametros.hora) campos.hora.value = parametros.hora;
}
converter();

// Quando a sincronização terminar, "agora" pode mudar alguns segundos; só
// atualizamos se o usuário ainda não mexeu nos campos.
let mexeu = Boolean(parametros.data || parametros.hora);
for (const campo of [campos.data, campos.hora]) campo.addEventListener("input", () => (mexeu = true));
relogio.addEventListener("estado", () => {
  if (!mexeu) {
    preencherAgora();
    converter();
  }
});

// ---- Planejador de reuniões -------------------------------------------------------
const CHAVE_REUNIAO = "conversor:reuniao";
let cidadesReuniao = validarListaCidades(ler(CHAVE_REUNIAO), MAX_REUNIAO) ?? [...new Set([origemPadrao, "brasilia", "lisboa", "nova-york"])].slice(0, 3);
if (cidadesReuniao.length === 0) cidadesReuniao = [origemPadrao];

const dataReuniao = $("#dataReuniao");
{
  const base = buscarCidade(cidadesReuniao[0]);
  const p = partesNoFuso(relogio.agora(), base.fuso);
  dataReuniao.value = dataIso(p.ano, p.mes, p.dia);
}

function salvarReuniao() {
  gravar(CHAVE_REUNIAO, cidadesReuniao);
}

function renderizarFichas() {
  const lista = $("#fichasReuniao");
  lista.replaceChildren(
    ...cidadesReuniao.map((id, i) => {
      const cidade = buscarCidade(id);
      const nome = nomeCidade(cidade);
      return el(
        "li",
        {},
        el(
          "span",
          { class: `ficha${i === 0 ? " ficha--principal" : ""}` },
          i === 0 ? el("span", { class: "ficha__contagem" }, t("conversor.referencia")) : null,
          nome,
          i > 0
            ? el(
                "button",
                {
                  type: "button",
                  class: "ficha__acao",
                  "aria-label": t("conversor.tornarReferencia", { cidade: nome }),
                  title: t("conversor.tornarReferenciaCurto"),
                  onclick: () => {
                    cidadesReuniao = [id, ...cidadesReuniao.filter((c) => c !== id)];
                    salvarReuniao();
                    renderizarReuniao();
                  },
                },
                icone("anterior", "icone--sm"),
              )
            : null,
          cidadesReuniao.length > 1
            ? el(
                "button",
                {
                  type: "button",
                  class: "ficha__acao",
                  "aria-label": t("conversor.removerDaReuniao", { cidade: nome }),
                  title: t("comum.remover"),
                  onclick: () => {
                    cidadesReuniao = cidadesReuniao.filter((c) => c !== id);
                    salvarReuniao();
                    renderizarReuniao();
                    $("#cidadeReuniao").focus();
                  },
                },
                icone("fechar", "icone--sm"),
              )
            : null,
        ),
      );
    }),
  );

  preencherSelect($("#cidadeReuniao"), opcoesCidades((c) => !cidadesReuniao.includes(c.id)));
  const cheio = cidadesReuniao.length >= MAX_REUNIAO;
  $("#cidadeReuniao").disabled = cheio;
  $("#botaoAdicionarReuniao").disabled = cheio;
}

function horaCurta(h) {
  return t("conversor.horaCurta", { hora: h });
}

function renderizarTabela() {
  const data = lerDataIso(dataReuniao.value);
  const corpo = $("#tabelaReuniao");
  const resumo = $("#resumoReuniao");
  if (!data) {
    corpo.replaceChildren();
    resumo.textContent = t("conversor.escolhaData");
    return;
  }
  const cidades = cidadesReuniao.map(buscarCidade);
  const { linhas, janelas } = planejarReuniao(
    cidades.map((c) => c.fuso),
    data,
  );
  const meio = linhas[12]?.instante ?? linhas[0].instante;

  const linhasTabela = cidades.map((cidade, ci) =>
    el(
      "tr",
      {},
      el(
        "th",
        { scope: "row" },
        nomeCidade(cidade),
        el("span", { class: "planejador__fuso" }, formatarDeslocamento(deslocamentoMinutos(meio, cidade.fuso))),
      ),
      linhas.map((l) => {
        const local = l.locais[ci];
        const p = local.partes;
        const relativo = outroDia(p, data);
        const dias = diferencaDias(data, p);
        const noite = p.hora < 7 || p.hora >= 22;
        return el(
          "td",
          {
            class: [local.comercial ? "comercial" : "", noite ? "noite" : "", l.todos ? "coluna-todos" : ""].join(" ").trim() || null,
            title: `${nomeCidade(cidade)}: ${formatarHora(p, false)}${relativo ? ` (${relativo})` : ""}`,
          },
          doisDigitos(p.hora),
          dias === 1 ? el("sup", {}, "+1") : dias === -1 ? el("sup", {}, "−1") : null,
        );
      }),
    ),
  );

  const linhaTodos = el(
    "tr",
    { class: "sobreposicao" },
    el("th", { scope: "row" }, t("conversor.todosDisponiveis")),
    linhas.map((l) => el("td", { class: l.todos ? "todos" : null }, l.todos ? "✓" : "")),
  );

  corpo.replaceChildren(...linhasTabela, linhaTodos);

  const base = nomeCidade(cidades[0]);
  if (cidades.length < 2) {
    resumo.textContent = t("conversor.adicioneMais");
  } else if (janelas.length) {
    const texto = janelas.map((j) => `${horaCurta(j.inicio)}–${horaCurta(j.fim)}`).join(", ");
    resumo.textContent = t("conversor.janelas", { base, janelas: texto });
  } else {
    resumo.textContent = t("conversor.semJanela");
  }
}

function renderizarReuniao() {
  renderizarFichas();
  renderizarTabela();
}

$("#formReuniao").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const id = $("#cidadeReuniao").value;
  if (!buscarCidade(id) || cidadesReuniao.includes(id) || cidadesReuniao.length >= MAX_REUNIAO) return;
  cidadesReuniao.push(id);
  salvarReuniao();
  renderizarReuniao();
  anunciar(t("conversor.adicionadaReuniao", { cidade: nomeCidade(buscarCidade(id)) }));
});
dataReuniao.addEventListener("input", renderizarTabela);

renderizarReuniao();
