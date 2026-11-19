import { Columns3 } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../estado/contexto'
import { CAMPOS, type MapaColunas, type NomeAba } from '../io/mapeamento'
import type { Mapas } from '../worker/protocolo'
import { classeEntrada } from './estilos'
import { Botao, Cartao } from './ui'

export default function TelaMapeamento() {
  const { pendencias, todasAbas, confirmarMapeamento, voltarInicio } = useApp()
  const abas = todasAbas.filter((a) => pendencias.some((p) => p.aba === a.aba))
  const [mapas, setMapas] = useState<Mapas>(
    () => Object.fromEntries(abas.map((a) => [a.aba, { ...a.mapa }])) as Mapas,
  )

  const faltando = abas.flatMap((a) =>
    CAMPOS[a.aba]
      .filter((d) => d.obrigatorio && (mapas[a.aba]?.[d.campo] ?? null) === null)
      .map((d) => `${a.aba}: ${d.rotulo}`),
  )

  const definir = (aba: NomeAba, campo: string, valor: string) => {
    setMapas((m) => {
      const atual: MapaColunas = { ...(m[aba] ?? {}) }
      atual[campo] = valor === '' ? null : Number(valor)
      return { ...m, [aba]: atual }
    })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start gap-3">
        <Columns3 className="mt-1 size-7 shrink-0 text-seguranca" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold text-marinho dark:text-white">
            Indique as colunas da sua planilha
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-concreto/80">
            Não reconhecemos alguns cabeçalhos. Aponte qual coluna corresponde a cada campo; o
            mapeamento fica lembrado neste navegador para a próxima vez.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        {abas.map((a) => (
          <Cartao key={a.aba} titulo={`Aba ${a.aba} (lida de "${a.origem}")`}>
            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS[a.aba].map((d) => {
                const id = `map-${a.aba}-${d.campo}`
                const valor = mapas[a.aba]?.[d.campo]
                const erro = d.obrigatorio && (valor === null || valor === undefined)
                return (
                  <div key={d.campo} className="flex flex-col gap-1">
                    <label
                      htmlFor={id}
                      className="text-sm font-medium text-marinho dark:text-concreto"
                    >
                      {d.rotulo}{' '}
                      {d.obrigatorio ? (
                        <span className="text-critico">*</span>
                      ) : (
                        <span className="text-xs font-normal text-concreto-escuro">(opcional)</span>
                      )}
                    </label>
                    <select
                      id={id}
                      className={`${classeEntrada} ${erro ? 'border-critico ring-1 ring-critico/40' : ''}`}
                      value={valor ?? ''}
                      onChange={(e) => definir(a.aba, d.campo, e.target.value)}
                    >
                      <option value="">— não usar —</option>
                      {a.cabecalhos.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `(coluna ${i + 1} sem nome)`}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-aco-claro dark:text-seguranca">
                Ver as primeiras linhas
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr>
                      {a.cabecalhos.map((h, i) => (
                        <th
                          key={i}
                          className="border-b border-concreto px-2 py-1 text-left dark:border-aco"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.amostra.map((l, k) => (
                      <tr key={k}>
                        {l.map((v, i) => (
                          <td
                            key={i}
                            className="px-2 py-1 whitespace-nowrap text-slate-600 dark:text-concreto/80"
                          >
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Cartao>
        ))}
      </div>
      {faltando.length > 0 && (
        <p className="mt-4 text-sm text-critico" role="alert">
          Faltam: {faltando.join(', ')}.
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Botao
          variante="primario"
          disabled={faltando.length > 0}
          onClick={() => confirmarMapeamento(mapas)}
        >
          Continuar
        </Botao>
        <Botao onClick={voltarInicio}>Cancelar</Botao>
      </div>
    </div>
  )
}
