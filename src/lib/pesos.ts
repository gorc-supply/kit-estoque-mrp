// Pesos do ABC multicritério: ajuste de um peso mantendo a soma em 100%.

import type { IdCriterio } from '../engine/tipos'

/** Ajusta um peso e redistribui os demais proporcionalmente para somar 100%. */
export function rebalancear(
  pesos: Record<IdCriterio, number>,
  id: IdCriterio,
  novo: number,
  ids: IdCriterio[],
): Record<IdCriterio, number> {
  const outros = ids.filter((x) => x !== id)
  const somaOutros = outros.reduce((s, x) => s + (pesos[x] ?? 0), 0)
  if (somaOutros <= 1e-9) return { ...pesos, [id]: 1 }
  const saida: Record<IdCriterio, number> = { [id]: novo }
  for (const o of outros) saida[o] = ((pesos[o] ?? 0) / somaOutros) * (1 - novo)
  return saida
}
