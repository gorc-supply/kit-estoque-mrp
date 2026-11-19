import { useEffect, useMemo, useRef } from 'react'
import { useTemaAtual } from '../estado/tema'
import { echarts, type OpcaoGrafico } from './echarts'
import { montarOpcao } from './montar'
import { coresGrafico, type CoresGrafico } from './tema'

export interface PropsGrafico {
  /** Monta a opção do gráfico com as cores do tema atual. */
  opcao: (c: CoresGrafico) => OpcaoGrafico | null
  /** Resumo textual para leitores de tela (aria-label). */
  descricao: string
  altura?: number
  aoClicar?: (p: {
    name?: string
    seriesName?: string
    data?: unknown
    dataIndex?: number
    value?: unknown
  }) => void
  className?: string
}

const reduzirMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Grafico({
  opcao,
  descricao,
  altura = 320,
  aoClicar,
  className = '',
}: PropsGrafico) {
  const div = useRef<HTMLDivElement>(null)
  const inst = useRef<echarts.ECharts | null>(null)
  const clique = useRef(aoClicar)
  const { tema } = useTemaAtual()
  const cores = useMemo(() => coresGrafico(tema === 'escuro'), [tema])
  const especifica = useMemo(() => opcao(cores), [opcao, cores])

  useEffect(() => {
    clique.current = aoClicar
  }, [aoClicar])

  useEffect(() => {
    if (!div.current) return
    const g = echarts.init(div.current, undefined, { renderer: 'canvas' })
    inst.current = g
    g.on('click', (p) => clique.current?.(p as never))
    const obs = new ResizeObserver(() => g.resize())
    obs.observe(div.current)
    return () => {
      obs.disconnect()
      g.dispose()
      inst.current = null
    }
  }, [])

  useEffect(() => {
    const g = inst.current
    if (!g || !especifica) return
    g.setOption(montarOpcao(cores, descricao, especifica, !reduzirMovimento()), { notMerge: true })
  }, [especifica, cores, descricao])

  if (!especifica) {
    return (
      <p className="py-8 text-center text-sm text-concreto-escuro dark:text-concreto/70">
        Não se aplica a este item (dados insuficientes para o gráfico).
      </p>
    )
  }
  return (
    <div
      ref={div}
      role="img"
      aria-label={descricao}
      className={`w-full ${aoClicar ? 'cursor-pointer' : ''} ${className}`}
      style={{ height: altura }}
    />
  )
}
