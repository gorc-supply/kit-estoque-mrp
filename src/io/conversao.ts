// Conversão de valores de células (texto, número, data) para os tipos do engine.

export type EstiloDecimal = 'virgula' | 'ponto'

/**
 * Lê número em formato pt-BR ou en: "1.234,56", "1234,56", "1,234.56", "R$ 10", "5%".
 * Com estilo 'virgula' (padrão pt-BR), "1.234" é mil e duzentos e trinta e quatro.
 * Retorna NaN se vazio ou inválido.
 */
export function lerNumero(v: unknown, estilo: EstiloDecimal = 'virgula'): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean' || v === null || v === undefined) return NaN
  let s = String(v).trim()
  if (!s) return NaN
  s = s.replace(/^R\$/i, '').replace(/[\s%]/g, '')
  let negativo = false
  if (/^\(.*\)$/.test(s)) {
    negativo = true
    s = s.slice(1, -1)
  }
  const temPonto = s.includes('.')
  const temVirgula = s.includes(',')
  if (temPonto && temVirgula) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (temVirgula) {
    if (estilo === 'ponto' && /^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '')
    else if (/^-?\d{1,3}(,\d{3}){2,}$/.test(s)) s = s.replace(/,/g, '')
    else s = s.replace(',', '.')
  } else if (temPonto) {
    if (estilo === 'virgula' && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN
  const n = Number(s)
  return negativo ? -n : n
}

/** Número opcional: undefined quando vazio ou inválido. */
export function lerNumeroOpcional(
  v: unknown,
  estilo: EstiloDecimal = 'virgula',
): number | undefined {
  const n = lerNumero(v, estilo)
  return Number.isFinite(n) ? n : undefined
}

/** Percentual como fração: "5%" → 0,05; 5 → 0,05; 0,05 → 0,05. Vazio → 0. */
export function lerPercentual(v: unknown, estilo: EstiloDecimal = 'virgula'): number {
  if (v === null || v === undefined || String(v).trim() === '') return 0
  const comPct = typeof v === 'string' && v.includes('%')
  const n = lerNumero(v, estilo)
  if (!Number.isFinite(n)) return NaN
  if (comPct) return n / 100
  return n >= 1 ? n / 100 : n
}

export function lerTexto(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim()
}

const MS_DIA = 86_400_000
const EPOCA_EXCEL_1900 = Date.UTC(1899, 11, 30)
const EPOCA_EXCEL_1904 = Date.UTC(1904, 0, 1)

function dataValida(ano: number, mes: number, dia: number): Date | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900 || ano > 2200) return null
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia ? d : null
}

/**
 * Datas aceitas: número de série do Excel, Date, "dd/mm/aaaa", "dd/mm/aa", "dd-mm-aaaa",
 * "aaaa-mm-dd" (com ou sem hora). Retorna meia-noite UTC ou null.
 */
export function lerData(v: unknown, data1904 = false): Date | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) {
    if (!Number.isFinite(v.getTime())) return null
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()))
  }
  if (typeof v === 'number') {
    if (!(v >= 1 && v < 2958466)) return null
    const base = data1904 ? EPOCA_EXCEL_1904 : EPOCA_EXCEL_1900
    return new Date(base + Math.floor(v + 1e-9) * MS_DIA)
  }
  const s = String(v).trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s)
  if (m) return dataValida(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/.exec(s)
  if (m) {
    let ano = Number(m[3])
    if (m[3].length === 2) ano += ano < 70 ? 2000 : 1900
    return dataValida(ano, Number(m[2]), Number(m[1]))
  }
  // Número de série guardado como texto.
  if (/^\d{5}(\.\d+)?$/.test(s)) return lerData(Number(s), data1904)
  return null
}
