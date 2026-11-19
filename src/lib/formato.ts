// Formatação pt-BR para a interface.

import { formatarData } from '../engine/datas'

const cache = new Map<string, Intl.NumberFormat>()
function nf(min: number, max: number, extra: Intl.NumberFormatOptions = {}) {
  const k = `${min}|${max}|${JSON.stringify(extra)}`
  let f = cache.get(k)
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      ...extra,
    })
    cache.set(k, f)
  }
  return f
}

export const TRACO = '—'

export function num(v: number | null | undefined, casas = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return TRACO
  if (v === Infinity) return '∞'
  return nf(0, casas).format(v)
}

export function numFixo(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return v === Infinity ? '∞' : TRACO
  return nf(casas, casas).format(v)
}

export function moeda(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return TRACO
  return nf(2, 2, { style: 'currency', currency: 'BRL' }).format(v)
}

/** Moeda compacta para eixos e cartões: R$ 1,2 mi. */
export function moedaCompacta(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return TRACO
  return nf(0, 1, { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v)
}

export function compacto(v: number): string {
  return nf(0, 1, { notation: 'compact' }).format(v)
}

export function pct(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return TRACO
  return `${nf(casas, casas).format(v * 100)}%`
}

/** Quantidade com unidade: discretas para cima, fracionáveis com 2 casas. */
export function qtd(v: number | null | undefined, unidade: string, discreta: boolean): string {
  if (v === null || v === undefined || Number.isNaN(v)) return TRACO
  if (v === Infinity) return '∞'
  return discreta ? `${num(Math.ceil(v - 1e-9))} ${unidade}` : `${numFixo(v, 2)} ${unidade}`
}

export function data(d: Date | null | undefined): string {
  return d ? formatarData(d) : TRACO
}

export function dias(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return TRACO
  if (v === Infinity) return '∞'
  return `${num(v)} d`
}
