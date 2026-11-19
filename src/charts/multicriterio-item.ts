// Fase 9 — detalhe do item: contribuição de cada critério para o score e radar dos normalizados.

import type { ItemMulticriterio } from '../engine/tipos'
import { numFixo, pct } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import { eixo, type CoresGrafico } from './tema'

export function opcaoContribuicoes(m: ItemMulticriterio, c: CoresGrafico): OpcaoGrafico | null {
  if (!m.criterios.length || m.score === null) return null
  return {
    grid: { left: 8, right: 16, top: 36, bottom: 24, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (p: { seriesName: string; value: number; seriesIndex: number }) => {
        const k = m.criterios[p.seriesIndex]
        return `<b>${k.nome}</b><br/>normalizado ${numFixo(k.normalizado, 3)} × peso ${pct(k.peso, 0)} = <b>+${numFixo(k.contribuicao, 3)}</b>${k.faltando ? '<br/>(dado faltando: valor neutro 0,5)' : ''}`
      },
    },
    legend: { top: 0 },
    xAxis: eixo(c, {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: { color: c.textoSuave, formatter: (v: number) => numFixo(v, 1) },
    }),
    yAxis: eixo(c, { type: 'category', data: ['Score'], axisLabel: { show: false } }),
    series: m.criterios.map((k, i) => ({
      name: k.nome,
      type: 'bar',
      stack: 'score',
      barWidth: 34,
      data: [Math.round(k.contribuicao * 1000) / 1000],
      itemStyle: { color: c.serie[i % c.serie.length], opacity: k.faltando ? 0.45 : 1 },
      label: {
        show: k.contribuicao >= 0.05,
        color: '#fff',
        fontSize: 10,
        formatter: () => `+${numFixo(k.contribuicao, 2)}`,
      },
    })),
  }
}

export function opcaoRadarCriterios(m: ItemMulticriterio, c: CoresGrafico): OpcaoGrafico | null {
  if (m.criterios.length < 3) return null
  return {
    legend: false as never,
    tooltip: { trigger: 'item' },
    radar: {
      indicator: m.criterios.map((k) => ({ name: k.nome, max: 1 })),
      radius: '62%',
      axisName: { color: c.textoSuave, fontSize: 10 },
      splitLine: { lineStyle: { color: c.grade } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: c.grade } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            name: 'Normalizado (1 = mais crítico)',
            value: m.criterios.map((k) => Math.round(k.normalizado * 1000) / 1000),
            areaStyle: { color: c.destaque, opacity: 0.25 },
            lineStyle: { color: c.destaque, width: 2 },
            itemStyle: { color: c.destaque },
          },
        ],
      },
    ],
  }
}
