// 10. Liberações planejadas por semana (R$): o "fluxo de caixa de compras".

import type { ResultadoMRP } from '../engine/tipos'
import { moeda, moedaCompacta } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoLiberacoes(mrp: ResultadoMRP, c: CoresGrafico): OpcaoGrafico {
  return {
    grid: { left: 64, right: 16, top: 32, bottom: 32 },
    legend: false as never,
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => moeda(v) },
    xAxis: eixo(c, { type: 'category', data: mrp.semanas.map((s) => s.rotulo) }),
    yAxis: eixo(c, {
      type: 'value',
      axisLabel: { color: c.textoSuave, formatter: (v: number) => moedaCompacta(v) },
    }),
    series: [
      {
        name: 'Liberações planejadas (R$)',
        type: 'bar',
        data: mrp.consolidado.map((s) => s.valor),
        itemStyle: { color: c.destaque, borderRadius: [3, 3, 0, 0] },
        label: {
          show: mrp.horizonte <= 16,
          position: 'top',
          color: c.textoSuave,
          fontSize: 10,
          formatter: (p: { value: number }) => (p.value > 0 ? moedaCompacta(p.value) : ''),
        },
      },
    ],
  }
}
