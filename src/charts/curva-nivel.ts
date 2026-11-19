// 16. Curva nível de serviço × custo anual do estoque de segurança (6.12e).

import { curvaNivelServico } from '../engine/parametros'
import { moeda, pct } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export interface SerieCurvaNivel {
  nome: string
  sigmaLT: number
  H: number
  nivelAtual: number | null
}

export function opcaoCurvaNivel(series: SerieCurvaNivel[], c: CoresGrafico): OpcaoGrafico | null {
  const validas = series.filter((s) => s.sigmaLT > 0 && s.H > 0)
  if (!validas.length) return null
  return {
    grid: { left: 72, right: 24, top: 40, bottom: 44 },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) => moeda(v),
      axisPointer: { type: 'line' },
    },
    xAxis: eixo(c, {
      type: 'value',
      min: 0.8,
      max: 1,
      name: 'Nível de serviço',
      nameLocation: 'middle',
      nameGap: 26,
      axisLabel: { color: c.textoSuave, formatter: (v: number) => pct(v, 0) },
    }),
    yAxis: eixo(c, {
      type: 'value',
      name: 'Custo anual do ES',
      axisLabel: { color: c.textoSuave, formatter: (v: number) => moeda(v).replace(',00', '') },
    }),
    series: validas.map((s, k) => {
      const pts = curvaNivelServico(s.sigmaLT, s.H)
      const atual =
        s.nivelAtual !== null ? curvaNivelServico(s.sigmaLT, s.H, [s.nivelAtual])[0] : null
      return {
        name: s.nome,
        type: 'line',
        smooth: true,
        data: pts.map((p) => [p.nivel, p.custoAnual]),
        lineStyle: { color: c.serie[k % c.serie.length], width: 2 },
        itemStyle: { color: c.serie[k % c.serie.length] },
        markPoint: atual
          ? {
              symbol: 'circle',
              symbolSize: 12,
              label: { show: false },
              data: [
                {
                  name: 'Atual',
                  coord: [atual.nivel, atual.custoAnual],
                  itemStyle: { color: c.critico },
                },
              ],
            }
          : undefined,
      }
    }),
  }
}
