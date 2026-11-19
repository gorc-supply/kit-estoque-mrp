// Custo unitário (seção 6.2).
// Prioridade: (1) cadastro; (2) custo médio ponderado das entradas na janela
// (líquido de devoluções ao fornecedor com valor); (3) último custo de entrada;
// (4) zero, com alerta "item sem custo".

import { diaSerial } from './datas'
import type { Material, Movimento, OrigemCusto } from './tipos'

export interface CustoItem {
  custo: number
  origem: OrigemCusto
}

/**
 * @param movimentos movimentos válidos do item (qualquer data até a data-base)
 * @param inicioJanelaDia / fimJanelaDia limites da janela (dias seriais, inclusivos)
 */
export function calcularCusto(
  material: Material,
  movimentos: readonly Movimento[],
  inicioJanelaDia: number,
  fimJanelaDia: number,
): CustoItem {
  if (material.custoUnitario !== undefined && material.custoUnitario > 0) {
    return { custo: material.custoUnitario, origem: 'cadastro' }
  }

  let somaValor = 0
  let somaQtd = 0
  let ultimaData = -Infinity
  let ultimoCusto = 0

  for (const m of movimentos) {
    if (!m.data || m.valorTotal === undefined || !(m.valorTotal > 0)) continue
    const dia = diaSerial(m.data)
    if (m.tipo === 'Entrada') {
      if (dia >= inicioJanelaDia && dia <= fimJanelaDia) {
        somaValor += m.valorTotal
        somaQtd += m.quantidade
      }
      if (dia >= ultimaData) {
        ultimaData = dia
        ultimoCusto = m.valorTotal / m.quantidade
      }
    } else if (
      m.tipo === 'Devolução ao fornecedor' &&
      dia >= inicioJanelaDia &&
      dia <= fimJanelaDia
    ) {
      somaValor -= m.valorTotal
      somaQtd -= m.quantidade
    }
  }

  if (somaQtd > 0 && somaValor > 0) return { custo: somaValor / somaQtd, origem: 'media_entradas' }
  if (ultimoCusto > 0) return { custo: ultimoCusto, origem: 'ultima_entrada' }
  return { custo: 0, origem: 'sem_custo' }
}
