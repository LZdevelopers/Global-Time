// Feriados nacionais, pontos facultativos federais e datas comemorativas.
//
// Classificação (importante — não misturar):
//  - "nacional": feriado previsto em lei federal; vale em todo o país.
//  - "facultativo": ponto facultativo da administração pública federal,
//    definido em portaria anual do Ministério da Gestão (MGI). NÃO é feriado:
//    empresas privadas, estados e municípios decidem se aderem.
//  - "comemorativa": data comemorativa sem folga.
//
// Regras de data:
//  { tipo: "fixa", mes, dia }
//  { tipo: "pascoa", deslocamento }        (dias em relação ao Domingo de Páscoa)
//  { tipo: "nesimo", mes, diaSemana, n }   (n-ésimo dia da semana do mês; 0 = domingo)
//  { tipo: "domingoSeguinte", mes, dia }   (a data, ou o domingo seguinte se não cair em domingo)
//
// Para atualizar: confira a portaria do MGI de cada ano (publicada em
// dezembro/janeiro) e ajuste EXTRAS_POR_ANO e os horários dos pontos parciais.

const LEI_FERIADOS = "https://www.planalto.gov.br/ccivil_03/leis/l0662.htm";
const LEI_10607 = "https://www.planalto.gov.br/ccivil_03/leis/2002/l10607.htm";
const LEI_9093 = "https://www.planalto.gov.br/ccivil_03/leis/l9093.htm";
const DOU_PORTARIA_2026 = "https://www.in.gov.br/web/dou/-/portaria-mgi-n-11.460-de-29-de-dezembro-de-2025-678388627";
// Portaria MGI nº 11.460/2025 (DOU de 30/12/2025): calendário federal de 2026.
const PORTARIA_2026 = DOU_PORTARIA_2026;

export const FONTE_CALENDARIO_FEDERAL = PORTARIA_2026;

export const FERIADOS_NACIONAIS = [
  {
    id: "confraternizacao-universal",
    nome: "Confraternização Universal",
    tipo: "nacional",
    regra: { tipo: "fixa", mes: 1, dia: 1 },
    base_legal: "Lei nº 662/1949, com redação da Lei nº 10.607/2002",
    fonte: LEI_10607,
  },
  {
    id: "paixao-de-cristo",
    nome: "Paixão de Cristo (Sexta-feira Santa)",
    tipo: "nacional",
    regra: { tipo: "pascoa", deslocamento: -2 },
    base_legal: "Lei nº 9.093/1995; listada como feriado nacional na portaria federal anual",
    fonte: LEI_9093,
    observacao:
      "Data móvel: dois dias antes da Páscoa. É feriado religioso previsto na Lei nº 9.093/1995 e consta como feriado nacional no calendário oficial federal.",
  },
  {
    id: "tiradentes",
    nome: "Tiradentes",
    tipo: "nacional",
    regra: { tipo: "fixa", mes: 4, dia: 21 },
    base_legal: "Lei nº 662/1949, com redação da Lei nº 10.607/2002",
    fonte: LEI_10607,
  },
  {
    id: "dia-do-trabalho",
    nome: "Dia do Trabalho",
    tipo: "nacional",
    regra: { tipo: "fixa", mes: 5, dia: 1 },
    base_legal: "Lei nº 662/1949, com redação da Lei nº 10.607/2002",
    fonte: LEI_10607,
  },
  {
    id: "independencia",
    nome: "Independência do Brasil",
    tipo: "nacional",
    regra: { tipo: "fixa", mes: 9, dia: 7 },
    base_legal: "Lei nº 662/1949, com redação da Lei nº 10.607/2002",
    fonte: LEI_10607,
  },
  {
    id: "nossa-senhora-aparecida",
    nome: "Nossa Senhora Aparecida",
    tipo: "nacional",
    regra: { tipo: "fixa", mes: 10, dia: 12 },
    base_legal: "Lei nº 6.802/1980",
    fonte: "https://www.planalto.gov.br/ccivil_03/leis/l6802.htm",
  },
  {
    id: "finados",
    nome: "Finados",
    tipo: "nacional",
    regra: { tipo: "fixa", mes: 11, dia: 2 },
    base_legal: "Lei nº 662/1949, com redação da Lei nº 10.607/2002",
    fonte: LEI_10607,
  },
  {
    id: "proclamacao-da-republica",
    nome: "Proclamação da República",
    tipo: "nacional",
    regra: { tipo: "fixa", mes: 11, dia: 15 },
    base_legal: "Lei nº 662/1949, com redação da Lei nº 10.607/2002",
    fonte: LEI_10607,
  },
  {
    id: "consciencia-negra",
    nome: "Dia Nacional de Zumbi e da Consciência Negra",
    tipo: "nacional",
    regra: { tipo: "fixa", mes: 11, dia: 20 },
    desde: 2024,
    base_legal: "Lei nº 14.759/2023",
    fonte: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14759.htm",
    observacao: "Feriado nacional a partir de 2024.",
  },
  {
    id: "natal",
    nome: "Natal",
    tipo: "nacional",
    regra: { tipo: "fixa", mes: 12, dia: 25 },
    base_legal: "Lei nº 662/1949, com redação da Lei nº 10.607/2002",
    fonte: LEI_FERIADOS,
  },

  // ---- Pontos facultativos federais (recorrentes) ----
  {
    id: "carnaval-segunda",
    nome: "Carnaval (segunda-feira)",
    tipo: "facultativo",
    regra: { tipo: "pascoa", deslocamento: -48 },
    base_legal: "Portaria anual do Ministério da Gestão (ponto facultativo federal)",
    fonte: PORTARIA_2026,
    observacao:
      "Não é feriado nacional. Pode ser feriado em alguns estados ou municípios por lei local.",
  },
  {
    id: "carnaval-terca",
    nome: "Carnaval (terça-feira)",
    tipo: "facultativo",
    regra: { tipo: "pascoa", deslocamento: -47 },
    base_legal: "Portaria anual do Ministério da Gestão (ponto facultativo federal)",
    fonte: PORTARIA_2026,
    observacao:
      "Não é feriado nacional. Pode ser feriado em alguns estados ou municípios por lei local.",
  },
  {
    id: "quarta-de-cinzas",
    nome: "Quarta-feira de Cinzas",
    tipo: "facultativo",
    parcial: "até as 14h",
    regra: { tipo: "pascoa", deslocamento: -46 },
    base_legal: "Portaria anual do Ministério da Gestão (ponto facultativo federal)",
    fonte: PORTARIA_2026,
  },
  {
    id: "corpus-christi",
    nome: "Corpus Christi",
    tipo: "facultativo",
    regra: { tipo: "pascoa", deslocamento: 60 },
    base_legal: "Portaria anual do Ministério da Gestão (ponto facultativo federal)",
    fonte: PORTARIA_2026,
    observacao:
      "Ponto facultativo federal. É feriado municipal em muitas cidades (Lei nº 9.093/1995).",
  },
  {
    id: "dia-do-servidor-publico",
    nome: "Dia do Servidor Público",
    tipo: "facultativo",
    regra: { tipo: "fixa", mes: 10, dia: 28 },
    base_legal: "Lei nº 8.112/1990, art. 236; ponto facultativo definido em portaria anual",
    fonte: PORTARIA_2026,
    observacao: "Vale para a administração pública federal; a data pode ser transferida pela portaria.",
  },
  {
    id: "vespera-de-natal",
    nome: "Véspera de Natal",
    tipo: "facultativo",
    parcial: "após as 13h",
    regra: { tipo: "fixa", mes: 12, dia: 24 },
    base_legal: "Portaria anual do Ministério da Gestão (ponto facultativo federal)",
    fonte: PORTARIA_2026,
  },
  {
    id: "vespera-de-ano-novo",
    nome: "Véspera de Ano-Novo",
    tipo: "facultativo",
    parcial: "após as 13h",
    regra: { tipo: "fixa", mes: 12, dia: 31 },
    base_legal: "Portaria anual do Ministério da Gestão (ponto facultativo federal)",
    fonte: PORTARIA_2026,
  },
];

// Pontos facultativos extras que só existem em um ano específico, conforme a
// portaria daquele ano. Também permite remover/transferir datas recorrentes.
export const EXTRAS_POR_ANO = {
  2026: {
    adicionar: [
      {
        id: "ponto-facultativo-2026-04-20",
        nome: "Ponto facultativo (emenda de Tiradentes)",
        tipo: "facultativo",
        regra: { tipo: "fixa", mes: 4, dia: 20 },
        base_legal: "Portaria MGI nº 11.460/2025 (calendário de 2026)",
        fonte: PORTARIA_2026,
      },
      {
        id: "ponto-facultativo-2026-06-05",
        nome: "Ponto facultativo (emenda de Corpus Christi)",
        tipo: "facultativo",
        regra: { tipo: "fixa", mes: 6, dia: 5 },
        base_legal: "Portaria MGI nº 11.460/2025 (calendário de 2026)",
        fonte: PORTARIA_2026,
      },
    ],
    remover: [],
  },
};

export const DATAS_COMEMORATIVAS = [
  { id: "pascoa", nome: "Páscoa", tipo: "comemorativa", regra: { tipo: "pascoa", deslocamento: 0 } },
  { id: "dia-da-mulher", nome: "Dia Internacional da Mulher", tipo: "comemorativa", regra: { tipo: "fixa", mes: 3, dia: 8 } },
  {
    id: "dia-dos-povos-indigenas",
    nome: "Dia dos Povos Indígenas",
    tipo: "comemorativa",
    regra: { tipo: "fixa", mes: 4, dia: 19 },
    base_legal: "Lei nº 14.402/2022",
  },
  { id: "dia-das-maes", nome: "Dia das Mães", tipo: "comemorativa", regra: { tipo: "nesimo", mes: 5, diaSemana: 0, n: 2 } },
  { id: "dia-dos-namorados", nome: "Dia dos Namorados", tipo: "comemorativa", regra: { tipo: "fixa", mes: 6, dia: 12 } },
  { id: "dia-dos-pais", nome: "Dia dos Pais", tipo: "comemorativa", regra: { tipo: "nesimo", mes: 8, diaSemana: 0, n: 2 } },
  { id: "dia-das-criancas", nome: "Dia das Crianças", tipo: "comemorativa", regra: { tipo: "fixa", mes: 10, dia: 12 } },
  { id: "dia-do-professor", nome: "Dia do Professor", tipo: "comemorativa", regra: { tipo: "fixa", mes: 10, dia: 15 } },
  { id: "dia-da-bandeira", nome: "Dia da Bandeira", tipo: "comemorativa", regra: { tipo: "fixa", mes: 11, dia: 19 } },
];
