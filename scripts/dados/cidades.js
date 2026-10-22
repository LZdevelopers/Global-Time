// Cidades com fuso IANA e coordenadas aproximadas (centro urbano, ~1 km).
// As coordenadas servem ao cálculo de nascer/pôr do sol; os fusos, ao relógio
// mundial e ao conversor. Os horários são sempre calculados pelos dados de
// fuso da plataforma (Intl), nunca por deslocamentos fixos.
//
// Os nomes estão em português do Brasil. Nos outros idiomas: grafias
// europeias em pt-PT e nomes em inglês nos demais (cidades brasileiras mantêm
// o nome próprio). Países vêm do Intl.DisplayNames, no idioma da interface.

import { idiomaAtual, locale, t } from "../i18n/estado.js";
import { CODIGOS_PAISES } from "./paises.js";

export const CIDADES = [
  // Brasil — capitais e Fernando de Noronha
  { id: "brasilia", nome: "Brasília", pais: "Brasil", uf: "DF", fuso: "America/Sao_Paulo", lat: -15.794, lon: -47.882 },
  { id: "sao-paulo", nome: "São Paulo", pais: "Brasil", uf: "SP", fuso: "America/Sao_Paulo", lat: -23.55, lon: -46.633 },
  { id: "rio-de-janeiro", nome: "Rio de Janeiro", pais: "Brasil", uf: "RJ", fuso: "America/Sao_Paulo", lat: -22.906, lon: -43.172 },
  { id: "belo-horizonte", nome: "Belo Horizonte", pais: "Brasil", uf: "MG", fuso: "America/Sao_Paulo", lat: -19.917, lon: -43.934 },
  { id: "vitoria", nome: "Vitória", pais: "Brasil", uf: "ES", fuso: "America/Sao_Paulo", lat: -20.32, lon: -40.338 },
  { id: "curitiba", nome: "Curitiba", pais: "Brasil", uf: "PR", fuso: "America/Sao_Paulo", lat: -25.429, lon: -49.271 },
  { id: "florianopolis", nome: "Florianópolis", pais: "Brasil", uf: "SC", fuso: "America/Sao_Paulo", lat: -27.595, lon: -48.548 },
  { id: "porto-alegre", nome: "Porto Alegre", pais: "Brasil", uf: "RS", fuso: "America/Sao_Paulo", lat: -30.035, lon: -51.218 },
  { id: "goiania", nome: "Goiânia", pais: "Brasil", uf: "GO", fuso: "America/Sao_Paulo", lat: -16.686, lon: -49.264 },
  { id: "campo-grande", nome: "Campo Grande", pais: "Brasil", uf: "MS", fuso: "America/Campo_Grande", lat: -20.469, lon: -54.62 },
  { id: "cuiaba", nome: "Cuiabá", pais: "Brasil", uf: "MT", fuso: "America/Cuiaba", lat: -15.601, lon: -56.097 },
  { id: "salvador", nome: "Salvador", pais: "Brasil", uf: "BA", fuso: "America/Bahia", lat: -12.971, lon: -38.501 },
  { id: "aracaju", nome: "Aracaju", pais: "Brasil", uf: "SE", fuso: "America/Maceio", lat: -10.911, lon: -37.072 },
  { id: "maceio", nome: "Maceió", pais: "Brasil", uf: "AL", fuso: "America/Maceio", lat: -9.666, lon: -35.735 },
  { id: "recife", nome: "Recife", pais: "Brasil", uf: "PE", fuso: "America/Recife", lat: -8.054, lon: -34.881 },
  { id: "joao-pessoa", nome: "João Pessoa", pais: "Brasil", uf: "PB", fuso: "America/Fortaleza", lat: -7.115, lon: -34.864 },
  { id: "natal", nome: "Natal", pais: "Brasil", uf: "RN", fuso: "America/Fortaleza", lat: -5.795, lon: -35.209 },
  { id: "fortaleza", nome: "Fortaleza", pais: "Brasil", uf: "CE", fuso: "America/Fortaleza", lat: -3.732, lon: -38.527 },
  { id: "teresina", nome: "Teresina", pais: "Brasil", uf: "PI", fuso: "America/Fortaleza", lat: -5.089, lon: -42.802 },
  { id: "sao-luis", nome: "São Luís", pais: "Brasil", uf: "MA", fuso: "America/Fortaleza", lat: -2.53, lon: -44.303 },
  { id: "belem", nome: "Belém", pais: "Brasil", uf: "PA", fuso: "America/Belem", lat: -1.456, lon: -48.502 },
  { id: "macapa", nome: "Macapá", pais: "Brasil", uf: "AP", fuso: "America/Belem", lat: 0.035, lon: -51.07 },
  { id: "palmas", nome: "Palmas", pais: "Brasil", uf: "TO", fuso: "America/Araguaina", lat: -10.184, lon: -48.334 },
  { id: "manaus", nome: "Manaus", pais: "Brasil", uf: "AM", fuso: "America/Manaus", lat: -3.119, lon: -60.022 },
  { id: "boa-vista", nome: "Boa Vista", pais: "Brasil", uf: "RR", fuso: "America/Boa_Vista", lat: 2.82, lon: -60.672 },
  { id: "porto-velho", nome: "Porto Velho", pais: "Brasil", uf: "RO", fuso: "America/Porto_Velho", lat: -8.761, lon: -63.904 },
  { id: "rio-branco", nome: "Rio Branco", pais: "Brasil", uf: "AC", fuso: "America/Rio_Branco", lat: -9.975, lon: -67.81 },
  { id: "fernando-de-noronha", nome: "Fernando de Noronha", pais: "Brasil", uf: "PE", fuso: "America/Noronha", lat: -3.854, lon: -32.424 },

  // América do Sul e Central
  { id: "buenos-aires", nome: "Buenos Aires", pais: "Argentina", fuso: "America/Argentina/Buenos_Aires", lat: -34.604, lon: -58.382 },
  { id: "ushuaia", nome: "Ushuaia", pais: "Argentina", fuso: "America/Argentina/Ushuaia", lat: -54.801, lon: -68.303 },
  { id: "montevideu", nome: "Montevidéu", pais: "Uruguai", fuso: "America/Montevideo", lat: -34.901, lon: -56.165 },
  { id: "assuncao", nome: "Assunção", pais: "Paraguai", fuso: "America/Asuncion", lat: -25.264, lon: -57.576 },
  { id: "santiago", nome: "Santiago", pais: "Chile", fuso: "America/Santiago", lat: -33.449, lon: -70.669 },
  { id: "la-paz", nome: "La Paz", pais: "Bolívia", fuso: "America/La_Paz", lat: -16.5, lon: -68.15 },
  { id: "lima", nome: "Lima", pais: "Peru", fuso: "America/Lima", lat: -12.046, lon: -77.043 },
  { id: "bogota", nome: "Bogotá", pais: "Colômbia", fuso: "America/Bogota", lat: 4.711, lon: -74.072 },
  { id: "caracas", nome: "Caracas", pais: "Venezuela", fuso: "America/Caracas", lat: 10.481, lon: -66.904 },
  { id: "cidade-do-mexico", nome: "Cidade do México", pais: "México", fuso: "America/Mexico_City", lat: 19.433, lon: -99.133 },

  // América do Norte
  { id: "nova-york", nome: "Nova York", pais: "Estados Unidos", fuso: "America/New_York", lat: 40.713, lon: -74.006 },
  { id: "washington", nome: "Washington", pais: "Estados Unidos", fuso: "America/New_York", lat: 38.907, lon: -77.037 },
  { id: "miami", nome: "Miami", pais: "Estados Unidos", fuso: "America/New_York", lat: 25.762, lon: -80.192 },
  { id: "toronto", nome: "Toronto", pais: "Canadá", fuso: "America/Toronto", lat: 43.653, lon: -79.383 },
  { id: "chicago", nome: "Chicago", pais: "Estados Unidos", fuso: "America/Chicago", lat: 41.878, lon: -87.63 },
  { id: "denver", nome: "Denver", pais: "Estados Unidos", fuso: "America/Denver", lat: 39.739, lon: -104.99 },
  { id: "los-angeles", nome: "Los Angeles", pais: "Estados Unidos", fuso: "America/Los_Angeles", lat: 34.052, lon: -118.244 },
  { id: "sao-francisco", nome: "São Francisco", pais: "Estados Unidos", fuso: "America/Los_Angeles", lat: 37.775, lon: -122.419 },
  { id: "vancouver", nome: "Vancouver", pais: "Canadá", fuso: "America/Vancouver", lat: 49.283, lon: -123.121 },
  { id: "anchorage", nome: "Anchorage", pais: "Estados Unidos", fuso: "America/Anchorage", lat: 61.218, lon: -149.9 },
  { id: "honolulu", nome: "Honolulu", pais: "Estados Unidos", fuso: "Pacific/Honolulu", lat: 21.307, lon: -157.858 },

  // Europa
  { id: "lisboa", nome: "Lisboa", pais: "Portugal", fuso: "Europe/Lisbon", lat: 38.722, lon: -9.139 },
  { id: "porto", nome: "Porto", pais: "Portugal", fuso: "Europe/Lisbon", lat: 41.158, lon: -8.629 },
  { id: "londres", nome: "Londres", pais: "Reino Unido", fuso: "Europe/London", lat: 51.507, lon: -0.128 },
  { id: "dublin", nome: "Dublin", pais: "Irlanda", fuso: "Europe/Dublin", lat: 53.35, lon: -6.26 },
  { id: "madri", nome: "Madri", pais: "Espanha", fuso: "Europe/Madrid", lat: 40.417, lon: -3.704 },
  { id: "paris", nome: "Paris", pais: "França", fuso: "Europe/Paris", lat: 48.857, lon: 2.352 },
  { id: "amsterda", nome: "Amsterdã", pais: "Países Baixos", fuso: "Europe/Amsterdam", lat: 52.368, lon: 4.904 },
  { id: "berlim", nome: "Berlim", pais: "Alemanha", fuso: "Europe/Berlin", lat: 52.52, lon: 13.405 },
  { id: "zurique", nome: "Zurique", pais: "Suíça", fuso: "Europe/Zurich", lat: 47.377, lon: 8.541 },
  { id: "roma", nome: "Roma", pais: "Itália", fuso: "Europe/Rome", lat: 41.903, lon: 12.496 },
  { id: "atenas", nome: "Atenas", pais: "Grécia", fuso: "Europe/Athens", lat: 37.984, lon: 23.728 },
  { id: "istambul", nome: "Istambul", pais: "Turquia", fuso: "Europe/Istanbul", lat: 41.008, lon: 28.978 },
  { id: "moscou", nome: "Moscou", pais: "Rússia", fuso: "Europe/Moscow", lat: 55.756, lon: 37.617 },
  { id: "reykjavik", nome: "Reykjavík", pais: "Islândia", fuso: "Atlantic/Reykjavik", lat: 64.147, lon: -21.942 },
  { id: "tromso", nome: "Tromsø", pais: "Noruega", fuso: "Europe/Oslo", lat: 69.649, lon: 18.956 },

  // África e Oriente Médio
  { id: "luanda", nome: "Luanda", pais: "Angola", fuso: "Africa/Luanda", lat: -8.839, lon: 13.289 },
  { id: "maputo", nome: "Maputo", pais: "Moçambique", fuso: "Africa/Maputo", lat: -25.969, lon: 32.573 },
  { id: "lagos", nome: "Lagos", pais: "Nigéria", fuso: "Africa/Lagos", lat: 6.524, lon: 3.379 },
  { id: "joanesburgo", nome: "Joanesburgo", pais: "África do Sul", fuso: "Africa/Johannesburg", lat: -26.204, lon: 28.047 },
  { id: "cairo", nome: "Cairo", pais: "Egito", fuso: "Africa/Cairo", lat: 30.044, lon: 31.236 },
  { id: "tel-aviv", nome: "Tel Aviv", pais: "Israel", fuso: "Asia/Jerusalem", lat: 32.085, lon: 34.782 },
  { id: "dubai", nome: "Dubai", pais: "Emirados Árabes Unidos", fuso: "Asia/Dubai", lat: 25.205, lon: 55.271 },
  { id: "teera", nome: "Teerã", pais: "Irã", fuso: "Asia/Tehran", lat: 35.689, lon: 51.389 },

  // Ásia e Oceania
  { id: "mumbai", nome: "Mumbai", pais: "Índia", fuso: "Asia/Kolkata", lat: 19.076, lon: 72.878 },
  { id: "nova-delhi", nome: "Nova Délhi", pais: "Índia", fuso: "Asia/Kolkata", lat: 28.614, lon: 77.209 },
  { id: "katmandu", nome: "Katmandu", pais: "Nepal", fuso: "Asia/Kathmandu", lat: 27.717, lon: 85.324 },
  { id: "singapura", nome: "Singapura", pais: "Singapura", fuso: "Asia/Singapore", lat: 1.352, lon: 103.82 },
  { id: "hong-kong", nome: "Hong Kong", pais: "China", fuso: "Asia/Hong_Kong", lat: 22.319, lon: 114.169 },
  { id: "xangai", nome: "Xangai", pais: "China", fuso: "Asia/Shanghai", lat: 31.23, lon: 121.474 },
  { id: "pequim", nome: "Pequim", pais: "China", fuso: "Asia/Shanghai", lat: 39.904, lon: 116.407 },
  { id: "seul", nome: "Seul", pais: "Coreia do Sul", fuso: "Asia/Seoul", lat: 37.567, lon: 126.978 },
  { id: "toquio", nome: "Tóquio", pais: "Japão", fuso: "Asia/Tokyo", lat: 35.676, lon: 139.65 },
  { id: "sydney", nome: "Sydney", pais: "Austrália", fuso: "Australia/Sydney", lat: -33.869, lon: 151.209 },
  { id: "melbourne", nome: "Melbourne", pais: "Austrália", fuso: "Australia/Melbourne", lat: -37.814, lon: 144.963 },
  { id: "adelaide", nome: "Adelaide", pais: "Austrália", fuso: "Australia/Adelaide", lat: -34.929, lon: 138.601 },
  { id: "auckland", nome: "Auckland", pais: "Nova Zelândia", fuso: "Pacific/Auckland", lat: -36.849, lon: 174.763 },
];

// Uma cidade por fuso brasileiro além de Brasília (atalho do relógio mundial).
export const CIDADES_FUSOS_BRASIL = ["fernando-de-noronha", "manaus", "rio-branco"];

export function buscarCidade(id) {
  return CIDADES.find((c) => c.id === id) ?? null;
}

// Só onde o nome difere do português do Brasil.
const NOMES_PT_PT = {
  "nova-york": "Nova Iorque", madri: "Madrid", amsterda: "Amesterdão", moscou: "Moscovo", teera: "Teerão",
  "nova-delhi": "Nova Deli", montevideu: "Montevideu", "cidade-do-mexico": "Cidade do México",
};
const NOMES_EN = {
  montevideu: "Montevideo", assuncao: "Asunción", "cidade-do-mexico": "Mexico City", "nova-york": "New York",
  "sao-francisco": "San Francisco", lisboa: "Lisbon", londres: "London", madri: "Madrid", amsterda: "Amsterdam",
  berlim: "Berlin", zurique: "Zurich", roma: "Rome", atenas: "Athens", istambul: "Istanbul", moscou: "Moscow",
  joanesburgo: "Johannesburg", teera: "Tehran", "nova-delhi": "New Delhi", katmandu: "Kathmandu",
  singapura: "Singapore", xangai: "Shanghai", pequim: "Beijing", seul: "Seoul", toquio: "Tokyo", cairo: "Cairo",
};

/** Nome da cidade no idioma da interface. */
export function nomeCidade(cidade) {
  const idioma = idiomaAtual();
  if (idioma === "pt-BR") return cidade.nome;
  if (idioma === "pt-PT") return NOMES_PT_PT[cidade.id] ?? cidade.nome;
  return NOMES_EN[cidade.id] ?? cidade.nome;
}

/** Código ISO do país da cidade ("BR"), ou null. */
export function codigoPais(cidade) {
  return (cidade && CODIGOS_PAISES[cidade.pais]) ?? null;
}

let nomesRegioes = null;
/** Nome do país no idioma da interface. */
export function nomePais(cidade) {
  if (idiomaAtual() === "pt-BR") return cidade.pais;
  try {
    if (nomesRegioes?.locale !== locale()) nomesRegioes = { locale: locale(), f: new Intl.DisplayNames([locale()], { type: "region" }) };
    return nomesRegioes.f.of(CODIGOS_PAISES[cidade.pais]) ?? cidade.pais;
  } catch {
    return cidade.pais;
  }
}

/** "São Paulo (SP)" ou "Lisboa, Portugal". */
export function rotuloCidade(cidade) {
  return cidade.uf ? `${nomeCidade(cidade)} (${cidade.uf})` : `${nomeCidade(cidade)}, ${nomePais(cidade)}`;
}

const REGIOES = [
  ["regioes.brasil", (c) => c.pais === "Brasil"],
  ["regioes.americas", (c) => c.fuso.startsWith("America/") || c.fuso.startsWith("Pacific/Honolulu")],
  ["regioes.europa", (c) => c.fuso.startsWith("Europe/") || c.fuso.startsWith("Atlantic/")],
  ["regioes.africaOrienteMedio", (c) => c.fuso.startsWith("Africa/") || ["Asia/Dubai", "Asia/Tehran", "Asia/Jerusalem"].includes(c.fuso)],
  ["regioes.asiaOceania", () => true],
];

/** Opções agrupadas para <select>: [{ valor, rotulo, grupo }]. */
export function opcoesCidades(filtro = () => true) {
  return CIDADES.filter(filtro).map((c) => ({
    valor: c.id,
    rotulo: rotuloCidade(c),
    grupo: t(REGIOES.find(([, teste]) => teste(c))[0]),
  }));
}

// O Chrome (ICU) informa alguns fusos pelo nome antigo do IANA; a lista de
// cidades usa o atual.
const FUSOS_ANTIGOS = {
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Calcutta": "Asia/Kolkata",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
};

/** Fuso IANA informado pelo navegador. Indica a configuração do aparelho, não necessariamente onde a pessoa está. */
export function fusoDoNavegador() {
  try {
    const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    return FUSOS_ANTIGOS[fuso] ?? fuso;
  } catch {
    return null;
  }
}

/** Cidade cadastrada para um fuso IANA, se houver. */
export function cidadeDoFuso(fuso) {
  const atual = FUSOS_ANTIGOS[fuso] ?? fuso;
  return CIDADES.find((c) => c.fuso === atual) ?? null;
}

/** Nome legível de um fuso IANA: a cidade cadastrada ou o último trecho do identificador. */
export function nomeDoFuso(fuso) {
  const cidade = cidadeDoFuso(fuso);
  return cidade ? nomeCidade(cidade) : fuso.split("/").pop().replace(/_/g, " ");
}
