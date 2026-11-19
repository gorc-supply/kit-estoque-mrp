import { Calculator } from 'lucide-react'
import { useCallback, useMemo, type ReactNode } from 'react'
import { opcaoBacktest } from '../charts/backtest'
import { opcaoCurvaNivel } from '../charts/curva-nivel'
import { opcaoCustoLote } from '../charts/custo-lote'
import { opcaoDistribuicaoLT } from '../charts/distribuicao-lt'
import Grafico from '../charts/Grafico'
import { opcaoHistoricoItem } from '../charts/historico-item'
import { opcaoContribuicoes, opcaoRadarCriterios } from '../charts/multicriterio-item'
import { opcaoPerfisParecidos } from '../charts/similaridade'
import type { CoresGrafico } from '../charts/tema'
import type { ItemResultado, Resultado } from '../engine/tipos'
import { montarCalculo } from '../lib/calculo'
import { data, dias, moeda, num, numFixo, pct, qtd } from '../lib/formato'
import { Gaveta, SeloABC, SeloPrioridade, SeloStatus, SeloXYZ } from './ui'

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-concreto dark:bg-aco/40 dark:ring-aco">
      <dt className="text-xs text-concreto-escuro dark:text-concreto/70">{rotulo}</dt>
      <dd className="text-sm font-semibold text-marinho tabular-nums dark:text-white">
        {children}
      </dd>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-sm font-semibold tracking-wide text-aco uppercase dark:text-seguranca">
        {titulo}
      </h3>
      {children}
    </section>
  )
}

export default function GavetaItem({
  item,
  resultado,
  aoFechar,
  aoAbrirItem,
}: {
  item: ItemResultado | null
  resultado: Resultado
  aoFechar: () => void
  aoAbrirItem: (codigo: string) => void
}) {
  const r = resultado
  const porCodigo = useMemo(() => new Map(r.itens.map((i) => [i.codigo, i])), [r.itens])
  const i = item
  const u = (v: number | null) => (v === null || !i ? '—' : qtd(v, i.unidade, i.unidadeDiscreta))
  const rotulos = r.janela.rotulos

  const opHistorico = useCallback(
    (c: CoresGrafico) => (i ? opcaoHistoricoItem(i, rotulos, c) : null),
    [i, rotulos],
  )
  const opLote = useCallback(
    (c: CoresGrafico) => (i ? opcaoCustoLote(i, r.parametros.custoPedido, c) : null),
    [i, r.parametros.custoPedido],
  )
  const opLT = useCallback((c: CoresGrafico) => (i ? opcaoDistribuicaoLT(i, c) : null), [i])
  const opBacktest = useCallback(
    (c: CoresGrafico) => (i ? opcaoBacktest(i, rotulos, c) : null),
    [i, rotulos],
  )
  const opNivel = useCallback(
    (c: CoresGrafico) =>
      i
        ? opcaoCurvaNivel(
            [
              {
                nome: i.codigo,
                sigmaLT: i.sigmaLT,
                H: i.custoManutencao,
                nivelAtual: i.nivelServico,
              },
            ],
            c,
          )
        : null,
    [i],
  )
  const parecidos = useMemo(
    () =>
      i
        ? i.parecidos.map((p) => porCodigo.get(p.codigo)).filter((x): x is ItemResultado => !!x)
        : [],
    [i, porCodigo],
  )
  const opParecidos = useCallback(
    (c: CoresGrafico) =>
      i && parecidos.length ? opcaoPerfisParecidos(i, parecidos, rotulos, c) : null,
    [i, parecidos, rotulos],
  )
  const calculo = useMemo(() => (i ? montarCalculo(i, r) : []), [i, r])
  const mcItem = i?.multicriterio ?? null
  const opContrib = useCallback(
    (c: CoresGrafico) => (mcItem ? opcaoContribuicoes(mcItem, c) : null),
    [mcItem],
  )
  const opRadar = useCallback(
    (c: CoresGrafico) => (mcItem ? opcaoRadarCriterios(mcItem, c) : null),
    [mcItem],
  )

  return (
    <Gaveta
      aberta={!!i}
      aoFechar={aoFechar}
      largura="max-w-3xl"
      titulo={
        i ? (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{i.codigo}</span>
              <SeloABC c={i.classeABC} />
              <SeloXYZ c={i.classeXYZ} />
              <SeloStatus s={i.status} />
              {i.prioridade && <SeloPrioridade p={i.prioridade} />}
            </div>
            <div className="mt-0.5 truncate text-sm font-normal text-slate-600 dark:text-concreto/80">
              {i.descricao} · {i.categoria} · {i.fornecedor}
            </div>
          </div>
        ) : (
          ''
        )
      }
    >
      {i && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Dado rotulo="Estoque atual">{u(i.estoqueAtual)}</Dado>
            <Dado rotulo="Posição (com pedidos)">{u(i.posicao)}</Dado>
            <Dado rotulo="Previsão por período">{numFixo(i.previsao, 2)}</Dado>
            <Dado rotulo="Cobertura">{dias(i.coberturaDias)}</Dado>
            <Dado rotulo="Estoque de segurança">
              {i.estoqueSeguranca === null ? 'revisão manual' : u(i.estoqueSeguranca)}
            </Dado>
            <Dado rotulo="Ponto de pedido">{u(i.pontoPedido)}</Dado>
            <Dado rotulo="Lote (Q*)">{u(i.loteCompra)}</Dado>
            <Dado rotulo="Estoque máximo">{u(i.estoqueMaximo)}</Dado>
            <Dado rotulo="Custo unitário">{moeda(i.custo)}</Dado>
            <Dado rotulo="Lead time">
              {dias(i.leadTimeDias)}
              {i.leadTimePadrao ? ' (padrão)' : ''}
            </Dado>
            <Dado rotulo="Giro">{i.giro !== null ? `${numFixo(i.giro, 1)}×/ano` : '—'}</Dado>
            <Dado rotulo="Sugestão">
              {i.sugestaoQtd > 0 ? `${u(i.sugestaoQtd)} · ${moeda(i.sugestaoValor)}` : '—'}
            </Dado>
          </dl>
          {i.sugestaoQtd > 0 && (
            <p className="mt-2 text-sm text-slate-600 dark:text-concreto/80">
              {i.motivo}. Chegada estimada em {data(i.dataChegada)}.
            </p>
          )}
          {i.revisaoManual.length > 0 && (
            <p className="mt-2 rounded-md bg-seguranca/15 px-3 py-2 text-sm text-marinho dark:text-concreto">
              Revisão manual: {i.revisaoManual.join('; ')}.
            </p>
          )}

          <Secao titulo="Histórico de consumo, previsão e saldo">
            <Grafico
              opcao={opHistorico}
              altura={280}
              descricao={`Consumo de ${i.codigo} por período: média ${numFixo(i.media, 2)}, desvio ${numFixo(i.desvio, 2)}, previsão ${numFixo(i.previsao, 2)}.`}
            />
          </Secao>

          {mcItem && (
            <Secao titulo="Classificação multicritério">
              <p className="text-sm text-slate-700 dark:text-concreto/90">
                <span className="inline-flex items-center gap-1 align-middle">
                  Valor <SeloABC c={mcItem.classeValor} /> → final{' '}
                  <SeloABC c={mcItem.classeFinal} />
                </span>
                {mcItem.score !== null && (
                  <>
                    {' '}
                    · score {numFixo(mcItem.score, 3)} (posição {mcItem.posicao})
                  </>
                )}
                {mcItem.estabilidade !== null && (
                  <>
                    {' '}
                    ·{' '}
                    <span className={mcItem.estabilidade < 0.7 ? 'font-semibold text-critico' : ''}>
                      classe estável em {pct(mcItem.estabilidade, 0)} das simulações
                    </span>
                  </>
                )}
                {mcItem.equipamentos.length > 0 && <> · atende {mcItem.equipamentos.join(', ')}</>}
              </p>
              <p className="mt-1 text-sm font-medium text-marinho dark:text-white">
                {mcItem.motivo}
              </p>
              {mcItem.criterios.length > 0 && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Grafico
                    opcao={opContrib}
                    altura={150}
                    descricao={`Contribuição de cada critério para o score de ${i.codigo}.`}
                  />
                  <Grafico
                    opcao={opRadar}
                    altura={230}
                    descricao={`Critérios normalizados de ${i.codigo} (1 = mais crítico).`}
                  />
                </div>
              )}
            </Secao>
          )}

          <Secao titulo="Ver o cálculo">
            <div className="flex flex-col gap-4">
              {calculo.map((g) => (
                <details
                  key={g.titulo}
                  open={g.titulo === 'Parâmetros de reposição'}
                  className="rounded-lg border border-concreto bg-white p-3 dark:border-aco dark:bg-aco/30"
                >
                  <summary className="flex cursor-pointer items-center gap-2 font-semibold text-marinho dark:text-white">
                    <Calculator className="size-4 text-seguranca" aria-hidden /> {g.titulo}
                  </summary>
                  <ol className="mt-3 flex flex-col gap-3">
                    {g.passos.map((p) => (
                      <li key={p.titulo} className="border-l-2 border-seguranca/70 pl-3 text-sm">
                        <div className="font-medium text-marinho dark:text-white">
                          {p.titulo}
                          {p.ancora && (
                            <a
                              href={`#metodologia-${p.ancora}`}
                              data-ir-metodologia={p.ancora}
                              className="ml-2 text-xs font-normal text-aco-claro underline dark:text-seguranca"
                            >
                              metodologia
                            </a>
                          )}
                        </div>
                        <div className="mt-1 font-mono text-xs text-slate-600 dark:text-concreto/80">
                          {p.formula}
                        </div>
                        <div className="font-mono text-xs break-words text-slate-600 dark:text-concreto/80">
                          = {p.conta}
                        </div>
                        <div className="mt-0.5 font-semibold text-aco dark:text-seguranca">
                          → {p.resultado}
                        </div>
                        {p.nota && (
                          <div className="mt-0.5 text-xs text-concreto-escuro dark:text-concreto/70">
                            {p.nota}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </Secao>

          <Secao titulo="Custo total do lote (derivada = 0 no EOQ)">
            <Grafico
              opcao={opLote}
              altura={280}
              descricao={`Curva de custo total de ${i.codigo}: EOQ ${num(i.eoq, 1)}, lote ajustado ${num(i.loteCompra, 1)}, penalidade ${pct(i.penalidadeArredondamento, 2)}.`}
            />
          </Secao>
          <Secao titulo="Demanda durante o lead time">
            <Grafico
              opcao={opLT}
              altura={260}
              descricao={`Distribuição normal da demanda no lead time de ${i.codigo}: média ${num(i.mediaLT, 1)}, probabilidade de faltar antes da chegada ${pct(i.probFaltarAntesChegada)}.`}
            />
            {i.probIndicativa && (
              <p className="text-xs text-concreto-escuro dark:text-concreto/70">
                Indicativo: para demanda intermitente a distribuição Normal é uma aproximação fraca.
              </p>
            )}
          </Secao>
          <Secao titulo="Nível de serviço × custo do estoque de segurança">
            <Grafico
              opcao={opNivel}
              altura={240}
              descricao={`Custo anual do estoque de segurança de ${i.codigo} entre 80% e 99,9% de nível de serviço.`}
            />
            {i.fillRate !== null && (
              <p className="text-sm text-slate-600 dark:text-concreto/80">
                Nível de ciclo {pct(i.nivelServico ?? 1 - (i.probRupturaCiclo ?? 0))} → fill rate
                esperado {pct(i.fillRate, 2)} das unidades atendidas.
              </p>
            )}
          </Secao>
          <Secao titulo="Backtest da previsão">
            <Grafico
              opcao={opBacktest}
              altura={260}
              descricao={`Backtest de ${i.codigo}: real contra previsto e WMAPE por método.`}
            />
          </Secao>
          <Secao titulo="Itens com padrão de consumo parecido">
            {parecidos.length ? (
              <>
                <Grafico
                  opcao={opParecidos}
                  altura={220}
                  descricao={`Perfis normalizados de ${i.codigo} e de ${parecidos.length} itens parecidos.`}
                />
                <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                  {i.parecidos.map((p) => (
                    <li key={p.codigo}>
                      <button
                        type="button"
                        onClick={() => aoAbrirItem(p.codigo)}
                        className="rounded-md bg-white px-2 py-1 ring-1 ring-concreto hover:ring-seguranca dark:bg-aco/40 dark:ring-aco"
                      >
                        {p.codigo} · cos θ {numFixo(p.similaridade, 2)}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-concreto-escuro dark:text-concreto/70">
                Nenhum item com cos θ ≥ 0,80 (a comparação usa só itens suaves ou erráticos com a
                janela completa).
              </p>
            )}
          </Secao>
        </>
      )}
    </Gaveta>
  )
}
