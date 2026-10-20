// Lógica pura de fusos usada pelo relógio mundial, conversor e tela cheia:
// horário comercial, resolução de cidade/fuso, validação de parâmetros de URL
// e planejamento de reuniões. Sem DOM — testada em testes/fusos.test.mjs.

import { CIDADES, buscarCidade, nomeCidade } from "../dados/cidades.js";
import { civilParaInstante, deslocamentoMinutos, fusoValido, lerDataIso, lerHora, partesNoFuso } from "./tempo.js";

export const INICIO_COMERCIAL = 9;
export const FIM_COMERCIAL = 18;

/**
 * Aproximação de horário comercial: segunda a sexta, das 9h às 18h locais.
 * Não considera feriados locais nem costumes de cada país.
 */
export function emHorarioComercial(partes) {
  const diaUtil = partes.diaSemana >= 1 && partes.diaSemana <= 5;
  return diaUtil && partes.hora >= INICIO_COMERCIAL && partes.hora < FIM_COMERCIAL;
}

/**
 * Converte um identificador em zona: id de cidade conhecida ou nome IANA.
 * Retorna { id, nome, fuso, cidade } ou null.
 */
export function resolverZona(valor) {
  if (typeof valor !== "string" || !valor) return null;
  const cidade = buscarCidade(valor);
  if (cidade) {
    return { id: cidade.id, nome: nomeCidade(cidade), fuso: cidade.fuso, cidade };
  }
  if (fusoValido(valor) && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(valor)) {
    return { id: valor, nome: valor.split("/").at(-1).replace(/_/g, " "), fuso: valor, cidade: null };
  }
  return null;
}

/** Lê ?de=&para=&data=&hora= ignorando qualquer valor inválido. */
export function lerParametrosConversor(busca) {
  const params = new URLSearchParams(busca);
  const resultado = {};
  const de = resolverZona(params.get("de") ?? "");
  const para = resolverZona(params.get("para") ?? "");
  if (de) resultado.de = de.id;
  if (para) resultado.para = para.id;
  if (lerDataIso(params.get("data"))) resultado.data = params.get("data");
  const hora = lerHora(params.get("hora"));
  if (hora) resultado.hora = `${String(hora.hora).padStart(2, "0")}:${String(hora.minuto).padStart(2, "0")}`;
  return resultado;
}

/** Lê uma lista de ids de cidades ("lisboa,toquio"), sem duplicatas, até `limite`. */
export function lerListaCidades(texto, limite = 3) {
  if (typeof texto !== "string" || texto.length > 500) return [];
  const ids = [];
  for (const parte of texto.split(",")) {
    const id = parte.trim();
    if (buscarCidade(id) && !ids.includes(id)) ids.push(id);
    if (ids.length >= limite) break;
  }
  return ids;
}

/** Filtra uma lista salva (localStorage) mantendo só cidades conhecidas. */
export function validarListaCidades(lista, limite = 40) {
  if (!Array.isArray(lista)) return null;
  const ids = [];
  for (const id of lista) {
    if (typeof id === "string" && buscarCidade(id) && !ids.includes(id)) ids.push(id);
    if (ids.length >= limite) break;
  }
  return ids;
}

/**
 * Planeja uma reunião: para cada hora (0–23) do dia `data` no fuso da
 * primeira zona, calcula a hora local de todas as zonas e se cada uma está em
 * horário comercial. Retorna { linhas, janelas }.
 *  - linhas[i] = { instante, horaBase, locais: [{ partes, comercial }], todos }
 *  - janelas = [{ inicio, fim }] horas-base consecutivas em que todos estão
 *    em horário comercial (fim exclusivo).
 */
export function planejarReuniao(fusos, data) {
  if (!fusos.length) return { linhas: [], janelas: [] };
  const base = fusos[0];
  const linhas = [];
  for (let hora = 0; hora < 24; hora += 1) {
    const instante = civilParaInstante({ ...data, hora, minuto: 0, segundo: 0 }, base);
    const locais = fusos.map((fuso) => {
      const partes = partesNoFuso(instante, fuso);
      return { partes, comercial: emHorarioComercial(partes) };
    });
    linhas.push({ instante, horaBase: hora, locais, todos: locais.every((l) => l.comercial) });
  }
  const janelas = [];
  let inicio = null;
  for (let i = 0; i <= linhas.length; i += 1) {
    const todos = linhas[i]?.todos;
    if (todos && inicio === null) inicio = i;
    if (!todos && inicio !== null) {
      janelas.push({ inicio, fim: i });
      inicio = null;
    }
  }
  return { linhas, janelas };
}

/** Diferença em minutos entre dois fusos num instante (b − a). */
export function diferencaEntreFusos(instante, fusoA, fusoB) {
  return deslocamentoMinutos(instante, fusoB) - deslocamentoMinutos(instante, fusoA);
}

/** Lista de nomes IANA disponíveis na plataforma (para sugestões). */
export function fusosDisponiveis() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [...new Set(CIDADES.map((c) => c.fuso))].sort();
  }
}
