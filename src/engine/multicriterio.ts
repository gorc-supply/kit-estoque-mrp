// Classificação ABC multicritério (CLAUDE.md, seção 16-B).
// Modo 1: pontuação ponderada de critérios normalizados (0–1, 1 = mais crítico).
// Modo 2: matriz bicritério ABC por valor × criticidade (VED).

import type {
  ClasseABC,
  ClasseVED,
  ConfigMulticriterio,
  CriterioDoItem,
  Equipamento,
  IdCriterio,
  ItemMulticriterio,
  Material,
  OndeUsado,
  ProblemaQualidade,
  RegraPiso,
  ResultadoAHP,
  ResumoMulticriterio,
} from './tipos'

// ---------------------------------------------------------------------------
// Critérios, presets e configuração padrão

export interface DefCriterio {
  id: IdCriterio
  nome: string
  direcao: 'maior' | 'menor'
  /** Categóricos já chegam normalizados (criticidade, substituto). */
  categorico: boolean
  ajuda: string
}

export const CRITERIOS_BASE: DefCriterio[] = [
  {
    id: 'valor',
    nome: 'Valor de consumo anual',
    direcao: 'maior',
    categorico: false,
    ajuda: 'Cv_anual = d̄ × custo × períodos por ano (o ABC clássico).',
  },
  {
    id: 'lead_time',
    nome: 'Lead time',
    direcao: 'maior',
    categorico: false,
    ajuda: 'Quanto mais demora para chegar, mais proteção o item merece.',
  },
  {
    id: 'criticidade',
    nome: 'Criticidade',
    direcao: 'maior',
    categorico: true,
    ajuda:
      'Alta/Média/Baixa, A/B/C, V/E/D ou 1–5. Do item ou, se vazia, a maior entre os equipamentos que ele atende.',
  },
  {
    id: 'fornecedores',
    nome: 'Nº de fornecedores',
    direcao: 'menor',
    categorico: false,
    ajuda: 'Menos fornecedores = mais risco (1 = fonte única).',
  },
  {
    id: 'substituto',
    nome: 'Sem substituto',
    direcao: 'maior',
    categorico: true,
    ajuda: 'Item sem substituto = 1; com substituto = 0.',
  },
  {
    id: 'custo_parada',
    nome: 'Custo de parada (R$/h)',
    direcao: 'maior',
    categorico: false,
    ajuda: 'Custo de a máquina parar por falta do item.',
  },
  {
    id: 'equipamentos',
    nome: 'Nº de equipamentos atendidos',
    direcao: 'maior',
    categorico: false,
    ajuda: 'Quantos equipamentos usam o item (aba OndeUsado).',
  },
  {
    id: 'cv',
    nome: 'Variabilidade (CV)',
    direcao: 'maior',
    categorico: false,
    ajuda:
      'Peso padrão 0: a variabilidade já é o eixo XYZ da matriz; colocá-la no score conta duas vezes.',
  },
]

export const PRESETS: Record<
  'classico' | 'producao' | 'mro',
  { nome: string; pesos: Record<IdCriterio, number> }
> = {
  classico: { nome: 'Clássico (só valor)', pesos: { valor: 1 } },
  producao: {
    nome: 'Produção/MRP',
    pesos: { valor: 0.4, lead_time: 0.25, criticidade: 0.25, fornecedores: 0.1 },
  },
  mro: {
    nome: 'Manutenção (MRO)',
    pesos: { criticidade: 0.35, lead_time: 0.25, valor: 0.2, substituto: 0.1, fornecedores: 0.1 },
  },
}

export const MATRIZ_VED_PADRAO: ConfigMulticriterio['matrizVED'] = {
  A: { V: 'A', E: 'A', D: 'B' },
  B: { V: 'A', E: 'B', D: 'C' },
  C: { V: 'B', E: 'C', D: 'C' },
}

export const REGRA_PISO_EXEMPLO: RegraPiso = {
  id: 'piso-1',
  ativa: false,
  criticidadeMin: 1,
  semSubstituto: true,
  leadTimeMaiorQue: 60,
  classeMinima: 'B',
}

export const CONFIG_MC_PADRAO: ConfigMulticriterio = {
  ativo: false,
  modo: 'ponderado',
  normalizacao: 'posto',
  pesos: { ...PRESETS.producao.pesos },
  direcoes: {},
  metodoClasses: 'mesma_contagem',
  percentuais: { A: 0.2, B: 0.3 },
  cortes: { A: 0.6, B: 0.35 },
  regras: [REGRA_PISO_EXEMPLO],
  matrizVED: MATRIZ_VED_PADRAO,
  simulacoes: 500,
  perturbacao: 0.1,
  ahp: null,
}

export function completarConfigMC(c: Partial<ConfigMulticriterio> = {}): ConfigMulticriterio {
  return {
    ...CONFIG_MC_PADRAO,
    ...c,
    pesos: { ...(c.pesos ?? CONFIG_MC_PADRAO.pesos) },
    direcoes: { ...c.direcoes },
    percentuais: { ...CONFIG_MC_PADRAO.percentuais, ...c.percentuais },
    cortes: { ...CONFIG_MC_PADRAO.cortes, ...c.cortes },
    regras: (c.regras ?? CONFIG_MC_PADRAO.regras).map((r) => ({ ...r })),
    matrizVED: {
      A: { ...MATRIZ_VED_PADRAO.A, ...c.matrizVED?.A },
      B: { ...MATRIZ_VED_PADRAO.B, ...c.matrizVED?.B },
      C: { ...MATRIZ_VED_PADRAO.C, ...c.matrizVED?.C },
    },
  }
}

export function nomeCriterio(id: IdCriterio): string {
  const base = CRITERIOS_BASE.find((c) => c.id === id)
  if (base) return base.nome
  if (!id.startsWith('crit_')) return id
  const nome = id.slice(5).replace(/_/g, ' ')
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} (critério próprio)`
}

// ---------------------------------------------------------------------------
// Criticidade

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/**
 * Criticidade como número 0–1 (1 = mais crítico).
 * Alta/A/V/5 = 1; Média/B/E/3 = 0,5; Baixa/C/D/1 = 0; escala 1–5 → (x − 1) ÷ 4.
 * Retorna null se vazio ou não reconhecido.
 */
export function interpretarCriticidade(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v >= 1 && v <= 5 ? (v - 1) / 4 : null
  const s = semAcento(String(v)).replace(/[.\s]+/g, ' ')
  if (!s) return null
  if (/^[1-5]([.,]0+)?$/.test(s)) return (Number(s.replace(',', '.')) - 1) / 4
  if (['alta', 'alto', 'a', 'v', 'vital', 'critica', 'critico', 'muito alta'].includes(s)) return 1
  if (['media', 'medio', 'b', 'e', 'essencial', 'moderada'].includes(s)) return 0.5
  if (['baixa', 'baixo', 'c', 'd', 'desejavel'].includes(s)) return 0
  return null
}

export function rotuloCriticidade(n: number | null): string {
  if (n === null) return 'não informada'
  if (n >= 0.999) return 'Alta'
  if (Math.abs(n - 0.5) < 1e-9) return 'Média'
  if (n <= 1e-9) return 'Baixa'
  return `nível ${Math.round(n * 4 + 1)} de 5`
}

/** V (Vital) ≥ 0,75; E (Essencial) ≥ 0,25; D (Desejável) abaixo. Sem dado → E (neutro). */
export function classeVED(n: number | null): ClasseVED {
  if (n === null) return 'E'
  return n >= 0.75 ? 'V' : n >= 0.25 ? 'E' : 'D'
}

export const NOME_VED: Record<ClasseVED, string> = { V: 'Vital', E: 'Essencial', D: 'Desejável' }

// ---------------------------------------------------------------------------
// Normalização

/**
 * Posto percentil: (posição no ranking crescente − 1) ÷ (n − 1); empates recebem a média
 * dos postos. Valores null recebem 0,5 (neutro). Com um único valor, 0,5.
 */
export function normalizarPosto(valores: readonly (number | null)[]): number[] {
  const presentes = valores
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null && Number.isFinite(x.v))
    .sort((a, b) => a.v - b.v)
  const saida = valores.map(() => 0.5)
  const n = presentes.length
  if (n <= 1) return saida
  let k = 0
  while (k < n) {
    let j = k
    while (j + 1 < n && presentes[j + 1].v === presentes[k].v) j++
    const postoMedio = (k + j) / 2 // posições 0-based → (posição − 1)
    for (let t = k; t <= j; t++) saida[presentes[t].i] = postoMedio / (n - 1)
    k = j + 1
  }
  return saida
}

/** Mín-máx: (x − mín) ÷ (máx − mín). Null → 0,5; todos iguais → 0,5. */
export function normalizarMinMax(valores: readonly (number | null)[]): number[] {
  const ok = valores.filter((v): v is number => v !== null && Number.isFinite(v))
  if (!ok.length) return valores.map(() => 0.5)
  const min = Math.min(...ok)
  const max = Math.max(...ok)
  return valores.map((v) =>
    v === null || !Number.isFinite(v) || max === min ? 0.5 : (v - min) / (max - min),
  )
}

// ---------------------------------------------------------------------------
// AHP (Saaty)

export const INDICE_ALEATORIO: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
}

export interface SaidaAHP {
  pesos: number[]
  lambdaMax: number
  ci: number
  cr: number
  /** Par (i, j) cuja comparação mais destoa dos pesos resultantes. */
  parMaisContraditorio: { i: number; j: number; informado: number; implicito: number } | null
}

/**
 * Pesos pela média geométrica das linhas (normalizada). λmáx ≈ média de (A·w)ᵢ ÷ wᵢ;
 * CI = (λmáx − n) ÷ (n − 1); CR = CI ÷ RI.
 */
export function calcularAHP(A: readonly (readonly number[])[]): SaidaAHP {
  const n = A.length
  const geo = A.map((linha) => Math.exp(linha.reduce((s, x) => s + Math.log(x), 0) / n))
  const soma = geo.reduce((s, x) => s + x, 0)
  const w = geo.map((g) => g / soma)
  const Aw = A.map((linha) => linha.reduce((s, x, j) => s + x * w[j], 0))
  const lambdaMax = Aw.reduce((s, x, i) => s + x / w[i], 0) / n
  const ci = n > 1 ? (lambdaMax - n) / (n - 1) : 0
  const ri = INDICE_ALEATORIO[n] ?? 1.45
  const cr = ri > 0 ? Math.max(0, ci / ri) : 0
  let par: SaidaAHP['parMaisContraditorio'] = null
  let maior = 0
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const desvio = Math.abs(Math.log(A[i][j] / (w[i] / w[j])))
      if (desvio > maior + 1e-12) {
        maior = desvio
        par = { i, j, informado: A[i][j], implicito: w[i] / w[j] }
      }
    }
  return { pesos: w, lambdaMax, ci, cr, parMaisContraditorio: maior > 1e-9 ? par : null }
}

/** Monta a matriz recíproca a partir dos valores acima da diagonal (a[i][j], i < j). */
export function matrizReciproca(n: number, acima: (i: number, j: number) => number): number[][] {
  const M = Array.from({ length: n }, () => new Array<number>(n).fill(1))
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      M[i][j] = acima(i, j)
      M[j][i] = 1 / M[i][j]
    }
  return M
}

export function registroAHP(criterios: IdCriterio[], matriz: number[][]): ResultadoAHP {
  const r = calcularAHP(matriz)
  return { criterios, matriz, pesos: r.pesos, lambdaMax: r.lambdaMax, ci: r.ci, cr: r.cr }
}

// ---------------------------------------------------------------------------
// Preparação: criticidade efetiva (item ou equipamentos) e equipamentos atendidos

export interface DadosMC {
  criticidade: number | null
  /** null quando a planilha não tem a aba OndeUsado. */
  equipamentos: string[] | null
}

export function prepararDadosMC(
  materiais: readonly Material[],
  equipamentos: readonly Equipamento[],
  ondeUsado: readonly OndeUsado[],
): { porCodigo: Map<string, DadosMC>; avisos: ProblemaQualidade[] } {
  const avisos: ProblemaQualidade[] = []
  const critEquip = new Map<string, number | null>()
  for (const e of equipamentos) {
    const nome = (e.equipamento ?? '').trim()
    if (!nome) continue
    const c = interpretarCriticidade(e.criticidade)
    if (c === null && e.criticidade !== undefined && String(e.criticidade).trim() !== '') {
      avisos.push({
        regra: 'mc_criticidade_invalida',
        gravidade: 'aviso',
        aba: 'Equipamentos',
        linha: e.linha,
        mensagem: `Equipamento "${nome}": criticidade "${e.criticidade}" não reconhecida (use Alta/Média/Baixa, A/B/C, V/E/D ou 1 a 5).`,
      })
    }
    critEquip.set(nome, c)
  }
  const cadastrados = new Set(materiais.map((m) => m.codigo))
  const usados = new Map<string, Set<string>>()
  for (const u of ondeUsado) {
    const codigo = (u.codigo ?? '').trim()
    const eq = (u.equipamento ?? '').trim()
    if (!codigo || !eq || !cadastrados.has(codigo)) {
      avisos.push({
        regra: 'mc_onde_usado_invalido',
        gravidade: 'aviso',
        aba: 'OndeUsado',
        linha: u.linha,
        codigo,
        mensagem: `Linha ${u.linha ?? '?'}: ${!codigo || !eq ? 'código ou equipamento vazio' : `código "${codigo}" sem cadastro em Materiais`}. Linha ignorada.`,
      })
      continue
    }
    if (equipamentos.length && !critEquip.has(eq)) {
      avisos.push({
        regra: 'mc_onde_usado_invalido',
        gravidade: 'aviso',
        aba: 'OndeUsado',
        linha: u.linha,
        codigo,
        mensagem: `Linha ${u.linha ?? '?'}: equipamento "${eq}" não está na aba Equipamentos (conta como atendido, sem criticidade).`,
      })
    }
    const s = usados.get(codigo) ?? new Set<string>()
    s.add(eq)
    usados.set(codigo, s)
  }
  const temOndeUsado = ondeUsado.length > 0
  const porCodigo = new Map<string, DadosMC>()
  for (const m of materiais) {
    let crit = interpretarCriticidade(m.criticidade)
    if (crit === null && m.criticidade !== undefined && String(m.criticidade).trim() !== '') {
      avisos.push({
        regra: 'mc_criticidade_invalida',
        gravidade: 'aviso',
        aba: 'Materiais',
        linha: m.linha,
        codigo: m.codigo,
        mensagem: `Item "${m.codigo}": criticidade "${m.criticidade}" não reconhecida (use Alta/Média/Baixa, A/B/C, V/E/D ou 1 a 5).`,
      })
    }
    const eqs = usados.get(m.codigo)
    if (crit === null && eqs) {
      // Cadastro do item prevalece; sem ele, vale a maior criticidade dos equipamentos atendidos.
      let max: number | null = null
      for (const e of eqs) {
        const c = critEquip.get(e) ?? null
        if (c !== null && (max === null || c > max)) max = c
      }
      crit = max
    }
    porCodigo.set(m.codigo, {
      criticidade: crit,
      equipamentos: temOndeUsado ? [...(eqs ?? [])].sort() : null,
    })
  }
  return { porCodigo, avisos }
}

// ---------------------------------------------------------------------------
// Classificação

export interface EntradaMC {
  codigo: string
  classeValor: ClasseABC
  valorAnual: number
  leadTime: number
  cv: number | null
  criticidade: number | null
  equipamentos: string[] | null
  fornecedores: number | null
  substituto: boolean | null
  custoParada: number | null
  criterios: Record<string, number>
  classeManual: ClasseABC | null
  justificativa: string | null
}

export interface SaidaMC {
  porItem: Map<string, ItemMulticriterio>
  resumo: ResumoMulticriterio
  avisos: ProblemaQualidade[]
}

const ORDEM: Record<ClasseABC, number> = { A: 0, B: 1, C: 2 }

const n2 = (x: number) => x.toFixed(2).replace('.', ',')
const fmtNum = (x: number, casas = 0) =>
  x.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas })

function valorBruto(e: EntradaMC, id: IdCriterio): number | boolean | null {
  switch (id) {
    case 'valor':
      return e.valorAnual
    case 'lead_time':
      return e.leadTime
    case 'cv':
      return e.cv
    case 'equipamentos':
      return e.equipamentos === null ? null : e.equipamentos.length
    case 'criticidade':
      return e.criticidade
    case 'fornecedores':
      return e.fornecedores
    case 'substituto':
      return e.substituto
    case 'custo_parada':
      return e.custoParada
    default:
      if (id.startsWith('crit_')) {
        const v = e.criterios[id.slice(5)]
        return v === undefined || !Number.isFinite(v) ? null : v
      }
      return null
  }
}

function brutoExibicao(id: IdCriterio, v: number | boolean | null): number | string | null {
  if (v === null) return null
  if (id === 'criticidade') return rotuloCriticidade(v as number)
  if (id === 'substituto') return v ? 'Sim' : 'Não'
  return v as number
}

function textoCriterio(id: IdCriterio, v: number | boolean | null, normalizado: number): string {
  if (v === null) return `sem dado de ${nomeCriterio(id).toLowerCase()}`
  switch (id) {
    case 'valor':
      return `valor ${normalizado >= 0.67 ? 'alto' : normalizado >= 0.33 ? 'intermediário' : 'baixo'}`
    case 'lead_time':
      return `lead time de ${fmtNum(v as number)} dias`
    case 'cv':
      return `CV ${n2(v as number)}`
    case 'equipamentos':
      return `${fmtNum(v as number)} equipamento${v === 1 ? '' : 's'} atendido${v === 1 ? '' : 's'}`
    case 'criticidade':
      return `criticidade ${rotuloCriticidade(v as number)}`
    case 'fornecedores':
      return v === 1 ? 'fonte única' : `${fmtNum(v as number)} fornecedores`
    case 'substituto':
      return v ? 'com substituto' : 'sem substituto'
    case 'custo_parada':
      return `parada de R$ ${fmtNum(v as number, 2)}/h`
    default:
      return `${nomeCriterio(id)} ${fmtNum(v as number, 2)}`
  }
}

export function descreverRegra(r: RegraPiso): string {
  const conds: string[] = []
  if (r.criticidadeMin !== null)
    conds.push(
      `criticidade ${r.criticidadeMin >= 0.999 ? 'Alta' : `≥ ${rotuloCriticidade(r.criticidadeMin)}`}`,
    )
  if (r.semSubstituto) conds.push('sem substituto')
  if (r.leadTimeMaiorQue !== null) conds.push(`lead time > ${fmtNum(r.leadTimeMaiorQue)} dias`)
  const se = conds.length ? conds.join(', ').replace(/, ([^,]*)$/, ' e $1') : 'todos os itens'
  return `${se} → nunca abaixo de ${r.classeMinima}`
}

function regraAtende(r: RegraPiso, e: EntradaMC): boolean {
  if (!r.ativa) return false
  if (
    r.criticidadeMin !== null &&
    (e.criticidade === null || e.criticidade < r.criticidadeMin - 1e-9)
  )
    return false
  if (r.semSubstituto && e.substituto !== false) return false
  if (r.leadTimeMaiorQue !== null && !(e.leadTime > r.leadTimeMaiorQue)) return false
  return true
}

/** Aplica regras de piso e classe manual sobre a classe calculada. */
function ajustarClasse(
  calc: ClasseABC,
  e: EntradaMC,
  regras: readonly RegraPiso[],
): { classe: ClasseABC; regra: RegraPiso | null } {
  let classe = calc
  let regra: RegraPiso | null = null
  for (const r of regras) {
    if (regraAtende(r, e) && ORDEM[r.classeMinima] < ORDEM[classe]) {
      classe = r.classeMinima
      regra = r
    }
  }
  if (e.classeManual) return { classe: e.classeManual, regra: null }
  return { classe, regra }
}

/** Distribui classes pelo score conforme o método escolhido. */
function classesPorScore(
  scores: readonly number[],
  desempate: readonly number[],
  codigos: readonly string[],
  config: ConfigMulticriterio,
  contagem: { A: number; B: number },
): { classes: ClasseABC[]; posicoes: number[] } {
  const n = scores.length
  const classes = new Array<ClasseABC>(n).fill('C')
  const posicoes = new Array<number>(n).fill(0)
  const ordem = scores.map((_, i) => i)
  ordem.sort(
    (a, b) =>
      scores[b] - scores[a] || desempate[b] - desempate[a] || (codigos[a] < codigos[b] ? -1 : 1),
  )
  ordem.forEach((i, pos) => (posicoes[i] = pos + 1))
  if (config.metodoClasses === 'cortes') {
    for (let i = 0; i < n; i++)
      classes[i] =
        scores[i] >= config.cortes.A - 1e-12
          ? 'A'
          : scores[i] >= config.cortes.B - 1e-12
            ? 'B'
            : 'C'
    return { classes, posicoes }
  }
  const nA = contagem.A
  const nB = contagem.B
  ordem.forEach((i, pos) => (classes[i] = pos < nA ? 'A' : pos < nA + nB ? 'B' : 'C'))
  return { classes, posicoes }
}

/** Gerador pseudoaleatório determinístico (mulberry32): estabilidade reprodutível. */
function rng(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Critérios presentes nos dados (base + crit_<nome> encontrados). */
export function criteriosDisponiveis(itens: readonly EntradaMC[]): IdCriterio[] {
  const proprios = new Set<string>()
  for (const e of itens) for (const k of Object.keys(e.criterios)) proprios.add(`crit_${k}`)
  return [...CRITERIOS_BASE.map((c) => c.id), ...[...proprios].sort()]
}

export function direcaoCriterio(id: IdCriterio, config: ConfigMulticriterio): 'maior' | 'menor' {
  const base = CRITERIOS_BASE.find((c) => c.id === id)
  if (base) return base.direcao
  return config.direcoes[id] ?? 'maior'
}

export function classificarMulticriterio(
  itens: readonly EntradaMC[],
  config: ConfigMulticriterio,
): SaidaMC {
  const n = itens.length
  const avisos: ProblemaQualidade[] = []
  const disponiveis = criteriosDisponiveis(itens)
  const codigos = itens.map((e) => e.codigo)

  // Pesos efetivos (somente > 0, renormalizados).
  const ponderados =
    config.modo === 'ponderado' ? disponiveis.filter((id) => (config.pesos[id] ?? 0) > 0) : []
  const somaPesos = ponderados.reduce((s, id) => s + config.pesos[id], 0)
  const pesos: Record<IdCriterio, number> = {}
  for (const id of ponderados) pesos[id] = config.pesos[id] / somaPesos

  // Matriz normalizada (só critérios ponderados).
  const brutos = new Map<IdCriterio, (number | boolean | null)[]>()
  const norm = new Map<IdCriterio, number[]>()
  for (const id of ponderados) {
    const b = itens.map((e) => valorBruto(e, id))
    brutos.set(id, b)
    let nk: number[]
    if (id === 'criticidade') nk = b.map((v) => (v === null ? 0.5 : (v as number)))
    else if (id === 'substituto') nk = b.map((v) => (v === null ? 0.5 : v ? 0 : 1))
    else {
      const nums = b.map((v) => (v === null ? null : (v as number)))
      nk = config.normalizacao === 'minmax' ? normalizarMinMax(nums) : normalizarPosto(nums)
      if (direcaoCriterio(id, config) === 'menor')
        nk = nk.map((x, i) => (nums[i] === null ? 0.5 : 1 - x))
    }
    norm.set(id, nk)
    const faltando = codigos.filter((_, i) => b[i] === null)
    if (faltando.length) {
      avisos.push({
        regra: 'mc_dado_faltando',
        gravidade: 'aviso',
        aba: 'Materiais',
        mensagem: `Critério "${nomeCriterio(id)}": ${faltando.length} item(ns) sem dado receberam o valor neutro 0,5 (ex.: ${faltando.slice(0, 5).join(', ')}${faltando.length > 5 ? '…' : ''}).`,
      })
    }
  }

  const contagemValor = {
    A: itens.filter((e) => e.classeValor === 'A').length,
    B: itens.filter((e) => e.classeValor === 'B').length,
  }
  const contagem =
    config.metodoClasses === 'percentual'
      ? (() => {
          // Arredonda A e B sem ultrapassar o total de itens.
          const nA = Math.min(n, Math.max(0, Math.round(config.percentuais.A * n)))
          return { A: nA, B: Math.min(n - nA, Math.max(0, Math.round(config.percentuais.B * n))) }
        })()
      : contagemValor
  const desempate = itens.map((e) => e.valorAnual)

  // Score e classe calculada
  let scores: number[] = []
  let calc: ClasseABC[] = []
  let posicoes: (number | null)[] = itens.map(() => null)
  if (config.modo === 'ponderado') {
    scores = itens.map((_, i) => ponderados.reduce((s, id) => s + pesos[id] * norm.get(id)![i], 0))
    const r = classesPorScore(scores, desempate, codigos, config, contagem)
    calc = r.classes
    posicoes = r.posicoes
  } else {
    calc = itens.map((e) => config.matrizVED[e.classeValor][classeVED(e.criticidade)])
    const semCrit = itens.filter((e) => e.criticidade === null).map((e) => e.codigo)
    if (semCrit.length) {
      avisos.push({
        regra: 'mc_dado_faltando',
        gravidade: 'aviso',
        aba: 'Materiais',
        mensagem: `Matriz VED: ${semCrit.length} item(ns) sem criticidade foram tratados como Essencial (ex.: ${semCrit.slice(0, 5).join(', ')}${semCrit.length > 5 ? '…' : ''}).`,
      })
    }
  }

  const finais = itens.map((e, i) => ajustarClasse(calc[i], e, config.regras))
  for (const e of itens) {
    if (e.classeManual && !e.justificativa) {
      avisos.push({
        regra: 'mc_manual_sem_justificativa',
        gravidade: 'aviso',
        aba: 'Materiais',
        codigo: e.codigo,
        mensagem: `Item "${e.codigo}": classe manual ${e.classeManual} sem justificativa_classe. A classe manual foi aplicada; registre o motivo.`,
      })
    }
  }

  // Estabilidade: perturba cada peso em até ±perturbação, renormaliza e reclassifica.
  const estabilidade: (number | null)[] = itens.map(() => null)
  if (config.modo === 'ponderado' && ponderados.length && n > 0) {
    const iguais = new Array<number>(n).fill(0)
    const aleatorio = rng(20261119)
    const sims = Math.max(1, Math.round(config.simulacoes))
    const matriz = ponderados.map((id) => norm.get(id)!)
    for (let s = 0; s < sims; s++) {
      const w = ponderados.map((id) =>
        Math.max(0, pesos[id] + (aleatorio() * 2 - 1) * config.perturbacao),
      )
      const soma = w.reduce((a, b) => a + b, 0) || 1
      const sc = new Array<number>(n)
      for (let i = 0; i < n; i++) {
        let t = 0
        for (let k = 0; k < w.length; k++) t += (w[k] / soma) * matriz[k][i]
        sc[i] = t
      }
      const { classes } = classesPorScore(sc, desempate, codigos, config, contagem)
      for (let i = 0; i < n; i++)
        if (ajustarClasse(classes[i], itens[i], config.regras).classe === finais[i].classe)
          iguais[i]++
    }
    for (let i = 0; i < n; i++) estabilidade[i] = iguais[i] / sims
  }

  // Monta o detalhe por item
  const porItem = new Map<string, ItemMulticriterio>()
  let subiram = 0
  let desceram = 0
  let instaveis = 0
  const fluxos = new Map<string, number>()
  itens.forEach((e, i) => {
    const criterios: CriterioDoItem[] = ponderados.map((id) => {
      const b = brutos.get(id)![i]
      const nk = norm.get(id)![i]
      return {
        id,
        nome: nomeCriterio(id),
        bruto: brutoExibicao(id, b),
        normalizado: nk,
        peso: pesos[id],
        contribuicao: pesos[id] * nk,
        faltando: b === null,
      }
    })
    const final = finais[i].classe
    const mudou =
      ORDEM[final] < ORDEM[e.classeValor]
        ? 'subiu'
        : ORDEM[final] > ORDEM[e.classeValor]
          ? 'desceu'
          : null
    if (mudou === 'subiu') subiram++
    if (mudou === 'desceu') desceram++
    if (estabilidade[i] !== null && estabilidade[i]! < 0.7) instaveis++
    const chave = `${e.classeValor}>${final}`
    fluxos.set(chave, (fluxos.get(chave) ?? 0) + 1)

    let motivo: string
    const ved = classeVED(e.criticidade)
    if (e.classeManual)
      motivo = `Classe manual ${e.classeManual}${e.justificativa ? `: ${e.justificativa}` : ' (sem justificativa)'}.`
    else if (finais[i].regra)
      motivo = `Regra de piso (${descreverRegra(finais[i].regra!)}); o cálculo indicava ${calc[i]}.`
    else if (config.modo === 'ved')
      motivo = `Matriz VED: valor ${e.classeValor} × ${NOME_VED[ved]} → ${final}.`
    else motivo = motivoPonderado(e, criterios, mudou, final, scores[i])

    porItem.set(e.codigo, {
      score: config.modo === 'ponderado' ? scores[i] : null,
      posicao: posicoes[i],
      criterios,
      criticidade: e.criticidade,
      ved,
      equipamentos: e.equipamentos ?? [],
      classeValor: e.classeValor,
      classeCalculada: calc[i],
      classeFinal: final,
      regraAplicada: finais[i].regra ? descreverRegra(finais[i].regra!) : null,
      manual: Boolean(e.classeManual),
      justificativa: e.justificativa,
      mudou,
      motivo,
      estabilidade: estabilidade[i],
    })
  })

  const resumo: ResumoMulticriterio = {
    config,
    pesos,
    criterios: disponiveis.map((id) => ({
      id,
      nome: nomeCriterio(id),
      itensComDado: itens.filter((e) => valorBruto(e, id) !== null).length,
      direcao: direcaoCriterio(id, config),
    })),
    subiram,
    desceram,
    instaveis,
    fluxos: [...fluxos.entries()].map(([k, itensFluxo]) => ({
      de: k[0] as ClasseABC,
      para: k[2] as ClasseABC,
      itens: itensFluxo,
    })),
  }
  return { porItem, resumo, avisos }
}

function motivoPonderado(
  e: EntradaMC,
  criterios: CriterioDoItem[],
  mudou: 'subiu' | 'desceu' | null,
  final: ClasseABC,
  score: number,
): string {
  const texto = (c: CriterioDoItem) => {
    const v = valorBruto(e, c.id)
    return textoCriterio(c.id, v, c.normalizado)
  }
  const valor = criterios.find((c) => c.id === 'valor')
  const outros = criterios.filter((c) => c.id !== 'valor')
  if (mudou === 'subiu') {
    // Só cita como causa da subida critérios em que o item está acima do neutro (normalizado > 0,5).
    const fortes = [...outros]
      .sort((a, b) => b.contribuicao - a.contribuicao)
      .filter((c) => c.contribuicao > 0 && c.normalizado > 0.5 && !c.faltando)
      .slice(0, 2)
    const partes = fortes.map((c) => `${texto(c)} (+${n2(c.contribuicao)})`)
    const lista =
      partes.length === 2 ? `${partes[0]} e ${partes[1]}` : (partes[0] ?? 'os demais critérios')
    const verbo = partes.length === 2 ? 'compensam' : 'compensa'
    return valor
      ? `Subiu de ${e.classeValor} para ${final}: ${lista} ${verbo} o ${texto(valor)} (+${n2(valor.contribuicao)}).`
      : `Subiu de ${e.classeValor} para ${final}: ${lista}.`
  }
  if (mudou === 'desceu') {
    const fracos = [...outros]
      .sort((a, b) => b.peso - b.contribuicao - (a.peso - a.contribuicao))
      .slice(0, 2)
    // Mostra quanto cada critério fraco somou do máximo possível (o próprio peso).
    const partes = fracos.map(
      (c) => `${texto(c)} (+${n2(c.contribuicao)} de ${n2(c.peso)} possíveis)`,
    )
    const lista =
      partes.length === 2 ? `${partes[0]} e ${partes[1]}` : (partes[0] ?? 'os demais critérios')
    return valor
      ? `Desceu de ${e.classeValor} para ${final}: o ${texto(valor)} (+${n2(valor.contribuicao)}) não compensa ${lista}.`
      : `Desceu de ${e.classeValor} para ${final}: ${lista}.`
  }
  return `Mantém a classe ${final} (score ${n2(score)}).`
}
