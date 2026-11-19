import { useMemo, useState } from 'react'
import { calcularAHP, matrizReciproca, nomeCriterio, registroAHP } from '../engine/multicriterio'
import type { IdCriterio, ResultadoAHP } from '../engine/tipos'
import { numFixo, pct } from '../lib/formato'
import { classeEntrada } from './estilos'
import { Botao, Gaveta } from './ui'

// Escala de Saaty: 9 = extremamente mais importante … 1 = igual … 1/9 = o outro é extremamente mais.
const ESCALA: { valor: number; rotulo: (a: string, b: string) => string }[] = [
  ...[9, 7, 5, 3, 2].map((v) => ({
    valor: v,
    rotulo: (a: string) =>
      `${a} é ${v}× mais importante${v === 9 ? ' (extremamente)' : v === 7 ? ' (muito fortemente)' : v === 5 ? ' (fortemente)' : v === 3 ? ' (moderadamente)' : ''}`,
  })),
  { valor: 1, rotulo: () => 'Igualmente importantes' },
  ...[2, 3, 5, 7, 9].map((v) => ({
    valor: 1 / v,
    rotulo: (_a: string, b: string) => `${b} é ${v}× mais importante`,
  })),
]

export default function AssistenteAHP({
  aberto,
  aoFechar,
  criterios,
  aoAplicar,
}: {
  aberto: boolean
  aoFechar: () => void
  criterios: IdCriterio[]
  aoAplicar: (pesos: Record<IdCriterio, number>, registro: ResultadoAHP) => void
}) {
  const n = criterios.length
  const [valores, setValores] = useState<Record<string, number>>({})
  const chave = (i: number, j: number) => `${criterios[i]}|${criterios[j]}`
  const matriz = useMemo(
    () => matrizReciproca(n, (i, j) => valores[`${criterios[i]}|${criterios[j]}`] ?? 1),
    [n, valores, criterios],
  )
  const r = useMemo(() => (n >= 2 ? calcularAHP(matriz) : null), [matriz, n])

  return (
    <Gaveta
      aberta={aberto}
      aoFechar={aoFechar}
      titulo="Assistente AHP (comparação par a par)"
      largura="max-w-2xl"
    >
      {n < 2 ? (
        <p className="text-sm">Dê peso a pelo menos dois critérios para compará-los.</p>
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-slate-600 dark:text-concreto/80">
            Compare os critérios dois a dois na escala de Saaty (1 a 9). Os pesos saem da média
            geométrica das linhas da matriz; a razão de consistência (CR) diz se as respostas se
            contradizem (aceitável até 0,10).
          </p>
          <ol className="flex flex-col gap-2">
            {criterios.flatMap((a, i) =>
              criterios.slice(i + 1).map((b, k) => {
                const j = i + 1 + k
                const id = `ahp-${i}-${j}`
                return (
                  <li key={id} className="grid gap-1 sm:grid-cols-[1fr_1.4fr] sm:items-center">
                    <label htmlFor={id} className="font-medium text-marinho dark:text-concreto">
                      {nomeCriterio(a)} × {nomeCriterio(b)}
                    </label>
                    <select
                      id={id}
                      className={classeEntrada}
                      value={String(valores[chave(i, j)] ?? 1)}
                      onChange={(e) =>
                        setValores((v) => ({ ...v, [chave(i, j)]: Number(e.target.value) }))
                      }
                    >
                      {ESCALA.map((o) => (
                        <option key={o.valor} value={String(o.valor)}>
                          {o.rotulo(nomeCriterio(a), nomeCriterio(b))}
                        </option>
                      ))}
                    </select>
                  </li>
                )
              }),
            )}
          </ol>
          {r && (
            <div className="rounded-lg border border-concreto p-3 dark:border-aco">
              <table className="w-full text-sm">
                <caption className="mb-1 text-left font-semibold text-marinho dark:text-white">
                  Pesos resultantes
                </caption>
                <tbody>
                  {criterios.map((c, i) => (
                    <tr key={c}>
                      <td className="py-0.5">{nomeCriterio(c)}</td>
                      <td className="py-0.5 text-right tabular-nums">{pct(r.pesos[i])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 tabular-nums">
                λmáx = {numFixo(r.lambdaMax, 3)} · CI = {numFixo(r.ci, 3)} ·{' '}
                <b>CR = {numFixo(r.cr, 3)}</b>
              </p>
              {r.cr > 0.1 && (
                <p className="mt-1 text-critico" role="alert">
                  CR acima de 0,10: as comparações estão incoerentes.
                  {r.parMaisContraditorio &&
                    ` O par mais contraditório é ${nomeCriterio(criterios[r.parMaisContraditorio.i])} × ${nomeCriterio(criterios[r.parMaisContraditorio.j])}: você informou ${numFixo(r.parMaisContraditorio.informado, 2)}, mas o restante das respostas implica ${numFixo(r.parMaisContraditorio.implicito, 2)}.`}
                </p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Botao
              variante="primario"
              disabled={!r}
              onClick={() => {
                const reg = registroAHP(criterios, matriz)
                aoAplicar(Object.fromEntries(criterios.map((c, i) => [c, reg.pesos[i]])), reg)
                aoFechar()
              }}
            >
              Aplicar estes pesos
            </Botao>
            <Botao onClick={aoFechar}>Cancelar</Botao>
          </div>
        </div>
      )}
    </Gaveta>
  )
}
