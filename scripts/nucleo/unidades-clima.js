// Unidades do clima: temperatura, vento, chuva, visibilidade e pressão.
//
// A Open-Meteo responde sempre em °C, km/h, mm, metros e hPa; a conversão é
// feita só na hora de mostrar, então gráficos, limiares de chuva e cache
// continuam na mesma base.
//
// Padrão: o costume do país do visitante (não o do lugar consultado — quem
// mora nos EUA quer ver Paris em °F). O país vem da localização por IP ou GPS
// usada no clima; sem ela, da cidade do fuso do aparelho. Cada grandeza pode
// ser trocada à mão; a escolha fica salva e prevalece sobre o padrão.

import { numero, t } from "../i18n/estado.js";
import { codigoPais } from "../dados/cidades.js";
import { gravar, ler } from "./armazenamento.js";
import { cidadePreferida } from "./fuso-preferido.js";

const CHAVE_UNIDADES = "clima:unidades";
const CHAVE_PAIS = "clima:pais";

/** Unidades possíveis de cada grandeza; a primeira é a métrica (padrão). */
export const UNIDADES = Object.freeze({
  temperatura: ["c", "f"],
  vento: ["kmh", "mph", "ms"],
  chuva: ["mm", "pol"],
  distancia: ["km", "mi"],
  pressao: ["hpa", "kpa", "mmhg", "inhg"],
});

// Só onde o costume difere do métrico com km/h e hPa.
//  - EUA: sistema imperial em tudo.
//  - Reino Unido: °C, mas vento em mph e distâncias em milhas.
//  - Canadá: pressão em kPa (Environment Canada).
//  - Rússia: vento em m/s e pressão em mmHg.
//  - Noruega, Islândia, Japão, Coreia do Sul e China: vento em m/s.
const COSTUMES = {
  US: { temperatura: "f", vento: "mph", chuva: "pol", distancia: "mi", pressao: "inhg" },
  GB: { vento: "mph", distancia: "mi" },
  CA: { pressao: "kpa" },
  RU: { vento: "ms", pressao: "mmhg" },
  NO: { vento: "ms" },
  IS: { vento: "ms" },
  JP: { vento: "ms" },
  KR: { vento: "ms" },
  CN: { vento: "ms" },
};

/** Unidades costumeiras de um país (código ISO); métricas se desconhecido. */
export function unidadesDoPais(pais) {
  const padrao = Object.fromEntries(Object.entries(UNIDADES).map(([g, lista]) => [g, lista[0]]));
  return { ...padrao, ...(COSTUMES[String(pais || "").toUpperCase()] ?? {}) };
}

/** Guarda o país do visitante (de IP ou GPS) para escolher o padrão. */
export function registrarPaisDoVisitante(pais) {
  if (typeof pais === "string" && /^[A-Z]{2}$/i.test(pais)) gravar(CHAVE_PAIS, pais.toUpperCase());
}

/** País do visitante: o da localização usada no clima ou o da cidade do fuso do aparelho. */
export function paisDoVisitante() {
  const salvo = ler(CHAVE_PAIS);
  if (typeof salvo === "string" && /^[A-Z]{2}$/.test(salvo)) return salvo;
  return codigoPais(cidadePreferida());
}

/** Escolhas manuais válidas ({ vento: "ms", … }). */
export function escolhasManuais() {
  const salvo = ler(CHAVE_UNIDADES);
  if (!salvo || typeof salvo !== "object") return {};
  return Object.fromEntries(Object.entries(salvo).filter(([g, u]) => UNIDADES[g]?.includes(u)));
}

/** Escolhe a unidade de uma grandeza; `null` volta ao padrão do país. */
export function escolherUnidade(grandeza, unidade) {
  if (!UNIDADES[grandeza]) return;
  const escolhas = escolhasManuais();
  if (unidade && UNIDADES[grandeza].includes(unidade)) escolhas[grandeza] = unidade;
  else delete escolhas[grandeza];
  gravar(CHAVE_UNIDADES, escolhas);
}

/** Unidades em uso: o padrão do país com as escolhas manuais por cima. */
export function unidadesAtuais() {
  return { ...unidadesDoPais(paisDoVisitante()), ...escolhasManuais() };
}

// ---- Conversões (a partir de °C, km/h, mm, metros e hPa) -------------------------------
export function converterTemperatura(c, unidade) {
  return unidade === "f" ? (c * 9) / 5 + 32 : c;
}

export function converterVento(kmh, unidade) {
  if (unidade === "mph") return kmh / 1.609344;
  if (unidade === "ms") return kmh / 3.6;
  return kmh;
}

export function converterChuva(mm, unidade) {
  return unidade === "pol" ? mm / 25.4 : mm;
}

export function converterDistancia(metros, unidade) {
  return unidade === "mi" ? metros / 1609.344 : metros / 1000;
}

export function converterPressao(hpa, unidade) {
  if (unidade === "kpa") return hpa / 10;
  if (unidade === "mmhg") return hpa * 0.750062;
  if (unidade === "inhg") return hpa * 0.02953;
  return hpa;
}

// ---- Texto -----------------------------------------------------------------------------------
/** "23°" na unidade escolhida (arredondado; −0 vira 0). */
export function grau(celsius, unidade = "c") {
  if (!Number.isFinite(celsius)) return "—";
  return `${Math.round(converterTemperatura(celsius, unidade)) || 0}°`;
}

// Casas decimais: m/s com uma casa (ventos fracos ficariam todos em 1–3);
// polegadas com duas (1 mm ≈ 0,04 in); inHg com duas, kPa com uma.
const casas = (n) => (v) => numero(v, { maximumFractionDigits: n });
const inteiro = (v) => numero(Math.round(v));

const FORMATOS = {
  vento: { kmh: inteiro, mph: inteiro, ms: casas(1) },
  chuva: { mm: casas(1), pol: casas(2) },
  distancia: { km: casas(1), mi: casas(1) },
  pressao: { hpa: inteiro, kpa: casas(1), mmhg: inteiro, inhg: casas(2) },
};

const CONVERSORES = { vento: converterVento, chuva: converterChuva, distancia: converterDistancia, pressao: converterPressao };

/** Valor (na unidade da Open-Meteo) convertido e com o símbolo: "12 km/h", "0,08 in". */
export function formatarMedida(grandeza, valor, unidade) {
  const convertido = CONVERSORES[grandeza](valor, unidade);
  return t(`clima.${unidade}`, { valor: FORMATOS[grandeza][unidade](convertido) });
}

/** Símbolo da unidade no idioma atual ("°F", "km/h", "мм рт. ст."). */
export function simboloUnidade(unidade) {
  if (unidade === "c") return "°C";
  if (unidade === "f") return "°F";
  return t(`clima.${unidade}`, { valor: "" }).trim();
}
