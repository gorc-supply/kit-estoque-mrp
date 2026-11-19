// Detalhe do item: histórico de consumo com média e faixa ±σ, previsão e saldo reconstruído.

import type { ItemResultado } from '../engine/tipos'
import { num } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoHistoricoItem(
  i: ItemResultado,
  rotulos: string[],
  c: CoresGrafico,
): OpcaoGrafico {
  const eixoX = [...rotulos.slice(i.inicioSerie), 'Previsão']
  const n = i.serie.length
  const media = new Array(n + 1).fill(i.media)
  const sup = new Array(n + 1).fill(i.media + i.desvio)
  const inf = new Array(n + 1).fill(Math.max(0, i.media - i.desvio))
  return {
    grid: { left: 48, right: 48, top: 40, bottom: 32 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => num(v, 2) },
    legend: { data: ['Consumo', 'Saldo no fim do período', 'Média', 'Previsão (F)'] },
    xAxis: eixo(c, { type: 'category', data: eixoX }),
    yAxis: [
      eixo(c, { type: 'value', name: i.unidade }),
      eixo(c, { type: 'value', name: 'saldo', splitLine: { show: false } }),
    ],
    series: [
      {
        name: 'Consumo',
        type: 'bar',
        data: [...i.serie, null],
        itemStyle: { color: c.primaria, borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Previsão (F)',
        type: 'bar',
        data: [...new Array(n).fill(null), i.previsao],
        itemStyle: { color: c.destaque, borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Média',
        type: 'line',
        data: media,
        symbol: 'none',
        lineStyle: { color: c.texto, type: 'dashed', width: 1 },
        itemStyle: { color: c.texto },
      },
      {
        name: 'base da faixa',
        type: 'line',
        data: inf,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        stack: 'faixa',
        tooltip: { show: false },
      },
      {
        name: 'Faixa ±σ',
        type: 'line',
        stack: 'faixa',
        data: sup.map((s, k) => s - inf[k]),
        symbol: 'none',
        lineStyle: { opacity: 0 },
        tooltip: { show: false },
        areaStyle: { color: c.primaria, opacity: 0.12 },
      },
      {
        name: 'Saldo no fim do período',
        type: 'line',
        yAxisIndex: 1,
        data: [...i.saldosFimPeriodo, null],
        smooth: true,
        lineStyle: { color: c.ok, width: 2 },
        itemStyle: { color: c.ok },
      },
    ],
  }
}
