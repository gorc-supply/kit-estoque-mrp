import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Ajuda } from './ui'

/** Número que anima até o valor final (respeita prefers-reduced-motion). */
function Contador({
  valor,
  formatar,
}: {
  valor: number | null
  formatar: (v: number | null) => string
}) {
  const [atual, setAtual] = useState<number | null>(0)
  const anterior = useRef(0)
  const [reduzido] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const animar = valor !== null && Number.isFinite(valor) && !reduzido
  useEffect(() => {
    if (valor === null || !Number.isFinite(valor) || reduzido) return
    const de = anterior.current
    const inicio = performance.now()
    let quadro = 0
    const passo = (t: number) => {
      const k = Math.min(1, (t - inicio) / 700)
      const e = 1 - Math.pow(1 - k, 3)
      setAtual(de + (valor - de) * e)
      if (k < 1) quadro = requestAnimationFrame(passo)
      else anterior.current = valor
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [valor, reduzido])
  return <>{formatar(animar ? atual : valor)}</>
}

export default function CartaoKPI({
  rotulo,
  valor,
  formatar,
  detalhe,
  formula,
  aoClicar,
  tom = 'neutro',
}: {
  rotulo: string
  valor: number | null
  formatar: (v: number | null) => string
  detalhe?: ReactNode
  formula: string
  aoClicar?: () => void
  tom?: 'neutro' | 'critico' | 'atencao' | 'ok' | 'excesso'
}) {
  const borda = {
    neutro: 'border-l-aco-claro',
    critico: 'border-l-critico',
    atencao: 'border-l-seguranca',
    ok: 'border-l-ok',
    excesso: 'border-l-excesso',
  }[tom]
  const Conteudo = (
    <>
      <div className="flex items-center gap-1 text-xs font-medium text-concreto-escuro dark:text-concreto/75">
        <span>{rotulo}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-marinho tabular-nums dark:text-white">
        <Contador valor={valor} formatar={formatar} />
      </div>
      {detalhe && (
        <div className="mt-0.5 text-xs text-slate-600 dark:text-concreto/80">{detalhe}</div>
      )}
    </>
  )
  return (
    <div
      className={`relative rounded-xl border border-l-4 border-concreto bg-white/90 shadow-sm transition-shadow dark:border-aco dark:bg-aco/40 ${borda} ${aoClicar ? 'hover:shadow-md' : ''}`}
    >
      <span className="absolute top-2 right-2 z-10">
        <Ajuda texto={formula} rotulo={`Fórmula: ${rotulo}`} />
      </span>
      {aoClicar ? (
        <button
          type="button"
          onClick={aoClicar}
          className="block w-full rounded-xl px-4 py-3 pr-8 text-left"
          aria-label={`${rotulo}: ver os itens`}
        >
          {Conteudo}
        </button>
      ) : (
        <div className="px-4 py-3 pr-8">{Conteudo}</div>
      )}
    </div>
  )
}
