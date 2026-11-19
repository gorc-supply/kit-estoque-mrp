// 9. MRP: estoque projetado semanal com ES e PP como referência e barras de recebimentos planejados.

import type { RegistroMRP } from '../engine/tipos'
import { num } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoMRPProjetado(
  r: RegistroMRP,
  rotulos: string[],
  c: CoresGrafico,
): OpcaoGrafico {
  const refs: { name: string; yAxis: number; lineStyle: object; label: object }[] = []
  if (r.estoqueSeguranca > 0)
    refs.push({
      name: 'ES',
      yAxis: r.estoqueSeguranca,
      lineStyle: { color: c.critico, type: 'dashed' },
      label: { formatter: `ES ${num(r.estoqueSeguranca, 1)}`, color: c.critico },
    })
  if (r.pontoPedido !== null && r.pontoPedido > 0)
    refs.push({
      name: 'PP',
      yAxis: r.pontoPedido,
      lineStyle: { color: c.destaque, type: 'dashed' },
      label: { formatter: `PP ${num(r.pontoPedido, 1)}`, color: c.destaque },
    })
  return {
    grid: { left: 56, right: 56, top: 40, bottom: 32 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => num(v, 2) },
    xAxis: eixo(c, { type: 'category', data: rotulos }),
    yAxis: eixo(c, { type: 'value' }),
    series: [
      {
        name: 'Recebimento planejado',
        type: 'bar',
        data: r.semanas.map((s) => s.recPlan),
        itemStyle: { color: c.primaria, opacity: 0.55, borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Recebimento programado',
        type: 'bar',
        data: r.semanas.map((s) => s.rp),
        itemStyle: { color: c.ok, opacity: 0.55, borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Necessidade bruta',
        type: 'line',
        data: r.semanas.map((s) => s.nb),
        lineStyle: { color: c.textoSuave, type: 'dotted' },
        itemStyle: { color: c.textoSuave },
        symbol: 'none',
      },
      {
        name: 'Estoque projetado',
        type: 'line',
        data: r.semanas.map((s) => s.ep),
        lineStyle: { color: c.secundaria, width: 3 },
        itemStyle: { color: c.secundaria },
        markLine: { silent: true, symbol: 'none', data: refs },
      },
    ],
  }
}
