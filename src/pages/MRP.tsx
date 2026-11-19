import { useCallback, useMemo, useState } from 'react'
import Grafico from '../charts/Grafico'
import { opcaoLiberacoes } from '../charts/liberacoes'
import { opcaoMatrizBOM } from '../charts/matriz-bom'
import { opcaoMRPProjetado } from '../charts/mrp-projetado'
import type { CoresGrafico } from '../charts/tema'
import { classeEntrada } from '../components/estilos'
import { Cartao } from '../components/ui'
import type { LinhaMRP } from '../engine/tipos'
import { data, moeda, num, numFixo } from '../lib/formato'
import type { PropsAba } from './tipos'

const LINHAS: [keyof LinhaMRP, string, string][] = [
  ['nb', 'NB', 'Necessidade bruta'],
  ['rp', 'RP', 'Recebimentos programados'],
  ['ep', 'EP', 'Estoque projetado'],
  ['nl', 'NL', 'Necessidade líquida'],
  ['recPlan', 'RecPlan', 'Recebimento planejado'],
  ['libPlan', 'LibPlan', 'Liberação planejada'],
]

const ORIGEM = {
  previsao: 'previsão de consumo',
  mps: 'MPS',
  dependente: 'demanda dependente (BOM)',
  'mps+dependente': 'MPS + BOM',
}

export default function MRP({ resultado: r, abrirItem }: PropsAba) {
  const mrp = r.mrp
  const porCodigo = useMemo(() => new Map(r.itens.map((i) => [i.codigo, i])), [r.itens])
  const registros = useMemo(
    () =>
      [...(mrp?.registros ?? [])].sort(
        (a, b) =>
          Number(b.temLiberacaoAtraso) - Number(a.temLiberacaoAtraso) ||
          a.nivel - b.nivel ||
          a.codigo.localeCompare(b.codigo),
      ),
    [mrp],
  )
  const [codigo, setCodigo] = useState(() => registros[0]?.codigo ?? '')
  const reg = registros.find((x) => x.codigo === codigo) ?? registros[0]
  const rotulos = useMemo(() => mrp?.semanas.map((s) => s.rotulo) ?? [], [mrp])
  const opProj = useCallback(
    (c: CoresGrafico) => (reg ? opcaoMRPProjetado(reg, rotulos, c) : null),
    [reg, rotulos],
  )
  const opLib = useCallback((c: CoresGrafico) => (mrp ? opcaoLiberacoes(mrp, c) : null), [mrp])
  const opBOM = useCallback(
    (c: CoresGrafico) => (mrp?.matricial ? opcaoMatrizBOM(mrp.matricial, c) : null),
    [mrp],
  )

  if (!mrp) {
    return (
      <Cartao titulo="MRP">
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-critico dark:bg-red-950/40"
          role="alert"
        >
          {r.erroMRP ?? 'O MRP não foi calculado.'}
        </p>
      </Cartao>
    )
  }
  const item = reg ? porCodigo.get(reg.codigo) : undefined
  const totalValor = mrp.consolidado.reduce((s, c) => s + c.valor, 0)

  return (
    <div className="flex flex-col gap-6">
      <Cartao
        titulo={`Registro de MRP (${mrp.comBOM ? 'explosão de BOM + MPS' : 'planejamento por consumo'})`}
        acoes={
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-concreto/80">
            Item
            <select
              className={`${classeEntrada} w-auto max-w-72`}
              value={reg?.codigo ?? ''}
              onChange={(e) => setCodigo(e.target.value)}
            >
              {registros.map((x) => (
                <option key={x.codigo} value={x.codigo}>
                  {x.temLiberacaoAtraso ? '⚠ ' : ''}
                  {x.codigo} — {porCodigo.get(x.codigo)?.descricao ?? ''}{' '}
                  {mrp.comBOM ? `(nível ${x.nivel})` : ''}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {reg && (
          <>
            <p className="mb-3 text-sm text-slate-600 dark:text-concreto/80">
              <button
                type="button"
                className="font-mono font-semibold text-aco-claro underline dark:text-seguranca"
                onClick={() => abrirItem(reg.codigo)}
              >
                {reg.codigo}
              </button>{' '}
              · LT {reg.ltSemanas} sem. · ES {numFixo(reg.estoqueSeguranca, 2)} · lote{' '}
              {reg.loteCompra === null ? 'lote a lote' : num(reg.loteCompra, 2)} · NB por{' '}
              {ORIGEM[reg.origemNB]}
              {reg.pedidosAtrasados > 0 &&
                ` · ${num(reg.pedidosAtrasados, 2)} em pedidos atrasados lançados na semana 1`}
              {item ? ` · estoque atual ${num(item.estoqueAtual, 2)} ${item.unidade}` : ''}
            </p>
            <div className="overflow-x-auto rounded-lg border border-concreto dark:border-aco">
              <table
                className="w-full text-sm tabular-nums"
                aria-label={`Registro de MRP do item ${reg.codigo}`}
              >
                <thead className="bg-slate-100 text-xs text-marinho dark:bg-aco dark:text-concreto">
                  <tr>
                    <th scope="col" className="sticky left-0 bg-inherit px-2 py-2 text-left">
                      Linha
                    </th>
                    {mrp.semanas.map((s) => (
                      <th
                        key={s.semana}
                        scope="col"
                        className="px-2 py-2 text-right whitespace-nowrap"
                      >
                        {s.rotulo}
                        <div className="font-normal text-concreto-escuro dark:text-concreto/70">
                          {data(s.inicio).slice(0, 5)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LINHAS.map(([k, sigla, nome]) => (
                    <tr key={k} className="border-t border-concreto/70 dark:border-aco/70">
                      <th
                        scope="row"
                        className="sticky left-0 bg-white px-2 py-1.5 text-left font-semibold whitespace-nowrap text-marinho dark:bg-marinho dark:text-concreto"
                        title={nome}
                      >
                        {sigla}{' '}
                        <span className="hidden font-normal text-concreto-escuro sm:inline dark:text-concreto/70">
                          {nome}
                        </span>
                      </th>
                      {reg.semanas.map((l) => {
                        const v = l[k] as number
                        const abaixo = k === 'ep' && v < reg.estoqueSeguranca - 1e-9
                        const atraso = k === 'libPlan' && l.libAtraso
                        return (
                          <td
                            key={l.semana}
                            className={`px-2 py-1.5 text-right ${abaixo ? 'bg-red-100 font-semibold text-critico dark:bg-red-950/50' : ''} ${atraso ? 'bg-seguranca/30 font-semibold' : ''} ${v === 0 ? 'text-concreto-escuro/60' : 'text-slate-800 dark:text-concreto'}`}
                            title={
                              atraso
                                ? 'Liberação em atraso: deveria ter sido liberada antes da semana 1'
                                : undefined
                            }
                          >
                            {v === 0 && k !== 'ep' ? '·' : numFixo(v, Math.abs(v) >= 100 ? 0 : 1)}
                            {atraso && ' ⚠'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reg.temLiberacaoAtraso && (
              <p className="mt-2 text-sm font-medium text-critico">
                ⚠ Liberação em atraso: o pedido já deveria ter sido emitido (lançado na semana 1).
              </p>
            )}
            <div className="mt-4">
              <Grafico
                opcao={opProj}
                altura={300}
                descricao={`Estoque projetado semanal de ${reg.codigo} com estoque de segurança e ponto de pedido de referência.`}
              />
            </div>
          </>
        )}
      </Cartao>

      <Cartao titulo={`Liberações planejadas por semana · total ${moeda(totalValor)}`}>
        <Grafico
          opcao={opLib}
          altura={260}
          descricao={`Valor das liberações planejadas por semana; total de ${moeda(totalValor)} no horizonte.`}
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-concreto-escuro dark:text-concreto/70">
                <th className="px-2 py-1 text-left">Semana</th>
                {mrp.semanas.map((s) => (
                  <th key={s.semana} className="px-2 py-1 text-right">
                    {s.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-concreto">
              <tr>
                <th className="px-2 py-1 text-left">Quantidade</th>
                {mrp.consolidado.map((c) => (
                  <td key={c.semana} className="px-2 py-1 text-right">
                    {num(c.quantidade, 0)}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="px-2 py-1 text-left">R$</th>
                {mrp.consolidado.map((c) => (
                  <td key={c.semana} className="px-2 py-1 text-right">
                    {moeda(c.valor).replace(',00', '')}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Cartao>

      {mrp.matricial && (
        <Cartao titulo="Visão matricial da BOM: r = (I − B)⁻¹ × d">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Grafico
              opcao={opBOM}
              altura={420}
              descricao="Matriz de uso direto B: quantidade de cada filho por unidade do pai, já com perda."
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <caption className="mb-2 text-left text-xs text-slate-600 dark:text-concreto/80">
                  Requisito total sem defasagem (série de Neumann) comparado com o total de
                  necessidades brutas do MRP no horizonte.
                </caption>
                <thead className="text-xs text-concreto-escuro dark:text-concreto/70">
                  <tr>
                    <th className="px-2 py-1 text-left">Item</th>
                    <th className="px-2 py-1 text-right">d (MPS)</th>
                    <th className="px-2 py-1 text-right">r</th>
                    <th className="px-2 py-1 text-right">NB do MRP</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-concreto">
                  {mrp.matricial.codigos.map((c, k) => {
                    const m = mrp.matricial!
                    const igual = Math.abs(m.requisitoTotal[k] - m.nbTotalMRP[k]) < 1e-6
                    return (
                      <tr key={c} className="border-t border-concreto/60 dark:border-aco/60">
                        <td className="px-2 py-1 font-mono">{c}</td>
                        <td className="px-2 py-1 text-right">{num(m.demandaIndependente[k], 2)}</td>
                        <td className="px-2 py-1 text-right">{num(m.requisitoTotal[k], 2)}</td>
                        <td className={`px-2 py-1 text-right ${igual ? 'text-ok' : ''}`}>
                          {num(m.nbTotalMRP[k], 2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-600 dark:text-concreto/80">
                Os totais só coincidem sem estoque, sem ES, com lote a lote e sem liberações fora do
                horizonte. Diferenças vêm do estoque disponível (que reduz a necessidade dos
                filhos), do estoque de segurança e do tamanho dos lotes.
              </p>
            </div>
          </div>
        </Cartao>
      )}
    </div>
  )
}
