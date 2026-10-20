// Funções puras de data, hora e fuso horário. Sem acesso ao DOM: este módulo
// é importado tanto pelo navegador quanto pelos testes em Node.
//
// Todas as conversões de fuso usam os dados IANA da própria plataforma via
// Intl.DateTimeFormat. Nunca somamos ou subtraímos horas fixas, porque as
// regras de horário de verão mudam por região e por ano.
//
// Os textos saem no idioma da interface (scripts/i18n/estado.js); nos testes,
// em português do Brasil.

import { idiomaAtual, locale, separadorDecimal, t } from "../i18n/estado.js";

export const FUSO_BRASILIA = "America/Sao_Paulo";

export const MS_SEGUNDO = 1000;
export const MS_MINUTO = 60 * MS_SEGUNDO;
export const MS_HORA = 60 * MS_MINUTO;
export const MS_DIA = 24 * MS_HORA;

export function doisDigitos(valor) {
  return String(valor).padStart(2, "0");
}

export function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";
}

export function plural(quantidade, singular, pluralTexto = `${singular}s`) {
  return `${quantidade} ${Math.abs(quantidade) === 1 ? singular : pluralTexto}`;
}

/**
 * Formata uma duração em milissegundos.
 * Padrão "HH:MM:SS"; com `centesimos` → "HH:MM:SS,cc".
 * `horas: "auto"` omite as horas quando a duração é menor que uma hora.
 */
export function formatarDuracao(ms, opcoes = {}) {
  const { centesimos = false, horas = "sempre", arredondar = "baixo" } = opcoes;
  const negativo = ms < 0;
  let valor = Math.abs(ms);

  if (centesimos) {
    valor = Math.floor(valor / 10) * 10;
  } else if (arredondar === "cima") {
    valor = Math.ceil(valor / MS_SEGUNDO) * MS_SEGUNDO;
  } else {
    valor = Math.floor(valor / MS_SEGUNDO) * MS_SEGUNDO;
  }

  const h = Math.floor(valor / MS_HORA);
  const m = Math.floor((valor % MS_HORA) / MS_MINUTO);
  const s = Math.floor((valor % MS_MINUTO) / MS_SEGUNDO);
  const cc = Math.floor((valor % MS_SEGUNDO) / 10);

  let texto =
    horas === "auto" && h === 0
      ? `${doisDigitos(m)}:${doisDigitos(s)}`
      : `${doisDigitos(h)}:${doisDigitos(m)}:${doisDigitos(s)}`;

  if (centesimos) texto += `${separadorDecimal()}${doisDigitos(cc)}`;
  return negativo ? `−${texto}` : texto;
}

/** Duração legível: "2 h 05 min", "45 s", "3 dias 4 h". */
export function formatarDuracaoExtenso(ms) {
  const total = Math.round(Math.abs(ms) / MS_SEGUNDO);
  const dias = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const uh = (n) => t("tempo.unidade.h", { n });
  const umin = (n) => t("tempo.unidade.min", { n });
  const us = (n) => t("tempo.unidade.s", { n });
  if (dias > 0) return `${t("tempo.dias", { n: dias })}${h ? ` ${uh(h)}` : ""}`;
  if (h > 0) return `${uh(h)} ${umin(doisDigitos(m))}`;
  if (m > 0) return `${umin(m)}${s ? ` ${us(doisDigitos(s))}` : ""}`;
  return us(s);
}

/** "+1,25 s", "−320 ms" — usado para mostrar diferenças pequenas de relógio. */
export function formatarDiferencaCurta(ms) {
  const sinal = ms > 0 ? "+" : ms < 0 ? "−" : "±";
  const abs = Math.abs(ms);
  if (abs < 1000) return `${sinal}${t("tempo.unidade.ms", { n: Math.round(abs) })}`;
  if (abs < 60000) {
    const segundos = (abs / 1000).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    return `${sinal}${t("tempo.unidade.s", { n: segundos })}`;
  }
  return `${sinal}${formatarDuracaoExtenso(abs)}`;
}

// ---- Fusos horários -------------------------------------------------------

const cacheFormatadores = new Map();

function formatadorPartes(fuso) {
  let formatador = cacheFormatadores.get(fuso);
  if (!formatador) {
    formatador = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
    cacheFormatadores.set(fuso, formatador);
  }
  return formatador;
}

const DIAS_SEMANA_EN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function fusoValido(fuso) {
  if (typeof fuso !== "string" || !fuso || fuso.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

/** Data/hora civil de um instante em um fuso IANA. */
export function partesNoFuso(instante, fuso = FUSO_BRASILIA) {
  const partes = {};
  for (const parte of formatadorPartes(fuso).formatToParts(new Date(instante))) {
    partes[parte.type] = parte.value;
  }
  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour) % 24,
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
    diaSemana: DIAS_SEMANA_EN[partes.weekday],
  };
}

/** Deslocamento do fuso em relação ao UTC, em minutos (ex.: −180 para Brasília). */
export function deslocamentoMinutos(instante, fuso = FUSO_BRASILIA) {
  const p = partesNoFuso(instante, fuso);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  const semMs = Math.floor(instante / 1000) * 1000;
  return Math.round((comoUtc - semMs) / MS_MINUTO);
}

/** "UTC−03:00", "UTC+05:30", "UTC". */
export function formatarDeslocamento(minutos) {
  if (minutos === 0) return "UTC";
  const sinal = minutos > 0 ? "+" : "−";
  const abs = Math.abs(minutos);
  return `UTC${sinal}${doisDigitos(Math.floor(abs / 60))}:${doisDigitos(abs % 60)}`;
}

/** Diferença relativa: "Mesmo horário", "+1 h", "−4 h 30 min". */
export function formatarDiferencaFuso(minutos) {
  if (minutos === 0) return t("tempo.mesmoHorario");
  const sinal = minutos > 0 ? "+" : "−";
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const partes = [h ? t("tempo.unidade.h", { n: h }) : "", m ? t("tempo.unidade.min", { n: m }) : ""].filter(Boolean);
  return `${sinal}${partes.join(" ")}`;
}

function mesmasPartes(a, b) {
  return (
    a.ano === b.ano &&
    a.mes === b.mes &&
    a.dia === b.dia &&
    a.hora === b.hora &&
    a.minuto === b.minuto &&
    a.segundo === b.segundo
  );
}

/**
 * Converte uma data/hora civil de um fuso para instantes UTC.
 *
 * Retorna { situacao, instantes }:
 *  - "normal": um único instante corresponde à hora informada;
 *  - "ambigua": a hora acontece duas vezes (fim do horário de verão) —
 *    `instantes` traz as duas ocorrências em ordem;
 *  - "inexistente": a hora foi pulada (início do horário de verão) —
 *    `instantes` traz o instante equivalente logo após o salto.
 */
export function civilParaInstantes(civil, fuso = FUSO_BRASILIA) {
  const { ano, mes, dia, hora = 0, minuto = 0, segundo = 0 } = civil;
  const alvo = { ano, mes, dia, hora, minuto, segundo };
  const comoUtc = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo);

  // Os deslocamentos possíveis perto dessa data: o fuso só muda de regra
  // em transições, então olhar um dia antes e um depois cobre ambos os lados.
  const deslocamentos = new Set([
    deslocamentoMinutos(comoUtc - MS_DIA, fuso),
    deslocamentoMinutos(comoUtc, fuso),
    deslocamentoMinutos(comoUtc + MS_DIA, fuso),
  ]);

  const instantes = [];
  for (const desl of deslocamentos) {
    const candidato = comoUtc - desl * MS_MINUTO;
    if (mesmasPartes(partesNoFuso(candidato, fuso), alvo) && !instantes.includes(candidato)) {
      instantes.push(candidato);
    }
  }
  instantes.sort((a, b) => a - b);

  if (instantes.length === 1) return { situacao: "normal", instantes };
  if (instantes.length > 1) return { situacao: "ambigua", instantes };

  // Hora pulada: usa o deslocamento de antes do salto, o que leva o relógio
  // para depois da transição (ex.: 00:30 inexistente → 01:30 do novo horário).
  const antes = deslocamentoMinutos(comoUtc - MS_DIA, fuso);
  return { situacao: "inexistente", instantes: [comoUtc - antes * MS_MINUTO] };
}

/** Atalho: primeiro instante válido para a hora civil (ou NaN se data inválida). */
export function civilParaInstante(civil, fuso = FUSO_BRASILIA) {
  if (!dataCivilValida(civil.ano, civil.mes, civil.dia)) return Number.NaN;
  return civilParaInstantes(civil, fuso).instantes[0];
}

export function dataCivilValida(ano, mes, dia) {
  if (![ano, mes, dia].every(Number.isInteger)) return false;
  if (ano < 1 || ano > 9999 || mes < 1 || mes > 12 || dia < 1) return false;
  return dia <= diasNoMes(ano, mes);
}

export function diasNoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

// ---- Datas civis (sem hora) ---------------------------------------------
// Representamos um dia como número de dias desde 1970-01-01 (UTC). Assim as
// contas de calendário não sofrem com fusos nem com horário de verão.

export function diaJuliano(ano, mes, dia) {
  return Math.floor(Date.UTC(ano, mes - 1, dia) / MS_DIA);
}

export function deDiaJuliano(n) {
  const d = new Date(n * MS_DIA);
  return {
    ano: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    diaSemana: d.getUTCDay(),
  };
}

export function diaSemana(ano, mes, dia) {
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/** "2026-10-19" */
export function dataIso(ano, mes, dia) {
  return `${String(ano).padStart(4, "0")}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

/** Lê "AAAA-MM-DD" com validação. */
export function lerDataIso(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto ?? "").trim());
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return dataCivilValida(ano, mes, dia) ? { ano, mes, dia } : null;
}

/** Lê "HH:MM" ou "HH:MM:SS" com validação. */
export function lerHora(texto) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(texto ?? "").trim());
  if (!m) return null;
  const [hora, minuto, segundo] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  if (hora > 23 || minuto > 59 || segundo > 59) return null;
  return { hora, minuto, segundo };
}

/** Semana ISO-8601 (segunda-feira como início). */
export function semanaIso(ano, mes, dia) {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const diaSem = data.getUTCDay() || 7;
  data.setUTCDate(data.getUTCDate() + 4 - diaSem);
  const inicioAno = new Date(Date.UTC(data.getUTCFullYear(), 0, 1));
  return Math.ceil(((data - inicioAno) / MS_DIA + 1) / 7);
}

export function diaDoAno(ano, mes, dia) {
  return diaJuliano(ano, mes, dia) - diaJuliano(ano, 1, 1) + 1;
}

export function anoBissexto(ano) {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

// ---- Nomes de meses e dias ----------------------------------------------
// As listas em português ficam como referência (e para os testes); nos outros
// idiomas os nomes vêm do Intl.

export const NOMES_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export const NOMES_MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export const NOMES_DIAS_SEMANA = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];

export const NOMES_DIAS_SEMANA_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const cacheDatas = new Map();

/** Formata uma data civil com Intl no idioma da interface (sem fuso: UTC). */
export function formatarDataIntl({ ano, mes, dia, hora = 12, minuto = 0 }, opcoes) {
  const chave = `${locale()}|${JSON.stringify(opcoes)}`;
  if (!cacheDatas.has(chave)) cacheDatas.set(chave, new Intl.DateTimeFormat(locale(), { ...opcoes, timeZone: "UTC" }));
  const data = new Date(Date.UTC(2000, mes - 1, dia, hora, minuto));
  data.setUTCFullYear(ano);
  return cacheDatas.get(chave).format(data);
}

const portugues = () => idiomaAtual() === "pt-BR";

/** Nome do mês (1–12): "outubro"; curto: "out". */
export function nomeMes(mes, curto = false) {
  if (portugues()) return (curto ? NOMES_MESES_CURTOS : NOMES_MESES)[mes - 1];
  return formatarDataIntl({ ano: 2001, mes, dia: 1 }, { month: curto ? "short" : "long" });
}

/** Nome do dia da semana (0 = domingo): "segunda-feira"; curto: "seg". */
export function nomeDiaSemana(indice, curto = false) {
  if (portugues()) return (curto ? NOMES_DIAS_SEMANA_CURTOS : NOMES_DIAS_SEMANA)[indice];
  // 7 de janeiro de 2001 foi um domingo.
  return formatarDataIntl({ ano: 2001, mes: 1, dia: 7 + indice }, { weekday: curto ? "short" : "long" });
}

/** Inicial do dia da semana para cabeçalhos estreitos: "D", "S"… / "日", "月"… */
export function inicialDiaSemana(indice) {
  if (portugues()) return NOMES_DIAS_SEMANA_CURTOS[indice].slice(0, 1).toUpperCase();
  return formatarDataIntl({ ano: 2001, mes: 1, dia: 7 + indice }, { weekday: "narrow" });
}

/** Mês e ano: "outubro de 2026" / "October 2026". */
export function formatarMesAno(ano, mes) {
  if (portugues()) return `${NOMES_MESES[mes - 1]} de ${ano}`;
  return formatarDataIntl({ ano, mes, dia: 1 }, { month: "long", year: "numeric" });
}

/** "segunda-feira, 19 de outubro de 2026" */
export function formatarDataExtenso({ ano, mes, dia }, { comAno = true, comSemana = true } = {}) {
  if (!portugues()) {
    return formatarDataIntl(
      { ano, mes, dia },
      { weekday: comSemana ? "long" : undefined, day: "numeric", month: "long", year: comAno ? "numeric" : undefined },
    );
  }
  const semana = comSemana ? `${NOMES_DIAS_SEMANA[diaSemana(ano, mes, dia)]}, ` : "";
  return `${semana}${dia} de ${NOMES_MESES[mes - 1]}${comAno ? ` de ${ano}` : ""}`;
}

/** "19/10/2026" */
export function formatarDataCurta({ ano, mes, dia }) {
  if (!portugues()) return formatarDataIntl({ ano, mes, dia }, { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${doisDigitos(dia)}/${doisDigitos(mes)}/${ano}`;
}

/** "14:05" ou "14:05:09" */
export function formatarHora({ hora, minuto, segundo }, comSegundos = true) {
  return comSegundos
    ? `${doisDigitos(hora)}:${doisDigitos(minuto)}:${doisDigitos(segundo)}`
    : `${doisDigitos(hora)}:${doisDigitos(minuto)}`;
}

/** Abreviação do fuso fornecida pela plataforma (ex.: "BRT", "GMT-3"). */
export function abreviacaoFuso(instante, fuso) {
  try {
    const partes = new Intl.DateTimeFormat(locale(), {
      timeZone: fuso,
      timeZoneName: "short",
    }).formatToParts(new Date(instante));
    return partes.find((p) => p.type === "timeZoneName")?.value ?? fuso;
  } catch {
    return fuso;
  }
}

/** Diferença em dias de calendário entre duas datas civis (b − a). */
export function diferencaDias(a, b) {
  return diaJuliano(b.ano, b.mes, b.dia) - diaJuliano(a.ano, a.mes, a.dia);
}

/** "hoje", "amanhã", "ontem" (no idioma da interface) ou null. */
export function relativoDia(alvo, referencia) {
  const diff = diferencaDias(referencia, alvo);
  if (diff === 0) return t("tempo.hoje");
  if (diff === 1) return t("tempo.amanha");
  if (diff === -1) return t("tempo.ontem");
  return null;
}

/** Como relativoDia, mas só para outro dia: null quando é o mesmo dia. */
export function outroDia(alvo, referencia) {
  return diferencaDias(referencia, alvo) === 0 ? null : relativoDia(alvo, referencia);
}
