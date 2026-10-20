// Eventos pessoais do calendário (compromissos, aniversários, lembretes).
//
// Funções puras, sem DOM nem armazenamento: usadas pelo navegador (eventos
// salvos localmente) e pelas Vercel Functions (eventos da conta), para que a
// validação seja exatamente a mesma dos dois lados. Erros são códigos, não
// textos — a interface traduz.

export const LIMITE_TITULO = 100;
export const LIMITE_DESCRICAO = 1000;
export const LIMITE_EVENTOS = 500;

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const RE_ID = /^[A-Za-z0-9_-]{8,40}$/;

function diasNoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Remove caracteres de controle e espaços repetidos; corta no limite. */
export function limparTexto(valor, limite, { multilinha = false } = {}) {
  if (typeof valor !== "string") return "";
  let texto = valor.normalize("NFC");
  texto = multilinha
    ? texto.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n")
    : texto.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ");
  return texto.trim().slice(0, limite);
}

/** { ano, mes, dia } de "AAAA-MM-DD", ou null se a data não existir. */
export function lerData(texto) {
  const m = RE_DATA.exec(typeof texto === "string" ? texto : "");
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) return null;
  return { ano, mes, dia };
}

export function novoId() {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Valida a entrada de um formulário ou da API.
 * Retorna { ok: true, evento } ou { ok: false, erros: { campo: código } }.
 * Campos: titulo (obrigatório), data AAAA-MM-DD (obrigatória), hora HH:MM
 * (opcional), descricao (opcional), anual (repetir todo ano).
 */
export function validarEvento(entrada, { id, agora = Date.now(), criadoEm } = {}) {
  const erros = {};
  const dados = entrada && typeof entrada === "object" ? entrada : {};

  const titulo = limparTexto(dados.titulo, LIMITE_TITULO);
  if (!titulo) erros.titulo = "obrigatorio";

  const data = lerData(dados.data);
  if (!data) erros.data = "invalida";

  let hora = null;
  if (dados.hora != null && dados.hora !== "") {
    if (typeof dados.hora === "string" && RE_HORA.test(dados.hora)) hora = dados.hora;
    else erros.hora = "invalida";
  }

  const descricao = limparTexto(dados.descricao ?? "", LIMITE_DESCRICAO, { multilinha: true });
  if (typeof dados.descricao === "string" && dados.descricao.length > LIMITE_DESCRICAO * 2) erros.descricao = "longa";

  if (Object.keys(erros).length) return { ok: false, erros };

  const idFinal = typeof id === "string" && RE_ID.test(id) ? id : novoId();
  return {
    ok: true,
    evento: {
      id: idFinal,
      titulo,
      data: dados.data,
      hora,
      descricao,
      anual: dados.anual === true,
      criadoEm: Number.isFinite(criadoEm) ? criadoEm : agora,
      atualizadoEm: agora,
    },
  };
}

/** Mantém só eventos válidos de uma lista salva (dados de fora são suspeitos). */
export function normalizarLista(lista) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  const saida = [];
  for (const item of lista.slice(0, LIMITE_EVENTOS)) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !RE_ID.test(item.id) || vistos.has(item.id)) continue;
    const r = validarEvento(item, { id: item.id, agora: Number(item.atualizadoEm) || Date.now(), criadoEm: Number(item.criadoEm) });
    if (r.ok) {
      vistos.add(item.id);
      saida.push(r.evento);
    }
  }
  return saida;
}

/** Dia juliano (mesma convenção de tempo.js: dias desde 1970-01-01 em UTC). */
function juliano(ano, mes, dia) {
  const d = new Date(Date.UTC(2000, mes - 1, dia));
  d.setUTCFullYear(ano);
  return Math.round(d.getTime() / 86400000);
}

function deJuliano(n) {
  const d = new Date(n * 86400000);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

/**
 * Ocorrências dos eventos entre os dias julianos `inicio` e `fim` (inclusive).
 * Eventos anuais aparecem todo ano a partir da data original; 29 de fevereiro
 * aparece em 28 de fevereiro nos anos não bissextos.
 * Retorna [{ juliano, evento }] em ordem de dia e hora.
 */
export function ocorrencias(eventos, inicio, fim) {
  const saida = [];
  const anoInicio = deJuliano(inicio).ano;
  const anoFim = deJuliano(fim).ano;
  for (const evento of eventos) {
    const d = lerData(evento.data);
    if (!d) continue;
    if (!evento.anual) {
      const j = juliano(d.ano, d.mes, d.dia);
      if (j >= inicio && j <= fim) saida.push({ juliano: j, evento });
      continue;
    }
    for (let ano = Math.max(anoInicio, d.ano); ano <= anoFim; ano += 1) {
      const dia = Math.min(d.dia, diasNoMes(ano, d.mes));
      const j = juliano(ano, d.mes, dia);
      if (j >= inicio && j <= fim) saida.push({ juliano: j, evento });
    }
  }
  return saida.sort((a, b) => a.juliano - b.juliano || (a.evento.hora ?? "").localeCompare(b.evento.hora ?? ""));
}
