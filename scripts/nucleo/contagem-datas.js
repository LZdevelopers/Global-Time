// Contagens regressivas para datas: leitura e validação dos parâmetros de URL,
// presets (Natal, Ano Novo) e decomposição do tempo restante. Sem DOM.
//
// Formato do link: ?titulo=…&data=AAAA-MM-DD&hora=HH:MM&fuso=America/Sao_Paulo
// Parâmetros inválidos são ignorados (com padrão seguro), nunca interpretados
// como HTML: o título é sempre exibido via textContent.

import { t } from "../i18n/estado.js";
import {
  FUSO_BRASILIA,
  MS_DIA,
  MS_HORA,
  MS_MINUTO,
  MS_SEGUNDO,
  civilParaInstante,
  dataIso,
  doisDigitos,
  fusoValido,
  lerDataIso,
  lerHora,
  partesNoFuso,
} from "./tempo.js";
import { limparTexto } from "./alarmes.js";

export const LIMITE_TITULO = 80;

/**
 * Lê os parâmetros de uma URLSearchParams. Retorna a configuração válida ou
 * null quando não há data válida.
 */
export function lerParametrosContagem(parametros) {
  const data = lerDataIso(parametros.get("data"));
  if (!data) return null;
  const horaLida = lerHora(parametros.get("hora") ?? "00:00");
  const hora = horaLida ? `${doisDigitos(horaLida.hora)}:${doisDigitos(horaLida.minuto)}` : "00:00";
  const fusoBruto = parametros.get("fuso");
  const fuso = fusoValido(fusoBruto) ? fusoBruto : FUSO_BRASILIA;
  const titulo = limparTexto(parametros.get("titulo"), LIMITE_TITULO);
  return { titulo, data: dataIso(data.ano, data.mes, data.dia), hora, fuso };
}

export function montarParametros({ titulo, data, hora, fuso }) {
  const parametros = new URLSearchParams();
  if (titulo) parametros.set("titulo", titulo);
  parametros.set("data", data);
  parametros.set("hora", hora);
  parametros.set("fuso", fuso);
  return parametros.toString();
}

/** Instante (ms) do alvo da contagem, ou NaN se inválido. */
export function instanteAlvo({ data, hora, fuso }) {
  const d = lerDataIso(data);
  const h = lerHora(hora);
  if (!d || !h || !fusoValido(fuso)) return Number.NaN;
  return civilParaInstante({ ...d, hora: h.hora, minuto: h.minuto, segundo: 0 }, fuso);
}

/** Decompõe uma duração (valor absoluto) em dias, horas, minutos e segundos. */
export function decompor(ms) {
  const total = Math.floor(Math.abs(ms) / MS_SEGUNDO) * MS_SEGUNDO;
  return {
    dias: Math.floor(total / MS_DIA),
    horas: Math.floor((total % MS_DIA) / MS_HORA),
    minutos: Math.floor((total % MS_HORA) / MS_MINUTO),
    segundos: Math.floor((total % MS_MINUTO) / MS_SEGUNDO),
  };
}

/** Texto compacto para o título da aba: "12d 04:05:06" ou "04:05:06". */
export function formatarCompacto(ms) {
  const { dias, horas, minutos, segundos } = decompor(ms);
  const hms = `${doisDigitos(horas)}:${doisDigitos(minutos)}:${doisDigitos(segundos)}`;
  return dias > 0 ? `${t("contagem.diasCurto", { n: String(dias) })} ${hms}` : hms;
}

/**
 * Próxima ocorrência de mes/dia à meia-noite no fuso, estritamente depois de
 * `agora`. Ex.: Natal → 25/12 do ano corrente, ou do próximo se já começou.
 */
export function proximaData(mes, dia, agora, fuso = FUSO_BRASILIA) {
  const hoje = partesNoFuso(agora, fuso);
  for (const ano of [hoje.ano, hoje.ano + 1]) {
    const instante = civilParaInstante({ ano, mes, dia, hora: 0, minuto: 0, segundo: 0 }, fuso);
    if (instante > agora) return { titulo: "", data: dataIso(ano, mes, dia), hora: "00:00", fuso };
  }
  return null;
}

// Atalhos de datas; o título vem do dicionário ("contagem.preset.<chave>").
export const PRESETS = {
  natal: { mes: 12, dia: 25 },
  "ano-novo": { mes: 1, dia: 1 },
};

export function configuracaoPreset(chave, agora, fuso = FUSO_BRASILIA) {
  const preset = PRESETS[chave];
  if (!preset) return null;
  const config = proximaData(preset.mes, preset.dia, agora, fuso);
  return config && { ...config, titulo: `${t(`contagem.preset.${chave}`)} ${config.data.slice(0, 4)}` };
}

/** Normaliza a lista salva ({ id, titulo, data, hora, fuso }). */
export function validarListaSalva(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const parametros = new URLSearchParams();
      for (const chave of ["titulo", "data", "hora", "fuso"]) {
        if (typeof item[chave] === "string") parametros.set(chave, item[chave]);
      }
      const config = lerParametrosContagem(parametros);
      return config && { id: String(item.id ?? "").slice(0, 40) || `c${config.data}`, ...config };
    })
    .filter(Boolean);
}
