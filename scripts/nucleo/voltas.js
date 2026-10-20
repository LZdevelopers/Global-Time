// Formatação e exportação das voltas do cronômetro. Funções puras (sem DOM),
// testadas em testes/voltas.test.mjs. Os textos saem no idioma da interface.

import { separadorDecimal, t } from "../i18n/estado.js";
import { detalharVoltas } from "./medidores.js";
import { doisDigitos, formatarDuracao } from "./tempo.js";

/** Tempo de cronômetro: "00:12,34" abaixo de 1 h, "01:00:00,00" acima. */
export function formatarCronometro(ms) {
  return formatarDuracao(ms, { centesimos: true, horas: "auto" });
}

/** Diferença entre voltas: "+0,52 s", "−1,07 s", "+01:02,10". */
export function formatarDiferencaVolta(ms) {
  if (ms == null) return "—";
  const sinal = ms > 0 ? "+" : ms < 0 ? "−" : "±";
  const abs = Math.floor(Math.abs(ms) / 10) * 10;
  if (abs < 60000) {
    const s = Math.floor(abs / 1000);
    const cc = Math.floor((abs % 1000) / 10);
    return `${sinal}${t("tempo.unidade.s", { n: `${s}${separadorDecimal()}${doisDigitos(cc)}` })}`;
  }
  return `${sinal}${formatarCronometro(abs)}`;
}

/** Texto simples para a área de transferência. */
export function textoVoltas(totais, totalMs) {
  const voltas = detalharVoltas(totais);
  const linhas = [t("voltas.textoTitulo", { total: formatarCronometro(totalMs) })];
  if (voltas.length) {
    linhas.push("", [t("voltas.col.volta"), t("voltas.col.tempo"), t("voltas.col.diferenca"), t("voltas.col.total")].join("\t"));
    for (const v of voltas) {
      const marca = v.melhor ? ` (${t("voltas.melhorMinusculo")})` : v.pior ? ` (${t("voltas.piorMinusculo")})` : "";
      linhas.push(
        `${v.numero}\t${formatarCronometro(v.voltaMs)}${marca}\t${formatarDiferencaVolta(v.diferencaMs)}\t${formatarCronometro(v.totalMs)}`,
      );
    }
  }
  return linhas.join("\n");
}

function campoCsv(valor) {
  const texto = String(valor);
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * CSV das voltas. Separador ";" porque o Excel em português do Brasil (e em
 * outros idiomas com vírgula decimal) abre ";" diretamente em colunas. O
 * arquivo começa com BOM UTF-8 para que acentos apareçam corretamente no
 * Excel. As colunas em milissegundos preservam o valor exato.
 */
export function csvVoltas(totais, totalMs) {
  const voltas = detalharVoltas(totais);
  const linhas = [
    [
      t("voltas.col.volta"),
      t("voltas.col.tempo"),
      t("voltas.col.diferencaAnterior"),
      t("voltas.col.total"),
      t("voltas.col.voltaMs"),
      t("voltas.col.totalMs"),
      t("voltas.col.marcacao"),
    ],
  ];
  for (const v of voltas) {
    linhas.push([
      v.numero,
      formatarCronometro(v.voltaMs),
      v.diferencaMs == null ? "" : formatarDiferencaVolta(v.diferencaMs),
      formatarCronometro(v.totalMs),
      Math.round(v.voltaMs),
      Math.round(v.totalMs),
      v.melhor ? t("voltas.melhorMinusculo") : v.pior ? t("voltas.piorMinusculo") : "",
    ]);
  }
  linhas.push([t("voltas.tempoTotal"), formatarCronometro(totalMs), "", "", "", Math.round(totalMs), ""]);
  return `﻿${linhas.map((l) => l.map(campoCsv).join(";")).join("\r\n")}\r\n`;
}
