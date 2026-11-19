import { FileSpreadsheet } from 'lucide-react'
import { useMemo, useState } from 'react'
import TabelaDados, { type Coluna } from '../components/TabelaDados'
import { Botao, Cartao, SeloABC, SeloPrioridade, SeloStatus } from '../components/ui'
import { sugestoesOrdenadas } from '../engine/index'
import { ORDEM_PRIORIDADE } from '../engine/reposicao'
import type { ItemResultado } from '../engine/tipos'
import { data, moeda, num, qtd } from '../lib/formato'
import type { PropsAba } from './tipos'

export default function Compras({
  resultado: r,
  abrirItem,
  aoExportarSelecao,
  exportando,
}: PropsAba & { aoExportarSelecao: (codigos: string[]) => void; exportando: boolean }) {
  const sugestoes = useMemo(() => sugestoesOrdenadas(r.itens), [r.itens])
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(sugestoes.map((s) => s.codigo)),
  )
  const porFornecedor = useMemo(() => {
    const m = new Map<string, { itens: number; valor: number; selecionado: number }>()
    for (const s of sugestoes) {
      const f = m.get(s.fornecedor) ?? { itens: 0, valor: 0, selecionado: 0 }
      f.itens++
      f.valor += s.sugestaoValor
      if (selecionados.has(s.codigo)) f.selecionado += s.sugestaoValor
      m.set(s.fornecedor, f)
    }
    return [...m.entries()].sort((a, b) => b[1].valor - a[1].valor)
  }, [sugestoes, selecionados])
  const totalSelecionado = sugestoes
    .filter((s) => selecionados.has(s.codigo))
    .reduce((t, s) => t + s.sugestaoValor, 0)

  const colunas = useMemo<Coluna<ItemResultado>[]>(
    () => [
      {
        id: 'prioridade',
        titulo: 'Prioridade',
        valor: (i) => ORDEM_PRIORIDADE[i.prioridade!],
        csv: (i) => i.prioridade,
        render: (i) => <SeloPrioridade p={i.prioridade!} />,
      },
      {
        id: 'codigo',
        titulo: 'Código',
        valor: (i) => i.codigo,
        render: (i) => <span className="font-mono">{i.codigo}</span>,
      },
      {
        id: 'descricao',
        titulo: 'Descrição',
        valor: (i) => i.descricao,
        render: (i) => (
          <span className="block max-w-56 truncate" title={i.descricao}>
            {i.descricao}
          </span>
        ),
      },
      {
        id: 'abc',
        titulo: 'ABC',
        valor: (i) => i.classeABC,
        render: (i) => <SeloABC c={i.classeABC} />,
      },
      {
        id: 'status',
        titulo: 'Status',
        valor: (i) => i.status,
        render: (i) => <SeloStatus s={i.status} />,
      },
      { id: 'fornecedor', titulo: 'Fornecedor', valor: (i) => i.fornecedor },
      {
        id: 'qtd',
        titulo: 'Qtd sugerida',
        numerica: true,
        valor: (i) => i.sugestaoQtd,
        render: (i) => qtd(i.sugestaoQtd, i.unidade, i.unidadeDiscreta),
      },
      { id: 'unidade', titulo: 'Un.', valor: (i) => i.unidade },
      {
        id: 'custo',
        titulo: 'Custo unit.',
        numerica: true,
        valor: (i) => i.custo,
        render: (i) => moeda(i.custo),
      },
      {
        id: 'valor',
        titulo: 'Valor',
        numerica: true,
        valor: (i) => i.sugestaoValor,
        render: (i) => moeda(i.sugestaoValor),
      },
      {
        id: 'chegada',
        titulo: 'Chegada estimada',
        valor: (i) => i.dataChegada.getTime(),
        csv: (i) => data(i.dataChegada),
        render: (i) => data(i.dataChegada),
      },
      {
        id: 'motivo',
        titulo: 'Motivo',
        valor: (i) => i.motivo,
        render: (i) => (
          <span className="block max-w-96 truncate text-xs" title={i.motivo}>
            {i.motivo}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Cartao
          titulo="Sugestão de compras"
          acoes={
            <Botao
              variante="primario"
              disabled={!selecionados.size || exportando}
              onClick={() =>
                aoExportarSelecao(
                  sugestoes.filter((s) => selecionados.has(s.codigo)).map((s) => s.codigo),
                )
              }
            >
              <FileSpreadsheet className="size-4" aria-hidden />{' '}
              {exportando ? 'Gerando…' : `Exportar selecionados (${num(selecionados.size)})`}
            </Botao>
          }
        >
          {sugestoes.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600 dark:text-concreto/80">
              Nenhum item com posição abaixo do ponto de pedido. Nada a comprar agora.
            </p>
          ) : (
            <TabelaDados
              rotulo="Sugestão de compras ordenada por prioridade"
              dados={sugestoes}
              colunas={colunas}
              chave={(i) => i.codigo}
              aoClicarLinha={(i) => abrirItem(i.codigo)}
              nomeCSV="sugestao-compras"
              selecionados={selecionados}
              aoSelecionar={setSelecionados}
            />
          )}
        </Cartao>
        <Cartao titulo="Total por fornecedor">
          <ul className="flex flex-col divide-y divide-concreto text-sm dark:divide-aco">
            {porFornecedor.map(([f, v]) => (
              <li key={f} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-marinho dark:text-white">
                    {f}
                  </span>
                  <span className="text-xs text-concreto-escuro dark:text-concreto/70">
                    {num(v.itens)} item(ns)
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block font-semibold text-marinho dark:text-white">
                    {moeda(v.valor)}
                  </span>
                  {v.selecionado !== v.valor && (
                    <span className="text-xs text-concreto-escuro">
                      selecionado: {moeda(v.selecionado)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t-2 border-seguranca pt-2 text-sm font-semibold text-marinho dark:text-white">
            <span>Total selecionado</span>
            <span className="tabular-nums">{moeda(totalSelecionado)}</span>
          </div>
        </Cartao>
      </div>
    </div>
  )
}
