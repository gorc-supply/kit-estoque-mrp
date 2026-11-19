// Curva ABC (seção 6.4).
// Ordena por valor decrescente; classe pelo % acumulado ANTERIOR ao item:
// A se < corteA, B se < corteB, C caso contrário. Valor 0 vai para o fim, classe C.

import type { ClasseABC } from './tipos'

export interface EntradaABC {
  codigo: string
  valor: number
}

export interface SaidaABC {
  codigo: string
  valor: number
  classe: ClasseABC
  /** Participação do item no total (0..1). */
  pct: number
  /** % acumulado incluindo o item. */
  pctAcumulado: number
  /** % acumulado dos itens anteriores (critério de corte). */
  pctAcumuladoAnterior: number
  /** Posição no ranking (1 = maior). */
  posicao: number
}

export function classificarABC(
  itens: readonly EntradaABC[],
  corteA = 0.8,
  corteB = 0.95,
): SaidaABC[] {
  const ordenados = [...itens].sort((a, b) => {
    const va = a.valor > 0 ? a.valor : 0
    const vb = b.valor > 0 ? b.valor : 0
    if (vb !== va) return vb - va
    return a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0
  })
  let total = 0
  for (const i of ordenados) if (i.valor > 0) total += i.valor

  let acumulado = 0
  return ordenados.map((item, idx) => {
    const valor = item.valor > 0 ? item.valor : 0
    const anterior = total > 0 ? acumulado / total : 1
    acumulado += valor
    const pctAcumulado = total > 0 ? acumulado / total : 1
    let classe: ClasseABC = 'C'
    if (valor > 0) {
      if (anterior < corteA) classe = 'A'
      else if (anterior < corteB) classe = 'B'
    }
    return {
      codigo: item.codigo,
      valor,
      classe,
      pct: total > 0 ? valor / total : 0,
      pctAcumulado,
      pctAcumuladoAnterior: anterior,
      posicao: idx + 1,
    }
  })
}
