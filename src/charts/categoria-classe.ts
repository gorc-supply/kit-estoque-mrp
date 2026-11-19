// 8. Valor em estoque por categoria e classe ABC (barras empilhadas).

import type { ClasseABC, ItemResultado } from '../engine/tipos'
import { moeda, moedaCompacta } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoCategoriaClasse(
  itens: readonly ItemResultado[],
  c: CoresGrafico,
): OpcaoGrafico {
  const categorias = [...new Set(itens.map((i) => i.categoria))]
  const total = (cat: string) =>
    itens
      .filter((i) => i.categoria === cat)
      .reduce((s, i) => s + Math.max(0, i.estoqueAtual) * i.custo, 0)
  categorias.sort((a, b) => total(b) - total(a))
  const serie = (k: ClasseABC) => ({
    name: `Classe ${k}`,
    type: 'bar',
    stack: 'valor',
    itemStyle: { color: c.abc[k] },
    data: categorias.map((cat) =>
      itens
        .filter((i) => i.categoria === cat && i.classeABC === k)
        .reduce((s, i) => s + Math.max(0, i.estoqueAtual) * i.custo, 0),
    ),
  })
  return {
    grid: { left: 64, right: 16, top: 40, bottom: 64 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => moeda(v) },
    xAxis: eixo(c, {
      type: 'category',
      data: categorias,
      axisLabel: {
        color: c.textoSuave,
        interval: 0,
        rotate: categorias.length > 5 ? 25 : 0,
        fontSize: 11,
      },
    }),
    yAxis: eixo(c, {
      type: 'value',
      name: 'R$ em estoque',
      axisLabel: { color: c.textoSuave, formatter: (v: number) => moedaCompacta(v) },
    }),
    series: [serie('A'), serie('B'), serie('C')],
  }
}
