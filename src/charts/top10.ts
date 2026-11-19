// 6. Top 10 itens em excesso (R$) e Top 10 risco de ruptura (cobertura vs lead time).

import type { ItemResultado } from '../engine/tipos'
import { dias, moeda, moedaCompacta } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function valorExcesso(i: ItemResultado): number {
  return i.estoqueMaximo !== null && i.previsao > 0
    ? Math.max(0, i.estoqueAtual - i.estoqueMaximo) * i.custo
    : 0
}

export function opcaoTopExcesso(itens: readonly ItemResultado[], c: CoresGrafico): OpcaoGrafico {
  const top = [...itens]
    .filter((i) => valorExcesso(i) > 0)
    .sort((a, b) => valorExcesso(b) - valorExcesso(a))
    .slice(0, 10)
    .reverse()
  return {
    grid: { left: 90, right: 24, top: 24, bottom: 24 },
    legend: false as never,
    tooltip: {
      trigger: 'axis',
      formatter: (ps: { dataIndex: number }[]) => {
        const i = top[ps[0].dataIndex]
        return `<b>${i.codigo}</b> — ${i.descricao}<br/>Excesso: ${moeda(valorExcesso(i))}`
      },
    },
    xAxis: eixo(c, {
      type: 'value',
      axisLabel: { color: c.textoSuave, formatter: (v: number) => moedaCompacta(v) },
    }),
    yAxis: eixo(c, { type: 'category', data: top.map((i) => i.codigo) }),
    series: [
      {
        type: 'bar',
        data: top.map(valorExcesso),
        itemStyle: { color: c.excesso, borderRadius: [0, 3, 3, 0] },
        label: {
          show: true,
          position: 'right',
          color: c.textoSuave,
          formatter: (p: { value: number }) => moedaCompacta(p.value),
        },
      },
    ],
  }
}

export function itensRisco(itens: readonly ItemResultado[]): ItemResultado[] {
  return [...itens]
    .filter((i) => i.previsao > 0 && i.coberturaDias < i.leadTimeDias)
    .sort(
      (a, b) =>
        a.coberturaDias / a.leadTimeDias - b.coberturaDias / b.leadTimeDias ||
        b.consumoAnualValor - a.consumoAnualValor,
    )
    .slice(0, 10)
}

export function opcaoTopRisco(itens: readonly ItemResultado[], c: CoresGrafico): OpcaoGrafico {
  const top = itensRisco(itens).reverse()
  return {
    grid: { left: 90, right: 24, top: 40, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      formatter: (ps: { dataIndex: number }[]) => {
        const i = top[ps[0].dataIndex]
        return `<b>${i.codigo}</b> — ${i.descricao}<br/>Cobertura: ${dias(i.coberturaDias)}<br/>Lead time: ${dias(i.leadTimeDias)}`
      },
    },
    xAxis: eixo(c, { type: 'value', name: 'dias' }),
    yAxis: eixo(c, { type: 'category', data: top.map((i) => i.codigo) }),
    series: [
      {
        name: 'Cobertura (dias)',
        type: 'bar',
        data: top.map((i) => Math.round(i.coberturaDias * 10) / 10),
        itemStyle: { color: c.critico, borderRadius: [0, 3, 3, 0] },
      },
      {
        name: 'Lead time (dias)',
        type: 'bar',
        data: top.map((i) => i.leadTimeDias),
        itemStyle: { color: c.eixo, borderRadius: [0, 3, 3, 0] },
      },
    ],
  }
}
