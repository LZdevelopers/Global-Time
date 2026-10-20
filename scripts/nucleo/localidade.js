// Seletor de localidade (UF + capital) compartilhado por Feriados e
// Calendário. A escolha fica salva em "feriados:selecao" e pode vir da URL
// (?uf=SP&municipio=São Paulo), sempre validada contra os dados conhecidos.

import { t } from "../i18n/estado.js";
import { COBERTURA_ESTADUAL } from "../dados/feriados-estaduais.js";
import { COBERTURA_MUNICIPAL } from "../dados/feriados-municipais.js";
import { UFS, buscarUf } from "../dados/ufs.js";
import { gravar, ler } from "./armazenamento.js";
import { preencherSelect } from "./ui.js";

const CHAVE = "feriados:selecao";

export function municipioComDados(uf) {
  return COBERTURA_MUNICIPAL.municipios.find((m) => m.uf === uf)?.municipio ?? null;
}

export function lerSelecaoSalva() {
  const salvo = ler(CHAVE, {}) ?? {};
  return validarSelecao(salvo.uf, salvo.municipio, salvo);
}

function validarSelecao(uf, municipio, resto = {}) {
  const ufValida = typeof uf === "string" && buscarUf(uf) ? uf : "";
  const municipioValido = ufValida && municipio && municipioComDados(ufValida) === municipio ? municipio : "";
  return { ...resto, uf: ufValida, municipio: municipioValido };
}

export function salvarSelecao(parcial) {
  gravar(CHAVE, { ...(ler(CHAVE, {}) ?? {}), ...parcial });
}

/** Texto honesto sobre a cobertura de dados para a seleção atual. */
export function textoCobertura(uf, municipio) {
  if (!uf) return t("localidade.somenteNacionais");
  const semProprio = COBERTURA_ESTADUAL.ufsSemFeriadoProprio ?? [];
  const nomeUf = buscarUf(uf).nome;
  let estadual;
  if (semProprio.includes(uf)) estadual = t("localidade.semEstadual", { uf: nomeUf });
  else if (COBERTURA_ESTADUAL.ufsVerificadas.includes(uf)) estadual = t("localidade.incluiDe", { lugar: nomeUf });
  else estadual = t("localidade.semDadosEstaduais", { uf: nomeUf });
  const capital = buscarUf(uf).capital;
  let municipal;
  if (municipio) municipal = t("localidade.incluiDe", { lugar: municipio });
  else if (municipioComDados(uf)) municipal = t("localidade.escolhaCapital", { capital });
  else municipal = t("localidade.semDadosMunicipais", { capital });
  return `${estadual} ${municipal}`;
}

/**
 * Liga os <select> de UF e município. Chama `aoMudar({ uf, municipio })`
 * quando a escolha muda. Retorna a seleção inicial e um getter.
 */
export function ligarSeletorLocalidade(selectUf, selectMunicipio, { aoMudar, ajudaMunicipio } = {}) {
  const parametros = new URLSearchParams(location.search);
  const salva = lerSelecaoSalva();
  let atual = parametros.has("uf")
    ? validarSelecao(parametros.get("uf").toUpperCase(), parametros.get("municipio") ?? "")
    : { uf: salva.uf, municipio: salva.municipio };

  preencherSelect(
    selectUf,
    [{ valor: "", rotulo: t("localidade.opcaoNacionais") }, ...UFS.map((u) => ({ valor: u.sigla, rotulo: `${u.nome} (${u.sigla})` }))],
    atual.uf,
  );

  const preencherMunicipio = () => {
    const capital = municipioComDados(atual.uf);
    const opcoes = [{ valor: "", rotulo: t(atual.uf ? "localidade.semMunicipais" : "localidade.escolhaEstado") }];
    if (capital) opcoes.push({ valor: capital, rotulo: capital });
    preencherSelect(selectMunicipio, opcoes, atual.municipio);
    selectMunicipio.disabled = !capital;
    if (ajudaMunicipio) {
      const capitalUf = atual.uf ? buscarUf(atual.uf).capital : null;
      ajudaMunicipio.textContent = !atual.uf
        ? t("localidade.ajudaSemUf")
        : capital
          ? t("localidade.ajudaCapital", { capital })
          : t("localidade.semDadosMunicipais", { capital: capitalUf });
    }
  };
  preencherMunicipio();

  selectUf.addEventListener("change", () => {
    atual = validarSelecao(selectUf.value, "");
    preencherMunicipio();
    salvarSelecao(atual);
    aoMudar?.({ ...atual });
  });
  selectMunicipio.addEventListener("change", () => {
    atual = validarSelecao(atual.uf, selectMunicipio.value);
    salvarSelecao(atual);
    aoMudar?.({ ...atual });
  });

  return {
    get selecao() {
      return { ...atual };
    },
  };
}

