// Sistemas de calendário: gregoriano (padrão), hegírico, hebraico, chinês,
// persa, indiano, budista, japonês, etíope…
//
// Os dias continuam sendo dias julianos (ver tempo.js) — feriados, contagens e
// eventos não mudam. O sistema só decide como os dias se agrupam em meses e
// anos e como as datas são escritas. Fora do gregoriano, tudo vem do Intl do
// navegador: o mês começa no dia 1 e o ano muda quando muda o número (ou o
// nome) do ano, o que cobre meses de 29/30 dias e anos de 13 meses sem tabelas
// próprias.

import { locale } from "../i18n/estado.js";
import { gravar, ler } from "./armazenamento.js";
import { capitalizar, deDiaJuliano, diaJuliano, diasNoMes, formatarDataExtenso, formatarMesAno, nomeMes } from "./tempo.js";

export const SISTEMA_PADRAO = "gregory";
const CHAVE_SISTEMA = "calendario:sistema";
const MS_DIA = 86_400_000;

// Ordem do seletor. Ficam de fora as variantes que repetem outra
// ("islamic", "islamic-rgsa", "islamic-tbla", "ethioaa") e o "iso8601".
const SISTEMAS = [
  "gregory",
  "islamic-umalqura",
  "islamic-civil",
  "hebrew",
  "chinese",
  "dangi",
  "persian",
  "indian",
  "buddhist",
  "japanese",
  "roc",
  "ethiopic",
  "coptic",
];

/** Sistemas que este navegador sabe calcular (o gregoriano sempre). */
export function sistemasDisponiveis() {
  return SISTEMAS.filter((s) => {
    try {
      return new Intl.DateTimeFormat("en", { calendar: s }).resolvedOptions().calendar === s;
    } catch {
      return false;
    }
  });
}

/** Nome do sistema no idioma da página: "Calendário Hebraico". */
export function nomeSistema(sistema) {
  try {
    return capitalizar(new Intl.DisplayNames([locale()], { type: "calendar" }).of(sistema) ?? sistema);
  } catch {
    return sistema;
  }
}

/**
 * Nomes curtos para o seletor, sem a palavra que a maioria repete
 * ("Calendário Hebraico" → "Hebraico", "Hijri Calendar (Umm al-Qura)" →
 * "Hijri (Umm al-Qura)"). Idiomas sem espaços (japonês, chinês) ficam como
 * estão. Se o que sobra começa com uma preposição ("da República da China"),
 * fica o nome completo.
 */
export function nomesCurtos(sistemas) {
  const nomes = sistemas.map(nomeSistema);
  const palavras = nomes.map((n) => n.split(" "));
  const contagem = new Map();
  for (const p of palavras) for (const w of new Set(p.map((x) => x.toLocaleLowerCase()))) contagem.set(w, (contagem.get(w) ?? 0) + 1);
  const [comum, vezes] = [...contagem].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!comum || vezes < nomes.length / 2) return nomes;
  return palavras.map((p, i) => {
    const resto = p.filter((x) => x.toLocaleLowerCase() !== comum);
    if (!resto.length || resto.length === p.length || /^\p{Ll}{1,3}$/u.test(resto[0])) return nomes[i];
    return capitalizar(resto.join(" "));
  });
}

/** ?sistema= na URL, depois a escolha salva; senão o gregoriano. */
export function sistemaPreferido(indicado = null) {
  const disponiveis = sistemasDisponiveis();
  return [indicado, ler(CHAVE_SISTEMA)].find((s) => disponiveis.includes(s)) ?? SISTEMA_PADRAO;
}

export function salvarSistemaPreferido(sistema) {
  gravar(CHAVE_SISTEMA, sistema);
}

// ---- Gregoriano: as mesmas funções de sempre -------------------------------------

function sistemaGregoriano() {
  const inicioMes = (j) => j - deDiaJuliano(j).dia + 1;
  const fimMes = (j) => {
    const d = deDiaJuliano(j);
    return diaJuliano(d.ano, d.mes, diasNoMes(d.ano, d.mes));
  };
  const comDiaLimitado = (ano, mes, dia) => diaJuliano(ano, mes, Math.min(dia, diasNoMes(ano, mes)));
  return {
    id: "gregory",
    gregoriano: true,
    dia: (j) => deDiaJuliano(j).dia,
    inicioMes,
    fimMes,
    inicioAno: (j) => diaJuliano(deDiaJuliano(j).ano, 1, 1),
    mesesDoAno(j) {
      const { ano } = deDiaJuliano(j);
      return Array.from({ length: 12 }, (_, i) => ({ inicio: diaJuliano(ano, i + 1, 1), fim: diaJuliano(ano, i + 1, diasNoMes(ano, i + 1)) }));
    },
    nomeMes: (j) => nomeMes(deDiaJuliano(j).mes),
    tituloMes: (j) => {
      const d = deDiaJuliano(j);
      return formatarMesAno(d.ano, d.mes);
    },
    tituloAno: (j) => String(deDiaJuliano(j).ano),
    data: (j, opcoes) => formatarDataExtenso(deDiaJuliano(j), opcoes),
    moverMes(j, delta) {
      const d = deDiaJuliano(j);
      const total = d.ano * 12 + d.mes - 1 + delta;
      return comDiaLimitado(Math.floor(total / 12), (total % 12) + 1, d.dia);
    },
    moverAno(j, delta) {
      const d = deDiaJuliano(j);
      return comDiaLimitado(d.ano + delta, d.mes, d.dia);
    },
  };
}

// ---- Demais sistemas, pelo Intl ------------------------------------------------------

const dataDoDia = (j) => new Date(j * MS_DIA + MS_DIA / 2);

function sistemaIntl(id) {
  // Partes em algarismos latinos para os cálculos; a exibição usa o idioma da página.
  const partes = new Intl.DateTimeFormat("en-u-nu-latn", { calendar: id, timeZone: "UTC", era: "short", year: "numeric", month: "numeric", day: "numeric" });
  const cache = new Map();

  function info(j) {
    if (!cache.has(j)) {
      let dia = 1;
      let mes = "";
      const ano = [];
      for (const p of partes.formatToParts(dataDoDia(j))) {
        if (p.type === "day") dia = Number(p.value);
        else if (p.type === "month") mes = p.value;
        else if (["era", "year", "relatedYear", "yearName"].includes(p.type)) ano.push(p.value);
      }
      cache.set(j, { dia, mes, ano: ano.join(" ") });
    }
    return cache.get(j);
  }

  const inicioMes = (j) => j - info(j).dia + 1;
  // O mês mais curto é o 13º do etíope e do copta: 5 ou 6 dias.
  function fimMes(j) {
    let k = inicioMes(j) + 4;
    while (info(k + 1).dia !== 1) k += 1;
    return k;
  }
  function inicioAno(j) {
    const { ano } = info(j);
    let inicio = inicioMes(j);
    while (info(inicio - 1).ano === ano) inicio = inicioMes(inicio - 1);
    return inicio;
  }
  function mesesDoAno(j) {
    const { ano } = info(j);
    const meses = [];
    for (let inicio = inicioAno(j); info(inicio).ano === ano; inicio = meses.at(-1).fim + 1) {
      meses.push({ inicio, fim: fimMes(inicio) });
    }
    return meses;
  }
  /** O dia `dia` do mês que começa em `inicio`, sem passar do fim do mês. */
  const diaNoMes = (inicio, dia) => Math.min(inicio + dia - 1, fimMes(inicio));

  const formatos = new Map();
  function formatar(j, opcoes) {
    const chave = `${locale()}|${JSON.stringify(opcoes)}`;
    if (!formatos.has(chave)) formatos.set(chave, new Intl.DateTimeFormat(locale(), { ...opcoes, calendar: id, timeZone: "UTC" }));
    return formatos.get(chave).format(dataDoDia(j));
  }

  return {
    id,
    gregoriano: false,
    dia: (j) => info(j).dia,
    inicioMes,
    fimMes,
    inicioAno,
    mesesDoAno,
    nomeMes: (j) => formatar(j, { month: "long" }),
    tituloMes: (j) => formatar(j, { month: "long", year: "numeric" }),
    tituloAno: (j) => formatar(j, { year: "numeric" }),
    data: (j, { comAno = true, comSemana = true } = {}) =>
      formatar(j, { weekday: comSemana ? "long" : undefined, day: "numeric", month: "long", year: comAno ? "numeric" : undefined }),
    moverMes(j, delta) {
      let inicio = inicioMes(j);
      for (let i = 0; i < Math.abs(delta); i += 1) inicio = delta > 0 ? fimMes(inicio) + 1 : inicioMes(inicio - 1);
      return diaNoMes(inicio, info(j).dia);
    },
    moverAno(j, delta) {
      // Mesmo mês (pelo número; um mês intercalar que não existe no outro ano
      // cai na mesma posição, limitada ao último mês).
      const posicao = mesesDoAno(j).findIndex((m) => m.inicio === inicioMes(j));
      let referencia = inicioAno(j);
      for (let i = 0; i < Math.abs(delta); i += 1) referencia = delta > 0 ? mesesDoAno(referencia).at(-1).fim + 1 : inicioAno(referencia - 1);
      const meses = mesesDoAno(referencia);
      const mesmo = meses.find((m) => info(m.inicio).mes === info(j).mes) ?? meses[Math.min(posicao, meses.length - 1)];
      return diaNoMes(mesmo.inicio, info(j).dia);
    },
  };
}

const criados = new Map();

/** Operações de mês e ano de um sistema; valores desconhecidos viram o gregoriano. */
export function obterSistema(id = SISTEMA_PADRAO) {
  const valido = id !== SISTEMA_PADRAO && sistemasDisponiveis().includes(id) ? id : SISTEMA_PADRAO;
  if (!criados.has(valido)) criados.set(valido, valido === SISTEMA_PADRAO ? sistemaGregoriano() : sistemaIntl(valido));
  return criados.get(valido);
}
