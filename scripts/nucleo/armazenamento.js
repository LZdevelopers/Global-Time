// Acesso seguro ao localStorage. Em janelas anônimas, com cota cheia ou com
// armazenamento bloqueado, as operações falham silenciosamente e a página
// continua funcionando com o estado em memória.

const PREFIXO = "bt:";

function armazenamento() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function ler(chave, padrao = null) {
  try {
    const bruto = armazenamento()?.getItem(PREFIXO + chave);
    return bruto == null ? padrao : JSON.parse(bruto);
  } catch {
    return padrao;
  }
}

export function gravar(chave, valor) {
  try {
    armazenamento()?.setItem(PREFIXO + chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function remover(chave) {
  try {
    armazenamento()?.removeItem(PREFIXO + chave);
  } catch {
    /* sem armazenamento disponível */
  }
}

/** Avisa quando outra aba alterar a mesma chave. */
export function aoMudarEmOutraAba(chave, callback) {
  globalThis.addEventListener?.("storage", (evento) => {
    if (evento.key !== PREFIXO + chave) return;
    try {
      callback(evento.newValue == null ? null : JSON.parse(evento.newValue));
    } catch {
      callback(null);
    }
  });
}
