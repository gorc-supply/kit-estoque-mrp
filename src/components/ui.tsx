// Componentes básicos de interface.

import { CircleHelp, X } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import type { ClasseABC, ClasseXYZ, Prioridade, StatusItem } from '../engine/tipos'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo'

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-seguranca text-marinho font-semibold hover:brightness-110 shadow-sm disabled:opacity-60',
  secundario:
    'border border-aco-claro/60 text-aco hover:bg-aco-claro/10 dark:text-concreto dark:border-concreto/30 dark:hover:bg-white/10',
  fantasma: 'text-aco hover:bg-aco-claro/10 dark:text-concreto dark:hover:bg-white/10',
  perigo: 'bg-critico text-white hover:brightness-110',
}

export function Botao({
  variante = 'secundario',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm transition-colors disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Cartao({
  titulo,
  acoes,
  children,
  className = '',
  id,
}: {
  titulo?: ReactNode
  acoes?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section
      id={id}
      className={`min-w-0 rounded-xl border border-concreto bg-white/90 p-4 shadow-sm backdrop-blur dark:border-aco dark:bg-aco/40 ${className}`}
    >
      {(titulo || acoes) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && (
            <h2 className="text-base font-semibold text-marinho dark:text-white">{titulo}</h2>
          )}
          {acoes}
        </div>
      )}
      {children}
    </section>
  )
}

const COR_ABC: Record<ClasseABC, string> = {
  A: 'bg-classe-a text-white',
  B: 'bg-classe-b text-marinho',
  C: 'bg-classe-c text-marinho',
}
const COR_XYZ: Record<ClasseXYZ, string> = {
  X: 'bg-classe-x text-white',
  Y: 'bg-classe-y text-marinho',
  Z: 'bg-classe-z text-marinho',
  N: 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-white',
  Novo: 'border border-dashed border-concreto-escuro text-concreto-escuro dark:text-concreto',
}
const COR_STATUS: Record<StatusItem, string> = {
  Ruptura: 'bg-critico text-white',
  Crítico: 'bg-red-100 text-red-800 ring-1 ring-critico/50 dark:bg-red-900/50 dark:text-red-100',
  Comprar: 'bg-seguranca text-marinho',
  Excesso: 'bg-excesso text-white',
  'Sem giro': 'bg-sem-giro text-white',
  'Sem demanda': 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-white',
  OK: 'bg-ok text-white',
}
const COR_PRIORIDADE: Record<Prioridade, string> = {
  Urgente: 'bg-critico text-white',
  Alta: 'bg-seguranca text-marinho',
  Média: 'bg-classe-b text-marinho',
  Baixa: 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-white',
}

function Selo({
  classe,
  children,
  titulo,
}: {
  classe: string
  children: ReactNode
  titulo?: string
}) {
  return (
    <span
      title={titulo}
      className={`inline-flex min-w-6 items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${classe}`}
    >
      {children}
    </span>
  )
}

export const SeloABC = ({ c }: { c: ClasseABC }) => (
  <Selo classe={COR_ABC[c]} titulo={`Classe ${c}`}>
    {c}
  </Selo>
)
export const SeloXYZ = ({ c }: { c: ClasseXYZ }) => (
  <Selo
    classe={COR_XYZ[c]}
    titulo={c === 'N' ? 'Sem demanda' : c === 'Novo' ? 'Histórico insuficiente' : `Classe ${c}`}
  >
    {c}
  </Selo>
)
export const SeloStatus = ({ s }: { s: StatusItem }) => <Selo classe={COR_STATUS[s]}>{s}</Selo>
export const SeloPrioridade = ({ p }: { p: Prioridade }) => (
  <Selo classe={COR_PRIORIDADE[p]}>{p}</Selo>
)

/** Ícone de ajuda com explicação (hover, foco ou toque). */
export function Ajuda({ texto, rotulo = 'Ajuda' }: { texto: ReactNode; rotulo?: string }) {
  const [aberto, setAberto] = useState(false)
  const id = useId()
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={rotulo}
        aria-describedby={aberto ? id : undefined}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        onBlur={() => setAberto(false)}
        className="rounded-full p-0.5 text-concreto-escuro hover:text-aco-claro dark:text-concreto/70 dark:hover:text-white"
      >
        <CircleHelp className="size-4" aria-hidden />
      </button>
      {aberto && (
        <span
          role="tooltip"
          id={id}
          className="absolute top-6 left-1/2 z-50 w-64 -translate-x-1/2 rounded-md bg-marinho px-3 py-2 text-xs leading-relaxed font-normal text-white shadow-lg ring-1 ring-white/10"
        >
          {texto}
        </span>
      )}
    </span>
  )
}

/** Gaveta lateral acessível (Esc fecha, foco vai para dentro). */
export function Gaveta({
  aberta,
  aoFechar,
  titulo,
  children,
  largura = 'max-w-2xl',
}: {
  aberta: boolean
  aoFechar: () => void
  titulo: ReactNode
  children: ReactNode
  largura?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberta) return
    const anterior = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
      anterior?.focus()
    }
  }, [aberta, aoFechar])
  if (!aberta) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-marinho/60 backdrop-blur-sm"
        onClick={aoFechar}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof titulo === 'string' ? titulo : undefined}
        tabIndex={-1}
        className={`relative flex h-full w-full ${largura} flex-col bg-slate-50 shadow-2xl outline-none dark:bg-marinho`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-concreto px-4 py-3 dark:border-aco">
          <div className="min-w-0 text-lg font-semibold text-marinho dark:text-white">{titulo}</div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-concreto-escuro hover:bg-aco-claro/10 dark:text-concreto"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  )
}

export function Campo({
  rotulo,
  ajuda,
  children,
  htmlFor,
}: {
  rotulo: string
  ajuda?: ReactNode
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-sm font-medium text-marinho dark:text-concreto">
        <label htmlFor={htmlFor}>{rotulo}</label>
        {ajuda && <Ajuda texto={ajuda} rotulo={`Ajuda: ${rotulo}`} />}
      </div>
      {children}
    </div>
  )
}

/** Faixa de segurança (divisor). */
export function FaixaSeguranca({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-1.5 w-full ${className}`}
      style={{
        backgroundImage: 'repeating-linear-gradient(-45deg, #F59E0B 0 10px, #0B1F3A 10px 20px)',
        opacity: 0.85,
      }}
    />
  )
}
