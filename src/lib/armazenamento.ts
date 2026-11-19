// localStorage com proteção: pode falhar em aba anônima ou com armazenamento bloqueado.
// Guarda só preferências (parâmetros, mapeamento, tema). Nunca a planilha.

const PREFIXO = 'kit-estoque-mrp:'

export function ler<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(PREFIXO + chave)
    return v === null ? padrao : (JSON.parse(v) as T)
  } catch {
    return padrao
  }
}

export function gravar(chave: string, valor: unknown): void {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor))
  } catch {
    // ignora: a preferência vale só nesta sessão
  }
}

export function apagar(chave: string): void {
  try {
    localStorage.removeItem(PREFIXO + chave)
  } catch {
    // ignora
  }
}
