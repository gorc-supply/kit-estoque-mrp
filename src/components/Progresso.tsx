import { useApp } from '../estado/contexto'

export default function Progresso() {
  const { progresso, nomeArquivo } = useApp()
  const p = Math.round(Math.min(1, Math.max(0, progresso.fracao)) * 100)
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div
        className="size-14 animate-spin rounded-full border-4 border-concreto border-t-seguranca motion-reduce:animate-none dark:border-aco dark:border-t-seguranca"
        aria-hidden
      />
      <h1 className="mt-6 text-xl font-semibold text-marinho dark:text-white">
        Processando {nomeArquivo}
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-concreto/80" aria-live="polite">
        {progresso.etapa || 'Preparando'}…
      </p>
      <div
        className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-concreto dark:bg-aco"
        role="progressbar"
        aria-label="Progresso do processamento"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
      >
        <div
          className="h-full rounded-full bg-seguranca transition-[width] duration-300"
          style={{ width: `${p}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-concreto-escuro dark:text-concreto/70">
        {p}% · tudo acontece no seu navegador
      </p>
    </div>
  )
}
