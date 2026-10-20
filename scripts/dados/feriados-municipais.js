// Feriados MUNICIPAIS das capitais estaduais.
// Dados compilados em 2026-10-19.
//
// Cobre: somente capitais com fonte verificada (lei municipal citada em
// texto legal, decreto da prefeitura ou calendário oficial de órgão público).
//
// NÃO é uma base completa de feriados municipais: ficam de fora os demais
// municípios, as capitais sem fonte confirmada (Macapá, Natal, Cuiabá,
// Campo Grande e Goiânia), pontos facultativos, transferências pontuais por
// decreto e datas que coincidem com feriado nacional ou estadual (ex.: Sexta
// Santa, Finados, São Jorge no Rio, 5/set em Manaus, 5/ago em João Pessoa).
// A Consciência Negra (20/nov) é feriado nacional desde 2024; leis
// municipais anteriores aparecem com `ate: 2023`.
// Brasília (DF) não tem municípios e não aparece aqui.

export const FERIADOS_MUNICIPAIS = [
  // ---------------- AC — Rio Branco ----------------
  {
    id: "ac-rio-branco-aniversario",
    nome: "Aniversário de Rio Branco",
    uf: "AC",
    municipio: "Rio Branco",
    regra: { tipo: "fixa", mes: 12, dia: 28 },
    base_legal: "Lei municipal nº 1.609/2006",
    fonte: "https://www.tjac.jus.br/wp-content/uploads/2017/12/Portaria_PRESI_TJAC_2803_2017.pdf",
    observacao: "Já foi transferido por decreto em alguns anos.",
  },

  // ---------------- AL — Maceió ----------------
  {
    id: "al-maceio-corpus-christi",
    nome: "Corpus Christi",
    uf: "AL",
    municipio: "Maceió",
    regra: { tipo: "pascoa", deslocamento: 60 },
    base_legal: "Lei municipal nº 1.391/1967",
    fonte: "https://www.normasbrasil.com.br/norma/decreto-9696-2023-maceio_454429.html",
  },
  {
    id: "al-maceio-nossa-senhora-dos-prazeres",
    nome: "Nossa Senhora dos Prazeres (padroeira)",
    uf: "AL",
    municipio: "Maceió",
    regra: { tipo: "fixa", mes: 8, dia: 27 },
    base_legal: "Lei municipal nº 1.391/1967",
    fonte: "https://www.normasbrasil.com.br/norma/decreto-9696-2023-maceio_454429.html",
  },
  {
    id: "al-maceio-nossa-senhora-da-conceicao",
    nome: "Nossa Senhora da Conceição",
    uf: "AL",
    municipio: "Maceió",
    regra: { tipo: "fixa", mes: 12, dia: 8 },
    base_legal: "Lei municipal nº 1.391/1967",
    fonte: "https://www.normasbrasil.com.br/norma/decreto-9696-2023-maceio_454429.html",
  },

  // ---------------- AM — Manaus ----------------
  {
    id: "am-manaus-carnaval",
    nome: "Carnaval (terça-feira)",
    uf: "AM",
    municipio: "Manaus",
    regra: { tipo: "pascoa", deslocamento: -47 },
    base_legal: "Lei municipal nº 448/1998",
    fonte: "https://www.normasbrasil.com.br/norma/decreto-2025-manaus_472882.html",
  },
  {
    id: "am-manaus-corpus-christi",
    nome: "Corpus Christi",
    uf: "AM",
    municipio: "Manaus",
    regra: { tipo: "pascoa", deslocamento: 60 },
    base_legal: "Lei municipal nº 970/2006",
    fonte: "https://www.normasbrasil.com.br/norma/decreto-2025-manaus_472882.html",
  },
  {
    id: "am-manaus-elevacao-a-cidade",
    nome: "Elevação de Manaus à categoria de cidade",
    uf: "AM",
    municipio: "Manaus",
    regra: { tipo: "fixa", mes: 10, dia: 24 },
    base_legal: "Lei Orgânica do Município de Manaus, art. 437, II",
    fonte: "https://www.normasbrasil.com.br/norma/decreto-2025-manaus_472882.html",
  },
  {
    id: "am-manaus-nossa-senhora-da-conceicao",
    nome: "Nossa Senhora da Conceição (padroeira)",
    uf: "AM",
    municipio: "Manaus",
    regra: { tipo: "fixa", mes: 12, dia: 8 },
    base_legal: "Lei municipal nº 496/1999",
    fonte: "https://www.normasbrasil.com.br/norma/decreto-2025-manaus_472882.html",
  },

  // ---------------- BA — Salvador ----------------
  {
    id: "ba-salvador-corpus-christi",
    nome: "Corpus Christi",
    uf: "BA",
    municipio: "Salvador",
    regra: { tipo: "pascoa", deslocamento: 60 },
    base_legal: "Lei municipal nº 1.997/1967",
    fonte: "https://trf1.jus.br/sjba/conteudo/files/SEITRF1-12268879-PortariaSJBA-Diref.pdf",
    observacao: "O calendário do TJBA para 2026 lista em Salvador apenas 24/jun e 8/dez.",
  },
  {
    id: "ba-salvador-sao-joao",
    nome: "São João",
    uf: "BA",
    municipio: "Salvador",
    regra: { tipo: "fixa", mes: 6, dia: 24 },
    base_legal: "Lei municipal nº 1.997/1967",
    fonte: "https://trf1.jus.br/sjba/conteudo/files/SEITRF1-12268879-PortariaSJBA-Diref.pdf",
  },
  {
    id: "ba-salvador-conceicao-da-praia",
    nome: "Nossa Senhora da Conceição da Praia",
    uf: "BA",
    municipio: "Salvador",
    regra: { tipo: "fixa", mes: 12, dia: 8 },
    base_legal: "Lei municipal nº 1.997/1967",
    fonte: "https://trf1.jus.br/sjba/conteudo/files/SEITRF1-12268879-PortariaSJBA-Diref.pdf",
  },

  // ---------------- CE — Fortaleza ----------------
  {
    id: "ce-fortaleza-tricentenario",
    nome: "Aniversário de 300 anos de Fortaleza",
    uf: "CE",
    municipio: "Fortaleza",
    regra: { tipo: "fixa", mes: 4, dia: 13 },
    desde: 2026,
    ate: 2026,
    base_legal: "Lei municipal nº 11.649/2026",
    fonte: "https://www.trt7.jus.br/files/atos_normativos/portarias_presidencia/2026/PORTARIA%20PRESI%20N%20127-2026.pdf",
    observacao: "Feriado excepcional, válido somente em 2026.",
  },
  {
    id: "ce-fortaleza-corpus-christi",
    nome: "Corpus Christi",
    uf: "CE",
    municipio: "Fortaleza",
    regra: { tipo: "pascoa", deslocamento: 60 },
    base_legal: "Lei municipal nº 8.796/2003",
    fonte: "https://www.trt7.jus.br/files/atos_normativos/portarias_presidencia/2020/BD_PORTARIA_PRESI_105-2020.pdf",
  },
  {
    id: "ce-fortaleza-nossa-senhora-da-assuncao",
    nome: "Nossa Senhora da Assunção (padroeira)",
    uf: "CE",
    municipio: "Fortaleza",
    regra: { tipo: "fixa", mes: 8, dia: 15 },
    base_legal: "Lei municipal nº 8.796/2003",
    fonte: "https://www.trt7.jus.br/files/atos_normativos/portarias_presidencia/2020/BD_PORTARIA_PRESI_105-2020.pdf",
  },

  // ---------------- MA — São Luís ----------------
  {
    id: "ma-sao-luis-aniversario",
    nome: "Aniversário de São Luís / Natividade de Nossa Senhora",
    uf: "MA",
    municipio: "São Luís",
    regra: { tipo: "fixa", mes: 9, dia: 8 },
    desde: 1996,
    base_legal: "Lei municipal nº 3.432/1996",
    fonte: "https://oimparcial.com.br/cidades/2021/05/comercio-em-sao-luis-funcionara-normalmente-no-dia-de-corpus-christi/",
    observacao: "A mesma lei deixou de considerar Corpus Christi feriado em São Luís.",
  },

  // ---------------- PA — Belém ----------------
  {
    id: "pa-belem-corpus-christi",
    nome: "Corpus Christi",
    uf: "PA",
    municipio: "Belém",
    regra: { tipo: "pascoa", deslocamento: 60 },
    base_legal: "Lei municipal nº 6.306/1967",
    fonte: "https://trf1.jus.br/sjpa/conteudo/SEI_22086919_Portaria_SJPA_Diref_17.pdf",
  },
  {
    id: "pa-belem-imaculada-conceicao",
    nome: "Nossa Senhora da Imaculada Conceição",
    uf: "PA",
    municipio: "Belém",
    regra: { tipo: "fixa", mes: 12, dia: 8 },
    base_legal: "Lei municipal nº 6.306/1967",
    fonte: "https://trf1.jus.br/sjpa/conteudo/SEI_22086919_Portaria_SJPA_Diref_17.pdf",
  },

  // ---------------- PB — João Pessoa ----------------
  {
    id: "pb-joao-pessoa-sao-joao",
    nome: "São João",
    uf: "PB",
    municipio: "João Pessoa",
    regra: { tipo: "fixa", mes: 6, dia: 24 },
    base_legal: "Lei municipal nº 13.768/2019",
    fonte: "https://biblioteca.mpf.mp.br/repositorio/bitstreams/ff3f25d9-69ea-47d4-96e4-e386f7944b2d/download",
  },
  {
    id: "pb-joao-pessoa-nossa-senhora-da-conceicao",
    nome: "Nossa Senhora da Conceição",
    uf: "PB",
    municipio: "João Pessoa",
    regra: { tipo: "fixa", mes: 12, dia: 8 },
    base_legal: "Lei municipal nº 13.768/2019",
    fonte: "https://biblioteca.mpf.mp.br/repositorio/bitstreams/ff3f25d9-69ea-47d4-96e4-e386f7944b2d/download",
  },

  // ---------------- PE — Recife ----------------
  {
    id: "pe-recife-sao-joao",
    nome: "São João",
    uf: "PE",
    municipio: "Recife",
    regra: { tipo: "fixa", mes: 6, dia: 24 },
    base_legal: "Lei municipal nº 9.777/1967",
    fonte: "https://biblioteca.mpf.mp.br/repositorio/bitstreams/5e28bd59-cb6b-460d-acb8-148336447f3c/download",
  },
  {
    id: "pe-recife-nossa-senhora-do-carmo",
    nome: "Nossa Senhora do Carmo (padroeira)",
    uf: "PE",
    municipio: "Recife",
    regra: { tipo: "fixa", mes: 7, dia: 16 },
    base_legal: "Lei municipal nº 9.777/1967",
    fonte: "https://portal.tjpe.jus.br/documents/d/portal/feriados-2026-pdf",
  },

  // ---------------- PI — Teresina ----------------
  {
    id: "pi-teresina-aniversario",
    nome: "Aniversário de Teresina / Nossa Senhora do Amparo",
    uf: "PI",
    municipio: "Teresina",
    regra: { tipo: "fixa", mes: 8, dia: 16 },
    base_legal: "Lei municipal nº 2.275/1994",
    fonte: "https://biblioteca.mpf.mp.br/repositorio/bitstreams/0a6f0e39-6eb3-4d1a-b185-db0f306c3cd4/download",
    observacao: "Excepcionalmente antecipado para 31/03/2021 (Lei municipal nº 5.573/2021).",
  },

  // ---------------- RO — Porto Velho ----------------
  {
    id: "ro-porto-velho-nossa-senhora-auxiliadora",
    nome: "Nossa Senhora Auxiliadora (padroeira)",
    uf: "RO",
    municipio: "Porto Velho",
    regra: { tipo: "fixa", mes: 5, dia: 24 },
    base_legal: "Lei municipal nº 190/1980",
    fonte: "https://semad.portovelho.ro.gov.br/uploads/editor/files/Dec_%2017_221-2021.pdf",
  },
  {
    id: "ro-porto-velho-criacao-do-municipio",
    nome: "Criação do município de Porto Velho",
    uf: "RO",
    municipio: "Porto Velho",
    regra: { tipo: "fixa", mes: 10, dia: 2 },
    base_legal: "Lei municipal nº 190/1980",
    fonte: "https://semad.portovelho.ro.gov.br/uploads/editor/files/Dec_%2017_221-2021.pdf",
    observacao: "É transferido com frequência por decreto municipal.",
  },

  // ---------------- RR — Boa Vista ----------------
  {
    id: "rr-boa-vista-sao-sebastiao",
    nome: "São Sebastião",
    uf: "RR",
    municipio: "Boa Vista",
    regra: { tipo: "fixa", mes: 1, dia: 20 },
    base_legal: "Lei municipal nº 104/1984",
    fonte: "https://biblioteca.mpf.mp.br/repositorio/bitstreams/0e8b3b82-6f08-4cd3-91cf-c3a21e4ec236/download",
  },
  {
    id: "rr-boa-vista-sao-pedro",
    nome: "São Pedro",
    uf: "RR",
    municipio: "Boa Vista",
    regra: { tipo: "fixa", mes: 6, dia: 29 },
    base_legal: "Lei municipal nº 104/1984",
    fonte: "https://biblioteca.mpf.mp.br/repositorio/bitstreams/0e8b3b82-6f08-4cd3-91cf-c3a21e4ec236/download",
  },

  // ---------------- SE — Aracaju ----------------
  {
    id: "se-aracaju-aniversario",
    nome: "Aniversário de Aracaju",
    uf: "SE",
    municipio: "Aracaju",
    regra: { tipo: "fixa", mes: 3, dia: 17 },
    base_legal: "Lei municipal nº 3.805/2009",
    fonte: "https://biblioteca.mpf.mp.br/repositorio/bitstreams/1e49512d-7528-44e8-bb6f-96128eb68d3c/download",
  },
  {
    id: "se-aracaju-sao-joao",
    nome: "São João",
    uf: "SE",
    municipio: "Aracaju",
    regra: { tipo: "fixa", mes: 6, dia: 24 },
    base_legal: "Lei municipal nº 3.805/2009",
    fonte: "https://biblioteca.mpf.mp.br/repositorio/bitstreams/1e49512d-7528-44e8-bb6f-96128eb68d3c/download",
  },

  // ---------------- TO — Palmas ----------------
  {
    id: "to-palmas-sao-jose",
    nome: "São José (padroeiro de Palmas)",
    uf: "TO",
    municipio: "Palmas",
    regra: { tipo: "fixa", mes: 3, dia: 19 },
    base_legal: "Lei municipal nº 577/1996",
    fonte: "https://trf1.jus.br/sjto/conteudo/files/PORTARIA%20SJTO-DIREF%201.2023%20-%20FERIADOS.pdf",
  },
  {
    id: "to-palmas-aniversario",
    nome: "Aniversário de Palmas",
    uf: "TO",
    municipio: "Palmas",
    regra: { tipo: "fixa", mes: 5, dia: 20 },
    base_legal: "Lei municipal nº 108/1991",
    fonte: "https://trf1.jus.br/sjto/conteudo/files/PORTARIA%20SJTO-DIREF%201.2023%20-%20FERIADOS.pdf",
  },

  // ---------------- SP — São Paulo ----------------
  {
    id: "sp-sao-paulo-aniversario",
    nome: "Aniversário da Cidade de São Paulo",
    uf: "SP",
    municipio: "São Paulo",
    regra: { tipo: "fixa", mes: 1, dia: 25 },
    base_legal: "Lei municipal nº 7.008/1967; Lei municipal nº 14.485/2007, art. 10",
    fonte: "https://www.normasbrasil.com.br/norma/decreto-55703-2014-sao-paulo_277178.html",
  },
  {
    id: "sp-sao-paulo-corpus-christi",
    nome: "Corpus Christi",
    uf: "SP",
    municipio: "São Paulo",
    regra: { tipo: "pascoa", deslocamento: 60 },
    base_legal: "Lei municipal nº 14.485/2007",
    fonte: "https://prefeitura.sp.gov.br/web/gestao/w/calendario_2026",
  },
  {
    id: "sp-sao-paulo-consciencia-negra",
    nome: "Dia da Consciência Negra",
    uf: "SP",
    municipio: "São Paulo",
    regra: { tipo: "fixa", mes: 11, dia: 20 },
    desde: 2004,
    ate: 2023,
    base_legal: "Lei municipal nº 13.707/2004; Lei municipal nº 14.485/2007, art. 9",
    fonte: "https://www.normasbrasil.com.br/norma/decreto-55703-2014-sao-paulo_277178.html",
    observacao: "Feriado nacional desde 2024 (Lei federal nº 14.759/2023).",
  },

  // ---------------- RJ — Rio de Janeiro ----------------
  {
    id: "rj-rio-de-janeiro-sao-sebastiao",
    nome: "Dia de São Sebastião (padroeiro)",
    uf: "RJ",
    municipio: "Rio de Janeiro",
    regra: { tipo: "fixa", mes: 1, dia: 20 },
    base_legal: "Lei municipal nº 5.146/2010, art. 8º, I",
    fonte: "https://www.normasbrasil.com.br/norma/lei-5146-2010-rio-de-janeiro_177516.html",
  },
  {
    id: "rj-rio-de-janeiro-zumbi",
    nome: "Dia de Zumbi dos Palmares",
    uf: "RJ",
    municipio: "Rio de Janeiro",
    regra: { tipo: "fixa", mes: 11, dia: 20 },
    ate: 2023,
    base_legal: "Lei municipal nº 5.146/2010, art. 8º, IV",
    fonte: "https://www.normasbrasil.com.br/norma/lei-5146-2010-rio-de-janeiro_177516.html",
    observacao: "Feriado nacional desde 2024 (Lei federal nº 14.759/2023).",
  },

  // ---------------- MG — Belo Horizonte ----------------
  {
    id: "mg-belo-horizonte-corpus-christi",
    nome: "Corpus Christi",
    uf: "MG",
    municipio: "Belo Horizonte",
    regra: { tipo: "pascoa", deslocamento: 60 },
    base_legal: "Lei municipal nº 11.397/2022, Anexo V",
    fonte: "https://www8.tjmg.jus.br/institucional/at/pdf/pc17982026.pdf",
  },
  {
    id: "mg-belo-horizonte-assuncao",
    nome: "Assunção de Nossa Senhora",
    uf: "MG",
    municipio: "Belo Horizonte",
    regra: { tipo: "fixa", mes: 8, dia: 15 },
    base_legal: "Lei municipal nº 11.397/2022, Anexo V",
    fonte: "https://www8.tjmg.jus.br/institucional/at/pdf/pc17982026.pdf",
  },
  {
    id: "mg-belo-horizonte-consciencia-negra",
    nome: "Dia da Consciência Negra",
    uf: "MG",
    municipio: "Belo Horizonte",
    regra: { tipo: "fixa", mes: 11, dia: 20 },
    ate: 2023,
    base_legal: "Lei municipal nº 11.397/2022, Anexo V",
    fonte: "https://www8.tjmg.jus.br/institucional/at/pdf/pc17982026.pdf",
    observacao: "Feriado nacional desde 2024 (Lei federal nº 14.759/2023).",
  },
  {
    id: "mg-belo-horizonte-imaculada-conceicao",
    nome: "Imaculada Conceição",
    uf: "MG",
    municipio: "Belo Horizonte",
    regra: { tipo: "fixa", mes: 12, dia: 8 },
    base_legal: "Lei municipal nº 11.397/2022, Anexo V",
    fonte: "https://www8.tjmg.jus.br/institucional/at/pdf/pc17982026.pdf",
  },

  // ---------------- ES — Vitória ----------------
  {
    id: "es-vitoria-nossa-senhora-da-vitoria",
    nome: "Nossa Senhora da Vitória (Aniversário de Vitória)",
    uf: "ES",
    municipio: "Vitória",
    regra: { tipo: "fixa", mes: 9, dia: 8 },
    base_legal: "Lei municipal nº 1.732/1967, art. 1º",
    fonte: "https://www.tjes.jus.br/ato-normativo-no-319-2025-disp-02-12-2025/",
  },

  // ---------------- PR — Curitiba ----------------
  {
    id: "pr-curitiba-corpus-christi",
    nome: "Corpus Christi",
    uf: "PR",
    municipio: "Curitiba",
    regra: { tipo: "pascoa", deslocamento: 60 },
    base_legal: "Lei municipal nº 3.015/1967",
    fonte: "https://mid.curitiba.pr.gov.br/2024/00429306.pdf",
  },
  {
    id: "pr-curitiba-nossa-senhora-da-luz",
    nome: "Nossa Senhora da Luz dos Pinhais (padroeira)",
    uf: "PR",
    municipio: "Curitiba",
    regra: { tipo: "fixa", mes: 9, dia: 8 },
    base_legal: "Lei municipal nº 3.015/1967",
    fonte: "https://mid.curitiba.pr.gov.br/2024/00429306.pdf",
  },

  // ---------------- SC — Florianópolis ----------------
  {
    id: "sc-florianopolis-aniversario",
    nome: "Aniversário de Florianópolis",
    uf: "SC",
    municipio: "Florianópolis",
    regra: { tipo: "fixa", mes: 3, dia: 23 },
    desde: 1990,
    base_legal: "Lei municipal nº 832/1967, art. 2º (red. Leis nº 3.247/1989 e 8.046/2009)",
    fonte: "https://www.normasbrasil.com.br/norma/lei-832-1967-florianopolis_174001.html",
  },
  {
    id: "sc-florianopolis-corpus-christi",
    nome: "Corpus Christi",
    uf: "SC",
    municipio: "Florianópolis",
    regra: { tipo: "pascoa", deslocamento: 60 },
    base_legal: "Lei municipal nº 832/1967, art. 2º, c (red. Lei nº 8.046/2009)",
    fonte: "https://www.normasbrasil.com.br/norma/lei-832-1967-florianopolis_174001.html",
  },
  {
    id: "sc-florianopolis-consciencia-negra",
    nome: "Dia da Consciência Negra",
    uf: "SC",
    municipio: "Florianópolis",
    regra: { tipo: "fixa", mes: 11, dia: 20 },
    desde: 2010,
    ate: 2023,
    base_legal: "Lei municipal nº 832/1967, art. 2º, e (incl. Lei nº 8.046/2009)",
    fonte: "https://www.normasbrasil.com.br/norma/lei-832-1967-florianopolis_174001.html",
    observacao: "Feriado nacional desde 2024 (Lei federal nº 14.759/2023).",
  },

  // ---------------- RS — Porto Alegre ----------------
  {
    id: "rs-porto-alegre-navegantes",
    nome: "Nossa Senhora dos Navegantes",
    uf: "RS",
    municipio: "Porto Alegre",
    regra: { tipo: "fixa", mes: 2, dia: 2 },
    base_legal: "Lei municipal nº 3.033/1967 (red. Lei nº 13.591/2023)",
    fonte: "https://prefeitura.poa.br/gcs/noticias/aniversario-de-porto-alegre-nao-e-feriado-municipal",
    observacao: "O aniversário da cidade (26/mar) não é feriado municipal.",
  },
  {
    id: "rs-porto-alegre-corpus-christi",
    nome: "Corpus Christi",
    uf: "RS",
    municipio: "Porto Alegre",
    regra: { tipo: "pascoa", deslocamento: 60 },
    base_legal: "Lei municipal nº 3.033/1967",
    fonte: "https://prefeitura.poa.br/gcs/noticias/aniversario-de-porto-alegre-nao-e-feriado-municipal",
  },
];

export const COBERTURA_MUNICIPAL = {
  atualizadoEm: "2026-10-19",
  municipios: [
    { uf: "AC", municipio: "Rio Branco" },
    { uf: "AL", municipio: "Maceió" },
    { uf: "AM", municipio: "Manaus" },
    { uf: "BA", municipio: "Salvador" },
    { uf: "CE", municipio: "Fortaleza" },
    { uf: "MA", municipio: "São Luís" },
    { uf: "PA", municipio: "Belém" },
    { uf: "PB", municipio: "João Pessoa" },
    { uf: "PE", municipio: "Recife" },
    { uf: "PI", municipio: "Teresina" },
    { uf: "RO", municipio: "Porto Velho" },
    { uf: "RR", municipio: "Boa Vista" },
    { uf: "SE", municipio: "Aracaju" },
    { uf: "TO", municipio: "Palmas" },
    { uf: "SP", municipio: "São Paulo" },
    { uf: "RJ", municipio: "Rio de Janeiro" },
    { uf: "MG", municipio: "Belo Horizonte" },
    { uf: "ES", municipio: "Vitória" },
    { uf: "PR", municipio: "Curitiba" },
    { uf: "SC", municipio: "Florianópolis" },
    { uf: "RS", municipio: "Porto Alegre" },
  ],
};
