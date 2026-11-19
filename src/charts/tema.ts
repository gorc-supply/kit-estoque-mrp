// Cores e estilo base dos gráficos (seção 10), nos dois temas.

import type { ClasseABC, StatusItem } from '../engine/tipos'
import type { OpcaoGrafico } from './echarts'

export interface CoresGrafico {
  escuro: boolean
  fundo: string
  texto: string
  textoSuave: string
  eixo: string
  grade: string
  tooltip: string
  primaria: string
  secundaria: string
  destaque: string
  ok: string
  critico: string
  excesso: string
  semGiro: string
  serie: string[]
  abc: Record<ClasseABC, string>
  xyz: { X: string; Y: string; Z: string }
  status: Record<StatusItem, string>
}

export function coresGrafico(escuro: boolean): CoresGrafico {
  return {
    escuro,
    fundo: escuro ? '#0B1F3A' : '#FFFFFF',
    texto: escuro ? '#E5E7EB' : '#0B1F3A',
    textoSuave: escuro ? '#CBD5E1' : '#475569',
    eixo: escuro ? '#64748B' : '#94A3B8',
    grade: escuro ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.35)',
    tooltip: escuro ? '#13294B' : '#FFFFFF',
    primaria: escuro ? '#60A5FA' : '#2F5D8A',
    secundaria: escuro ? '#93C5FD' : '#1E3A5F',
    destaque: '#F59E0B',
    ok: '#16A34A',
    critico: '#DC2626',
    excesso: '#7C3AED',
    semGiro: '#6B7280',
    serie: escuro
      ? ['#60A5FA', '#F59E0B', '#34D399', '#A78BFA', '#F472B6', '#94A3B8']
      : ['#2F5D8A', '#F59E0B', '#16A34A', '#7C3AED', '#DB2777', '#64748B'],
    abc: { A: escuro ? '#3B82F6' : '#1D4ED8', B: '#60A5FA', C: '#94A3B8' },
    xyz: { X: '#16A34A', Y: '#D97706', Z: '#EA580C' },
    status: {
      Ruptura: '#DC2626',
      Crítico: '#F87171',
      Comprar: '#F59E0B',
      Excesso: '#7C3AED',
      'Sem giro': '#6B7280',
      'Sem demanda': escuro ? '#475569' : '#CBD5E1',
      OK: '#16A34A',
    },
  }
}

/** Opções comuns a todos os gráficos (fonte, tooltip, toolbox para PNG, acessibilidade). */
export function baseGrafico(c: CoresGrafico, descricao: string): OpcaoGrafico {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'Inter Variable, Inter, system-ui, sans-serif', color: c.texto },
    aria: { enabled: true, label: { enabled: true, description: descricao } },
    animationDuration: 500,
    tooltip: {
      backgroundColor: c.tooltip,
      borderColor: c.eixo,
      textStyle: { color: c.texto, fontSize: 12 },
      confine: true,
    },
    legend: { textStyle: { color: c.textoSuave }, top: 0, type: 'scroll' },
    toolbox: {
      right: 0,
      top: 0,
      iconStyle: { borderColor: c.textoSuave },
      feature: {
        saveAsImage: {
          title: 'Baixar PNG',
          pixelRatio: 2,
          backgroundColor: c.fundo,
          name: 'grafico-kit-estoque-mrp',
        },
      },
    },
  }
}

export function eixo(c: CoresGrafico, extra: Record<string, unknown> = {}) {
  return {
    axisLine: { lineStyle: { color: c.eixo } },
    axisTick: { lineStyle: { color: c.eixo } },
    axisLabel: { color: c.textoSuave, fontSize: 11 },
    splitLine: { lineStyle: { color: c.grade } },
    nameTextStyle: { color: c.textoSuave },
    ...extra,
  }
}
