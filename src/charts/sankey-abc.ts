// Fase 9 — Sankey "ABC por valor → classe final" (ABC multicritério).

import type { ResumoMulticriterio } from '../engine/tipos'
import { num } from '../lib/formato'
import type { OpcaoGrafico } from './echarts'
import type { CoresGrafico } from './tema'

export function opcaoSankeyABC(r: ResumoMulticriterio, c: CoresGrafico): OpcaoGrafico {
  const nos = [
    ...(['A', 'B', 'C'] as const).map((k) => ({
      name: `${k} (valor)`,
      itemStyle: { color: c.abc[k] },
      depth: 0,
    })),
    ...(['A', 'B', 'C'] as const).map((k) => ({
      name: `${k} (final)`,
      itemStyle: { color: c.abc[k] },
      depth: 1,
    })),
  ]
  const links = r.fluxos
    .filter((f) => f.itens > 0)
    .map((f) => ({
      source: `${f.de} (valor)`,
      target: `${f.para} (final)`,
      value: f.itens,
      lineStyle: {
        color: f.de === f.para ? c.eixo : f.para < f.de ? c.ok : c.critico,
        opacity: f.de === f.para ? 0.25 : 0.55,
      },
    }))
  return {
    legend: false as never,
    tooltip: {
      trigger: 'item',
      formatter: (p: {
        dataType: string
        data: { source?: string; target?: string; value?: number }
        name: string
        value: number
      }) =>
        p.dataType === 'edge'
          ? `${p.data.source} → ${p.data.target}: <b>${num(p.data.value ?? 0)}</b> itens`
          : `${p.name}: <b>${num(p.value)}</b> itens`,
    },
    series: [
      {
        type: 'sankey',
        left: 8,
        right: 70,
        top: 24,
        bottom: 12,
        nodeWidth: 18,
        nodeGap: 14,
        nodeAlign: 'justify',
        draggable: false,
        layoutIterations: 0,
        data: nos,
        links,
        label: { color: c.texto, fontWeight: 600 },
        emphasis: { focus: 'adjacency' },
      },
    ],
  }
}
