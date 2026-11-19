// 11. Padrão de demanda de Syntetos-Boylan: dispersão ADI × CV² com os quatro quadrantes.

import type { ItemResultado, PadraoDemanda } from '../engine/tipos'
import { numFixo } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

const PADROES: PadraoDemanda[] = ['Suave', 'Errático', 'Intermitente', 'Irregular']

export function opcaoSyntetosBoylan(
  itens: readonly ItemResultado[],
  corteADI: number,
  corteCV2: number,
  c: CoresGrafico,
): OpcaoGrafico {
  const validos = itens.filter((i) => i.adi !== null && i.cv2 !== null && Number.isFinite(i.adi))
  const maxADI = Math.max(corteADI * 2, ...validos.map((i) => i.adi!)) * 1.05
  const maxCV2 = Math.max(corteCV2 * 2, ...validos.map((i) => i.cv2!)) * 1.05
  const cores = [c.ok, c.destaque, c.primaria, c.critico]
  return {
    grid: { left: 56, right: 24, top: 40, bottom: 48 },
    tooltip: {
      formatter: (p: { data: { item: ItemResultado } }) => {
        const i = p.data.item
        return `<b>${i.codigo}</b> — ${i.descricao}<br/>ADI: ${numFixo(i.adi, 2)} · CV²: ${numFixo(i.cv2, 2)}<br/>${i.padrao}`
      },
    },
    xAxis: eixo(c, {
      type: 'value',
      name: 'ADI (intervalo médio entre demandas)',
      nameLocation: 'middle',
      nameGap: 28,
      min: 1,
      max: Math.ceil(maxADI * 10) / 10,
    }),
    yAxis: eixo(c, {
      type: 'value',
      name: 'CV² dos tamanhos',
      min: 0,
      max: Math.ceil(maxCV2 * 10) / 10,
    }),
    series: PADROES.map((p, k) => ({
      name: p,
      type: 'scatter',
      symbolSize: 9,
      itemStyle: { color: cores[k], opacity: 0.85 },
      data: validos.filter((i) => i.padrao === p).map((i) => ({ value: [i.adi, i.cv2], item: i })),
      ...(k === 0
        ? {
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { type: 'dashed', color: c.textoSuave },
              label: { color: c.textoSuave },
              data: [
                { xAxis: corteADI, label: { formatter: `ADI ${numFixo(corteADI, 2)}` } },
                { yAxis: corteCV2, label: { formatter: `CV² ${numFixo(corteCV2, 2)}` } },
              ],
            },
          }
        : {}),
    })),
  }
}
