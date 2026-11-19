import { RotateCcw } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { diaSerial, formatarData } from '../engine/datas'
import { completarParametros } from '../engine/padroes'
import type { ClasseABC, Parametros } from '../engine/tipos'
import { useApp } from '../estado/contexto'
import { classeEntrada } from './estilos'
import { Ajuda, Botao, Gaveta } from './ui'

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-concreto p-3 dark:border-aco">
      <legend className="px-1 text-sm font-semibold text-marinho dark:text-white">{titulo}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Rotulo({ id, texto, ajuda }: { id: string; texto: string; ajuda: ReactNode }) {
  return (
    <div className="flex items-center gap-1 text-sm text-marinho dark:text-concreto">
      <label htmlFor={id}>{texto}</label>
      <Ajuda texto={ajuda} rotulo={`Ajuda: ${texto}`} />
    </div>
  )
}

function CampoNumero({
  texto,
  ajuda,
  valor,
  aoMudar,
  passo = 1,
  min,
  max,
  percentual = false,
  sufixo,
}: {
  texto: string
  ajuda: ReactNode
  valor: number
  aoMudar: (v: number) => void
  passo?: number
  min?: number
  max?: number
  percentual?: boolean
  sufixo?: string
}) {
  const id = useId()
  const exibido = percentual ? Math.round(valor * 10000) / 100 : valor
  return (
    <div className="flex flex-col gap-1">
      <Rotulo id={id} texto={texto} ajuda={ajuda} />
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className={classeEntrada}
          value={Number.isFinite(exibido) ? exibido : ''}
          step={passo}
          min={min}
          max={max}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (e.target.value === '' || !Number.isFinite(n)) return
            aoMudar(percentual ? n / 100 : n)
          }}
        />
        {(percentual || sufixo) && (
          <span className="text-sm text-concreto-escuro dark:text-concreto/70">
            {percentual ? '%' : sufixo}
          </span>
        )}
      </div>
    </div>
  )
}

function CampoSelect<V extends string>({
  texto,
  ajuda,
  valor,
  opcoes,
  aoMudar,
}: {
  texto: string
  ajuda: ReactNode
  valor: V
  opcoes: [V, string][]
  aoMudar: (v: V) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Rotulo id={id} texto={texto} ajuda={ajuda} />
      <select
        id={id}
        className={classeEntrada}
        value={valor}
        onChange={(e) => aoMudar(e.target.value as V)}
      >
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </div>
  )
}

function CampoSimNao({
  texto,
  ajuda,
  valor,
  aoMudar,
}: {
  texto: string
  ajuda: ReactNode
  valor: boolean
  aoMudar: (v: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2 self-end py-1.5">
      <input
        id={id}
        type="checkbox"
        className="size-4 accent-seguranca"
        checked={valor}
        onChange={(e) => aoMudar(e.target.checked)}
      />
      <Rotulo id={id} texto={texto} ajuda={ajuda} />
    </div>
  )
}

export default function PainelParametros({
  aberto,
  aoFechar,
}: {
  aberto: boolean
  aoFechar: () => void
}) {
  const { parametros, alterarParametros, restaurarPadroes, resultado, recalculando } = useApp()
  const p = completarParametros(parametros)
  const set =
    <K extends keyof Parametros>(k: K) =>
    (v: Parametros[K]) =>
      alterarParametros({ [k]: v } as Partial<Parametros>)
  const idData = useId()
  const dataBaseTexto = p.dataBase
    ? new Date(diaSerial(p.dataBase) * 86_400_000).toISOString().slice(0, 10)
    : ''

  const nivel = (a: ClasseABC, x: 'X' | 'Y' | 'Z', v: number) =>
    alterarParametros({
      nivelServico: { ...p.nivelServico, [a]: { ...p.nivelServico[a], [x]: v } },
    })

  return (
    <Gaveta aberta={aberto} aoFechar={aoFechar} titulo="Parâmetros do cálculo" largura="max-w-xl">
      <p className="mb-4 text-sm text-slate-600 dark:text-concreto/80">
        Cada mudança recalcula tudo automaticamente{recalculando ? ' (recalculando…)' : ''}. Os
        valores ficam lembrados neste navegador.
      </p>
      <div className="flex flex-col gap-4">
        <Grupo titulo="Período e histórico">
          <CampoSelect
            texto="Período de análise"
            ajuda="Mensal suaviza o ruído para ABC/XYZ. Semanal reage mais rápido, mas é mais nervoso."
            valor={p.periodicidade}
            opcoes={[
              ['mensal', 'Mensal'],
              ['semanal', 'Semanal'],
            ]}
            aoMudar={(v) =>
              alterarParametros({
                periodicidade: v,
                janelaPeriodos:
                  v === 'semanal' && p.janelaPeriodos === 12
                    ? 52
                    : v === 'mensal' && p.janelaPeriodos === 52
                      ? 12
                      : p.janelaPeriodos,
              })
            }
          />
          <CampoNumero
            texto="Janela de histórico"
            sufixo="períodos"
            min={3}
            ajuda="Quantos períodos completos entram no cálculo. 12 meses capturam a sazonalidade anual."
            valor={p.janelaPeriodos}
            aoMudar={set('janelaPeriodos')}
          />
          <CampoSimNao
            texto="Excluir período corrente incompleto"
            ajuda="Um mês pela metade subestima a demanda."
            valor={p.excluirPeriodoIncompleto}
            aoMudar={set('excluirPeriodoIncompleto')}
          />
          <div className="flex flex-col gap-1">
            <Rotulo
              id={idData}
              texto="Data-base"
              ajuda="Data de referência do estoque atual. Padrão: data da última movimentação."
            />
            <input
              id={idData}
              type="date"
              className={classeEntrada}
              value={dataBaseTexto}
              onChange={(e) => {
                const v = e.target.value
                if (!v) return alterarParametros({ dataBase: null })
                const [a, m, d] = v.split('-').map(Number)
                alterarParametros({ dataBase: new Date(Date.UTC(a, m - 1, d)) })
              }}
            />
            <span className="text-xs text-concreto-escuro dark:text-concreto/70">
              Em uso: {resultado ? formatarData(resultado.dataBase) : '—'}{' '}
              {p.dataBase ? '' : '(automática)'}
            </span>
          </div>
          <CampoNumero
            texto="Dias por período"
            sufixo="dias"
            min={1}
            ajuda="Converte o lead time (em dias corridos) em períodos. 30 no mensal, 7 no semanal."
            valor={p.diasPorPeriodo ?? (p.periodicidade === 'mensal' ? 30 : 7)}
            aoMudar={set('diasPorPeriodo')}
          />
          <CampoNumero
            texto="Mínimo de períodos com dados"
            min={1}
            ajuda='Abaixo disso o item fica como "Histórico insuficiente" (XYZ Novo), sem estoque de segurança calculado.'
            valor={p.minPeriodos}
            aoMudar={set('minPeriodos')}
          />
          <CampoSimNao
            texto="Abater devoluções ao estoque da demanda"
            ajuda="Material requisitado e devolvido não foi consumido."
            valor={p.abaterDevolucoes}
            aoMudar={set('abaterDevolucoes')}
          />
        </Grupo>

        <Grupo titulo="Classificação">
          <CampoNumero
            texto="Corte A (acumulado)"
            percentual
            ajuda="Itens cujo acumulado anterior é menor que este corte são A. Pareto clássico: 80%."
            valor={p.corteA}
            aoMudar={set('corteA')}
          />
          <CampoNumero
            texto="Corte B (acumulado)"
            percentual
            ajuda="Até este corte, B; o restante é C. Padrão 95%."
            valor={p.corteB}
            aoMudar={set('corteB')}
          />
          <CampoNumero
            texto="Corte X (CV ≤)"
            passo={0.05}
            ajuda="Coeficiente de variação até este valor: demanda estável (X)."
            valor={p.corteX}
            aoMudar={set('corteX')}
          />
          <CampoNumero
            texto="Corte Y (CV ≤)"
            passo={0.05}
            ajuda="Acima de X e até este valor: Y. Acima: Z (irregular)."
            valor={p.corteY}
            aoMudar={set('corteY')}
          />
          <CampoNumero
            texto="Corte ADI (Syntetos-Boylan)"
            passo={0.01}
            ajuda="Intervalo médio entre demandas. Publicado: 1,32."
            valor={p.corteADI}
            aoMudar={set('corteADI')}
          />
          <CampoNumero
            texto="Corte CV² (Syntetos-Boylan)"
            passo={0.01}
            ajuda="Variabilidade dos tamanhos de demanda. Publicado: 0,49."
            valor={p.corteCV2}
            aoMudar={set('corteCV2')}
          />
        </Grupo>

        <Grupo titulo="Previsão">
          <CampoSelect
            texto="Método de previsão"
            ajuda="Regra fixa: média móvel para suaves/erráticos e SBA para intermitentes. Automático: o método com menor erro (MAE) no backtest."
            valor={p.metodoPrevisao}
            opcoes={[
              ['regra_fixa', 'Regra fixa'],
              ['automatico', 'Automático (backtest)'],
            ]}
            aoMudar={set('metodoPrevisao')}
          />
          <CampoNumero
            texto="Média móvel (suaves/erráticos)"
            sufixo="períodos"
            min={1}
            ajuda="Reage a mudanças sem ficar nervosa. Padrão: 6."
            valor={p.periodosMediaMovel}
            aoMudar={set('periodosMediaMovel')}
          />
          <CampoNumero
            texto="α do SBA (intermitentes)"
            passo={0.05}
            min={0.01}
            max={1}
            ajuda="Suavização do Croston corrigido. Padrão 0,10."
            valor={p.alphaSBA}
            aoMudar={set('alphaSBA')}
          />
        </Grupo>

        <Grupo titulo="Custos e reposição">
          <CampoNumero
            texto="Custo de emitir um pedido (S)"
            sufixo="R$"
            passo={10}
            min={0}
            ajuda="Placeholder de R$ 100: informe o custo real do seu processo de compra."
            valor={p.custoPedido}
            aoMudar={set('custoPedido')}
          />
          <CampoNumero
            texto="Taxa de manutenção (i)"
            percentual
            sufixo="% a.a."
            ajuda="Custo anual de manter estoque (capital, espaço, perdas). Literatura: 20–30% a.a."
            valor={p.taxaManutencaoAnual}
            aoMudar={set('taxaManutencaoAnual')}
          />
          <CampoNumero
            texto='Dias sem saída para "sem giro"'
            sufixo="dias"
            min={1}
            ajuda="Seis meses parado = risco de obsolescência."
            valor={p.diasSemGiro}
            aoMudar={set('diasSemGiro')}
          />
          <CampoNumero
            texto="Lead time padrão"
            sufixo="dias"
            min={0}
            ajuda="Usado nos itens sem lead time (com aviso de qualidade)."
            valor={p.leadTimePadraoDias}
            aoMudar={set('leadTimePadraoDias')}
          />
        </Grupo>

        <Grupo titulo="MRP">
          <CampoNumero
            texto="Horizonte"
            sufixo="semanas"
            min={1}
            max={104}
            ajuda="Cerca de um trimestre: 12 semanas."
            valor={p.horizonteMRP}
            aoMudar={set('horizonteMRP')}
          />
          <CampoSelect
            texto="Política de lote"
            ajuda="Lote econômico: compra pelo menos Q*. Lote a lote: só a necessidade líquida. Período fixo: cobre as próximas n semanas."
            valor={p.politicaLote}
            opcoes={[
              ['lote_economico', 'Lote econômico'],
              ['lote_a_lote', 'Lote a lote'],
              ['periodo_fixo', 'Período fixo (POQ)'],
            ]}
            aoMudar={set('politicaLote')}
          />
          {p.politicaLote === 'periodo_fixo' && (
            <CampoNumero
              texto="Semanas por pedido (POQ)"
              sufixo="semanas"
              min={1}
              ajuda="Quantas semanas de necessidade cada pedido cobre."
              valor={p.periodoFixoSemanas}
              aoMudar={set('periodoFixoSemanas')}
            />
          )}
        </Grupo>

        <fieldset className="rounded-lg border border-concreto p-3 dark:border-aco">
          <legend className="px-1 text-sm font-semibold text-marinho dark:text-white">
            Nível de serviço por classe{' '}
            <Ajuda texto="Itens A pesam no faturamento e custam caro para faltar; itens Z são imprevisíveis e proteger 98% deles exigiria estoque desproporcional." />
          </legend>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th />
                {(['X', 'Y', 'Z'] as const).map((x) => (
                  <th
                    key={x}
                    className="pb-1 text-center font-semibold text-marinho dark:text-concreto"
                  >
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['A', 'B', 'C'] as const).map((a) => (
                <tr key={a}>
                  <th className="pr-2 text-left font-semibold text-marinho dark:text-concreto">
                    {a}
                  </th>
                  {(['X', 'Y', 'Z'] as const).map((x) => (
                    <td key={x} className="p-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          aria-label={`Nível de serviço ${a}${x} em %`}
                          className={`${classeEntrada} text-right`}
                          step={0.5}
                          min={50}
                          max={99.9}
                          value={Math.round(p.nivelServico[a][x] * 1000) / 10}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            if (Number.isFinite(n) && n > 0 && n < 100) nivel(a, x, n / 100)
                          }}
                        />
                        <span className="text-xs text-concreto-escuro">%</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>

        <Botao onClick={restaurarPadroes} className="self-start">
          <RotateCcw className="size-4" aria-hidden /> Restaurar padrões
        </Botao>
      </div>
    </Gaveta>
  )
}
