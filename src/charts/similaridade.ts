// 17. Similaridade de perfis (6.12g): minigráficos sobrepostos e heatmap dos itens A.

import { cosseno, perfilNormalizado } from '../engine/similaridade'
import type { ItemResultado } from '../engine/tipos'
import { numFixo } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoPerfisParecidos(
  item: ItemResultado,
  parecidos: ItemResultado[],
  rotulos: string[],
  c: CoresGrafico,
): OpcaoGrafico {
  const ultimos = rotulos.slice(-12)
  const serie = (i: ItemResultado, k: number, destaque: boolean) => ({
    name: i.codigo,
    type: 'line',
    smooth: true,
    showSymbol: false,
    data: perfilNormalizado(i.serie.slice(-12)).map((v) => Math.round(v * 100) / 100),
    lineStyle: {
      width: destaque ? 3 : 1.5,
      color: destaque ? c.destaque : c.serie[(k % (c.serie.length - 1)) + 1],
      opacity: destaque ? 1 : 0.8,
    },
    itemStyle: { color: destaque ? c.destaque : c.serie[(k % (c.serie.length - 1)) + 1] },
  })
  return {
    grid: { left: 40, right: 16, top: 40, bottom: 28 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${numFixo(v, 2)}× a média` },
    xAxis: eixo(c, { type: 'category', data: ultimos }),
    yAxis: eixo(c, { type: 'value', name: '× média' }),
    series: [serie(item, 0, true), ...parecidos.map((p, k) => serie(p, k, false))],
  }
}

export function opcaoHeatmapSimilaridade(
  itens: readonly ItemResultado[],
  c: CoresGrafico,
): OpcaoGrafico | null {
  const topA = [...itens]
    .filter((i) => i.classeABC === 'A' && i.serie.length >= 6 && i.media > 0)
    .sort((a, b) => b.consumoAnualValor - a.consumoAnualValor)
    .slice(0, 30)
  if (topA.length < 3) return null
  const perfis = topA.map((i) => perfilNormalizado(i.serie.slice(-12)))
  const dados: [number, number, number][] = []
  for (let a = 0; a < topA.length; a++)
    for (let b = 0; b < topA.length; b++)
      dados.push([a, b, Math.round(cosseno(perfis[a], perfis[b]) * 1000) / 1000])
  const cod = topA.map((i) => i.codigo)
  return {
    grid: { left: 80, right: 24, top: 24, bottom: 80 },
    legend: false as never,
    tooltip: {
      formatter: (p: { value: number[] }) =>
        `${cod[p.value[0]]} × ${cod[p.value[1]]}<br/>cos θ = ${numFixo(p.value[2], 3)}`,
    },
    xAxis: eixo(c, {
      type: 'category',
      data: cod,
      axisLabel: { color: c.textoSuave, rotate: 60, fontSize: 9, interval: 0 },
    }),
    yAxis: eixo(c, {
      type: 'category',
      data: cod,
      axisLabel: { color: c.textoSuave, fontSize: 9, interval: 0 },
    }),
    visualMap: {
      min: 0.5,
      max: 1,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemHeight: 120,
      textStyle: { color: c.textoSuave },
      inRange: {
        color: c.escuro ? ['#13294B', '#2F5D8A', '#F59E0B'] : ['#F1F5F9', '#60A5FA', '#F59E0B'],
      },
    },
    series: [{ type: 'heatmap', data: dados, itemStyle: { borderColor: c.fundo, borderWidth: 1 } }],
  }
}
