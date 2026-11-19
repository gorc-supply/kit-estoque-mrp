// Tipos do motor de cálculo (CLAUDE.md, seções 5 e 6).
// O engine/ é TypeScript puro: nada de React, nada de DOM.
//
// Convenção de datas: todas as datas são objetos Date à meia-noite UTC
// (Date.UTC(aaaa, mm, dd)). A camada io/ é responsável por normalizar.

export type TipoMovimento =
  'Entrada' | 'Saída' | 'Ajuste +' | 'Ajuste -' | 'Devolução ao estoque' | 'Devolução ao fornecedor'

export const TIPOS_MOVIMENTO: readonly TipoMovimento[] = [
  'Entrada',
  'Saída',
  'Ajuste +',
  'Ajuste -',
  'Devolução ao estoque',
  'Devolução ao fornecedor',
]

export type TipoItem = 'Comprado' | 'Fabricado'

/** Linha da aba Materiais já com colunas mapeadas (valores podem estar inválidos: a validação é do engine). */
export interface Material {
  codigo: string
  descricao: string
  unidade: string
  /** NaN quando ausente ou não numérico. */
  estoqueAtual: number
  custoUnitario?: number
  leadTimeDias?: number
  desvioLeadTimeDias?: number
  loteMinimo?: number
  multiploCompra?: number
  estoqueSegurancaManual?: number
  fornecedor?: string
  categoria?: string
  tipoItem?: TipoItem
  dataCadastro?: Date
  // --- ABC multicritério (seção 16-B), todos opcionais
  /** Texto ou número como veio da planilha: Alta/Média/Baixa, A/B/C, V/E/D ou 1–5. */
  criticidade?: string | number
  numFornecedores?: number
  /** true = possui substituto; false = não possui; undefined = não informado. */
  possuiSubstituto?: boolean
  custoParadaHora?: number
  classeManual?: ClasseABC
  justificativaClasse?: string
  /** Critérios próprios da empresa (colunas crit_<nome>), por nome sem o prefixo. */
  criterios?: Record<string, number>
  /** Linha de origem na planilha (1 = cabeçalho). */
  linha?: number
}

export interface Equipamento {
  equipamento: string
  criticidade?: string | number
  setor?: string
  linha?: number
}

export interface OndeUsado {
  codigo: string
  equipamento: string
  linha?: number
}

export interface Movimento {
  /** null quando a data é inválida. */
  data: Date | null
  codigo: string
  /** null quando o tipo não foi reconhecido. */
  tipo: TipoMovimento | null
  /** Texto original do tipo, para mensagens. */
  tipoOriginal?: string
  /** O tipo foi inferido com ambiguidade (ex.: "Devolução" sem destino, códigos SAP). */
  tipoAmbiguo?: string
  /** NaN quando não numérica. */
  quantidade: number
  valorTotal?: number
  documento?: string
  linha?: number
}

export interface PedidoAberto {
  codigo: string
  dataPrevista: Date | null
  quantidade: number
  linha?: number
}

export interface ItemBOM {
  codigoPai: string
  codigoFilho: string
  quantidadePor: number
  /** Fração (0,05 = 5%). */
  perdaPct: number
  linha?: number
}

export interface ItemMPS {
  codigo: string
  semanaInicio: Date | null
  quantidade: number
  linha?: number
}

export interface Entrada {
  materiais: Material[]
  movimentacoes: Movimento[]
  pedidosAbertos: PedidoAberto[]
  bom: ItemBOM[]
  mps: ItemMPS[]
  /** Abas opcionais do ABC multicritério (seção 16-B). */
  equipamentos?: Equipamento[]
  ondeUsado?: OndeUsado[]
  /** Problemas detectados na leitura (io/), somados ao relatório de qualidade. */
  problemasLeitura?: ProblemaQualidade[]
}

// ---------------------------------------------------------------------------
// Parâmetros (seção 6.1)

export type Periodicidade = 'mensal' | 'semanal'
export type ClasseABC = 'A' | 'B' | 'C'
export type ClasseXYZ = 'X' | 'Y' | 'Z' | 'N' | 'Novo'
export type PadraoDemanda = 'Suave' | 'Errático' | 'Intermitente' | 'Irregular'
export type PoliticaLote = 'lote_economico' | 'lote_a_lote' | 'periodo_fixo'
export type MetodoPrevisaoModo = 'regra_fixa' | 'automatico'
export type BaseABC = 'valor_consumo' | 'quantidade' | 'valor_estoque'

/** Matriz de nível de serviço: niveis[ABC][XYZ] como fração (0,98). */
export type MatrizNivelServico = Record<ClasseABC, Record<'X' | 'Y' | 'Z', number>>

export interface Parametros {
  periodicidade: Periodicidade
  janelaPeriodos: number
  excluirPeriodoIncompleto: boolean
  corteA: number
  corteB: number
  corteX: number
  corteY: number
  corteADI: number
  corteCV2: number
  minPeriodos: number
  periodosMediaMovel: number
  alphaSBA: number
  /** Dias por período; se null, 30 (mensal) ou 7 (semanal). */
  diasPorPeriodo: number | null
  custoPedido: number
  taxaManutencaoAnual: number
  diasSemGiro: number
  abaterDevolucoes: boolean
  horizonteMRP: number
  politicaLote: PoliticaLote
  /** Número de semanas cobertas por pedido na política de período fixo (POQ). */
  periodoFixoSemanas: number
  /** Data-base; se null, data da última movimentação válida. */
  dataBase: Date | null
  metodoPrevisao: MetodoPrevisaoModo
  nivelServico: MatrizNivelServico
  /** Lead time usado quando o item não tem (com aviso). */
  leadTimePadraoDias: number
  /** ABC multicritério (seção 16-B). Desligado por padrão. */
  multicriterio: ConfigMulticriterio
}

// ---------------------------------------------------------------------------
// ABC multicritério (seção 16-B)

export type ModoMulticriterio = 'ponderado' | 'ved'
export type Normalizacao = 'posto' | 'minmax'
export type MetodoClasses = 'mesma_contagem' | 'percentual' | 'cortes'
export type ClasseVED = 'V' | 'E' | 'D'
/** valor, lead_time, cv, equipamentos, criticidade, fornecedores, substituto, custo_parada ou crit_<nome>. */
export type IdCriterio = string

export interface RegraPiso {
  id: string
  ativa: boolean
  /** Criticidade mínima (0–1: Alta = 1, Média = 0,5); null = não exige. */
  criticidadeMin: number | null
  semSubstituto: boolean
  /** Lead time estritamente maior que (dias); null = não exige. */
  leadTimeMaiorQue: number | null
  classeMinima: 'A' | 'B'
}

export interface ResultadoAHP {
  criterios: IdCriterio[]
  matriz: number[][]
  pesos: number[]
  lambdaMax: number
  ci: number
  cr: number
}

export interface ConfigMulticriterio {
  ativo: boolean
  modo: ModoMulticriterio
  normalizacao: Normalizacao
  /** Pesos por critério (frações; o motor renormaliza para somar 1). */
  pesos: Record<IdCriterio, number>
  /** Direção dos critérios crit_<nome>: 'maior' (padrão) ou 'menor' = mais crítico. */
  direcoes: Record<IdCriterio, 'maior' | 'menor'>
  metodoClasses: MetodoClasses
  /** Frações de itens em A e B (método percentual). */
  percentuais: { A: number; B: number }
  /** Cortes de score (método cortes): A ≥ A; B ≥ B. */
  cortes: { A: number; B: number }
  regras: RegraPiso[]
  /** Matriz VED: classe final por classe de valor × criticidade. */
  matrizVED: Record<ClasseABC, Record<ClasseVED, ClasseABC>>
  simulacoes: number
  /** Perturbação máxima de cada peso nas simulações (fração: 0,10 = ±10 p.p.). */
  perturbacao: number
  /** Última matriz AHP aplicada (para registro na planilha). */
  ahp: ResultadoAHP | null
}

// ---------------------------------------------------------------------------
// Qualidade (seção 7)

export type Gravidade = 'erro' | 'aviso'

export type RegraQualidade =
  | 'sem_materiais'
  | 'material_sem_codigo'
  | 'codigo_duplicado'
  | 'estoque_invalido'
  | 'mov_sem_cadastro'
  | 'data_invalida'
  | 'data_futura'
  | 'quantidade_invalida'
  | 'tipo_desconhecido'
  | 'tipo_ambiguo'
  | 'item_sem_custo'
  | 'item_sem_lead_time'
  | 'saldo_negativo'
  | 'linha_duplicada'
  | 'pedido_invalido'
  | 'bom_invalida'
  | 'bom_circular'
  | 'mps_invalido'
  | 'coluna_ausente'
  | 'leitura'
  | 'mc_dado_faltando'
  | 'mc_criticidade_invalida'
  | 'mc_manual_sem_justificativa'
  | 'mc_onde_usado_invalido'

export interface ProblemaQualidade {
  regra: RegraQualidade
  gravidade: Gravidade
  aba: string
  linha?: number
  codigo?: string
  mensagem: string
}

export interface RelatorioQualidade {
  problemas: ProblemaQualidade[]
  bloqueante: boolean
  totalLinhas: number
  linhasValidas: number
  /** Fração de linhas válidas (0..1). */
  percentualValidas: number
  contagemPorRegra: Partial<Record<RegraQualidade, number>>
}

// ---------------------------------------------------------------------------
// Resultado

export interface Janela {
  periodicidade: Periodicidade
  /** Índice absoluto do primeiro e do último período da janela. */
  inicio: number
  fim: number
  /** Rótulos dos períodos (ex.: "jan/26" ou "S03/26"). */
  rotulos: string[]
  /** Data inicial de cada período da janela. */
  datasInicio: Date[]
  diasPorPeriodo: number
  periodosPorAno: number
}

export type OrigemCusto = 'cadastro' | 'media_entradas' | 'ultima_entrada' | 'sem_custo'

export type StatusItem =
  'Ruptura' | 'Crítico' | 'Comprar' | 'Excesso' | 'Sem giro' | 'Sem demanda' | 'OK'

export type Prioridade = 'Urgente' | 'Alta' | 'Média' | 'Baixa'

export type NomeMetodo = `MM${number}` | 'SES' | 'SBA' | 'Média do histórico' | 'Sem demanda'

export interface ErroMetodo {
  metodo: NomeMetodo
  alpha?: number
  previsoes: number[]
  reais: number[]
  mae: number
  rmse: number
  /** null quando Σreal = 0. */
  wmape: number | null
  vies: number | null
}

export interface Backtest {
  /** Índices (na série do item) dos períodos testados. */
  periodos: number[]
  metodos: ErroMetodo[]
  /** Método com menor MAE. */
  melhor: NomeMetodo | null
}

export interface ItemResultado {
  codigo: string
  descricao: string
  unidade: string
  unidadeDiscreta: boolean
  categoria: string
  fornecedor: string
  tipoItem: TipoItem
  estoqueAtual: number
  loteMinimo: number
  multiploCompra: number
  leadTimeDias: number
  leadTimePadrao: boolean
  desvioLeadTimeDias: number | null

  // Custo (6.2)
  custo: number
  origemCusto: OrigemCusto

  // Série (6.3)
  /** Índice (na janela) em que a série do item começa. */
  inicioSerie: number
  serie: number[]
  n: number
  consumoQtd: number
  consumoValor: number
  consumoAnualValor: number
  media: number
  desvio: number
  cv: number | null

  // ABC (6.4)
  classeABC: ClasseABC
  pctConsumo: number
  pctAcumulado: number
  pctAcumuladoAnterior: number
  posicaoABC: number
  classeABCQuantidade: ClasseABC
  classeABCValorEstoque: ClasseABC
  /** Classe pelo valor de consumo (ABC clássico). Com o multicritério desligado, = classeABC. */
  classeABCValor: ClasseABC
  /** Detalhe do ABC multicritério (null com o módulo desligado). */
  multicriterio: ItemMulticriterio | null

  // XYZ (6.5)
  classeXYZ: ClasseXYZ
  adi: number | null
  cv2: number | null
  padrao: PadraoDemanda | null
  classeCombinada: string
  historicoInsuficiente: boolean

  // Previsão (6.6 / 6.12d)
  metodo: NomeMetodo
  motivoMetodo: string
  alphaSES: number | null
  previsao: number
  backtest: Backtest | null
  wmape: number | null
  vies: number | null

  // Parâmetros (6.7)
  nivelServico: number | null
  z: number | null
  ltPeriodos: number
  sigmaLT: number
  estoqueSeguranca: number | null
  esManual: boolean
  pontoPedido: number | null
  demandaAnual: number
  custoManutencao: number
  eoq: number | null
  loteCompra: number | null
  origemLote: 'eoq' | 'um_periodo' | 'minimo'
  estoqueMaximo: number | null
  consumoDiario: number
  coberturaDias: number

  // 6.12a
  custoTotalEOQ: number | null
  custoTotalLote: number | null
  penalidadeArredondamento: number | null
  // 6.12b
  mediaLT: number
  probRupturaCiclo: number | null
  probFaltarAntesChegada: number | null
  probIndicativa: boolean
  // 6.12c
  perdaNormalG: number | null
  faltaEsperadaCiclo: number | null
  fillRate: number | null

  // Reposição (6.8)
  pedidosAbertos: number
  posicao: number
  status: StatusItem
  diasSemSaida: number | null
  sugestaoQtd: number
  sugestaoValor: number
  dataChegada: Date
  riscoAntesChegada: boolean
  prioridade: Prioridade | null
  motivo: string
  revisaoManual: string[]

  // Saldo (6.9)
  saldosFimPeriodo: number[]
  saldoInicial: number
  estoqueMedio: number
  giro: number | null
  saldoInconsistente: boolean

  // Similaridade (6.12g)
  parecidos: { codigo: string; similaridade: number }[]
}

export interface CriterioDoItem {
  id: IdCriterio
  nome: string
  /** Valor bruto (número, rótulo de criticidade, Sim/Não) ou null se faltou. */
  bruto: number | string | null
  /** Valor normalizado 0–1 (1 = mais crítico); 0,5 quando faltou. */
  normalizado: number
  peso: number
  contribuicao: number
  faltando: boolean
}

export interface ItemMulticriterio {
  score: number | null
  /** Posição pelo score (1 = mais crítico); null no modo VED. */
  posicao: number | null
  criterios: CriterioDoItem[]
  /** Criticidade efetiva (0–1) e seu rótulo; null se não informada. */
  criticidade: number | null
  ved: ClasseVED
  equipamentos: string[]
  classeValor: ClasseABC
  /** Classe antes da regra de piso e da classe manual. */
  classeCalculada: ClasseABC
  classeFinal: ClasseABC
  regraAplicada: string | null
  manual: boolean
  justificativa: string | null
  mudou: 'subiu' | 'desceu' | null
  motivo: string
  /** Fração das simulações em que a classe se manteve (null no modo VED). */
  estabilidade: number | null
}

export interface ResumoMulticriterio {
  config: ConfigMulticriterio
  /** Pesos efetivos (renormalizados) por critério. */
  pesos: Record<IdCriterio, number>
  criterios: { id: IdCriterio; nome: string; itensComDado: number; direcao: 'maior' | 'menor' }[]
  subiram: number
  desceram: number
  instaveis: number
  /** Fluxos classe por valor → classe final (para o Sankey). */
  fluxos: { de: ClasseABC; para: ClasseABC; itens: number }[]
}

export interface LinhaMRP {
  semana: number
  inicio: Date
  nb: number
  rp: number
  ep: number
  nl: number
  recPlan: number
  libPlan: number
  libAtraso: boolean
}

export interface RegistroMRP {
  codigo: string
  nivel: number
  ltSemanas: number
  estoqueSeguranca: number
  pontoPedido: number | null
  loteCompra: number | null
  origemNB: 'previsao' | 'mps' | 'dependente' | 'mps+dependente'
  semanas: LinhaMRP[]
  temLiberacaoAtraso: boolean
  /** Recebimentos programados com data anterior à semana 1 (lançados na semana 1). */
  pedidosAtrasados: number
}

export interface ResultadoMRP {
  comBOM: boolean
  horizonte: number
  semanas: { semana: number; inicio: Date; rotulo: string }[]
  registros: RegistroMRP[]
  /** Liberações planejadas consolidadas por semana. */
  consolidado: { semana: number; quantidade: number; valor: number }[]
  /** Conferência matricial da BOM (6.12f); null sem BOM. */
  matricial: MatricialBOM | null
}

export interface MatricialBOM {
  codigos: string[]
  /** B[i][j] = quantidade do item i para fazer uma unidade do item j (com perda). */
  matrizB: number[][]
  demandaIndependente: number[]
  requisitoTotal: number[]
  /** Total de necessidades brutas do MRP no horizonte (para conferência). */
  nbTotalMRP: number[]
}

export type TipoAlerta =
  | 'Ruptura'
  | 'Risco antes da chegada'
  | 'Liberação em atraso'
  | 'Crítico'
  | 'Excesso'
  | 'Sem giro'
  | 'Saldo inconsistente'
  | 'Revisão manual'
  | 'Sem custo'

export interface Alerta {
  tipo: TipoAlerta
  gravidade: 'alta' | 'media' | 'baixa'
  codigo: string
  mensagem: string
}

export interface KPIs {
  valorEstoque: number
  skusAtivos: number
  totalItens: number
  pctSkusA: number
  pctValorA: number
  giro: number | null
  coberturaMediaDias: number | null
  itensRuptura: number
  pctRuptura: number
  itensCriticos: number
  itensComprar: number
  valorSugestao: number
  valorExcesso: number
  valorSemGiro: number
  riscoAntesChegada: number
  nivelServicoMedio: number | null
  qualidadeDados: number
  wmapeMedio: number | null
  viesMedio: number | null
}

export interface SerieConsolidada {
  rotulos: string[]
  entradasValor: number[]
  saidasValor: number[]
  saldoValor: number[]
}

export interface CelulaMatriz {
  abc: ClasseABC
  xyz: 'X' | 'Y' | 'Z'
  itens: number
  valor: number
}

export interface Resultado {
  dataBase: Date
  parametros: Parametros
  janela: Janela
  qualidade: RelatorioQualidade
  itens: ItemResultado[]
  matriz: CelulaMatriz[]
  kpis: KPIs
  alertas: Alerta[]
  mrp: ResultadoMRP | null
  /** Erro amigável do MRP (ex.: BOM circular); o restante do cálculo segue. */
  erroMRP: string | null
  consolidado: SerieConsolidada
  /** Resumo do ABC multicritério (null com o módulo desligado). */
  multicriterio: ResumoMulticriterio | null
  tempoMs: number
}

export type AoProgresso = (etapa: string, fracao: number) => void
