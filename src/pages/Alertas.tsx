import { useMemo, useState } from 'react'
import checklist from '../assets/ilustracoes/checklist.svg'
import { Cartao } from '../components/ui'
import type { TipoAlerta } from '../engine/tipos'
import { num } from '../lib/formato'
import type { PropsAba } from './tipos'

const COR = { alta: 'border-l-critico', media: 'border-l-seguranca', baixa: 'border-l-classe-c' }

export default function Alertas({ resultado: r, abrirItem }: PropsAba) {
  const [tipo, setTipo] = useState<TipoAlerta | null>(null)
  const porCodigo = useMemo(() => new Map(r.itens.map((i) => [i.codigo, i])), [r.itens])
  const contagem = useMemo(() => {
    const m = new Map<TipoAlerta, number>()
    for (const a of r.alertas) m.set(a.tipo, (m.get(a.tipo) ?? 0) + 1)
    return [...m.entries()]
  }, [r.alertas])
  const lista = tipo ? r.alertas.filter((a) => a.tipo === tipo) : r.alertas

  if (!r.alertas.length) {
    return (
      <Cartao titulo="Alertas">
        <div className="flex flex-col items-center py-10 text-center">
          <img src={checklist} alt="" className="h-28 w-auto" />
          <p className="mt-3 text-sm text-slate-600 dark:text-concreto/80">
            Nenhum alerta. Tudo dentro dos parâmetros.
          </p>
        </div>
      </Cartao>
    )
  }
  return (
    <Cartao titulo={`Alertas (${num(r.alertas.length)})`}>
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrar por tipo de alerta"
      >
        <button
          type="button"
          aria-pressed={!tipo}
          onClick={() => setTipo(null)}
          className={`rounded-full px-3 py-1 text-sm ring-1 ring-concreto dark:ring-aco ${!tipo ? 'bg-aco-claro text-white' : ''}`}
        >
          Todos
        </button>
        {contagem.map(([t, n]) => (
          <button
            key={t}
            type="button"
            aria-pressed={tipo === t}
            onClick={() => setTipo(t)}
            className={`rounded-full px-3 py-1 text-sm ring-1 ring-concreto dark:ring-aco ${tipo === t ? 'bg-aco-claro text-white' : 'text-slate-700 dark:text-concreto'}`}
          >
            {t} <b>{num(n)}</b>
          </button>
        ))}
      </div>
      <ul className="flex max-h-[640px] flex-col gap-2 overflow-y-auto pr-1">
        {lista.slice(0, 1000).map((a, k) => {
          const item = porCodigo.get(a.codigo)
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => item && abrirItem(a.codigo)}
                className={`flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-l-4 border-concreto bg-white px-3 py-2 text-left text-sm hover:shadow dark:border-aco dark:bg-aco/30 ${COR[a.gravidade]} ${a.tipo === 'Ruptura' ? 'alerta-critico' : ''}`}
              >
                <span className="font-semibold text-marinho dark:text-white">{a.tipo}</span>
                <span className="font-mono text-xs">{a.codigo}</span>
                <span className="text-xs text-concreto-escuro dark:text-concreto/70">
                  {item?.descricao}
                </span>
                <span className="w-full text-slate-700 dark:text-concreto/90">{a.mensagem}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Cartao>
  )
}
