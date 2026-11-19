// 6.12f — matriz de uso direto B (heatmap) da BOM.

import type { MatricialBOM } from '../engine/tipos'
import { numFixo } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoMatrizBOM(m: MatricialBOM, c: CoresGrafico): OpcaoGrafico {
  const dados: [number, number, number][] = []
  m.matrizB.forEach((linha, i) => linha.forEach((v, j) => v > 0 && dados.push([j, i, v])))
  const max = Math.max(1, ...dados.map((d) => d[2]))
  return {
    grid: { left: 72, right: 16, top: 24, bottom: 72 },
    legend: false as never,
    tooltip: {
      formatter: (p: { value: number[] }) =>
        `${numFixo(p.value[2], 3)} × <b>${m.codigos[p.value[1]]}</b> por unidade de <b>${m.codigos[p.value[0]]}</b>`,
    },
    xAxis: eixo(c, {
      type: 'category',
      data: m.codigos,
      name: 'pai (j)',
      axisLabel: { color: c.textoSuave, rotate: 60, interval: 0, fontSize: 10 },
    }),
    yAxis: eixo(c, {
      type: 'category',
      data: m.codigos,
      name: 'filho (i)',
      inverse: true,
      axisLabel: { color: c.textoSuave, interval: 0, fontSize: 10 },
    }),
    visualMap: {
      show: false,
      min: 0,
      max,
      inRange: { color: c.escuro ? ['#2F5D8A', '#F59E0B'] : ['#BFDBFE', '#1D4ED8'] },
    },
    series: [
      {
        type: 'heatmap',
        data: dados,
        label: {
          show: true,
          fontSize: 9,
          color: c.escuro ? '#fff' : '#0B1F3A',
          formatter: (p: { value: number[] }) => numFixo(p.value[2], 2),
        },
        itemStyle: { borderColor: c.fundo, borderWidth: 1 },
      },
    ],
  }
}
