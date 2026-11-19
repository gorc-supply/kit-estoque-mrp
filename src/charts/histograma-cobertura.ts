// 7. Histograma de cobertura (dias), com marcação do lead time médio.

import type { ItemResultado } from '../engine/tipos'
import { num } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

const FAIXAS = [0, 7, 15, 30, 45, 60, 90, 120, 180, 365]

export function opcaoHistogramaCobertura(
  itens: readonly ItemResultado[],
  c: CoresGrafico,
): OpcaoGrafico {
  const comConsumo = itens.filter((i) => i.previsao > 0)
  const rotulos = FAIXAS.map((f, k) =>
    k === FAIXAS.length - 1 ? `≥ ${f}` : `${f}–${FAIXAS[k + 1]}`,
  )
  const contagem = FAIXAS.map(() => 0)
  for (const i of comConsumo) {
    const d = i.coberturaDias
    let k = FAIXAS.length - 1
    for (let j = 0; j < FAIXAS.length - 1; j++)
      if (d < FAIXAS[j + 1]) {
        k = j
        break
      }
    contagem[k]++
  }
  const ltMedio = comConsumo.length
    ? comConsumo.reduce((s, i) => s + i.leadTimeDias, 0) / comConsumo.length
    : 0
  const faixaLT = FAIXAS.findIndex((_f, k) => k === FAIXAS.length - 1 || ltMedio < FAIXAS[k + 1])
  return {
    grid: { left: 48, right: 24, top: 40, bottom: 48 },
    legend: false as never,
    tooltip: {
      trigger: 'axis',
      formatter: (ps: { name: string; value: number }[]) =>
        `${ps[0].name} dias: <b>${num(ps[0].value)}</b> itens`,
    },
    xAxis: eixo(c, {
      type: 'category',
      data: rotulos,
      name: 'Cobertura (dias)',
      nameLocation: 'middle',
      nameGap: 30,
    }),
    yAxis: eixo(c, { type: 'value', name: 'itens', minInterval: 1 }),
    series: [
      {
        type: 'bar',
        data: contagem.map((v, k) => ({
          value: v,
          itemStyle: {
            color: FAIXAS[k + 1] !== undefined && FAIXAS[k + 1] <= ltMedio ? c.critico : c.primaria,
            borderRadius: [3, 3, 0, 0],
          },
        })),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: c.destaque, type: 'dashed', width: 2 },
          label: { color: c.destaque, formatter: `LT médio: ${num(ltMedio)} d` },
          data: [{ xAxis: rotulos[faixaLT] }],
        },
      },
    ],
  }
}
