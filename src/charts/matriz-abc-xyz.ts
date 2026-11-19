// 2. Matriz ABC×XYZ: heatmap 3×3 com contagem ou valor; clique filtra a tabela.

import type { CelulaMatriz } from '../engine/tipos'
import { moeda, moedaCompacta, num } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoMatriz(
  celulas: readonly CelulaMatriz[],
  metrica: 'itens' | 'valor',
  c: CoresGrafico,
): OpcaoGrafico {
  const xs = ['X', 'Y', 'Z']
  const ys = ['C', 'B', 'A']
  const dados = celulas.map((k) => [
    xs.indexOf(k.xyz),
    ys.indexOf(k.abc),
    metrica === 'itens' ? k.itens : k.valor,
    k.itens,
    k.valor,
  ])
  const max = Math.max(1, ...dados.map((d) => d[2]))
  return {
    grid: { left: 48, right: 16, top: 30, bottom: 40 },
    legend: false as never,
    tooltip: {
      formatter: (p: { value: number[] }) =>
        `<b>${ys[p.value[1]]}${xs[p.value[0]]}</b><br/>${num(p.value[3])} itens<br/>Consumo anual: ${moeda(p.value[4])}`,
    },
    xAxis: eixo(c, {
      type: 'category',
      data: ['X (estável)', 'Y (variável)', 'Z (irregular)'],
      splitArea: { show: false },
      position: 'top',
    }),
    yAxis: eixo(c, { type: 'category', data: ['C', 'B', 'A'] }),
    visualMap: {
      show: false,
      dimension: 2,
      min: 0,
      max,
      inRange: {
        color: c.escuro ? ['#13294B', '#2F5D8A', '#60A5FA'] : ['#EFF6FF', '#93C5FD', '#1D4ED8'],
      },
    },
    series: [
      {
        type: 'heatmap',
        data: dados,
        label: {
          show: true,
          fontSize: 13,
          fontWeight: 600,
          formatter: (p: { value: number[] }) =>
            `${ys[p.value[1]]}${xs[p.value[0]]}\n${metrica === 'itens' ? `${num(p.value[3])} itens` : moedaCompacta(p.value[4])}`,
          color: c.escuro ? '#FFFFFF' : '#0B1F3A',
        },
        itemStyle: { borderColor: c.fundo, borderWidth: 3, borderRadius: 6 },
        emphasis: { itemStyle: { borderColor: c.destaque, borderWidth: 3 } },
      },
    ],
  }
}
