// 13. Distribuição da demanda no lead time (6.12b): sino, área à direita do PP e posição atual.

import { phi } from '../engine/estatistica'
import type { ItemResultado } from '../engine/tipos'
import { num, pct } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoDistribuicaoLT(i: ItemResultado, c: CoresGrafico): OpcaoGrafico | null {
  const mu = i.mediaLT
  const s = i.sigmaLT
  if (!(s > 0) || i.pontoPedido === null) return null
  const ini = Math.max(0, mu - 4 * s)
  const fim = Math.max(mu + 4 * s, i.posicao * 1.05, i.pontoPedido * 1.05)
  const n = 120
  const pts: [number, number][] = []
  for (let k = 0; k <= n; k++) {
    const x = ini + ((fim - ini) * k) / n
    pts.push([x, phi((x - mu) / s) / s])
  }
  const pp = i.pontoPedido
  return {
    grid: { left: 56, right: 24, top: 40, bottom: 44 },
    legend: false as never,
    tooltip: {
      trigger: 'axis',
      formatter: (ps: { value: number[] }[]) =>
        `Demanda no LT: ${num(ps[0].value[0], 1)} ${i.unidade}`,
    },
    xAxis: eixo(c, {
      type: 'value',
      name: `Demanda durante o lead time (${i.unidade})`,
      nameLocation: 'middle',
      nameGap: 26,
      min: Math.floor(ini),
      max: Math.ceil(fim),
    }),
    yAxis: eixo(c, { type: 'value', show: false }),
    series: [
      {
        type: 'line',
        showSymbol: false,
        data: pts,
        lineStyle: { color: c.primaria, width: 2 },
        areaStyle: { color: c.primaria, opacity: 0.08 },
        markArea: {
          silent: true,
          itemStyle: { color: c.critico, opacity: 0.18 },
          data: [
            [
              { xAxis: pp, name: `Ruptura no ciclo: ${pct(i.probRupturaCiclo ?? 0)}` },
              { xAxis: fim },
            ],
          ],
          label: { color: c.critico, position: 'insideTopRight', fontSize: 11 },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              xAxis: mu,
              lineStyle: { color: c.textoSuave, type: 'dotted' },
              label: { formatter: `μ ${num(mu, 1)}`, color: c.textoSuave },
            },
            {
              xAxis: pp,
              lineStyle: { color: c.destaque, type: 'dashed' },
              label: { formatter: `PP ${num(pp, 1)}`, color: c.destaque },
            },
            {
              xAxis: i.posicao,
              lineStyle: { color: c.critico, width: 2 },
              label: {
                formatter: `Posição ${num(i.posicao, 1)}\nP(faltar) ${pct(i.probFaltarAntesChegada ?? 0)}`,
                color: c.critico,
              },
            },
          ],
        },
      },
    ],
  }
}
