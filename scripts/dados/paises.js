// Países das cidades do relógio mundial (scripts/dados/cidades.js), pelo nome
// usado lá, com o código ISO 3166-1 alfa-2. Fonte única para os nomes
// traduzidos (Intl.DisplayNames) e para os países do calendário. Sem DOM:
// usado também pela função /api/feriados.
//
// Ao incluir uma cidade de um país novo, acrescente o país aqui.

export const CODIGOS_PAISES = {
  Brasil: "BR", Argentina: "AR", Uruguai: "UY", Paraguai: "PY", Chile: "CL", "Bolívia": "BO", Peru: "PE",
  "Colômbia": "CO", Venezuela: "VE", "México": "MX", "Estados Unidos": "US", "Canadá": "CA", Portugal: "PT",
  "Reino Unido": "GB", Irlanda: "IE", Espanha: "ES", "França": "FR", "Países Baixos": "NL", Alemanha: "DE",
  "Suíça": "CH", "Itália": "IT", "Grécia": "GR", Turquia: "TR", "Rússia": "RU", "Islândia": "IS", Noruega: "NO",
  Angola: "AO", "Moçambique": "MZ", "Nigéria": "NG", "África do Sul": "ZA", Egito: "EG", Israel: "IL",
  "Emirados Árabes Unidos": "AE", "Irã": "IR", "Índia": "IN", Nepal: "NP", Singapura: "SG", China: "CN",
  "Coreia do Sul": "KR", "Japão": "JP", "Austrália": "AU", "Nova Zelândia": "NZ",
};

/** Códigos ISO dos países do relógio mundial, sem repetição. */
export const PAISES_RELOGIO = Object.freeze([...new Set(Object.values(CODIGOS_PAISES))]);
