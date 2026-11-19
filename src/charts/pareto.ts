// 1. Pareto ABC: barras de consumo anual por item + linha de % acumulado, faixas A/B/C.

import type { ItemResultado } from '../engine/tipos'
import { moeda, pct } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoPareto(
  itens: readonly ItemResultado[],
  corteA: number,
  corteB: number,
  c: CoresGrafico,
): OpcaoGrafico {
  const ord = [...itens]
    .filter((i) => i.consumoAnualValor > 0)
    .sort((a, b) => a.posicaoABC - b.posicaoABC)
  const fimA = ord.findIndex((i) => i.classeABC !== 'A')
  const fimB = ord.findIndex((i) => i.classeABC === 'C')
  const nA = fimA < 0 ? ord.length : fimA
  const nB = fimB < 0 ? ord.length : fimB
  const faixa = (de: number, ate: number, cor: string, nome: string) =>
    ate > de
      ? [
          { name: nome, xAxis: de, itemStyle: { color: cor, opacity: c.escuro ? 0.1 : 0.07 } },
          { xAxis: ate - 1 },
        ]
      : null
  return {
    grid: { left: 64, right: 48, top: 40, bottom: 48 },
    tooltip: {
      trigger: 'axis',
      formatter: (ps: { dataIndex: number }[]) => {
        const i = ord[ps[0].dataIndex]
        return `<b>${i.codigo}</b> — ${i.descricao}<br/>Consumo anual: ${moeda(i.consumoAnualValor)}<br/>% acumulado: ${pct(i.pctAcumulado)}<br/>Classe ${i.classeABC}`
      },
    },
    legend: { data: ['Consumo anual (R$)', '% acumulado'] },
    dataZoom:
      ord.length > 80 ? [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 8 }] : [],
    xAxis: eixo(c, {
      type: 'category',
      data: ord.map((i) => i.codigo),
      axisLabel: { show: ord.length <= 40, color: c.textoSuave, rotate: 60, fontSize: 9 },
    }),
    yAxis: [
      eixo(c, {
        type: 'value',
        name: 'R$/ano',
        axisLabel: { color: c.textoSuave, formatter: (v: number) => moeda(v).replace(',00', '') },
      }),
      eixo(c, {
        type: 'value',
        max: 1,
        axisLabel: { color: c.textoSuave, formatter: (v: number) => pct(v, 0) },
        splitLine: { show: false },
      }),
    ],
    series: [
      {
        name: 'Consumo anual (R$)',
        type: 'bar',
        large: ord.length > 500,
        data: ord.map((i) => ({
          value: i.consumoAnualValor,
          itemStyle: { color: c.abc[i.classeABC] },
        })),
        markArea: {
          silent: true,
          label: { color: c.textoSuave, position: 'insideTop' },
          data: [
            faixa(0, nA, c.abc.A, 'A'),
            faixa(nA, nB, c.abc.B, 'B'),
            faixa(nB, ord.length, c.abc.C, 'C'),
          ].filter(Boolean),
        },
      },
      {
        name: '% acumulado',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: c.destaque, width: 2 },
        itemStyle: { color: c.destaque },
        data: ord.map((i) => i.pctAcumulado),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: c.textoSuave, type: 'dashed' },
          label: { color: c.textoSuave, formatter: (p: { value: number }) => pct(p.value, 0) },
          data: [{ yAxis: corteA }, { yAxis: corteB }],
        },
      },
    ],
  }
}
