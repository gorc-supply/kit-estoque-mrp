// 5. Entradas vs saídas por período (R$), com linha do saldo total reconstruído.

import type { SerieConsolidada } from '../engine/tipos'
import { moeda, moedaCompacta } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoEntradasSaidas(s: SerieConsolidada, c: CoresGrafico): OpcaoGrafico {
  return {
    grid: { left: 64, right: 64, top: 40, bottom: 32 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => moeda(v) },
    xAxis: eixo(c, { type: 'category', data: s.rotulos }),
    yAxis: [
      eixo(c, {
        type: 'value',
        axisLabel: { color: c.textoSuave, formatter: (v: number) => moedaCompacta(v) },
      }),
      eixo(c, {
        type: 'value',
        axisLabel: { color: c.textoSuave, formatter: (v: number) => moedaCompacta(v) },
        splitLine: { show: false },
      }),
    ],
    series: [
      {
        name: 'Entradas (R$)',
        type: 'bar',
        data: s.entradasValor,
        itemStyle: { color: c.primaria, borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Saídas (R$)',
        type: 'bar',
        data: s.saidasValor,
        itemStyle: { color: c.destaque, borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Saldo em estoque (R$)',
        type: 'line',
        yAxisIndex: 1,
        data: s.saldoValor,
        smooth: true,
        lineStyle: { color: c.ok, width: 2 },
        itemStyle: { color: c.ok },
      },
    ],
  }
}
