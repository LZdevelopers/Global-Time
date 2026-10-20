// Calculadoras de tempo: diferença entre datas, soma de dias, duração entre
// horários e conversão de unidades. Toda a lógica fica em nucleo/calculos.js.

import "../i18n/index.js";
import { t } from "../i18n/estado.js";
import {
  UNIDADES,
  converterUnidades,
  descreverCalendario,
  diasUteisEntre,
  diferencaEntreDatas,
  duracaoEntreHorarios,
  formatarNumero,
  lerNumero,
  quantidade,
  somarDias,
} from "../nucleo/calculos.js";
import { obterRelogio } from "../nucleo/sincronizacao.js";
import { capitalizar, dataIso, formatarDataExtenso, lerDataIso, partesNoFuso } from "../nucleo/tempo.js";
import { $, $$, avisar, copiarTexto, el, preencherSelect } from "../nucleo/ui.js";
import { UFS } from "../dados/ufs.js";

const hoje = partesNoFuso(obterRelogio().agora());
const hojeIso = dataIso(hoje.ano, hoje.mes, hoje.dia);

const opcoesUf = [
  { valor: "", rotulo: t("calc.uf.nacionais") },
  ...UFS.map((uf) => ({ valor: uf.sigla, rotulo: t("calc.uf.mais", { nome: uf.nome, sigla: uf.sigla }) })),
];

/** "feriados nacionais" ou "nacionais + SP" para os detalhes. */
const feriadosConsiderados = (uf) => (uf ? t("calc.feriadosNacionaisMais", { uf }) : t("calc.feriadosNacionais"));

function linhas(lista, pares) {
  lista.replaceChildren(...pares.map(([dt, dd]) => el("div", {}, el("dt", {}, dt), el("dd", {}, dd))));
}

function mostrarErro(elemento, texto) {
  elemento.hidden = !texto;
  elemento.textContent = texto ?? "";
}

function marcarInvalido(campo, invalido) {
  if (invalido) campo.setAttribute("aria-invalid", "true");
  else campo.removeAttribute("aria-invalid");
}

// ---- 1. Diferença entre datas ---------------------------------------------
const difInicio = $("#difInicio");
const difFim = $("#difFim");
const difUf = $("#difUf");
preencherSelect(difUf, opcoesUf, "");
difInicio.value = hojeIso;
difFim.value = dataIso(hoje.ano, 12, 31);

function calcularDiferenca() {
  const a = lerDataIso(difInicio.value);
  const b = lerDataIso(difFim.value);
  marcarInvalido(difInicio, !a);
  marcarInvalido(difFim, !b);
  if (!a || !b) {
    $("#difResultado").textContent = "—";
    linhas($("#difDetalhes"), []);
    mostrarErro($("#difErro"), t("calc.erro.duasDatas"));
    return;
  }
  mostrarErro($("#difErro"), null);
  const r = diferencaEntreDatas(a, b);
  const uf = difUf.value || null;
  const uteis = diasUteisEntre(a, b, { uf });
  $("#difRotulo").textContent = t(r.negativa ? "calc.rotulo.diferencaNegativa" : "calc.rotulo.diferenca");
  $("#difResultado").textContent = quantidade("calc.qtd.dias", Math.abs(r.dias));
  const semanas = r.semanas
    ? r.diasAlemSemanas
      ? t("calc.semanasEDias", { semanas: quantidade("calc.qtd.semanas", r.semanas), dias: quantidade("calc.qtd.dias", r.diasAlemSemanas) })
      : quantidade("calc.qtd.semanas", r.semanas)
    : quantidade("calc.qtd.dias", r.diasAlemSemanas);
  linhas($("#difDetalhes"), [
    [t("calc.det.anosMesesDias"), descreverCalendario(r)],
    [t("calc.det.semanas"), semanas],
    [t("calc.det.uteis", { feriados: feriadosConsiderados(uf) }), quantidade("calc.qtd.diasUteis", uteis)],
    [t("calc.det.horas"), t("tempo.unidade.h", { n: r.horas })],
  ]);
}

// ---- 2. Somar dias ------------------------------------------------------------
const somData = $("#somData");
const somQuantidade = $("#somQuantidade");
const somTipo = $("#somTipo");
const somUf = $("#somUf");
preencherSelect(somUf, opcoesUf, "");
somData.value = hojeIso;

function calcularSoma() {
  const data = lerDataIso(somData.value);
  const dias = Number(somQuantidade.value);
  const quantidadeValida = somQuantidade.value.trim() !== "" && Number.isInteger(dias) && Math.abs(dias) <= 36500;
  marcarInvalido(somData, !data);
  marcarInvalido(somQuantidade, !quantidadeValida);
  somUf.disabled = somTipo.value !== "uteis";
  if (!data || !quantidadeValida) {
    $("#somResultado").textContent = "—";
    linhas($("#somDetalhes"), []);
    mostrarErro($("#somErro"), t(!data ? "calc.erro.data" : "calc.erro.dias"));
    return;
  }
  mostrarErro($("#somErro"), null);
  const uteis = somTipo.value === "uteis";
  const uf = somUf.value || null;
  const r = somarDias(data, dias, { uteis, uf });
  $("#somResultado").textContent = capitalizar(formatarDataExtenso(r));
  const corridos = diferencaEntreDatas(data, r).dias;
  const operacao = `${dias >= 0 ? "+" : "−"} ${quantidade(uteis ? "calc.qtd.diasUteis" : "calc.qtd.dias", Math.abs(dias))}`;
  linhas($("#somDetalhes"), [
    [t("calc.det.partida"), capitalizar(formatarDataExtenso(data))],
    [t("calc.det.operacao"), uteis ? `${operacao} (${feriadosConsiderados(uf)})` : operacao],
    [t("calc.det.corridosAte"), quantidade("calc.qtd.dias", Math.abs(corridos))],
  ]);
}

// ---- 3. Duração entre horários ---------------------------------------------------
const durInicio = $("#durInicio");
const durFim = $("#durFim");
const durPausa = $("#durPausa");

function calcularDuracao() {
  const pausaTexto = durPausa.value.trim();
  const pausa = pausaTexto === "" ? 0 : Number(pausaTexto);
  const r = duracaoEntreHorarios(durInicio.value, durFim.value, pausa);
  marcarInvalido(durPausa, !Number.isFinite(pausa) || pausa < 0);
  if (!r || r.erro) {
    $("#durResultado").textContent = "—";
    linhas($("#durDetalhes"), []);
    mostrarErro($("#durErro"), t(r?.erro ? `calc.erro.${r.erro}` : "calc.erro.horarios"));
    return;
  }
  mostrarErro($("#durErro"), null);
  $("#durResultado").textContent = t("tempo.unidade.h", { n: r.texto });
  linhas($("#durDetalhes"), [
    [t("calc.det.extenso"), t("calc.horasEMinutos", { horas: quantidade("calc.qtd.horas", r.horas), minutos: quantidade("calc.qtd.minutos", r.minutos) })],
    [t("calc.det.decimal"), t("tempo.unidade.h", { n: formatarNumero(r.decimal, 2) })],
    [t("calc.det.minutos"), t("tempo.unidade.min", { n: Math.round(r.ms / 60000) })],
    [t("calc.det.meiaNoite"), t(r.viraDia ? "calc.meiaNoite.sim" : "calc.meiaNoite.nao")],
  ]);
}

// ---- 4. Unidades --------------------------------------------------------------------
const uniValor = $("#uniValor");
const uniDe = $("#uniDe");
preencherSelect(
  uniDe,
  Object.keys(UNIDADES).map((valor) => ({ valor, rotulo: t(`calc.unidade.${valor}`) })),
  "minutos",
);

function calcularUnidades() {
  const valor = lerNumero(uniValor.value);
  const r = converterUnidades(valor, uniDe.value);
  marcarInvalido(uniValor, !r);
  if (!r) {
    $("#uniResultado").textContent = "—";
    linhas($("#uniDetalhes"), []);
    mostrarErro($("#uniErro"), t("calc.erro.numero"));
    return;
  }
  mostrarErro($("#uniErro"), null);
  const destaque = uniDe.value === "horas" ? "minutos" : "horas";
  // {q} é o número formatado; {n} escolhe a forma do plural.
  $("#uniResultado").textContent = t(`calc.qtdUnidade.${destaque}`, { n: r[destaque], q: formatarNumero(r[destaque], 4) });
  linhas(
    $("#uniDetalhes"),
    Object.keys(UNIDADES)
      .filter((chave) => chave !== uniDe.value)
      .map((chave) => [t(`calc.unidade.${chave}`), formatarNumero(r[chave])]),
  );
}

// ---- Ligações ----------------------------------------------------------------------
const calculos = [
  [[difInicio, difFim, difUf], calcularDiferenca],
  [[somData, somQuantidade, somTipo, somUf], calcularSoma],
  [[durInicio, durFim, durPausa], calcularDuracao],
  [[uniValor, uniDe], calcularUnidades],
];
for (const [campos, calcular] of calculos) {
  for (const campo of campos) {
    campo.addEventListener("input", calcular);
    campo.addEventListener("change", calcular);
  }
  calcular();
}
for (const formulario of $$("form.campos")) formulario.addEventListener("submit", (e) => e.preventDefault());

for (const botao of $$("[data-copiar]")) {
  botao.addEventListener("click", async () => {
    const titulo = $(`#${botao.dataset.titulo}`).textContent;
    if (titulo === "—") {
      avisar(t("calc.semResultado"));
      return;
    }
    const secao = botao.closest("section").querySelector("h2").textContent;
    const detalhes = $$(`#${botao.dataset.copiar} > div`).map(
      (linha) => `${linha.querySelector("dt").textContent}: ${linha.querySelector("dd").textContent}`,
    );
    const texto = [`${secao}: ${titulo}`, ...detalhes].join("\n");
    avisar(t((await copiarTexto(texto)) ? "calc.copiado" : "comum.naoCopiou"));
  });
}

// ---- Abas -------------------------------------------------------------------------
// Uma calculadora por vez. O endereço (#diferenca, #somar…) abre a aba certa.
const abas = $$("[role=tab][data-aba]");

function mostrarAba(id, { focar = false } = {}) {
  for (const aba of abas) {
    const ativa = aba.dataset.aba === id;
    aba.setAttribute("aria-selected", String(ativa));
    aba.tabIndex = ativa ? 0 : -1;
    $(`#${aba.dataset.aba}`).hidden = !ativa;
    if (ativa && focar) aba.focus();
  }
}

for (const [indice, aba] of abas.entries()) {
  aba.addEventListener("click", () => {
    mostrarAba(aba.dataset.aba);
    history.replaceState(null, "", `#${aba.dataset.aba}`);
  });
  aba.addEventListener("keydown", (evento) => {
    const passo = { ArrowRight: 1, ArrowLeft: -1 }[evento.key];
    if (!passo) return;
    evento.preventDefault();
    const proxima = abas[(indice + passo + abas.length) % abas.length];
    mostrarAba(proxima.dataset.aba, { focar: true });
    history.replaceState(null, "", `#${proxima.dataset.aba}`);
  });
}

const abaDoEndereco = () => abas.find((a) => `#${a.dataset.aba}` === location.hash)?.dataset.aba ?? abas[0].dataset.aba;
mostrarAba(abaDoEndereco());
window.addEventListener("hashchange", () => mostrarAba(abaDoEndereco()));
