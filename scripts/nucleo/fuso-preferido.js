// Fuso usado para exibir a hora local. Só muda a forma de mostrar o instante:
// o instante em si vem sempre do relógio sincronizado com o servidor.
//
// Padrão: o fuso configurado no aparelho (Intl). O usuário pode escolher
// outro manualmente; a escolha fica salva e prevalece nas próximas visitas.
// O fuso do aparelho não indica, por si, onde a pessoa está.

import { buscarCidade, cidadeDoFuso, fusoDoNavegador, nomeCidade, nomeDoFuso } from "../dados/cidades.js";
import { ler, gravar, remover } from "./armazenamento.js";
import { FUSO_BRASILIA, fusoValido } from "./tempo.js";

const CHAVE = "fuso";

/** Fuso do aparelho, ou o de Brasília se o navegador não informar um válido. */
export function fusoDoAparelho() {
  const fuso = fusoDoNavegador();
  return fuso && fusoValido(fuso) ? fuso : FUSO_BRASILIA;
}

/** Escolha manual salva ({ fuso, cidade? }) ou null. */
export function escolhaManual() {
  const salvo = ler(CHAVE);
  if (!salvo || typeof salvo.fuso !== "string" || !fusoValido(salvo.fuso)) return null;
  const cidade = typeof salvo.cidade === "string" ? buscarCidade(salvo.cidade) : null;
  return { fuso: salvo.fuso, cidade: cidade && cidade.fuso === salvo.fuso ? cidade.id : null };
}

/** { fuso, nome, manual } — fuso para exibir e um nome legível para ele. */
export function fusoPreferido() {
  const manual = escolhaManual();
  if (manual) {
    const cidade = manual.cidade ? buscarCidade(manual.cidade) : null;
    return { fuso: manual.fuso, nome: cidade ? nomeCidade(cidade) : nomeDoFuso(manual.fuso), manual: true };
  }
  const fuso = fusoDoAparelho();
  return { fuso, nome: nomeDoFuso(fuso), manual: false };
}

/** Salva a escolha manual de uma cidade; `null` volta ao fuso do aparelho. */
export function escolherCidade(id) {
  if (id == null) {
    remover(CHAVE);
    return;
  }
  const cidade = buscarCidade(id);
  if (cidade) gravar(CHAVE, { fuso: cidade.fuso, cidade: cidade.id });
}

/** Cidade cadastrada que corresponde ao fuso (para pré-selecionar listas). */
export function cidadePreferida() {
  const manual = escolhaManual();
  if (manual?.cidade) return buscarCidade(manual.cidade);
  return cidadeDoFuso(fusoPreferido().fuso);
}
