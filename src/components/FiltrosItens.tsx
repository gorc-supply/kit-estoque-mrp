import { Search, X } from 'lucide-react'
import { useMemo } from 'react'
import { ORDEM_STATUS } from '../charts/status-estoque'
import type { ClasseABC, ClasseXYZ, ItemResultado, StatusItem } from '../engine/tipos'
import { filtroVazio, ROTULO_ESPECIAL, type Filtro } from '../lib/filtros'
import { classeEntrada } from './estilos'
import { Botao } from './ui'

export default function FiltrosItens({
  itens,
  filtro,
  aoMudar,
}: {
  itens: readonly ItemResultado[]
  filtro: Filtro
  aoMudar: (f: Filtro) => void
}) {
  const categorias = useMemo(() => [...new Set(itens.map((i) => i.categoria))].sort(), [itens])
  const fornecedores = useMemo(() => [...new Set(itens.map((i) => i.fornecedor))].sort(), [itens])
  const sel = 'min-w-0 ' + classeEntrada
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className="relative col-span-2 sm:col-span-3 lg:col-span-1">
          <span className="sr-only">Buscar item</span>
          <Search
            className="pointer-events-none absolute top-2 left-2 size-4 text-concreto-escuro"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Buscar código ou descrição"
            className={`${classeEntrada} pl-8`}
            value={filtro.busca ?? ''}
            onChange={(e) => aoMudar({ ...filtro, busca: e.target.value || undefined })}
          />
        </label>
        <select
          aria-label="Classe ABC"
          className={sel}
          value={filtro.abc ?? ''}
          onChange={(e) =>
            aoMudar({ ...filtro, abc: (e.target.value || undefined) as ClasseABC | undefined })
          }
        >
          <option value="">Classe ABC: todas</option>
          {['A', 'B', 'C'].map((c) => (
            <option key={c} value={c}>
              Classe {c}
            </option>
          ))}
        </select>
        <select
          aria-label="Classe XYZ"
          className={sel}
          value={filtro.xyz ?? ''}
          onChange={(e) =>
            aoMudar({ ...filtro, xyz: (e.target.value || undefined) as ClasseXYZ | undefined })
          }
        >
          <option value="">Classe XYZ: todas</option>
          {['X', 'Y', 'Z', 'N', 'Novo'].map((c) => (
            <option key={c} value={c}>
              {c === 'N'
                ? 'N (sem demanda)'
                : c === 'Novo'
                  ? 'Novo (histórico insuficiente)'
                  : `Classe ${c}`}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          className={sel}
          value={filtro.status ?? ''}
          onChange={(e) =>
            aoMudar({ ...filtro, status: (e.target.value || undefined) as StatusItem | undefined })
          }
        >
          <option value="">Status: todos</option>
          {ORDEM_STATUS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Categoria"
          className={sel}
          value={filtro.categoria ?? ''}
          onChange={(e) => aoMudar({ ...filtro, categoria: e.target.value || undefined })}
        >
          <option value="">Categoria: todas</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="Fornecedor"
          className={sel}
          value={filtro.fornecedor ?? ''}
          onChange={(e) => aoMudar({ ...filtro, fornecedor: e.target.value || undefined })}
        >
          <option value="">Fornecedor: todos</option>
          {fornecedores.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {!filtroVazio(filtro) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {filtro.especial && (
            <span className="inline-flex items-center gap-1 rounded-full bg-seguranca/20 px-2.5 py-0.5 font-medium text-marinho dark:text-seguranca">
              {ROTULO_ESPECIAL[filtro.especial]}
              <button
                type="button"
                aria-label="Remover filtro"
                onClick={() => aoMudar({ ...filtro, especial: undefined })}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          )}
          <Botao variante="fantasma" className="px-2 py-1" onClick={() => aoMudar({})}>
            Limpar filtros
          </Botao>
        </div>
      )}
    </div>
  )
}
