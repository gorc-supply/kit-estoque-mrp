// 14. Nível de serviço de ciclo (tipo 1) × fill rate (tipo 2) por célula ABC×XYZ.

import type { ItemResultado } from '../engine/tipos'
import { pct } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoNivelFillRate(itens: readonly ItemResultado[], c: CoresGrafico): OpcaoGrafico {
  const celulas: string[] = []
  const tipo1: number[] = []
  const tipo2: number[] = []
  for (const a of ['A', 'B', 'C'] as const) {
    for (const x of ['X', 'Y', 'Z'] as const) {
      const g = itens.filter(
        (i) =>
          i.classeABC === a && i.classeXYZ === x && i.nivelServico !== null && i.fillRate !== null,
      )
      if (!g.length) continue
      celulas.push(`${a}${x}`)
      tipo1.push(g.reduce((s, i) => s + i.nivelServico!, 0) / g.length)
      tipo2.push(g.reduce((s, i) => s + Math.max(0, i.fillRate!), 0) / g.length)
    }
  }
  const minimo = Math.max(0, Math.floor(Math.min(0.8, ...tipo1, ...tipo2) * 20) / 20)
  return {
    grid: { left: 56, right: 16, top: 40, bottom: 32 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => pct(v, 2) },
    xAxis: eixo(c, { type: 'category', data: celulas }),
    yAxis: eixo(c, {
      type: 'value',
      min: minimo,
      max: 1,
      axisLabel: { color: c.textoSuave, formatter: (v: number) => pct(v, 0) },
    }),
    series: [
      {
        name: 'Nível de ciclo (tipo 1, alvo)',
        type: 'bar',
        data: tipo1,
        itemStyle: { color: c.primaria, borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Fill rate esperado (tipo 2)',
        type: 'bar',
        data: tipo2,
        itemStyle: { color: c.ok, borderRadius: [3, 3, 0, 0] },
      },
    ],
  }
}
