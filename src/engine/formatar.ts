// Formatação pt-BR usada em textos gerados pelo engine (motivos, alertas).
// Intl existe em qualquer ambiente JS moderno (navegador, worker, Node): não é DOM.

const cacheNumero = new Map<string, Intl.NumberFormat>()

function formatador(min: number, max: number): Intl.NumberFormat {
  const chave = `${min}-${max}`
  let f = cacheNumero.get(chave)
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max })
    cacheNumero.set(chave, f)
  }
  return f
}

export function num(v: number, casas = 0): string {
  if (v === Infinity) return '∞'
  if (!Number.isFinite(v)) return '—'
  return formatador(0, casas).format(v)
}

export function numFixo(v: number, casas = 2): string {
  if (!Number.isFinite(v)) return v === Infinity ? '∞' : '—'
  return formatador(casas, casas).format(v)
}

const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function moeda(v: number): string {
  return Number.isFinite(v) ? moedaFmt.format(v) : '—'
}

export function pct(v: number, casas = 1): string {
  if (!Number.isFinite(v)) return '—'
  return `${numFixo(v * 100, casas)}%`
}

/** Quantidade com unidade: discretas arredondadas para cima, fracionáveis com 2 casas. */
export function qtd(v: number, unidade: string, discreta: boolean): string {
  if (!Number.isFinite(v)) return '—'
  return discreta ? `${num(Math.ceil(v - 1e-9))} ${unidade}` : `${numFixo(v, 2)} ${unidade}`
}
