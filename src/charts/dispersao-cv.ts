// 3. Dispersão CV × consumo anual (eixo X log), cor por classe ABC.

import type { ClasseABC, ItemResultado } from '../engine/tipos'
import { moeda, numFixo } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoDispersaoCV(
  itens: readonly ItemResultado[],
  corteX: number,
  corteY: number,
  c: CoresGrafico,
): OpcaoGrafico {
  const validos = itens.filter((i) => i.consumoAnualValor > 0 && i.cv !== null)
  const serie = (k: ClasseABC) => ({
    name: `Classe ${k}`,
    type: 'scatter',
    symbolSize: 9,
    itemStyle: { color: c.abc[k], opacity: 0.85 },
    data: validos
      .filter((i) => i.classeABC === k)
      .map((i) => ({ value: [i.consumoAnualValor, i.cv], name: i.codigo, item: i })),
  })
  return {
    grid: { left: 56, right: 24, top: 40, bottom: 48 },
    tooltip: {
      formatter: (p: { data: { item: ItemResultado } }) => {
        const i = p.data.item
        return `<b>${i.codigo}</b> — ${i.descricao}<br/>Consumo anual: ${moeda(i.consumoAnualValor)}<br/>CV: ${numFixo(i.cv, 2)} (${i.classeXYZ})`
      },
    },
    xAxis: eixo(c, {
      type: 'log',
      name: 'Consumo anual (R$, escala log)',
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: { color: c.textoSuave, formatter: (v: number) => moeda(v).replace(',00', '') },
    }),
    yAxis: eixo(c, { type: 'value', name: 'CV' }),
    series: [
      {
        ...serie('A'),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', color: c.textoSuave },
          label: {
            color: c.textoSuave,
            formatter: (p: { value: number }) => `CV ${numFixo(p.value, 2)}`,
          },
          data: [{ yAxis: corteX }, { yAxis: corteY }],
        },
      },
      serie('B'),
      serie('C'),
    ],
  }
}
