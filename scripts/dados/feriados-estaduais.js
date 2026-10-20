// Feriados ESTADUAIS (e distrital) do Brasil.
// Dados compilados em 2026-10-19.
//
// Cobre: feriados criados por lei estadual/distrital ou pela Constituição
// estadual (data magna da Lei federal nº 9.093/1995 e outros feriados
// estaduais em vigor), conferidos em texto legal, decreto anual de feriados
// do Executivo ou calendário oficial de órgão público.
//
// NÃO cobre: pontos facultativos, datas apenas comemorativas, feriados
// restritos a categorias (ex.: Dia do Comércio no RJ, Dia do Servidor),
// transferências pontuais feitas por decreto em um único ano, nem datas que
// coincidem com feriado nacional (ex.: 21/abr em MG e no DF, 15/nov no PR).
// A Consciência Negra (20/nov) é feriado nacional desde 2024 (Lei federal
// nº 14.759/2023); leis estaduais anteriores aparecem com `ate: 2023`.
// MG, MT e PR não têm feriado estadual próprio fora das datas nacionais.
// Não é uma base jurídica oficial: em caso de dúvida, consulte a lei citada.

export const FERIADOS_ESTADUAIS = [
  // ---------------- AC ----------------
  {
    id: "ac-dia-do-catolico",
    nome: "Dia do Católico",
    uf: "AC",
    regra: { tipo: "fixa", mes: 1, dia: 20 },
    base_legal: "Lei estadual nº 3.137/2016",
    fonte: "https://agencia.ac.gov.br/wp-content/uploads/2025/12/Calendario-1-1.pdf",
    observacao: "Lei estadual nº 2.126/2009 (red. Lei nº 2.247/2009) adia para sexta-feira os feriados estaduais que caem de terça a quinta; a aplicação é definida no decreto anual.",
  },
  {
    id: "ac-dia-do-evangelico",
    nome: "Dia do Evangélico",
    uf: "AC",
    regra: { tipo: "fixa", mes: 1, dia: 23 },
    desde: 2005,
    base_legal: "Lei estadual nº 1.538/2004",
    fonte: "https://agencia.ac.gov.br/wp-content/uploads/2025/12/Calendario-1-1.pdf",
    observacao: "Pode ser adiado para sexta-feira (Lei estadual nº 2.126/2009, red. Lei nº 2.247/2009).",
  },
  {
    id: "ac-dia-internacional-da-mulher",
    nome: "Dia Internacional da Mulher",
    uf: "AC",
    regra: { tipo: "fixa", mes: 3, dia: 8 },
    desde: 2002,
    base_legal: "Lei estadual nº 1.411/2001",
    fonte: "https://agencia.ac.gov.br/wp-content/uploads/2025/12/Calendario-1-1.pdf",
    observacao: "Pode ser adiado para sexta-feira (Lei estadual nº 2.126/2009, red. Lei nº 2.247/2009).",
  },
  {
    id: "ac-aniversario-do-estado",
    nome: "Aniversário do Estado do Acre",
    uf: "AC",
    regra: { tipo: "fixa", mes: 6, dia: 15 },
    base_legal: "Lei estadual nº 14/1964",
    fonte: "https://agencia.ac.gov.br/wp-content/uploads/2025/12/Calendario-1-1.pdf",
    observacao: "Data magna; não é adiada (exceção da Lei estadual nº 2.247/2009).",
  },
  {
    id: "ac-dia-da-amazonia",
    nome: "Dia da Amazônia",
    uf: "AC",
    regra: { tipo: "fixa", mes: 9, dia: 5 },
    base_legal: "Lei estadual nº 243/1968",
    fonte: "https://agencia.ac.gov.br/wp-content/uploads/2025/12/Calendario-1-1.pdf",
    observacao: "Pode ser adiado para sexta-feira (Lei estadual nº 2.126/2009, red. Lei nº 2.247/2009).",
  },
  {
    id: "ac-tratado-de-petropolis",
    nome: "Assinatura do Tratado de Petrópolis",
    uf: "AC",
    regra: { tipo: "fixa", mes: 11, dia: 17 },
    base_legal: "Lei estadual nº 57/1965",
    fonte: "https://agencia.ac.gov.br/wp-content/uploads/2025/12/Calendario-1-1.pdf",
    observacao: "Pode ser adiado para sexta-feira (Lei estadual nº 2.126/2009, red. Lei nº 2.247/2009).",
  },

  // ---------------- AL ----------------
  {
    id: "al-sao-joao",
    nome: "São João",
    uf: "AL",
    regra: { tipo: "fixa", mes: 6, dia: 24 },
    desde: 1994,
    base_legal: "Lei estadual nº 5.508/1993",
    fonte: "https://www.legisweb.com.br/legislacao/?id=440220",
  },
  {
    id: "al-sao-pedro",
    nome: "São Pedro",
    uf: "AL",
    regra: { tipo: "fixa", mes: 6, dia: 29 },
    desde: 1994,
    base_legal: "Lei estadual nº 5.509/1993",
    fonte: "https://www.legisweb.com.br/legislacao/?id=440220",
  },
  {
    id: "al-emancipacao-politica",
    nome: "Emancipação Política de Alagoas",
    uf: "AL",
    regra: { tipo: "fixa", mes: 9, dia: 16 },
    base_legal: "Feriado estadual (data magna) listado nos decretos anuais do Executivo (ex.: Decreto nº 86.020/2022 e Decreto nº 106.093/2025)",
    fonte: "https://www.legisweb.com.br/legislacao/?id=440220",
    observacao: "Os decretos citam as Leis estaduais nº 5.508/1993, 5.509/1993, 5.724/1995 e 7.530/2013 sem indicar qual delas institui cada data.",
  },
  {
    id: "al-zumbi-dos-palmares",
    nome: "Zumbi dos Palmares",
    uf: "AL",
    regra: { tipo: "fixa", mes: 11, dia: 20 },
    ate: 2023,
    base_legal: "Feriado estadual listado nos decretos anuais do Executivo (ex.: Decreto nº 86.020/2022)",
    fonte: "https://www.legisweb.com.br/legislacao/?id=440220",
    observacao: "Feriado nacional desde 2024 (Lei federal nº 14.759/2023).",
  },
  {
    id: "al-dia-do-evangelico",
    nome: "Dia Estadual do Evangélico",
    uf: "AL",
    regra: { tipo: "fixa", mes: 11, dia: 30 },
    base_legal: "Lei estadual nº 7.530/2013",
    fonte: "https://www.legisweb.com.br/legislacao/?id=440220",
    observacao: "Incluído nos decretos anuais de feriados do Executivo estadual a partir de 2018; já foi transferido por decreto (ex.: 2023 → 1º/dez).",
  },

  // ---------------- AP ----------------
  {
    id: "ap-sao-jose",
    nome: "Dia de São José (padroeiro do Amapá)",
    uf: "AP",
    regra: { tipo: "fixa", mes: 3, dia: 19 },
    desde: 2003,
    base_legal: "Lei estadual nº 667/2002",
    fonte: "https://trf1.jus.br/sjap/conteudo/avisos/Portaria%20SJAP-Diref%204-2023%2011-1-2023%20feriados%202023%20(1).pdf",
  },
  {
    id: "ap-criacao-do-territorio",
    nome: "Criação do Território Federal do Amapá",
    uf: "AP",
    regra: { tipo: "fixa", mes: 9, dia: 13 },
    base_legal: "Constituição do Estado do Amapá (data magna)",
    fonte: "https://trf1.jus.br/sjap/conteudo/avisos/Portaria%20SJAP-Diref%204-2023%2011-1-2023%20feriados%202023%20(1).pdf",
  },

  // ---------------- AM ----------------
  {
    id: "am-elevacao-a-provincia",
    nome: "Elevação do Amazonas à categoria de Província",
    uf: "AM",
    regra: { tipo: "fixa", mes: 9, dia: 5 },
    desde: 1978,
    base_legal: "Lei estadual (promulgada) nº 25/1977",
    fonte: "https://sapl.al.am.leg.br/norma/8919",
    observacao: "Data magna. Já foi transferido por decreto em anos específicos.",
  },

  // ---------------- BA ----------------
  {
    id: "ba-independencia-da-bahia",
    nome: "Independência da Bahia (Dois de Julho)",
    uf: "BA",
    regra: { tipo: "fixa", mes: 7, dia: 2 },
    base_legal: "Constituição do Estado da Bahia, art. 6º, § 3º",
    fonte: "https://estatuinte.uneb.br/wp-content/uploads/2023/09/Constituicao-do-Estado-da-Bahia.pdf",
    observacao: "Data magna.",
  },

  // ---------------- CE ----------------
  {
    id: "ce-data-magna",
    nome: "Data Magna do Ceará (Abolição da escravatura no Ceará)",
    uf: "CE",
    regra: { tipo: "fixa", mes: 3, dia: 25 },
    desde: 2012,
    base_legal: "Constituição do Estado do Ceará, art. 18, parágrafo único (Emenda Constitucional nº 73/2011)",
    fonte: "https://diariodonordeste.verdesmares.com.br/ceara/quais-os-feriados-em-marco-de-2026-no-ceara-veja-datas-1.3745934",
    observacao: "19/mar (São José) NÃO é feriado estadual; é feriado em vários municípios.",
  },

  // ---------------- DF ----------------
  {
    id: "df-dia-do-evangelico",
    nome: "Dia do Evangélico",
    uf: "DF",
    regra: { tipo: "fixa", mes: 11, dia: 30 },
    desde: 1996,
    base_legal: "Lei distrital nº 963/1995",
    fonte: "https://www.lex.com.br/feriado-do-dia-do-evangelico-instituido-por-lei-distrital-nao-se-aplica-a-orgaos-publicos-federais-com-sede-no-df/",
    observacao: "Feriado local; segundo o TRF1, não se aplica a órgãos públicos federais sediados no DF.",
  },

  // ---------------- ES ----------------
  {
    id: "es-nossa-senhora-da-penha",
    nome: "Nossa Senhora da Penha (Data Magna do ES)",
    uf: "ES",
    regra: { tipo: "pascoa", deslocamento: 8 },
    desde: 2020,
    base_legal: "Lei estadual nº 11.010/2019",
    fonte: "https://www3.al.es.gov.br/Arquivo/Documents/legislacao/html/LEI110102019.html",
    observacao: "Sempre na segunda-feira, oitavo dia após o Domingo de Páscoa.",
  },

  // ---------------- GO ----------------
  {
    id: "go-fundacao-cidade-de-goias",
    nome: "Fundação da Cidade de Goiás",
    uf: "GO",
    regra: { tipo: "fixa", mes: 7, dia: 26 },
    base_legal: "Lei estadual nº 20.756/2020, art. 269, II, a",
    fonte: "https://legisla.casacivil.go.gov.br/api/v2/pesquisa/legislacoes/100979/pdf",
    observacao: "Previsto no estatuto dos servidores estaduais (sem expediente nas repartições do Estado); o Executivo pode transferi-lo para dia útil próximo (art. 269, § 1º).",
  },
  {
    id: "go-pedra-fundamental-goiania",
    nome: "Lançamento da pedra fundamental de Goiânia",
    uf: "GO",
    regra: { tipo: "fixa", mes: 10, dia: 24 },
    base_legal: "Lei estadual nº 20.756/2020, art. 269, II, b",
    fonte: "https://legisla.casacivil.go.gov.br/api/v2/pesquisa/legislacoes/100979/pdf",
    observacao: "Previsto no estatuto dos servidores estaduais (sem expediente nas repartições do Estado). Também é aniversário de Goiânia.",
  },

  // ---------------- MA ----------------
  {
    id: "ma-adesao-a-independencia",
    nome: "Adesão do Maranhão à Independência do Brasil",
    uf: "MA",
    regra: { tipo: "fixa", mes: 7, dia: 28 },
    base_legal: "Lei estadual nº 2.457/1964",
    fonte: "https://trf1.jus.br/sjma/conteudo/files/Portaria%20SJMA%20Diref%202.pdf",
    observacao: "Data magna.",
  },

  // ---------------- MS ----------------
  {
    id: "ms-criacao-do-estado",
    nome: "Criação do Estado de Mato Grosso do Sul",
    uf: "MS",
    regra: { tipo: "fixa", mes: 10, dia: 11 },
    desde: 1980,
    base_legal: "Lei estadual nº 10/1979",
    fonte: "https://web.archive.org/web/20140927152601/http://aacpdappls.net.ms.gov.br/appls/legislacao/secoge/govato.nsf/1b758e65922af3e904256b220050342a/a489a293563f506304256e450002e9f8",
    observacao: "Data magna.",
  },

  // ---------------- PA ----------------
  {
    id: "pa-adesao-a-independencia",
    nome: "Adesão do Grão-Pará à Independência do Brasil",
    uf: "PA",
    regra: { tipo: "fixa", mes: 8, dia: 15 },
    base_legal: "Lei estadual nº 5.999/1996 (data magna); listado como feriado estadual no Decreto estadual nº 5.122/2025",
    fonte: "https://dol.com.br/noticias/para/930705/para-divulga-feriados-e-pontos-facultativos-de-2026-veja-o-calendario",
  },

  // ---------------- PB ----------------
  {
    id: "pb-fundacao-do-estado",
    nome: "Fundação do Estado da Paraíba e Nossa Senhora das Neves",
    uf: "PB",
    regra: { tipo: "fixa", mes: 8, dia: 5 },
    base_legal: "Lei estadual nº 10.601/2015 (data magna); anteriormente Lei estadual nº 3.489/1967",
    fonte: "https://www.auniao.pb.gov.br/noticias/caderno_paraiba/o-que-abre-e-fecha-no-feriado-de-5-de-agosto",
  },

  // ---------------- PE ----------------
  {
    id: "pe-data-magna",
    nome: "Data Magna de Pernambuco (Revolução Pernambucana de 1817)",
    uf: "PE",
    regra: { tipo: "fixa", mes: 3, dia: 6 },
    desde: 2018,
    base_legal: "Lei estadual nº 16.241/2017, art. 49 (originalmente Lei estadual nº 16.059/2017)",
    fonte: "https://legis.alepe.pe.gov.br/texto.aspx?id=28224",
    observacao: "Data fixa (não há regra de domingo). São João (24/jun) não é feriado estadual; é municipal no Recife.",
  },

  // ---------------- PI ----------------
  {
    id: "pi-dia-do-piaui",
    nome: "Dia do Piauí",
    uf: "PI",
    regra: { tipo: "fixa", mes: 10, dia: 19 },
    base_legal: "Lei estadual nº 176/1937",
    fonte: "https://www.legisweb.com.br/legislacao/?id=442337",
    observacao: "Data magna. Excepcionalmente antecipado para 15/05/2020 (Lei estadual nº 7.371/2020).",
  },

  // ---------------- RJ ----------------
  {
    id: "rj-carnaval",
    nome: "Carnaval (terça-feira)",
    uf: "RJ",
    regra: { tipo: "pascoa", deslocamento: -47 },
    desde: 2009,
    base_legal: "Lei estadual nº 5.243/2008",
    fonte: "https://alerjln1.alerj.rj.gov.br/contlei.nsf/f25edae7e64db53b032564fe005262ef/53ff854eddeb3f4883257686005f4d70",
    observacao: "Consolidado na Lei estadual nº 5.645/2010. Questionado no STF (ADI 4131).",
  },
  {
    id: "rj-sao-jorge",
    nome: "Dia de São Jorge",
    uf: "RJ",
    regra: { tipo: "fixa", mes: 4, dia: 23 },
    desde: 2008,
    base_legal: "Lei estadual nº 5.198/2008",
    fonte: "https://alerjln1.alerj.rj.gov.br/contlei.nsf/f25edae7e64db53b032564fe005262ef/53ff854eddeb3f4883257686005f4d70",
    observacao: "Consolidado na Lei estadual nº 5.645/2010. Questionado no STF (ADI 4092).",
  },
  {
    id: "rj-corpus-christi",
    nome: "Corpus Christi",
    uf: "RJ",
    regra: { tipo: "pascoa", deslocamento: 60 },
    desde: 2026,
    base_legal: "Lei estadual nº 11.002/2025",
    fonte: "https://www.diariodorio.com/stf-valida-corpus-christi-como-feriado-estadual-no-rio-de-janeiro/",
    observacao: "Validado pelo STF na ADI 7898.",
  },
  {
    id: "rj-zumbi-consciencia-negra",
    nome: "Dia de Zumbi / Consciência Negra",
    uf: "RJ",
    regra: { tipo: "fixa", mes: 11, dia: 20 },
    ate: 2023,
    base_legal: "Lei estadual nº 4.007/2002 (consolidada na Lei estadual nº 5.645/2010)",
    fonte: "https://alerjln1.alerj.rj.gov.br/contlei.nsf/f25edae7e64db53b032564fe005262ef/53ff854eddeb3f4883257686005f4d70",
    observacao: "Feriado nacional desde 2024 (Lei federal nº 14.759/2023).",
  },

  // ---------------- RN ----------------
  {
    id: "rn-martires-de-cunhau-e-uruacu",
    nome: "Mártires de Cunhaú e Uruaçu",
    uf: "RN",
    regra: { tipo: "fixa", mes: 10, dia: 3 },
    desde: 2007,
    base_legal: "Lei estadual nº 8.913/2006",
    fonte: "https://web.archive.org/web/20070624110034/http://www.gabinetecivil.rn.gov.br/acess/pdf/lo8.913.pdf",
    observacao: "Data magna. 7/ago (Dia do RN) não consta como feriado no decreto estadual de 2026.",
  },

  // ---------------- RO ----------------
  {
    id: "ro-criacao-do-estado",
    nome: "Instalação/Criação do Estado de Rondônia",
    uf: "RO",
    regra: { tipo: "fixa", mes: 1, dia: 4 },
    desde: 2011,
    base_legal: "Lei estadual nº 2.291/2010",
    fonte: "https://rondonia.ro.gov.br/wp-content/uploads/2026/01/Decreto_N__31210_-1_260119_183002.pdf",
    observacao: "Data magna. O Dia do Evangélico (18/jun, Lei nº 1.026/2001) não aparece como feriado estadual no decreto de 2026.",
  },

  // ---------------- RR ----------------
  {
    id: "rr-criacao-do-estado",
    nome: "Criação do Estado de Roraima",
    uf: "RR",
    regra: { tipo: "fixa", mes: 10, dia: 5 },
    base_legal: "Constituição do Estado de Roraima, art. 9º",
    fonte: "https://atos.tjrr.jus.br/files/compilado15180520240626667c696d89649.pdf",
    observacao: "Data magna.",
  },

  // ---------------- RS ----------------
  {
    id: "rs-revolucao-farroupilha",
    nome: "Dia do Gaúcho (Revolução Farroupilha)",
    uf: "RS",
    regra: { tipo: "fixa", mes: 9, dia: 20 },
    desde: 1995,
    base_legal: "Constituição do Estado do Rio Grande do Sul, art. 6º, parágrafo único (Emenda Constitucional nº 11/1995)",
    fonte: "https://tramandai.rs.gov.br/conteudos_documentos/277d4a4adea0733e86e1c7a3240a44c3.pdf",
    observacao: "Data magna.",
  },

  // ---------------- SC ----------------
  {
    id: "sc-data-magna",
    nome: "Dia de Santa Catarina (Data Magna)",
    uf: "SC",
    regra: { tipo: "domingoSeguinte", mes: 8, dia: 11 },
    base_legal: "Lei estadual nº 12.906/2004; regra de transferência na Lei estadual nº 18.531/2022",
    fonte: "https://portalelegis.alesc.sc.gov.br/documentos/rr6g0",
    observacao: "Se 11/ago não cair em domingo, a comemoração oficial é transferida para o domingo seguinte — na prática não gera folga em dia útil. 25/nov (Santa Catarina de Alexandria) é apenas projeto de lei (PL 23/2026), não incluído.",
  },

  // ---------------- SE ----------------
  {
    id: "se-emancipacao-politica",
    nome: "Emancipação Política de Sergipe",
    uf: "SE",
    regra: { tipo: "fixa", mes: 7, dia: 8 },
    base_legal: "Constituição do Estado de Sergipe, art. 269",
    fonte: "https://biblioteca.mpf.mp.br/repositorio/bitstreams/a9a3ccf1-6e57-4937-89da-2b8cfc75ca13/download",
    observacao: "Data magna.",
  },

  // ---------------- SP ----------------
  {
    id: "sp-revolucao-constitucionalista",
    nome: "Revolução Constitucionalista de 1932",
    uf: "SP",
    regra: { tipo: "fixa", mes: 7, dia: 9 },
    desde: 1997,
    base_legal: "Lei estadual nº 9.497/1997",
    fonte: "https://www.al.sp.gov.br/repositorio/legislacao/lei/1997/lei-9497-05.03.1997.html",
    observacao: "Data magna.",
  },

  // ---------------- TO ----------------
  {
    id: "to-dia-da-autonomia",
    nome: "Dia da Autonomia (criação da Comarca do Norte)",
    uf: "TO",
    regra: { tipo: "fixa", mes: 3, dia: 18 },
    desde: 1998,
    ate: 2008,
    base_legal: "Lei estadual nº 960/1998",
    fonte: "https://www.al.to.leg.br/arquivo/15717",
    observacao: "Deixou de ser feriado com a nova redação dada pela Lei estadual nº 2.013/2009.",
  },
  {
    id: "to-senhor-do-bonfim",
    nome: "Dia do Senhor do Bonfim",
    uf: "TO",
    regra: { tipo: "fixa", mes: 8, dia: 15 },
    desde: 2025,
    base_legal: "Lei estadual nº 4.509/2024",
    fonte: "https://conexaoto.com.br/2025/08/06/tocantins-tem-em-2025-o-primeiro-feriado-do-dia-do-senhor-do-bonfim",
  },
  {
    id: "to-nossa-senhora-da-natividade",
    nome: "Nossa Senhora da Natividade (padroeira do Tocantins)",
    uf: "TO",
    regra: { tipo: "fixa", mes: 9, dia: 8 },
    desde: 1994,
    base_legal: "Lei estadual nº 627/1993",
    fonte: "https://www.al.to.leg.br/arquivo/6883",
  },
  {
    id: "to-criacao-do-estado",
    nome: "Criação do Estado do Tocantins",
    uf: "TO",
    regra: { tipo: "fixa", mes: 10, dia: 5 },
    desde: 1990,
    base_legal: "Lei estadual nº 98/1989",
    fonte: "https://www.al.to.leg.br/arquivo/6358",
    observacao: "Data magna.",
  },
];

export const COBERTURA_ESTADUAL = {
  atualizadoEm: "2026-10-19",
  ufsVerificadas: [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MS", "PA",
    "PB", "PE", "PI", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
  ],
  // Verificadas, mas sem feriado estadual próprio além dos nacionais.
  ufsSemFeriadoProprio: ["MG", "MT", "PR"],
};
