import { Download, Plus, Scale, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { completarConfigMC, CRITERIOS_BASE, descreverRegra, PRESETS } from '../engine/multicriterio'
import type {
  ClasseABC,
  ClasseVED,
  ConfigMulticriterio,
  IdCriterio,
  RegraPiso,
  ResumoMulticriterio,
} from '../engine/tipos'
import { baixarArquivo } from '../lib/download'
import { rebalancear } from '../lib/pesos'
import { num, pct } from '../lib/formato'
import AssistenteAHP from './AssistenteAHP'
import { classeEntrada, classeEntradaCompacta } from './estilos'
import { Ajuda, Botao } from './ui'

const AJUDA = new Map(CRITERIOS_BASE.map((c) => [c.id, c.ajuda]))

function presetAtual(pesos: Record<IdCriterio, number>): string {
  for (const [k, p] of Object.entries(PRESETS)) {
    const ids = new Set([
      ...Object.keys(p.pesos),
      ...Object.keys(pesos).filter((x) => pesos[x] > 1e-6),
    ])
    if ([...ids].every((x) => Math.abs((p.pesos[x] ?? 0) - (pesos[x] ?? 0)) < 0.005)) return k
  }
  return 'personalizado'
}

export default function PainelMulticriterio({
  config,
  resumo,
  aoMudar,
}: {
  config: ConfigMulticriterio
  resumo: ResumoMulticriterio | null
  aoMudar: (c: ConfigMulticriterio) => void
}) {
  const [ahpAberto, setAhpAberto] = useState(false)
  const [erroJson, setErroJson] = useState<string | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const mudar = (patch: Partial<ConfigMulticriterio>) => aoMudar({ ...config, ...patch })

  const criterios =
    resumo?.criterios ??
    CRITERIOS_BASE.map((c) => ({ id: c.id, nome: c.nome, itensComDado: 0, direcao: c.direcao }))
  const ids = criterios.map((c) => c.id)
  const soma = ids.reduce((s, id) => s + (config.pesos[id] ?? 0), 0) || 1
  const pesoPct = (id: IdCriterio) => ((config.pesos[id] ?? 0) / soma) * 100
  const preset = presetAtual(
    Object.fromEntries(ids.map((id) => [id, (config.pesos[id] ?? 0) / soma])),
  )
  const comPeso = ids.filter((id) => (config.pesos[id] ?? 0) > 0).slice(0, 9)

  const salvarJson = () => {
    const dados = { ferramenta: 'Kit Estoque MRP', versao: 1, multicriterio: config }
    baixarArquivo(
      new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }),
      'pesos-abc-multicriterio.json',
    )
  }
  const carregarJson = async (f: File) => {
    try {
      const obj = JSON.parse(await f.text())
      const c = obj?.multicriterio ?? obj
      if (!c || typeof c !== 'object' || typeof c.pesos !== 'object') throw new Error('formato')
      setErroJson(null)
      aoMudar(completarConfigMC({ ...c, ativo: true }))
    } catch {
      setErroJson('Arquivo inválido: use um .json salvo por esta ferramenta.')
    }
  }
  const setRegra = (i: number, patch: Partial<RegraPiso>) =>
    mudar({ regras: config.regras.map((r, k) => (k === i ? { ...r, ...patch } : r)) })

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-md ring-1 ring-concreto dark:ring-aco"
          role="group"
          aria-label="Modo de classificação"
        >
          {(
            [
              ['ponderado', 'Pontuação ponderada'],
              ['ved', 'Matriz ABC × criticidade (VED)'],
            ] as const
          ).map(([m, r]) => (
            <button
              key={m}
              type="button"
              aria-pressed={config.modo === m}
              onClick={() => mudar({ modo: m })}
              className={`px-3 py-1.5 first:rounded-l-md last:rounded-r-md ${config.modo === m ? 'bg-aco-claro text-white' : 'text-slate-700 dark:text-concreto'}`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Botao variante="fantasma" onClick={salvarJson}>
            <Download className="size-4" aria-hidden /> Salvar pesos (.json)
          </Botao>
          <Botao variante="fantasma" onClick={() => arquivo.current?.click()}>
            <Upload className="size-4" aria-hidden /> Carregar pesos
          </Botao>
          <input
            ref={arquivo}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Carregar configuração de pesos"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void carregarJson(f)
            }}
          />
        </div>
      </div>
      {erroJson && (
        <p className="text-critico" role="alert">
          {erroJson}
        </p>
      )}

      {config.modo === 'ponderado' ? (
        <>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-medium text-marinho dark:text-concreto">Ponto de partida:</span>
              {Object.entries(PRESETS).map(([k, p]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={preset === k}
                  onClick={() => mudar({ pesos: { ...p.pesos }, ahp: null })}
                  className={`rounded-full px-3 py-1 ring-1 ${preset === k ? 'bg-seguranca text-marinho ring-seguranca' : 'ring-concreto hover:ring-seguranca dark:ring-aco'}`}
                >
                  {p.nome}
                </button>
              ))}
              <span
                className={`rounded-full px-3 py-1 ring-1 ${preset === 'personalizado' ? 'bg-seguranca text-marinho ring-seguranca' : 'text-concreto-escuro ring-concreto dark:ring-aco'}`}
              >
                Personalizado
              </span>
              <Botao
                variante="secundario"
                className="ml-auto"
                onClick={() => setAhpAberto(true)}
                disabled={comPeso.length < 2}
              >
                <Scale className="size-4" aria-hidden /> Assistente AHP
              </Botao>
            </div>
            <p className="text-xs text-concreto-escuro dark:text-concreto/70">
              Os presets são pontos de partida, não normas: ajuste os pesos à realidade da sua
              empresa.
              {config.ahp &&
                ` Pesos atuais vieram do AHP (CR = ${config.ahp.cr.toFixed(3).replace('.', ',')}).`}
            </p>
          </div>

          <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
            {criterios.map((c) => {
              const id = `peso-${c.id}`
              const v = pesoPct(c.id)
              const proprio = c.id.startsWith('crit_')
              return (
                <div key={c.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <label htmlFor={id} className="font-medium text-marinho dark:text-concreto">
                      {c.nome}
                    </label>
                    {AJUDA.get(c.id) && (
                      <Ajuda texto={AJUDA.get(c.id)!} rotulo={`Sobre ${c.nome}`} />
                    )}
                    <span
                      className={`ml-1 text-xs ${c.itensComDado ? 'text-concreto-escuro dark:text-concreto/70' : 'text-critico'}`}
                    >
                      {resumo
                        ? c.itensComDado
                          ? `${num(c.itensComDado)} itens com dado`
                          : 'sem dados na planilha'
                        : ''}
                    </span>
                    <span className="ml-auto font-semibold tabular-nums">{num(v, 0)}%</span>
                  </div>
                  <input
                    id={id}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(v)}
                    onChange={(e) =>
                      mudar({
                        pesos: rebalancear(
                          Object.fromEntries(ids.map((x) => [x, (config.pesos[x] ?? 0) / soma])),
                          c.id,
                          Number(e.target.value) / 100,
                          ids,
                        ),
                        ahp: null,
                      })
                    }
                    className="accent-seguranca"
                  />
                  {proprio && (
                    <select
                      aria-label={`Direção de ${c.nome}`}
                      className={`${classeEntradaCompacta} self-start text-xs`}
                      value={config.direcoes[c.id] ?? 'maior'}
                      onChange={(e) =>
                        mudar({
                          direcoes: {
                            ...config.direcoes,
                            [c.id]: e.target.value as 'maior' | 'menor',
                          },
                        })
                      }
                    >
                      <option value="maior">maior = mais crítico</option>
                      <option value="menor">menor = mais crítico</option>
                    </select>
                  )}
                  {c.id === 'cv' && v > 0 && (
                    <p className="text-xs text-seguranca">
                      A variabilidade já é o eixo XYZ da matriz; com peso aqui ela conta duas vezes.
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-marinho dark:text-concreto">Normalização</span>
              <select
                className={classeEntrada}
                value={config.normalizacao}
                onChange={(e) =>
                  mudar({ normalizacao: e.target.value as ConfigMulticriterio['normalizacao'] })
                }
              >
                <option value="posto">Posto percentil (robusto a extremos)</option>
                <option value="minmax">Mín-máx</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-marinho dark:text-concreto">
                Como formar as classes
              </span>
              <select
                className={classeEntrada}
                value={config.metodoClasses}
                onChange={(e) =>
                  mudar({ metodoClasses: e.target.value as ConfigMulticriterio['metodoClasses'] })
                }
              >
                <option value="mesma_contagem">Mesma quantidade de A/B/C do ABC por valor</option>
                <option value="percentual">Percentual de itens</option>
                <option value="cortes">Cortes de score</option>
              </select>
            </label>
            {config.metodoClasses !== 'mesma_contagem' && (
              <div className="flex items-end gap-2">
                {(['A', 'B'] as const).map((k) => (
                  <label key={k} className="flex flex-1 flex-col gap-1">
                    <span className="font-medium text-marinho dark:text-concreto">
                      {config.metodoClasses === 'percentual' ? `% itens ${k}` : `Score ${k} ≥`}
                    </span>
                    <input
                      type="number"
                      className={classeEntrada}
                      step={config.metodoClasses === 'percentual' ? 1 : 0.05}
                      min={0}
                      max={config.metodoClasses === 'percentual' ? 100 : 1}
                      value={
                        config.metodoClasses === 'percentual'
                          ? Math.round(config.percentuais[k] * 100)
                          : config.cortes[k]
                      }
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (!Number.isFinite(n)) return
                        if (config.metodoClasses === 'percentual')
                          mudar({ percentuais: { ...config.percentuais, [k]: n / 100 } })
                        else mudar({ cortes: { ...config.cortes, [k]: n } })
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <fieldset className="rounded-lg border border-concreto p-3 dark:border-aco">
            <legend className="px-1 font-semibold text-marinho dark:text-white">
              Regras de piso{' '}
              <Ajuda texto="Garantem uma classe mínima para itens que atendem a todas as condições, qualquer que seja o score. A classe manual do cadastro prevalece sobre tudo." />
            </legend>
            <ul className="flex flex-col gap-2">
              {config.regras.map((r, i) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-seguranca"
                    aria-label="Regra ativa"
                    checked={r.ativa}
                    onChange={(e) => setRegra(i, { ativa: e.target.checked })}
                  />
                  <select
                    aria-label="Criticidade mínima"
                    className={`${classeEntradaCompacta}`}
                    value={r.criticidadeMin === null ? '' : String(r.criticidadeMin)}
                    onChange={(e) =>
                      setRegra(i, {
                        criticidadeMin: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  >
                    <option value="">qualquer criticidade</option>
                    <option value="1">criticidade Alta</option>
                    <option value="0.5">criticidade Média ou Alta</option>
                  </select>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      className="size-4 accent-seguranca"
                      checked={r.semSubstituto}
                      onChange={(e) => setRegra(i, { semSubstituto: e.target.checked })}
                    />
                    sem substituto
                  </label>
                  <label className="flex items-center gap-1">
                    LT &gt;
                    <input
                      type="number"
                      aria-label="Lead time maior que (dias)"
                      className={`${classeEntradaCompacta} w-20`}
                      min={0}
                      value={r.leadTimeMaiorQue ?? ''}
                      onChange={(e) =>
                        setRegra(i, {
                          leadTimeMaiorQue: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                    dias →
                  </label>
                  <select
                    aria-label="Classe mínima"
                    className={`${classeEntradaCompacta}`}
                    value={r.classeMinima}
                    onChange={(e) => setRegra(i, { classeMinima: e.target.value as 'A' | 'B' })}
                  >
                    <option value="A">nunca abaixo de A</option>
                    <option value="B">nunca abaixo de B</option>
                  </select>
                  <button
                    type="button"
                    aria-label="Remover regra"
                    className="rounded p-1 text-concreto-escuro hover:text-critico"
                    onClick={() => mudar({ regras: config.regras.filter((_, k) => k !== i) })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                  <span className="w-full text-xs text-concreto-escuro dark:text-concreto/70">
                    {descreverRegra(r)}
                  </span>
                </li>
              ))}
            </ul>
            <Botao
              variante="fantasma"
              className="mt-2"
              onClick={() =>
                mudar({
                  regras: [
                    ...config.regras,
                    {
                      id: `piso-${Date.now()}`,
                      ativa: true,
                      criticidadeMin: 1,
                      semSubstituto: false,
                      leadTimeMaiorQue: null,
                      classeMinima: 'B',
                    },
                  ],
                })
              }
            >
              <Plus className="size-4" aria-hidden /> Adicionar regra
            </Botao>
          </fieldset>
        </>
      ) : (
        <div>
          <p className="mb-2 text-slate-600 dark:text-concreto/80">
            Cruza a classe por valor com a criticidade (V = Vital, E = Essencial, D = Desejável).
            Mais simples de explicar para a diretoria; a pontuação ponderada é mais completa.
          </p>
          <table className="text-sm">
            <thead>
              <tr>
                <th />
                {(['V', 'E', 'D'] as ClasseVED[]).map((v) => (
                  <th
                    key={v}
                    className="px-2 pb-1 text-center font-semibold text-marinho dark:text-concreto"
                  >
                    {v === 'V' ? 'Vital (V)' : v === 'E' ? 'Essencial (E)' : 'Desejável (D)'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['A', 'B', 'C'] as ClasseABC[]).map((a) => (
                <tr key={a}>
                  <th className="pr-2 text-left font-semibold text-marinho dark:text-concreto">
                    {a} (valor)
                  </th>
                  {(['V', 'E', 'D'] as ClasseVED[]).map((v) => (
                    <td key={v} className="p-1">
                      <select
                        aria-label={`Classe final para ${a} por valor e ${v}`}
                        className={`${classeEntradaCompacta} w-20`}
                        value={config.matrizVED[a][v]}
                        onChange={(e) =>
                          mudar({
                            matrizVED: {
                              ...config.matrizVED,
                              [a]: { ...config.matrizVED[a], [v]: e.target.value as ClasseABC },
                            },
                          })
                        }
                      >
                        {['A', 'B', 'C'].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resumo && (
        <p
          className="rounded-md bg-seguranca/15 px-3 py-2 font-medium text-marinho dark:text-concreto"
          aria-live="polite"
        >
          Com esta configuração, <b>{num(resumo.subiram)}</b>{' '}
          {resumo.subiram === 1 ? 'item sobe' : 'itens sobem'} de classe e{' '}
          <b>{num(resumo.desceram)}</b> {resumo.desceram === 1 ? 'desce' : 'descem'}
          {config.modo === 'ponderado' &&
            ` · ${num(resumo.instaveis)} com classe instável (< ${pct(0.7, 0)} das simulações)`}
          .
        </p>
      )}

      <AssistenteAHP
        key={comPeso.join('|')}
        aberto={ahpAberto}
        aoFechar={() => setAhpAberto(false)}
        criterios={comPeso}
        aoAplicar={(pesos, registro) => mudar({ pesos, ahp: registro })}
      />
    </div>
  )
}
