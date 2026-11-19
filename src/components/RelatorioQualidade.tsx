import { CheckCircle2, TriangleAlert, XCircle } from 'lucide-react'
import { DESCRICAO_REGRA } from '../engine/qualidade'
import type { RegraQualidade, RelatorioQualidade as Relatorio } from '../engine/tipos'
import { num, pct } from '../lib/formato'

export default function RelatorioQualidade({
  qualidade: q,
  abrirItem,
  aberto = false,
}: {
  qualidade: Relatorio
  abrirItem?: (codigo: string) => void
  aberto?: boolean
}) {
  const erros = q.problemas.filter((p) => p.gravidade === 'erro').length
  const avisos = q.problemas.length - erros
  const regras = Object.entries(q.contagemPorRegra) as [RegraQualidade, number][]
  const Icone = q.bloqueante ? XCircle : avisos ? TriangleAlert : CheckCircle2
  const cor = q.bloqueante ? 'text-critico' : avisos ? 'text-seguranca' : 'text-ok'
  return (
    <details
      open={aberto || q.bloqueante}
      className="rounded-xl border border-concreto bg-white/90 p-4 shadow-sm dark:border-aco dark:bg-aco/40"
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-semibold text-marinho dark:text-white">
        <Icone className={`size-5 ${cor}`} aria-hidden />
        Qualidade dos dados: {pct(q.percentualValidas)} das {num(q.totalLinhas)} linhas aproveitadas
        <span className="text-sm font-normal text-slate-600 dark:text-concreto/80">
          · {num(erros)} erro(s) · {num(avisos)} aviso(s)
        </span>
      </summary>
      {regras.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          <ul className="flex flex-wrap gap-2 text-xs">
            {regras.map(([regra, n]) => (
              <li
                key={regra}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-marinho dark:text-concreto"
              >
                {DESCRICAO_REGRA[regra]}: <b>{num(n)}</b>
              </li>
            ))}
          </ul>
          <div className="max-h-72 overflow-auto rounded-lg border border-concreto dark:border-aco">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 text-left dark:bg-aco">
                <tr>
                  <th className="px-2 py-1.5">Gravidade</th>
                  <th className="px-2 py-1.5">Aba</th>
                  <th className="px-2 py-1.5">Linha</th>
                  <th className="px-2 py-1.5">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {q.problemas.slice(0, 500).map((p, k) => (
                  <tr key={k} className="border-t border-concreto/60 dark:border-aco/60">
                    <td
                      className={`px-2 py-1 font-semibold ${p.gravidade === 'erro' ? 'text-critico' : 'text-seguranca'}`}
                    >
                      {p.gravidade === 'erro' ? 'Erro' : 'Aviso'}
                    </td>
                    <td className="px-2 py-1">{p.aba}</td>
                    <td className="px-2 py-1 tabular-nums">{p.linha ?? '—'}</td>
                    <td className="px-2 py-1 text-slate-700 dark:text-concreto">
                      {p.mensagem}
                      {p.codigo &&
                        abrirItem &&
                        p.regra !== 'mov_sem_cadastro' &&
                        p.gravidade === 'aviso' && (
                          <button
                            type="button"
                            className="ml-1 text-aco-claro underline dark:text-seguranca"
                            onClick={() => abrirItem(p.codigo!)}
                          >
                            ver item
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {q.problemas.length > 500 && (
              <p className="p-2 text-xs">
                Mostrando 500 de {num(q.problemas.length)} problemas. A lista completa vai na
                planilha de saída.
              </p>
            )}
          </div>
        </div>
      )}
    </details>
  )
}
