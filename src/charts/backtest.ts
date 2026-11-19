// 15. Backtest da previsão (6.12d): real × previsto e WMAPE por método, com o vencedor destacado.

import type { ItemResultado } from '../engine/tipos'
import { num, pct } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoBacktest(
  i: ItemResultado,
  rotulos: string[],
  c: CoresGrafico,
): OpcaoGrafico | null {
  const bt = i.backtest
  if (!bt || !bt.metodos.length) return null
  const escolhido =
    bt.metodos.find((m) => m.metodo === i.metodo) ??
    bt.metodos.find((m) => m.metodo === bt.melhor) ??
    bt.metodos[0]
  const eixoX = bt.periodos.map((p) => rotulos[i.inicioSerie + p] ?? `P${p + 1}`)
  return {
    grid: [
      { left: 48, right: '54%', top: 40, bottom: 32 },
      { left: '56%', right: 16, top: 40, bottom: 32 },
    ],
    tooltip: { trigger: 'axis' },
    legend: { data: ['Real', `Previsto (${escolhido.metodo})`] },
    xAxis: [
      eixo(c, { type: 'category', data: eixoX, gridIndex: 0 }),
      eixo(c, { type: 'category', data: bt.metodos.map((m) => m.metodo), gridIndex: 1 }),
    ],
    yAxis: [
      eixo(c, { type: 'value', gridIndex: 0 }),
      eixo(c, {
        type: 'value',
        gridIndex: 1,
        name: 'WMAPE',
        axisLabel: { color: c.textoSuave, formatter: (v: number) => pct(v, 0) },
      }),
    ],
    series: [
      {
        name: 'Real',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: escolhido.reais,
        lineStyle: { color: c.texto },
        itemStyle: { color: c.texto },
      },
      {
        name: `Previsto (${escolhido.metodo})`,
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: escolhido.previsoes.map((v) => Math.round(v * 100) / 100),
        lineStyle: { color: c.destaque, type: 'dashed' },
        itemStyle: { color: c.destaque },
      },
      {
        name: 'WMAPE por método',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        tooltip: { valueFormatter: (v: number) => pct(v) },
        data: bt.metodos.map((m) => ({
          value: m.wmape ?? 0,
          itemStyle: { color: m.metodo === bt.melhor ? c.ok : c.eixo, borderRadius: [3, 3, 0, 0] },
        })),
        label: {
          show: true,
          position: 'top',
          color: c.textoSuave,
          fontSize: 10,
          formatter: (p: { dataIndex: number }) => `MAE ${num(bt.metodos[p.dataIndex].mae, 1)}`,
        },
      },
    ],
  }
}
