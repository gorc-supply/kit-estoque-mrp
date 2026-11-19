// 4. Status do estoque: rosca em quantidade de itens ou valor em estoque.

import type { ItemResultado, StatusItem } from '../engine/tipos'
import { moeda, num, pct } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import type { CoresGrafico } from './tema'

export const ORDEM_STATUS: StatusItem[] = [
  'Ruptura',
  'Crítico',
  'Comprar',
  'Excesso',
  'Sem giro',
  'Sem demanda',
  'OK',
]

export function opcaoStatus(
  itens: readonly ItemResultado[],
  metrica: 'itens' | 'valor',
  c: CoresGrafico,
): OpcaoGrafico {
  const dados = ORDEM_STATUS.map((s) => {
    const grupo = itens.filter((i) => i.status === s)
    const valor = grupo.reduce((t, i) => t + Math.max(0, i.estoqueAtual) * i.custo, 0)
    return {
      name: s,
      value: metrica === 'itens' ? grupo.length : valor,
      itens: grupo.length,
      valor,
      itemStyle: { color: c.status[s] },
    }
  }).filter((d) => d.itens > 0)
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: { name: string; percent: number; data: { itens: number; valor: number } }) =>
        `<b>${p.name}</b><br/>${num(p.data.itens)} itens<br/>${moeda(p.data.valor)} em estoque<br/>${pct(p.percent / 100)} do total`,
    },
    legend: { bottom: 0, top: 'auto' },
    series: [
      {
        type: 'pie',
        radius: ['48%', '74%'],
        center: ['50%', '45%'],
        itemStyle: { borderColor: c.fundo, borderWidth: 2 },
        label: {
          color: c.texto,
          formatter: (p: { name: string; percent: number }) =>
            `${p.name}\n${pct(p.percent / 100, 0)}`,
        },
        data: dados,
      },
    ],
  }
}
