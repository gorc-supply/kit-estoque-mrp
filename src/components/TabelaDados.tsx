import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { baixarCSV } from '../lib/csv'
import { Ajuda, Botao } from './ui'

export interface Coluna<T> {
  id: string
  titulo: string
  /** Valor para ordenar e exportar (número ou texto). */
  valor: (t: T) => string | number | null
  /** Renderização na tela (padrão: o próprio valor). */
  render?: (t: T) => ReactNode
  /** Texto para o CSV (padrão: valor). */
  csv?: (t: T) => string | number | null
  numerica?: boolean
  ajuda?: string
  largura?: string
}

const recursos = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
})

export default function TabelaDados<T extends RowData>({
  dados,
  colunas,
  chave,
  aoClicarLinha,
  nomeCSV,
  alturaMax = 560,
  selecionados,
  aoSelecionar,
  rotulo,
  ordenacaoInicial,
  vazio = 'Nenhum item para mostrar com os filtros atuais.',
}: {
  dados: T[]
  colunas: Coluna<T>[]
  chave: (t: T) => string
  aoClicarLinha?: (t: T) => void
  nomeCSV?: string
  alturaMax?: number
  selecionados?: Set<string>
  aoSelecionar?: (s: Set<string>) => void
  rotulo: string
  ordenacaoInicial?: SortingState
  vazio?: string
}) {
  const [sorting, setSorting] = useState<SortingState>(ordenacaoInicial ?? [])
  const ajudante = useMemo(() => createColumnHelper<typeof recursos, T>(), [])
  const defs = useMemo(
    () =>
      colunas.map(
        (c) =>
          ajudante.accessor((t: T) => c.valor(t) ?? (c.numerica ? -Infinity : ''), {
            id: c.id,
            header: c.titulo,
            sortUndefined: 'last',
            sortDescFirst: c.numerica,
          }) as unknown as ColumnDef<typeof recursos, T>,
      ),
    [colunas, ajudante],
  )

  const tabela = useTable({
    features: recursos,
    columns: defs,
    data: dados,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (t: T) => chave(t),
  })

  const linhas = tabela.getRowModel().rows
  const contêiner = useRef<HTMLDivElement>(null)
  // O React Compiler não memoiza o useVirtualizer (aviso esperado da biblioteca).
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: linhas.length,
    getScrollElement: () => contêiner.current,
    estimateSize: () => 40,
    overscan: 12,
  })
  const itens = virtual.getVirtualItems()
  const topo = itens.length ? itens[0].start : 0
  const base = itens.length ? virtual.getTotalSize() - itens[itens.length - 1].end : 0

  const porId = useMemo(() => new Map(colunas.map((c) => [c.id, c])), [colunas])
  const comSelecao = Boolean(selecionados && aoSelecionar)
  const todosSelecionados =
    comSelecao && dados.length > 0 && dados.every((d) => selecionados!.has(chave(d)))

  const exportar = () => {
    const ordenados = linhas.map((l) => l.original)
    baixarCSV(
      nomeCSV ?? 'tabela',
      colunas.map((c) => c.titulo),
      ordenados.map((t) => colunas.map((c) => (c.csv ?? c.valor)(t))),
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-concreto-escuro dark:text-concreto/80">
        <span aria-live="polite">
          {linhas.length.toLocaleString('pt-BR')} {linhas.length === 1 ? 'item' : 'itens'}
          {comSelecao && ` · ${selecionados!.size.toLocaleString('pt-BR')} selecionado(s)`}
        </span>
        {nomeCSV && (
          <Botao variante="fantasma" onClick={exportar} className="print:hidden">
            <Download className="size-4" aria-hidden /> Baixar CSV da tabela
          </Botao>
        )}
      </div>
      <div
        ref={contêiner}
        className="overflow-auto rounded-lg border border-concreto dark:border-aco"
        style={{ maxHeight: alturaMax }}
      >
        <table className="w-full border-collapse text-sm" aria-label={rotulo}>
          <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs text-marinho uppercase dark:bg-aco dark:text-concreto">
            <tr>
              {comSelecao && (
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    checked={todosSelecionados}
                    onChange={() =>
                      aoSelecionar!(todosSelecionados ? new Set() : new Set(dados.map(chave)))
                    }
                  />
                </th>
              )}
              {tabela.getHeaderGroups()[0].headers.map((h) => {
                const col = porId.get(h.column.id)!
                const ordem = h.column.getIsSorted()
                return (
                  <th
                    key={h.id}
                    scope="col"
                    aria-sort={
                      ordem === 'asc' ? 'ascending' : ordem === 'desc' ? 'descending' : 'none'
                    }
                    className={`px-2.5 py-2 font-semibold whitespace-nowrap ${col.numerica ? 'text-right' : ''} ${col.largura ?? ''}`}
                  >
                    <span
                      className={`inline-flex items-center gap-1 ${col.numerica ? 'flex-row-reverse' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 rounded hover:text-aco-claro dark:hover:text-white"
                        title="Ordenar"
                      >
                        {col.titulo}
                        {ordem === 'asc' ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : ordem === 'desc' ? (
                          <ArrowDown className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                        )}
                      </button>
                      {col.ajuda && <Ajuda texto={col.ajuda} rotulo={`O que é ${col.titulo}`} />}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td
                  colSpan={colunas.length + (comSelecao ? 1 : 0)}
                  className="px-3 py-10 text-center text-concreto-escuro dark:text-concreto/70"
                >
                  {vazio}
                </td>
              </tr>
            )}
            {topo > 0 && (
              <tr aria-hidden>
                <td style={{ height: topo }} />
              </tr>
            )}
            {itens.map((v) => {
              const linha = linhas[v.index]
              const t = linha.original
              const id = chave(t)
              return (
                <tr
                  key={linha.id}
                  data-index={v.index}
                  onClick={aoClicarLinha ? () => aoClicarLinha(t) : undefined}
                  onKeyDown={
                    aoClicarLinha ? (e) => e.key === 'Enter' && aoClicarLinha(t) : undefined
                  }
                  tabIndex={aoClicarLinha ? 0 : undefined}
                  className={`border-t border-concreto/70 dark:border-aco/70 ${aoClicarLinha ? 'cursor-pointer hover:bg-seguranca/10 focus-visible:bg-seguranca/10' : ''} ${selecionados?.has(id) ? 'bg-classe-b/10' : ''}`}
                >
                  {comSelecao && (
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${id}`}
                        checked={selecionados!.has(id)}
                        onChange={() => {
                          const s = new Set(selecionados)
                          if (s.has(id)) s.delete(id)
                          else s.add(id)
                          aoSelecionar!(s)
                        }}
                      />
                    </td>
                  )}
                  {colunas.map((c) => (
                    <td
                      key={c.id}
                      className={`px-2.5 py-1.5 whitespace-nowrap text-slate-700 dark:text-concreto ${c.numerica ? 'text-right tabular-nums' : ''}`}
                    >
                      {c.render ? c.render(t) : (c.valor(t) ?? '—')}
                    </td>
                  ))}
                </tr>
              )
            })}
            {base > 0 && (
              <tr aria-hidden>
                <td style={{ height: base }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
