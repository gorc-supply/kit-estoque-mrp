// 12. Curva de custo total do lote (6.12a): pedir (↓), manter (reta), total (U), EOQ, Q* e penalidade.

import { curvaCustoLote } from '../engine/parametros'
import type { ItemResultado } from '../engine/tipos'
import { moeda, num, pct } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoCustoLote(i: ItemResultado, S: number, c: CoresGrafico): OpcaoGrafico | null {
  if (i.eoq === null || i.loteCompra === null || i.custoTotalEOQ === null) return null
  const D = i.demandaAnual
  const H = i.custoManutencao
  const qMax = Math.max(i.eoq, i.loteCompra) * 2.2
  const pts = curvaCustoLote(D, S, H, qMax, 80)
  const ctQ = i.custoTotalLote ?? 0
  return {
    grid: { left: 64, right: 24, top: 40, bottom: 44 },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) => moeda(v),
      axisPointer: { type: 'line' },
    },
    xAxis: eixo(c, {
      type: 'value',
      name: `Lote (${i.unidade})`,
      nameLocation: 'middle',
      nameGap: 26,
      min: 0,
      max: Math.round(qMax),
    }),
    yAxis: eixo(c, { type: 'value', name: 'R$/ano', min: 0, max: Math.ceil(i.custoTotalEOQ * 3) }),
    series: [
      {
        name: 'Custo de pedir (D/Q·S)',
        type: 'line',
        showSymbol: false,
        data: pts.map((p) => [p.q, p.pedir]),
        lineStyle: { color: c.primaria },
        itemStyle: { color: c.primaria },
      },
      {
        name: 'Custo de manter (Q/2·H)',
        type: 'line',
        showSymbol: false,
        data: pts.map((p) => [p.q, p.manter]),
        lineStyle: { color: c.ok },
        itemStyle: { color: c.ok },
      },
      {
        name: 'Custo total',
        type: 'line',
        showSymbol: false,
        data: pts.map((p) => [p.q, p.total]),
        lineStyle: { color: c.destaque, width: 3 },
        itemStyle: { color: c.destaque },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: c.textoSuave, type: 'dashed' },
          label: { color: c.textoSuave, formatter: 'derivada = 0' },
          data: [
            [
              { coord: [i.eoq * 0.45, i.custoTotalEOQ] },
              { coord: [i.eoq * 1.55, i.custoTotalEOQ] },
            ],
          ],
        },
        markPoint: {
          symbolSize: 44,
          label: { fontSize: 10, color: '#fff' },
          data: [
            {
              name: 'EOQ',
              coord: [i.eoq, i.custoTotalEOQ],
              value: 'EOQ',
              itemStyle: { color: c.secundaria },
            },
            {
              name: 'Q*',
              coord: [i.loteCompra, ctQ],
              value: 'Q*',
              itemStyle: { color: c.critico },
            },
          ],
        },
      },
    ],
    title: {
      text: `EOQ ${num(i.eoq, 1)} · Q* ${num(i.loteCompra, 2)} · penalidade ${pct(i.penalidadeArredondamento ?? 0, 2)}`,
      left: 'center',
      bottom: 0,
      textStyle: { color: c.textoSuave, fontSize: 11, fontWeight: 'normal' },
    },
  }
}
