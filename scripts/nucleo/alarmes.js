// Regras do despertador, sem DOM: validação, próximo disparo, soneca e
// alarmes perdidos enquanto a página estava fechada.
//
// Um alarme:
//  { id, rotulo, hora: "HH:MM", data: "AAAA-MM-DD" | null, dias: [0..6],
//    fuso, som, ativo, sonecaAte: instante | null }
// `data` (alarme único) e `dias` (repetição semanal, 0 = domingo) são
// mutuamente exclusivos.
//
// Horários de verão: se a hora não existe naquele dia (salto para frente), o
// alarme toca logo após o salto; se a hora acontece duas vezes (fim do horário
// de verão), toca na primeira ocorrência.

import { t } from "../i18n/estado.js";
import {
  FUSO_BRASILIA,
  MS_MINUTO,
  civilParaInstantes,
  deDiaJuliano,
  diaJuliano,
  fusoValido,
  lerDataIso,
  lerHora,
  partesNoFuso,
} from "./tempo.js";

export const LIMITE_ROTULO = 60;
export const SONECA_MS = 5 * MS_MINUTO;

export function limparTexto(texto, limite) {
  return String(texto ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limite);
}

function instanteCivil(data, hora, fuso) {
  return civilParaInstantes({ ...data, hora: hora.hora, minuto: hora.minuto, segundo: 0 }, fuso).instantes[0];
}

/** Próximo instante (ms) em que o alarme deve tocar depois de `agora`, ou null. */
export function proximoDisparo(alarme, agora) {
  if (!alarme?.ativo) return null;
  if (Number.isFinite(alarme.sonecaAte) && alarme.sonecaAte > agora) return alarme.sonecaAte;

  const hora = lerHora(alarme.hora);
  const fuso = fusoValido(alarme.fuso) ? alarme.fuso : FUSO_BRASILIA;
  if (!hora) return null;

  if (alarme.data) {
    const data = lerDataIso(alarme.data);
    if (!data) return null;
    const instante = instanteCivil(data, hora, fuso);
    return instante > agora ? instante : null;
  }

  const dias = Array.isArray(alarme.dias) ? alarme.dias : [];
  if (!dias.length) return null;

  const hoje = partesNoFuso(agora, fuso);
  const base = diaJuliano(hoje.ano, hoje.mes, hoje.dia);
  // Oito dias cobrem a semana inteira mesmo quando o horário de hoje já passou.
  for (let i = 0; i <= 8; i += 1) {
    const { ano, mes, dia, diaSemana } = deDiaJuliano(base + i);
    if (!dias.includes(diaSemana)) continue;
    const instante = instanteCivil({ ano, mes, dia }, hora, fuso);
    if (instante > agora) return instante;
  }
  return null;
}

/**
 * Valida a entrada do formulário. Retorna { ok, erros: { campo: msg }, alarme }.
 * As mensagens saem no idioma da interface.
 * `agora` é o instante sincronizado, usado para recusar alarmes únicos no passado.
 */
export function validarAlarme(entrada, agora) {
  const erros = {};
  const rotulo = limparTexto(entrada.rotulo, LIMITE_ROTULO);
  const hora = lerHora(entrada.hora);
  if (!hora) erros.hora = t("despertador.erro.hora");

  const fuso = fusoValido(entrada.fuso) ? entrada.fuso : null;
  if (!fuso) erros.fuso = t("despertador.erro.fuso");

  const repetir = entrada.modo === "semanal";
  const dias = repetir
    ? [...new Set((entrada.dias ?? []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  let data = null;

  if (repetir) {
    if (!dias.length) erros.dias = t("despertador.erro.dias");
  } else {
    const lida = lerDataIso(entrada.data);
    if (!lida) erros.data = t("despertador.erro.data");
    else data = entrada.data.trim();
  }

  const alarme = {
    id: entrada.id || `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    rotulo,
    hora: hora ? `${String(hora.hora).padStart(2, "0")}:${String(hora.minuto).padStart(2, "0")}` : "",
    data,
    dias,
    fuso: fuso ?? FUSO_BRASILIA,
    som: entrada.som || "bipe",
    ativo: true,
    sonecaAte: null,
  };

  if (!Object.keys(erros).length && !repetir && proximoDisparo(alarme, agora) == null) {
    erros.hora = t("despertador.erro.passou");
  }

  return { ok: Object.keys(erros).length === 0, erros, alarme };
}

/** Normaliza dados lidos do armazenamento, descartando entradas inválidas. */
export function restaurarAlarmes(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((a) => a && typeof a === "object" && lerHora(a.hora) && (lerDataIso(a.data) || Array.isArray(a.dias)))
    .map((a) => ({
      id: String(a.id).slice(0, 40),
      rotulo: limparTexto(a.rotulo, LIMITE_ROTULO),
      hora: a.hora,
      data: a.data && lerDataIso(a.data) ? a.data : null,
      dias: Array.isArray(a.dias) ? a.dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
      fuso: fusoValido(a.fuso) ? a.fuso : FUSO_BRASILIA,
      cidade: typeof a.cidade === "string" ? a.cidade.slice(0, 40) : null,
      som: typeof a.som === "string" ? a.som : "bipe",
      ativo: Boolean(a.ativo),
      sonecaAte: Number.isFinite(a.sonecaAte) ? a.sonecaAte : null,
    }));
}

/**
 * Alarmes que deveriam ter tocado entre `desde` e `ate` (exclusivo/inclusivo).
 * Retorna [{ alarme, instante }].
 */
export function alarmesPerdidos(alarmes, desde, ate) {
  if (!Number.isFinite(desde) || desde >= ate) return [];
  const perdidos = [];
  for (const alarme of alarmes) {
    const instante = proximoDisparo(alarme, desde);
    if (instante != null && instante <= ate) perdidos.push({ alarme, instante });
  }
  return perdidos;
}

/** Estado após o alarme tocar e ser desligado. */
export function aposDisparo(alarme) {
  return { ...alarme, sonecaAte: null, ativo: alarme.data ? false : alarme.ativo };
}

export function adiarAlarme(alarme, agora, ms = SONECA_MS) {
  return { ...alarme, sonecaAte: agora + ms };
}

/** Próximo alarme entre todos: { alarme, instante } ou null. */
export function proximoGeral(alarmes, agora) {
  let melhor = null;
  for (const alarme of alarmes) {
    const instante = proximoDisparo(alarme, agora);
    if (instante != null && (!melhor || instante < melhor.instante)) melhor = { alarme, instante };
  }
  return melhor;
}
