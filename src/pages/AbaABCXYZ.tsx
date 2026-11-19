import { ArrowDown, ArrowUp } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { opcaoCurvaNivel } from '../charts/curva-nivel'
import { opcaoDispersaoCV } from '../charts/dispersao-cv'
import Grafico from '../charts/Grafico'
import { opcaoMatriz } from '../charts/matriz-abc-xyz'
import { opcaoNivelFillRate } from '../charts/nivel-fillrate'
import { opcaoPareto } from '../charts/pareto'
import { opcaoSankeyABC } from '../charts/sankey-abc'
import { opcaoHeatmapSimilaridade } from '../charts/similaridade'
import { opcaoSyntetosBoylan } from '../charts/syntetos-boylan'
import type { CoresGrafico } from '../charts/tema'
import { classeEntradaCompacta } from '../components/estilos'
import FiltrosItens from '../components/FiltrosItens'
import PainelMulticriterio from '../components/PainelMulticriterio'
import TabelaDados, { type Coluna } from '../components/TabelaDados'
import { Cartao, SeloABC, SeloXYZ } from '../components/ui'
import { completarParametros } from '../engine/padroes'
import type { BaseABC, ClasseABC, ConfigMulticriterio, ItemResultado } from '../engine/tipos'
import { useApp } from '../estado/contexto'
import { aplicarFiltro, type Filtro } from '../lib/filtros'
import { moeda, num, numFixo, pct } from '../lib/formato'
import type { PropsAba } from './tipos'
import { Alternar } from './VisaoGeral'

const POLITICAS: Record<string, string> = {
  AX: 'Reposição automática por ponto de pedido, ES baixo e revisão frequente dos parâmetros.',
  AY: 'Ponto de pedido com ES moderado; acompanhar a previsão de perto.',
  AZ: 'Comprar sob demanda ou programado com o fornecedor; evitar estoque especulativo e negociar lead time curto.',
  BX: 'Reposição automática com lote econômico.',
  BY: 'Ponto de pedido com ES padrão e revisão periódica.',
  BZ: 'Estoque mínimo com revisão manual; avaliar substituir ou consolidar.',
  CX: 'Reposição simples (duas caixas / kanban) com lotes maiores.',
  CY: 'Revisão periódica com lotes maiores; pouco esforço de gestão.',
  CZ: 'Comprar sob demanda ou revisar se vale a pena estocar.',
}

const BASES: [BaseABC, string][] = [
  ['valor_consumo', 'Valor de consumo (padrão)'],
  ['quantidade', 'Quantidade consumida'],
  ['valor_estoque', 'Valor em estoque'],
]

export default function AbaABCXYZ({ resultado: r, abrirItem }: PropsAba) {
  const [filtro, setFiltro] = useState<Filtro>({})
  const [metrica, setMetrica] = useState<'itens' | 'valor'>('itens')
  const [base, setBase] = useState<BaseABC>('valor_consumo')
  const [verSimilaridade, setVerSimilaridade] = useState(false)
  const { parametros, alterarParametros } = useApp()
  // Configuração atual (pode estar à frente do resultado enquanto o worker recalcula).
  const cfgMC = completarParametros(parametros).multicriterio
  const setMC = useCallback(
    (c: ConfigMulticriterio) => alterarParametros({ multicriterio: c }),
    [alterarParametros],
  )
  const mc = r.multicriterio
  const itens = r.itens
  const p = r.parametros
  const classeDe = useCallback(
    (i: ItemResultado): ClasseABC =>
      base === 'quantidade'
        ? i.classeABCQuantidade
        : base === 'valor_estoque'
          ? i.classeABCValorEstoque
          : i.classeABC,
    [base],
  )
  const filtrados = useMemo(() => {
    const f = aplicarFiltro(itens, { ...filtro, abc: undefined })
    return filtro.abc ? f.filter((i) => classeDe(i) === filtro.abc) : f
  }, [itens, filtro, classeDe])

  const opPareto = useCallback(
    (c: CoresGrafico) => opcaoPareto(itens, p.corteA, p.corteB, c),
    [itens, p.corteA, p.corteB],
  )
  const opMatriz = useCallback(
    (c: CoresGrafico) => opcaoMatriz(r.matriz, metrica, c),
    [r.matriz, metrica],
  )
  const opCV = useCallback(
    (c: CoresGrafico) => opcaoDispersaoCV(itens, p.corteX, p.corteY, c),
    [itens, p.corteX, p.corteY],
  )
  const opSB = useCallback(
    (c: CoresGrafico) => opcaoSyntetosBoylan(itens, p.corteADI, p.corteCV2, c),
    [itens, p.corteADI, p.corteCV2],
  )
  const opFill = useCallback((c: CoresGrafico) => opcaoNivelFillRate(itens, c), [itens])
  const opCurvaCelula = useCallback(
    (c: CoresGrafico) =>
      opcaoCurvaNivel(
        (['AX', 'AY', 'AZ', 'BX', 'BY', 'CX'] as const)
          .map((cel) => {
            const g = itens.filter(
              (i) =>
                `${i.classeABC}${i.classeXYZ}` === cel && i.sigmaLT > 0 && i.custoManutencao > 0,
            )
            if (!g.length) return null
            // Consolidado: soma das curvas (σ_LT·H somados equivale a somar os custos).
            const sigmaH = g.reduce((s, i) => s + i.sigmaLT * i.custoManutencao, 0)
            return {
              nome: cel,
              sigmaLT: sigmaH,
              H: 1,
              nivelAtual: p.nivelServico[cel[0] as ClasseABC][cel[1] as 'X' | 'Y' | 'Z'],
            }
          })
          .filter((x): x is NonNullable<typeof x> => !!x),
        c,
      ),
    [itens, p.nivelServico],
  )
  const opSim = useCallback((c: CoresGrafico) => opcaoHeatmapSimilaridade(itens, c), [itens])
  const opSankey = useCallback((c: CoresGrafico) => (mc ? opcaoSankeyABC(mc, c) : null), [mc])
  const mudaram = useMemo(
    () =>
      itens
        .filter((i) => i.multicriterio?.mudou)
        .sort(
          (a, b) =>
            (a.multicriterio!.mudou === 'subiu' ? 0 : 1) -
              (b.multicriterio!.mudou === 'subiu' ? 0 : 1) ||
            (b.multicriterio!.score ?? 0) - (a.multicriterio!.score ?? 0),
        ),
    [itens],
  )
  const colunasMudou = useMemo<Coluna<ItemResultado>[]>(
    () => [
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
          <span className="block max-w-52 truncate" title={i.descricao}>
            {i.descricao}
          </span>
        ),
      },
      {
        id: 'mudanca',
        titulo: 'Valor → final',
        valor: (i) => `${i.classeABCValor}→${i.classeABC}`,
        render: (i) => (
          <span className="inline-flex items-center gap-1">
            <SeloABC c={i.classeABCValor} />
            {i.multicriterio!.mudou === 'subiu' ? (
              <ArrowUp className="size-4 text-ok" aria-label="subiu" />
            ) : (
              <ArrowDown className="size-4 text-critico" aria-label="desceu" />
            )}
            <SeloABC c={i.classeABC} />
          </span>
        ),
      },
      {
        id: 'score',
        titulo: 'Score',
        numerica: true,
        valor: (i) => i.multicriterio!.score,
        render: (i) => numFixo(i.multicriterio!.score, 2),
      },
      {
        id: 'estabilidade',
        titulo: 'Estabilidade',
        numerica: true,
        valor: (i) => i.multicriterio!.estabilidade,
        render: (i) => {
          const e = i.multicriterio!.estabilidade
          return (
            <span className={e !== null && e < 0.7 ? 'font-semibold text-critico' : ''}>
              {pct(e, 0)}
            </span>
          )
        },
        ajuda:
          '% das 500 simulações (pesos perturbados em até ±10 p.p.) em que a classe se manteve. Abaixo de 70% = instável.',
      },
      {
        id: 'motivo',
        titulo: 'Motivo',
        valor: (i) => i.multicriterio!.motivo,
        render: (i) => (
          <span className="block max-w-[28rem] truncate text-xs" title={i.multicriterio!.motivo}>
            {i.multicriterio!.motivo}
          </span>
        ),
      },
    ],
    [],
  )

  const colunas = useMemo<Coluna<ItemResultado>[]>(
    () => [
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
          <span className="block max-w-64 truncate" title={i.descricao}>
            {i.descricao}
          </span>
        ),
      },
      { id: 'categoria', titulo: 'Categoria', valor: (i) => i.categoria },
      {
        id: 'consumoQtd',
        titulo: 'Consumo (qtd)',
        numerica: true,
        valor: (i) => i.consumoQtd,
        render: (i) => `${num(i.consumoQtd, 2)} ${i.unidade}`,
      },
      {
        id: 'consumoAnual',
        titulo: 'Consumo anual (R$)',
        numerica: true,
        valor: (i) => i.consumoAnualValor,
        render: (i) => moeda(i.consumoAnualValor),
      },
      {
        id: 'pct',
        titulo: '%',
        numerica: true,
        valor: (i) => i.pctConsumo,
        render: (i) => pct(i.pctConsumo, 2),
      },
      {
        id: 'pctAcum',
        titulo: '% acum.',
        numerica: true,
        valor: (i) => i.pctAcumulado,
        render: (i) => pct(i.pctAcumulado),
      },
      {
        id: 'abc',
        titulo: mc && base === 'valor_consumo' ? 'ABC final' : 'ABC',
        valor: (i) => classeDe(i),
        render: (i) => <SeloABC c={classeDe(i)} />,
      },
      ...(mc
        ? ([
            {
              id: 'abcValor',
              titulo: 'ABC valor',
              valor: (i) => i.classeABCValor,
              render: (i) => <SeloABC c={i.classeABCValor} />,
              ajuda: 'Classe pelo valor de consumo (ABC clássico), para comparar com a final.',
            },
            {
              id: 'scoreMC',
              titulo: 'Score',
              numerica: true,
              valor: (i) => i.multicriterio?.score ?? null,
              render: (i) => numFixo(i.multicriterio?.score, 2),
              ajuda: 'Score multicritério S = Σ peso × valor normalizado (0–1).',
            },
          ] satisfies Coluna<ItemResultado>[])
        : []),
      {
        id: 'media',
        titulo: 'd̄',
        numerica: true,
        valor: (i) => i.media,
        render: (i) => numFixo(i.media, 2),
        ajuda: 'Demanda média por período',
      },
      {
        id: 'desvio',
        titulo: 'σ',
        numerica: true,
        valor: (i) => i.desvio,
        render: (i) => numFixo(i.desvio, 2),
        ajuda: 'Desvio padrão amostral da demanda',
      },
      {
        id: 'cv',
        titulo: 'CV',
        numerica: true,
        valor: (i) => i.cv,
        render: (i) => numFixo(i.cv, 2),
        ajuda: 'Coeficiente de variação = σ ÷ d̄',
      },
      {
        id: 'xyz',
        titulo: 'XYZ',
        valor: (i) => i.classeXYZ,
        render: (i) => <SeloXYZ c={i.classeXYZ} />,
      },
      {
        id: 'adi',
        titulo: 'ADI',
        numerica: true,
        valor: (i) => i.adi,
        render: (i) => numFixo(i.adi, 2),
        ajuda: 'Intervalo médio entre demandas',
      },
      {
        id: 'cv2',
        titulo: 'CV²',
        numerica: true,
        valor: (i) => i.cv2,
        render: (i) => numFixo(i.cv2, 2),
      },
      {
        id: 'padrao',
        titulo: 'Padrão',
        valor: (i) =>
          i.padrao ?? (i.historicoInsuficiente ? 'Histórico insuficiente' : 'Sem demanda'),
      },
      { id: 'combinada', titulo: 'Classe', valor: (i) => i.classeCombinada },
    ],
    [classeDe, mc, base],
  )

  return (
    <div className="flex flex-col gap-6">
      <Cartao
        titulo="Classificar por"
        acoes={
          <div
            className="inline-flex rounded-md ring-1 ring-concreto dark:ring-aco"
            role="group"
            aria-label="Classificar por"
          >
            {(
              [
                [false, 'Valor'],
                [true, 'Multicritério'],
              ] as const
            ).map(([ativo, rotulo]) => (
              <button
                key={rotulo}
                type="button"
                aria-pressed={cfgMC.ativo === ativo}
                onClick={() => setMC({ ...cfgMC, ativo })}
                className={`px-4 py-1.5 text-sm font-medium first:rounded-l-md last:rounded-r-md ${cfgMC.ativo === ativo ? 'bg-seguranca text-marinho' : 'text-slate-700 dark:text-concreto'}`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-concreto/80">
          {cfgMC.ativo
            ? 'A classe final combina valor, lead time, criticidade e outros critérios com os pesos da sua empresa, e passa a valer na matriz, no nível de serviço, nas prioridades de compra, nos KPIs e na planilha. A classe por valor continua ao lado para comparação.'
            : 'ABC clássico pelo valor de consumo anual. Ligue o multicritério para considerar também lead time, criticidade, fornecedores, substitutos e critérios próprios da empresa.'}
        </p>
        {cfgMC.ativo && (
          <div className="mt-4">
            <PainelMulticriterio config={cfgMC} resumo={mc} aoMudar={setMC} />
          </div>
        )}
      </Cartao>

      {mc && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          <Cartao titulo="ABC por valor → classe final">
            <Grafico
              opcao={opSankey}
              altura={300}
              descricao={`Fluxo de itens da classe por valor para a classe final: ${mc.subiram} subiram e ${mc.desceram} desceram.`}
            />
            <p className="text-xs text-slate-600 dark:text-concreto/80">
              Faixas verdes: itens que subiram; vermelhas: que desceram; cinza: mantiveram a classe.
            </p>
          </Cartao>
          <Cartao titulo={`Quem mudou de classe (${num(mudaram.length)})`}>
            <TabelaDados
              rotulo="Itens que mudaram de classe no ABC multicritério"
              dados={mudaram}
              colunas={
                mc.config.modo === 'ved'
                  ? colunasMudou.filter((c) => c.id !== 'score' && c.id !== 'estabilidade')
                  : colunasMudou
              }
              chave={(i) => i.codigo}
              aoClicarLinha={(i) => abrirItem(i.codigo)}
              nomeCSV="abc-multicriterio-mudancas"
              alturaMax={320}
              vazio="Nenhum item mudou de classe com esta configuração."
            />
          </Cartao>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Cartao titulo="Matriz ABC × XYZ" acoes={<Alternar valor={metrica} aoMudar={setMetrica} />}>
          <Grafico
            opcao={opMatriz}
            altura={300}
            descricao={`Matriz ABC por XYZ: ${r.matriz.map((m) => `${m.abc}${m.xyz} ${m.itens} itens`).join(', ')}. Clique numa célula para filtrar a tabela.`}
            aoClicar={(p) => {
              const v = p.value as number[] | undefined
              if (!v) return
              setBase('valor_consumo')
              setFiltro({
                abc: (['C', 'B', 'A'] as const)[v[1]],
                xyz: (['X', 'Y', 'Z'] as const)[v[0]],
              })
            }}
          />
        </Cartao>
        <Cartao titulo="Curva ABC (Pareto)">
          <Grafico
            opcao={opPareto}
            altura={300}
            descricao={`Curva de Pareto do consumo anual: ${r.kpis.pctSkusA > 0 ? pct(r.kpis.pctSkusA) : '—'} dos itens (classe A) concentram ${pct(r.kpis.pctValorA)} do valor.`}
            aoClicar={(p) => p.name && abrirItem(p.name)}
          />
        </Cartao>
      </div>

      <Cartao titulo="Política recomendada por célula">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          {(['A', 'B', 'C'] as const).flatMap((a) =>
            (['X', 'Y', 'Z'] as const).map((x) => {
              const cel = r.matriz.find((m) => m.abc === a && m.xyz === x)
              return (
                <button
                  key={a + x}
                  type="button"
                  onClick={() => {
                    setBase('valor_consumo')
                    setFiltro({ abc: a, xyz: x })
                  }}
                  className="rounded-lg border border-concreto p-2.5 text-left hover:border-seguranca dark:border-aco"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-marinho dark:text-white">
                    <SeloABC c={a} />
                    <SeloXYZ c={x} />
                    <span className="ml-auto text-xs font-normal text-concreto-escuro dark:text-concreto/70">
                      {num(cel?.itens ?? 0)} itens · {pct(p.nivelServico[a][x], 0)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-concreto/80">
                    {POLITICAS[a + x]}
                  </p>
                </button>
              )
            }),
          )}
        </div>
      </Cartao>

      <Cartao
        titulo="Itens"
        acoes={
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-concreto/80">
            ABC por
            <select
              className={`${classeEntradaCompacta}`}
              value={base}
              onChange={(e) => setBase(e.target.value as BaseABC)}
            >
              {BASES.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <div className="flex flex-col gap-3">
          <FiltrosItens itens={itens} filtro={filtro} aoMudar={setFiltro} />
          <TabelaDados
            rotulo="Classificação ABC-XYZ dos itens"
            dados={filtrados}
            colunas={colunas}
            chave={(i) => i.codigo}
            aoClicarLinha={(i) => abrirItem(i.codigo)}
            nomeCSV="abc-xyz"
            ordenacaoInicial={[{ id: 'consumoAnual', desc: true }]}
          />
        </div>
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="CV × consumo anual">
          <Grafico
            opcao={opCV}
            descricao="Dispersão do coeficiente de variação contra o consumo anual em escala logarítmica, por classe ABC."
            aoClicar={(p) => p.name && abrirItem(p.name)}
          />
        </Cartao>
        <Cartao titulo="Padrão de demanda (Syntetos-Boylan)">
          <Grafico
            opcao={opSB}
            descricao="Dispersão ADI por CV² com os quadrantes suave, errático, intermitente e irregular."
            aoClicar={(p) => {
              const d = p.data as { item?: ItemResultado } | undefined
              if (d?.item) abrirItem(d.item.codigo)
            }}
          />
        </Cartao>
        <Cartao titulo="Nível de ciclo (tipo 1) × fill rate (tipo 2)">
          <Grafico
            opcao={opFill}
            descricao="Comparação, por célula ABC-XYZ, entre o nível de serviço de ciclo alvo e o fill rate esperado."
          />
          <p className="text-xs text-slate-600 dark:text-concreto/80">
            O fill rate costuma passar de 99%: a falta esperada por ciclo é pequena perto do tamanho
            do lote.
          </p>
        </Cartao>
        <Cartao titulo="Nível de serviço × custo anual do ES (por célula)">
          <Grafico
            opcao={opCurvaCelula}
            descricao="Custo anual do estoque de segurança somado por célula, de 80% a 99,9% de nível de serviço, com o nível atual marcado."
          />
          <p className="text-xs text-slate-600 dark:text-concreto/80">
            Perto de 99% o custo marginal dispara: de 95% para 99% o ES cresce cerca de 41%.
          </p>
        </Cartao>
      </div>

      <Cartao
        titulo="Similaridade entre os itens A de maior valor"
        acoes={
          <button
            type="button"
            className="text-sm text-aco-claro underline dark:text-seguranca"
            onClick={() => setVerSimilaridade((v) => !v)}
          >
            {verSimilaridade ? 'Ocultar' : 'Mostrar'}
          </button>
        }
      >
        {verSimilaridade ? (
          <Grafico
            opcao={opSim}
            altura={520}
            descricao="Mapa de calor da similaridade de cosseno entre os perfis de consumo dos 30 itens A de maior valor."
          />
        ) : (
          <p className="text-sm text-slate-600 dark:text-concreto/80">
            Mapa de calor da similaridade de cosseno entre os perfis de consumo (opcional).
          </p>
        )}
      </Cartao>
    </div>
  )
}
