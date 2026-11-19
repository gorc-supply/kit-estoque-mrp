// Planilha de saída (.xlsx) — CLAUDE.md, seção 11.
//
// Regras para o Excel abrir sem "aviso de reparo":
// - Os números são VALORES calculados (nada de fórmulas); a aba Leia-me explica cada fórmula.
// - Cores por status e por classe ABC vão como preenchimento direto na célula (o valor é conhecido).
// - Formatação condicional só na aba MRP_Semanal (EP < ES) e só dos tipos `cellIs`/`expression`.
// - Barras de dados (dataBar) ficam de fora de propósito: o ExcelJS grava extensões x14 que
//   costumam disparar o aviso de reparo, e elas não acrescentam informação ao que já está na célula.
// - Nenhuma célula recebe NaN ou Infinity (viram célula vazia ou o texto "∞").
// - Sem células mescladas e sem validações: menos partes no XML, menos chance de reparo.

import type ExcelJS from 'exceljs'
import { formatarData } from '../engine/datas'
import { arredondarQuantidade } from '../engine/estatistica'
import { sugestoesOrdenadas } from '../engine/index'
import { descreverRegra, NOME_VED, nomeCriterio, rotuloCriticidade } from '../engine/multicriterio'
import { DESCRICAO_REGRA } from '../engine/qualidade'
import type {
  ClasseABC,
  ConfigMulticriterio,
  IdCriterio,
  ItemResultado,
  KPIs,
  Parametros,
  Prioridade,
  RegistroMRP,
  Resultado,
  StatusItem,
} from '../engine/tipos'
import {
  COR_ACO,
  COR_CONCRETO,
  COR_MARINHO,
  COR_SEGURANCA,
  criarAbaTabela,
  dataParaExcel,
  estilizarCabecalho,
  FMT_DATA,
  FMT_DEC2,
  FMT_INT,
  FMT_MOEDA,
  FMT_PCT,
  type ModuloExcel,
} from './estilo-excel'

export interface OpcoesExportacao {
  /** Nome do arquivo enviado pelo usuário (ex.: 'demo-industria.xlsx'). */
  nomeArquivoOriginal: string
  /** Link da ferramenta, citado na aba Leia-me. */
  urlFerramenta: string
  /** Data usada no nome do arquivo e no "gerado em" (meia-noite UTC, convenção do engine). Padrão: hoje. */
  hoje?: Date
  /** Imagens PNG (data URL) dos gráficos, empilhadas na aba Dashboard. */
  imagens?: { titulo: string; dataUrl: string }[]
  /** Se informado, a aba Sugestao_Compras traz só estes códigos (linhas selecionadas na interface). */
  codigosCompras?: string[]
}

/** Nomes das abas, na ordem da seção 11. */
export const ABAS_SAIDA = [
  'Leia-me',
  'Dashboard',
  'ABC-XYZ',
  'ABC_Multicriterio',
  'Parametros_Reposicao',
  'Sugestao_Compras',
  'MRP_Semanal',
  'MRP_Consolidado',
  'Alertas',
  'Qualidade_Dados',
  'Parametros_Usados',
] as const

/** Texto da aba ABC_Multicriterio quando o módulo está desligado. */
export const MENSAGEM_MC_DESLIGADO =
  'Classificação multicritério desligada. Ligue em ABC-XYZ → Classificar por: Multicritério na ferramenta.'

// ---------------------------------------------------------------------------
// Paleta (seção 10), em ARGB

const BRANCO = 'FFFFFFFF'
const TEXTO_ESCURO = 'FF111827'
const FUNDO_CARTAO = 'FFF1F5F9'
const CINZA_NOTA = 'FF6B7280'

export const COR_STATUS: Record<StatusItem, { fundo: string; texto: string }> = {
  Ruptura: { fundo: 'FFDC2626', texto: BRANCO },
  Crítico: { fundo: 'FFDC2626', texto: BRANCO },
  Comprar: { fundo: 'FFF59E0B', texto: TEXTO_ESCURO },
  Excesso: { fundo: 'FF7C3AED', texto: BRANCO },
  'Sem giro': { fundo: 'FF6B7280', texto: BRANCO },
  'Sem demanda': { fundo: COR_CONCRETO, texto: TEXTO_ESCURO },
  OK: { fundo: 'FF16A34A', texto: BRANCO },
}

export const COR_CLASSE: Record<ClasseABC, { fundo: string; texto: string }> = {
  A: { fundo: 'FF1D4ED8', texto: BRANCO },
  B: { fundo: 'FF60A5FA', texto: TEXTO_ESCURO },
  C: { fundo: 'FF94A3B8', texto: TEXTO_ESCURO },
}

/** Vermelho claro para destacar valores que merecem atenção (preenchimento direto). */
const FUNDO_ALERTA = 'FFFECACA'
const TEXTO_ALERTA = 'FF991B1B'
const FMT_3 = '0.000'

const COR_PRIORIDADE: Partial<Record<Prioridade, { fundo: string; texto: string }>> = {
  Urgente: { fundo: 'FFDC2626', texto: BRANCO },
  Alta: { fundo: 'FFF59E0B', texto: TEXTO_ESCURO },
}

const COR_GRAVIDADE: Record<string, { fundo: string; texto: string }> = {
  alta: { fundo: 'FFDC2626', texto: BRANCO },
  media: { fundo: 'FFF59E0B', texto: TEXTO_ESCURO },
  erro: { fundo: 'FFDC2626', texto: BRANCO },
  aviso: { fundo: 'FFF59E0B', texto: TEXTO_ESCURO },
}

const ROTULO_GRAVIDADE: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
  erro: 'Erro',
  aviso: 'Aviso',
}

// ---------------------------------------------------------------------------
// Utilitários

/** Número seguro para a célula: NaN/±Infinity/null viram null (célula vazia). */
function n(v: number | null | undefined, casas?: number): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null
  if (casas === undefined) return v
  const f = 10 ** casas
  return Math.round(v * f) / f
}

/** Quantidade arredondada como na tela (para cima em discretas; 2 casas nas fracionáveis). */
function q(v: number | null | undefined, discreta: boolean): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null
  return n(arredondarQuantidade(v, discreta))
}

const fmtQtd = (discreta: boolean) => (discreta ? FMT_INT : FMT_DEC2)

/** Formato por valor: inteiro sem casas, fracionário com 2 casas. */
const fmtPorValor = (v: number | null) =>
  v !== null && Math.abs(v - Math.round(v)) < 1e-9 ? FMT_INT : FMT_DEC2

function pintar(cell: ExcelJS.Cell, cor: { fundo: string; texto: string }, negrito = false): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor.fundo } }
  cell.font = { bold: negrito, color: { argb: cor.texto } }
}

function preencher(cell: ExcelJS.Cell, argb: string): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

const simNao = (b: boolean) => (b ? 'Sim' : 'Não')

/** Data de hoje à meia-noite UTC, a partir do relógio local (evita virar o dia por fuso). */
function hojeUTC(): Date {
  const a = new Date()
  return new Date(Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()))
}

function isoData(d: Date): string {
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mes}-${dia}`
}

/**
 * Nome do arquivo de saída: `MRP_<nome-original-sem-extensão>_<aaaa-mm-dd>.xlsx`.
 * `hoje` segue a convenção do engine (meia-noite UTC): a data é lida em UTC.
 */
export function nomeArquivoSaida(nomeOriginal: string, hoje: Date): string {
  const semCaminho = nomeOriginal.split(/[\\/]/).pop() ?? ''
  const semExt = semCaminho.replace(/\.[^.]+$/, '')
  const limpo = semExt
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, 80)
  return `MRP_${limpo || 'planilha'}_${isoData(hoje)}.xlsx`
}

// ---------------------------------------------------------------------------
// Rótulos

const ROTULO_POLITICA: Record<Parametros['politicaLote'], string> = {
  lote_economico: 'Lote econômico (EOQ ajustado)',
  lote_a_lote: 'Lote a lote',
  periodo_fixo: 'Período fixo (POQ)',
}

const ROTULO_METODO_MODO: Record<Parametros['metodoPrevisao'], string> = {
  regra_fixa: 'Regra fixa (média móvel para suaves/erráticos; SBA para intermitentes/irregulares)',
  automatico: 'Automático (método com menor MAE no backtest)',
}

const ROTULO_ORIGEM_NB: Record<RegistroMRP['origemNB'], string> = {
  previsao: 'Previsão',
  mps: 'MPS',
  dependente: 'Dependente (BOM)',
  'mps+dependente': 'MPS + dependente',
}

const ROTULO_MODO_MC: Record<ConfigMulticriterio['modo'], string> = {
  ponderado: 'Pontuação ponderada',
  ved: 'Matriz ABC por valor × criticidade (VED)',
}

const ROTULO_NORMALIZACAO: Record<ConfigMulticriterio['normalizacao'], string> = {
  posto: 'Posto percentil',
  minmax: 'Mín-máx',
}

const ROTULO_METODO_CLASSES: Record<ConfigMulticriterio['metodoClasses'], string> = {
  mesma_contagem: 'Mesma quantidade de itens em A, B e C que o ABC por valor',
  percentual: 'Percentual de itens por classe',
  cortes: 'Cortes de score',
}

const ORDEM_CLASSE: Record<ClasseABC, number> = { A: 0, B: 1, C: 2 }

// ---------------------------------------------------------------------------
// Exportação

export async function exportarExcel(
  Excel: ModuloExcel,
  r: Resultado,
  opcoes: OpcoesExportacao,
): Promise<ArrayBuffer> {
  const hoje = opcoes.hoje ?? hojeUTC()
  const wb = new Excel.Workbook()
  wb.creator = 'Kit Estoque MRP'
  wb.created = new Date()

  const porCodigo = new Map(r.itens.map((i) => [i.codigo, i]))

  abaLeiaMe(wb, r, opcoes, hoje)
  abaDashboard(wb, r, opcoes.imagens ?? [])
  abaABCXYZ(wb, r)
  abaABCMulticriterio(wb, r)
  abaParametrosReposicao(wb, r)
  abaSugestaoCompras(wb, r, opcoes.codigosCompras)
  abaMRPSemanal(wb, r, porCodigo)
  abaMRPConsolidado(wb, r, porCodigo)
  abaAlertas(wb, r, porCodigo)
  abaQualidade(wb, r)
  abaParametrosUsados(wb, r)

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

// ---------------------------------------------------------------------------
// 1. Leia-me

function abaLeiaMe(wb: ExcelJS.Workbook, r: Resultado, opcoes: OpcoesExportacao, hoje: Date): void {
  const ws = wb.addWorksheet('Leia-me', { properties: { tabColor: { argb: COR_SEGURANCA } } })
  ws.getColumn(1).width = 30
  ws.getColumn(2).width = 110

  const titulo = ws.addRow(['Kit Estoque MRP — planilha de resultados'])
  titulo.font = { bold: true, size: 16, color: { argb: COR_MARINHO } }
  ws.addRow([
    'Curva ABC-XYZ, parâmetros de reposição, sugestão de compras e MRP semanal, calculados no navegador.',
  ]).font = { italic: true, color: { argb: CINZA_NOTA } }
  ws.addRow([])

  const secao = (texto: string) => {
    ws.addRow([])
    const l = ws.addRow([texto])
    l.font = { bold: true, size: 13, color: { argb: BRANCO } }
    preencher(l.getCell(1), COR_MARINHO)
    preencher(l.getCell(2), COR_MARINHO)
  }
  const par = (rotulo: string, valor: ExcelJS.CellValue, formato?: string) => {
    const l = ws.addRow([rotulo, valor])
    l.getCell(1).font = { bold: true }
    l.getCell(1).alignment = { vertical: 'top' }
    const c = l.getCell(2)
    c.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }
    if (formato) c.numFmt = formato
    return l
  }

  const j = r.janela
  const periodo = j.periodicidade === 'mensal' ? 'mensal' : 'semanal'
  par('Arquivo de origem', opcoes.nomeArquivoOriginal)
  par('Gerado em', dataParaExcel(hoje), FMT_DATA)
  par('Data-base do cálculo', dataParaExcel(r.dataBase), FMT_DATA)
  par(
    'Janela de análise',
    j.rotulos.length > 0
      ? `${j.rotulos[0]} a ${j.rotulos[j.rotulos.length - 1]} (${j.rotulos.length} períodos, ${periodo})`
      : '—',
  )
  par('Itens analisados', r.itens.length, FMT_INT)
  par(
    'Qualidade dos dados',
    `${r.qualidade.linhasValidas.toLocaleString('pt-BR')} de ${r.qualidade.totalLinhas.toLocaleString('pt-BR')} linhas válidas (${(r.qualidade.percentualValidas * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%). Detalhes na aba Qualidade_Dados.`,
  )
  par('Ferramenta', { text: opcoes.urlFerramenta, hyperlink: opcoes.urlFerramenta }).getCell(
    2,
  ).font = { color: { argb: 'FF1D4ED8' }, underline: true }

  const aviso = ws.addRow([
    'Atenção',
    'Os valores desta planilha são SUGESTÕES calculadas a partir dos dados enviados. A qualidade do resultado depende da qualidade do cadastro e das movimentações (estoque atual, lead time, custo, histórico completo). Revise antes de emitir pedidos.',
  ])
  aviso.getCell(1).font = { bold: true, color: { argb: 'FF991B1B' } }
  aviso.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  preencher(aviso.getCell(1), 'FFFEF3C7')
  preencher(aviso.getCell(2), 'FFFEF3C7')

  secao('Abas desta planilha')
  const abas: [string, string][] = [
    ['Dashboard', 'Indicadores principais (KPIs) e imagens dos gráficos do painel.'],
    [
      'ABC-XYZ',
      'Classificação de cada item: consumo, participação, % acumulado, classe ABC (valor de consumo anualizado), média, desvio, CV, classe XYZ, ADI, CV², padrão de demanda (Syntetos-Boylan) e classe combinada. Com o ABC multicritério ligado, a classe ABC é a final e a classe por valor aparece ao lado.',
    ],
    [
      'ABC_Multicriterio',
      r.multicriterio
        ? 'ABC multicritério: para cada critério o valor bruto, o normalizado (0–1), o peso e a contribuição; score, posição, classe por valor, classe final, regra de piso, classe manual, quem subiu (↑) ou desceu (↓), motivo e estabilidade da classe. No modo VED: criticidade, classe VED e classes.'
        : 'ABC multicritério (desligado nesta exportação: a classe ABC é só por valor de consumo).',
    ],
    [
      'Parametros_Reposicao',
      'Parâmetros de reposição por item: nível de serviço, Z, previsão, ES, PP, EOQ, Q*, Máx, posição, cobertura, giro, status, custos do lote, probabilidades, fill rate e erro da previsão.',
    ],
    [
      'Sugestao_Compras',
      'Itens com posição ≤ PP, ordenados por prioridade (Urgente > Alta > Média > Baixa) e valor, com quantidade sugerida, data de chegada estimada e motivo.',
    ],
    [
      'MRP_Semanal',
      'Registro de MRP por item (NB, RP, EP, NL, RecPlan, LibPlan) com as semanas em colunas. EP abaixo do ES fica em vermelho (formatação condicional); liberações em atraso ficam em laranja com observação.',
    ],
    [
      'MRP_Consolidado',
      'Liberações planejadas por item e semana, em quantidade e em R$, com o total por semana (o "fluxo de caixa de compras").',
    ],
    [
      'Alertas',
      'Rupturas, riscos antes da chegada, liberações em atraso, críticos, excesso, sem giro e inconsistências.',
    ],
    ['Qualidade_Dados', 'Validações dos dados de entrada, com aba e linha de origem.'],
    [
      'Parametros_Usados',
      'Todos os parâmetros globais do cálculo, a matriz de nível de serviço e a configuração do ABC multicritério (modo, pesos, regras de piso, matriz VED e AHP).',
    ],
  ]
  for (const [a, b] of abas) par(a, b)

  secao('Parâmetros principais')
  const p = r.parametros
  par(
    'Periodicidade',
    `${periodo === 'mensal' ? 'Mensal' : 'Semanal'} (${j.diasPorPeriodo} dias por período; ${j.periodosPorAno} períodos por ano)`,
  )
  par('Custo de emissão do pedido (S)', p.custoPedido, FMT_MOEDA)
  par('Taxa de manutenção (i)', p.taxaManutencaoAnual, FMT_PCT)
  par(
    'Cortes ABC / XYZ',
    `A < ${pctTexto(p.corteA)}, B < ${pctTexto(p.corteB)}; X ≤ ${numTexto(p.corteX)}, Y ≤ ${numTexto(p.corteY)}`,
  )
  par(
    'Política de lote no MRP',
    `${ROTULO_POLITICA[p.politicaLote]}; horizonte de ${p.horizonteMRP} semanas`,
  )
  par(
    'ABC multicritério',
    r.multicriterio
      ? `Ligado — ${ROTULO_MODO_MC[r.multicriterio.config.modo]} (${r.multicriterio.subiram} itens subiram e ${r.multicriterio.desceram} desceram de classe)`
      : 'Desligado (classe ABC só por valor de consumo)',
  )
  par('Lista completa', 'Ver a aba Parametros_Usados (inclui a matriz de nível de serviço).')

  secao('Como cada número é calculado')
  const formulas: [string, string][] = [
    [
      'Notação',
      'F = previsão por período; σ = desvio padrão amostral da demanda; LTₚ = lead time em dias ÷ dias por período; Z = inversa da normal padrão no nível de serviço.',
    ],
    [
      'Classe ABC',
      'Itens ordenados pelo consumo anual em valor (média × custo × períodos por ano). A se o % acumulado ANTERIOR < corte A; B se < corte B; C no restante.',
    ],
    [
      'Classe XYZ',
      'CV = σ ÷ média. X se CV ≤ corte X; Y se CV ≤ corte Y; Z acima. N = sem demanda; Novo = menos períodos que o mínimo.',
    ],
    [
      'ABC multicritério',
      'Score S = Σ (peso × valor normalizado), com os pesos somando 100%. Cada critério é normalizado para 0–1 (1 = mais crítico) pelo posto percentil = (posição no ranking crescente − 1) ÷ (n − 1), empates com a média dos postos (alternativa: mín-máx); dado faltando vale 0,5. Itens ordenados pelo score recebem A, B e C (padrão: mesma quantidade de itens por classe do ABC por valor). Regras de piso e classe manual prevalecem. No modo VED, a classe final sai da matriz classe por valor × criticidade. Quando ligado, a classe final substitui a classe por valor em todo o cálculo (nível de serviço, prioridades, KPIs).',
    ],
    [
      'Padrão de demanda',
      'ADI = períodos ÷ períodos com demanda; CV² dos tamanhos não nulos. Suave, Errático, Intermitente ou Irregular pelos cortes de Syntetos-Boylan.',
    ],
    [
      'Estoque de segurança (ES)',
      'ES = Z × σ × √LTₚ. Com desvio de lead time: ES = Z × √(LTₚ × σ² + F² × σ_LTₚ²). Se houver ES manual no cadastro, ele é usado.',
    ],
    ['Ponto de pedido (PP)', 'PP = F × LTₚ + ES.'],
    [
      'Lote econômico (EOQ)',
      'EOQ = √(2 × D × S ÷ H), com D = F × períodos por ano e H = i × custo. Não se aplica se D = 0 ou H = 0.',
    ],
    ['Lote de compra (Q*)', 'Q* = max(lote mínimo, ⌈EOQ ÷ múltiplo⌉ × múltiplo).'],
    ['Estoque máximo (Máx)', 'Máx = ES + Q*.'],
    [
      'Cobertura (dias)',
      'Cobertura = estoque atual ÷ (F ÷ dias por período). Vazio/∞ quando o consumo é zero.',
    ],
    [
      'Giro anualizado',
      'Giro = (consumo em valor na janela × períodos por ano ÷ n) ÷ (estoque médio reconstruído × custo).',
    ],
    ['Posição', 'Posição = estoque atual + pedidos em aberto.'],
    [
      'Status (na ordem)',
      '1) Ruptura: estoque ≤ 0 e F > 0; 2) Crítico: estoque < ES; 3) Comprar: posição ≤ PP; 4) Excesso: estoque > Máx e F > 0; 5) Sem giro: sem saída há ≥ N dias e estoque > 0; 6) Sem demanda: F = 0 e estoque = 0; 7) OK.',
    ],
    [
      'Sugestão de compra',
      'Quando posição ≤ PP: Qtd = max(lote mínimo, ⌈(Máx − posição) ÷ múltiplo⌉ × múltiplo); Valor = Qtd × custo; chegada = data-base + lead time.',
    ],
    [
      'Prioridade',
      'Urgente se a cobertura (dias) < lead time; Alta se classe A ou status Ruptura/Crítico; Média se B; Baixa se C.',
    ],
    [
      'Custo total do lote',
      'CT(Q) = (D ÷ Q) × S + (Q ÷ 2) × H. Penalidade do arredondamento = (CT(Q*) − CT(EOQ)) ÷ CT(EOQ).',
    ],
    [
      'Probabilidades',
      'P(faltar antes da chegada) = 1 − Φ((posição − F × LTₚ) ÷ σ_LT). Fill rate = 1 − σ_LT × G(z) ÷ Q*, com G(z) = φ(z) − z × (1 − Φ(z)). Para intermitentes/irregulares é indicativo.',
    ],
    [
      'Erro da previsão',
      'Backtest nos últimos 6 períodos. WMAPE = Σ|real − prev| ÷ Σreal; viés = Σ(prev − real) ÷ Σreal (positivo = superestima).',
    ],
    [
      'MRP semanal',
      'EP(t) = EP(t−1) + RP(t) + RecPlan(t) − NB(t). Se EP antes do RecPlan < ES, NL = ES − (EP(t−1) + RP(t) − NB(t)); RecPlan aplica a política de lote; LibPlan = RecPlan deslocado do lead time (em semanas).',
    ],
    [
      'Arredondamento',
      'ES, PP, Máx e sugestões: para cima em unidades discretas (UN, PC, CX…) e com 2 casas nas fracionáveis (KG, L, M…). No MRP_Semanal os valores aparecem com 2 casas, sem arredondar para cima, para a conta do EP fechar.',
    ],
  ]
  for (const [a, b] of formulas) par(a, b)
}

function pctTexto(v: number): string {
  return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function numTexto(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

// ---------------------------------------------------------------------------
// 2. Dashboard

interface CartaoKPI {
  rotulo: string
  valor: number | null
  formato: string
  nota: string
}

function cartoesKPI(k: KPIs): CartaoKPI[] {
  return [
    {
      rotulo: 'Valor total em estoque',
      valor: k.valorEstoque,
      formato: FMT_MOEDA,
      nota: 'Σ estoque atual × custo',
    },
    {
      rotulo: 'SKUs ativos',
      valor: k.skusAtivos,
      formato: FMT_INT,
      nota: `Estoque > 0 ou demanda > 0 (de ${k.totalItens} itens)`,
    },
    {
      rotulo: 'Itens classe A (% dos SKUs)',
      valor: k.pctSkusA,
      formato: FMT_PCT,
      nota: 'Concentração A em quantidade de itens',
    },
    {
      rotulo: 'Consumo dos itens A (% do valor)',
      valor: k.pctValorA,
      formato: FMT_PCT,
      nota: 'Concentração A em valor de consumo',
    },
    {
      rotulo: 'Giro anualizado',
      valor: k.giro,
      formato: FMT_DEC2,
      nota: 'CMV anualizado ÷ estoque médio em valor',
    },
    {
      rotulo: 'Cobertura média (dias)',
      valor: k.coberturaMediaDias,
      formato: FMT_INT,
      nota: 'Valor em estoque ÷ consumo em valor por dia',
    },
    {
      rotulo: 'Itens em ruptura',
      valor: k.itensRuptura,
      formato: FMT_INT,
      nota: 'Estoque ≤ 0 com consumo previsto',
    },
    {
      rotulo: 'Itens em ruptura (%)',
      valor: k.pctRuptura,
      formato: FMT_PCT,
      nota: 'Rupturas ÷ total de itens',
    },
    {
      rotulo: 'Itens críticos (abaixo do ES)',
      valor: k.itensCriticos,
      formato: FMT_INT,
      nota: 'Estoque < estoque de segurança',
    },
    {
      rotulo: 'Itens a comprar',
      valor: k.itensComprar,
      formato: FMT_INT,
      nota: 'Itens com sugestão de compra',
    },
    {
      rotulo: 'Valor da sugestão de compra',
      valor: k.valorSugestao,
      formato: FMT_MOEDA,
      nota: 'Σ quantidade sugerida × custo',
    },
    {
      rotulo: 'Risco de ruptura antes da chegada',
      valor: k.riscoAntesChegada,
      formato: FMT_INT,
      nota: 'Cobertura (dias) < lead time',
    },
    {
      rotulo: 'Valor em excesso',
      valor: k.valorExcesso,
      formato: FMT_MOEDA,
      nota: 'Σ max(0, estoque − Máx) × custo',
    },
    {
      rotulo: 'Valor sem giro',
      valor: k.valorSemGiro,
      formato: FMT_MOEDA,
      nota: 'Σ estoque × custo dos itens sem giro',
    },
    {
      rotulo: 'Nível de serviço alvo médio',
      valor: k.nivelServicoMedio,
      formato: FMT_PCT,
      nota: 'Média ponderada pelo valor de consumo',
    },
    {
      rotulo: 'Qualidade dos dados',
      valor: k.qualidadeDados,
      formato: FMT_PCT,
      nota: '% de linhas válidas',
    },
    {
      rotulo: 'WMAPE médio da previsão',
      valor: k.wmapeMedio,
      formato: FMT_PCT,
      nota: 'Ponderado pelo valor de consumo',
    },
    {
      rotulo: 'Viés médio da previsão',
      valor: k.viesMedio,
      formato: FMT_PCT,
      nota: 'Positivo = previsão superestima',
    },
  ]
}

/** Largura e altura (px) de um PNG, lidas do cabeçalho IHDR. */
function dimensoesPNG(base64: string): { largura: number; altura: number } | null {
  try {
    const bin = atob(base64.slice(0, 44))
    if (bin.length < 24 || bin.charCodeAt(1) !== 0x50) return null
    const u32 = (i: number) =>
      ((bin.charCodeAt(i) << 24) |
        (bin.charCodeAt(i + 1) << 16) |
        (bin.charCodeAt(i + 2) << 8) |
        bin.charCodeAt(i + 3)) >>>
      0
    const largura = u32(16)
    const altura = u32(20)
    return largura > 0 && altura > 0 ? { largura, altura } : null
  } catch {
    return null
  }
}

function abaDashboard(
  wb: ExcelJS.Workbook,
  r: Resultado,
  imagens: { titulo: string; dataUrl: string }[],
): void {
  const ws = wb.addWorksheet('Dashboard', {
    properties: { tabColor: { argb: COR_SEGURANCA } },
    views: [{ showGridLines: false }],
  })
  // Colunas: A, C, E, G são espaçadores; B, D, F recebem os cartões.
  ;[3, 34, 3, 34, 3, 34, 3].forEach((w, i) => (ws.getColumn(i + 1).width = w))

  const t = ws.getCell('B1')
  t.value = 'Painel de indicadores'
  t.font = { bold: true, size: 16, color: { argb: COR_MARINHO } }
  const s = ws.getCell('B2')
  s.value = `Data-base ${formatarData(r.dataBase)} · ${r.itens.length} itens analisados`
  s.font = { italic: true, color: { argb: CINZA_NOTA } }

  const cartoes = cartoesKPI(r.kpis)
  const borda: Partial<ExcelJS.Borders> = {
    left: { style: 'thin', color: { argb: COR_ACO } },
    right: { style: 'thin', color: { argb: COR_ACO } },
  }
  let linha = 4
  for (let k = 0; k < cartoes.length; k += 3) {
    cartoes.slice(k, k + 3).forEach((c, idx) => {
      const col = 2 + idx * 2
      const cRot = ws.getCell(linha, col)
      cRot.value = c.rotulo
      cRot.font = { bold: true, color: { argb: BRANCO } }
      cRot.alignment = { vertical: 'middle' }
      preencher(cRot, COR_ACO)
      cRot.border = { ...borda, top: { style: 'thin', color: { argb: COR_ACO } } }

      const cVal = ws.getCell(linha + 1, col)
      const v = n(c.valor)
      cVal.value = v ?? '—'
      if (v !== null) cVal.numFmt = c.formato
      cVal.font = { bold: true, size: 18, color: { argb: COR_MARINHO } }
      cVal.alignment = { horizontal: 'left', vertical: 'middle' }
      preencher(cVal, FUNDO_CARTAO)
      cVal.border = borda

      const cNota = ws.getCell(linha + 2, col)
      cNota.value = c.nota
      cNota.font = { italic: true, size: 9, color: { argb: CINZA_NOTA } }
      cNota.alignment = { wrapText: true, vertical: 'top' }
      preencher(cNota, FUNDO_CARTAO)
      cNota.border = { ...borda, bottom: { style: 'thin', color: { argb: COR_ACO } } }
    })
    ws.getRow(linha + 1).height = 28
    ws.getRow(linha + 2).height = 26
    linha += 4
  }

  // Gráficos empilhados, cada um com o título numa linha acima.
  linha += 1
  const tituloGraf = ws.getCell(linha, 2)
  tituloGraf.value = 'Gráficos'
  tituloGraf.font = { bold: true, size: 14, color: { argb: COR_MARINHO } }
  linha += 1
  if (imagens.length === 0) {
    const c = ws.getCell(linha, 2)
    c.value = 'Nenhum gráfico incluído nesta exportação.'
    c.font = { italic: true, color: { argb: CINZA_NOTA } }
    return
  }
  const ALTURA_LINHA_PX = 20 // linha padrão: 15 pt = 20 px
  const LARGURA_MAX_PX = 900
  for (const img of imagens) {
    const c = ws.getCell(linha, 2)
    c.value = img.titulo
    c.font = { bold: true, size: 12 }
    const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(img.dataUrl.trim())
    if (!m) {
      ws.getCell(linha + 1, 2).value = '(imagem indisponível)'
      linha += 3
      continue
    }
    const extensao = m[1].toLowerCase() === 'png' ? 'png' : 'jpeg'
    const base64 = m[2]
    const dim = (extensao === 'png' ? dimensoesPNG(base64) : null) ?? { largura: 800, altura: 400 }
    const escala = Math.min(1, LARGURA_MAX_PX / dim.largura)
    const largura = Math.max(1, Math.round(dim.largura * escala))
    const altura = Math.max(1, Math.round(dim.altura * escala))
    const id = wb.addImage({ base64, extension: extensao })
    // tl é 0-based: { col: 1, row: linha } = coluna B, linha seguinte ao título.
    ws.addImage(id, { tl: { col: 1, row: linha }, ext: { width: largura, height: altura } })
    linha += 1 + Math.ceil(altura / ALTURA_LINHA_PX) + 1
  }
}

// ---------------------------------------------------------------------------
// 3. ABC-XYZ

function abaABCXYZ(wb: ExcelJS.Workbook, r: Resultado): void {
  // Com o multicritério ligado, a classe ABC é a final e a classe por valor vem logo ao lado.
  const comMC = r.multicriterio !== null
  const ws = criarAbaTabela(wb, 'ABC-XYZ', [
    { cabecalho: 'Item', largura: 14 },
    { cabecalho: 'Descrição', largura: 40 },
    { cabecalho: 'Categoria', largura: 18 },
    { cabecalho: 'Unidade', largura: 9 },
    { cabecalho: 'Consumo (qtd)', largura: 14, formato: FMT_DEC2 },
    { cabecalho: 'Consumo (R$)', largura: 16, formato: FMT_MOEDA },
    { cabecalho: 'Consumo anual (R$)', largura: 18, formato: FMT_MOEDA },
    { cabecalho: '% do consumo', largura: 12, formato: FMT_PCT },
    { cabecalho: '% acumulado', largura: 12, formato: FMT_PCT },
    { cabecalho: comMC ? 'Classe ABC (final)' : 'Classe ABC', largura: 10 },
    ...(comMC ? [{ cabecalho: 'Classe por valor', largura: 10 }] : []),
    { cabecalho: 'Média (d̄)', largura: 12, formato: FMT_DEC2 },
    { cabecalho: 'Desvio (σ)', largura: 12, formato: FMT_DEC2 },
    { cabecalho: 'CV', largura: 9, formato: FMT_DEC2 },
    { cabecalho: 'Classe XYZ', largura: 10 },
    { cabecalho: 'ADI', largura: 9, formato: FMT_DEC2 },
    { cabecalho: 'CV²', largura: 9, formato: FMT_DEC2 },
    { cabecalho: 'Padrão de demanda', largura: 16 },
    { cabecalho: 'Classe combinada', largura: 11 },
  ])
  const itens = [...r.itens].sort((a, b) => a.posicaoABC - b.posicaoABC)
  for (const i of itens) {
    const l = ws.addRow([
      i.codigo,
      i.descricao,
      i.categoria,
      i.unidade,
      n(i.consumoQtd, 2),
      n(i.consumoValor, 2),
      n(i.consumoAnualValor, 2),
      n(i.pctConsumo),
      n(i.pctAcumulado),
      i.classeABC,
      ...(comMC ? [i.classeABCValor] : []),
      n(i.media, 4),
      n(i.desvio, 4),
      n(i.cv, 4),
      i.classeXYZ,
      n(i.adi, 4),
      n(i.cv2, 4),
      i.padrao ?? '',
      i.classeCombinada,
    ])
    const d = comMC ? 1 : 0 // deslocamento das colunas depois da classe
    l.getCell(5).numFmt = fmtQtd(i.unidadeDiscreta)
    for (const c of [10, 18 + d]) {
      pintar(l.getCell(c), COR_CLASSE[i.classeABC], true)
      l.getCell(c).alignment = { horizontal: 'center' }
    }
    if (comMC) {
      pintar(l.getCell(11), COR_CLASSE[i.classeABCValor], true)
      l.getCell(11).alignment = { horizontal: 'center' }
    }
    l.getCell(14 + d).alignment = { horizontal: 'center' }
  }
}

// ---------------------------------------------------------------------------
// 3-B. ABC_Multicriterio (seção 16-B)

/** Formato do valor bruto de um critério numérico. */
function fmtBruto(id: IdCriterio, v: number): string {
  if (id === 'valor' || id === 'custo_parada') return FMT_MOEDA
  if (id === 'cv') return FMT_DEC2
  return fmtPorValor(v)
}

function pintarClasse(cell: ExcelJS.Cell, classe: ClasseABC): void {
  pintar(cell, COR_CLASSE[classe], true)
  cell.alignment = { horizontal: 'center' }
}

function marcarMudanca(cell: ExcelJS.Cell, mudou: 'subiu' | 'desceu' | null): void {
  cell.value = mudou === 'subiu' ? '↑' : mudou === 'desceu' ? '↓' : ''
  cell.alignment = { horizontal: 'center' }
  if (mudou)
    cell.font = { bold: true, color: { argb: mudou === 'subiu' ? 'FF16A34A' : 'FFDC2626' } }
}

function abaABCMulticriterio(wb: ExcelJS.Workbook, r: Resultado): void {
  const mc = r.multicriterio
  if (!mc) {
    const ws = wb.addWorksheet('ABC_Multicriterio', { properties: { tabColor: { argb: COR_ACO } } })
    ws.getColumn(1).width = 110
    const c = ws.getCell('A1')
    c.value = MENSAGEM_MC_DESLIGADO
    c.font = { bold: true, color: { argb: COR_MARINHO } }
    c.alignment = { wrapText: true }
    return
  }
  const itens = r.itens.filter(
    (i): i is ItemResultado & { multicriterio: NonNullable<ItemResultado['multicriterio']> } =>
      i.multicriterio !== null,
  )

  if (mc.config.modo === 'ved') {
    const ws = criarAbaTabela(wb, 'ABC_Multicriterio', [
      { cabecalho: 'Item', largura: 14 }, // 1
      { cabecalho: 'Descrição', largura: 36 }, // 2
      { cabecalho: 'Criticidade', largura: 14 }, // 3
      { cabecalho: 'VED', largura: 12 }, // 4
      { cabecalho: 'Classe por valor', largura: 10 }, // 5
      { cabecalho: 'Classe final', largura: 10 }, // 6
      { cabecalho: 'Regra de piso aplicada', largura: 40 }, // 7
      { cabecalho: 'Classe manual', largura: 9 }, // 8
      { cabecalho: 'Justificativa', largura: 36 }, // 9
      { cabecalho: 'Mudou?', largura: 8 }, // 10
      { cabecalho: 'Motivo', largura: 80 }, // 11
    ])
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
    const ordenados = [...itens].sort(
      (a, b) =>
        ORDEM_CLASSE[a.multicriterio.classeFinal] - ORDEM_CLASSE[b.multicriterio.classeFinal] ||
        b.consumoAnualValor - a.consumoAnualValor ||
        (a.codigo < b.codigo ? -1 : 1),
    )
    for (const i of ordenados) {
      const m = i.multicriterio
      const l = ws.addRow([
        i.codigo,
        i.descricao,
        rotuloCriticidade(m.criticidade),
        NOME_VED[m.ved],
        m.classeValor,
        m.classeFinal,
        m.regraAplicada ?? '',
        m.manual ? 'Sim' : '',
        m.justificativa ?? '',
        '',
        m.motivo,
      ])
      l.getCell(4).alignment = { horizontal: 'center' }
      pintarClasse(l.getCell(5), m.classeValor)
      pintarClasse(l.getCell(6), m.classeFinal)
      l.getCell(8).alignment = { horizontal: 'center' }
      marcarMudanca(l.getCell(10), m.mudou)
    }
    return
  }

  // Modo ponderado: 4 colunas por critério, na ordem dos pesos efetivos.
  const ids = Object.keys(mc.pesos)
  const ws = criarAbaTabela(wb, 'ABC_Multicriterio', [
    { cabecalho: 'Item', largura: 14 },
    { cabecalho: 'Descrição', largura: 36 },
    ...ids.flatMap((id) => {
      const nome = nomeCriterio(id)
      // O valor bruto do critério "Sem substituto" é a coluna possui_substituto (Sim/Não).
      const nomeBruto = id === 'substituto' ? 'Possui substituto' : nome
      return [
        { cabecalho: `${nomeBruto} (bruto)`, largura: 16 },
        { cabecalho: `${nome} (normalizado)`, largura: 13, formato: FMT_3 },
        { cabecalho: `${nome} (peso)`, largura: 11, formato: FMT_PCT },
        { cabecalho: `${nome} (contribuição)`, largura: 13, formato: FMT_3 },
      ]
    }),
    { cabecalho: 'Score', largura: 9, formato: FMT_3 },
    { cabecalho: 'Posição', largura: 9, formato: FMT_INT },
    { cabecalho: 'Classe por valor', largura: 10 },
    { cabecalho: 'Classe final', largura: 10 },
    { cabecalho: 'Regra de piso aplicada', largura: 40 },
    { cabecalho: 'Classe manual', largura: 9 },
    { cabecalho: 'Justificativa', largura: 36 },
    { cabecalho: 'Mudou?', largura: 8 },
    { cabecalho: 'Motivo', largura: 90 },
    { cabecalho: 'Estabilidade', largura: 11, formato: FMT_PCT },
  ])
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
  const c0 = 3 + 4 * ids.length // primeira coluna depois dos critérios (Score)
  const ordenados = [...itens].sort(
    (a, b) =>
      (a.multicriterio.posicao ?? Number.MAX_SAFE_INTEGER) -
        (b.multicriterio.posicao ?? Number.MAX_SAFE_INTEGER) || (a.codigo < b.codigo ? -1 : 1),
  )
  for (const i of ordenados) {
    const m = i.multicriterio
    const porId = new Map(m.criterios.map((c) => [c.id, c]))
    const valores: ExcelJS.CellValue[] = [i.codigo, i.descricao]
    for (const id of ids) {
      const c = porId.get(id)
      const bruto =
        !c || c.bruto === null
          ? 'sem dado'
          : typeof c.bruto === 'number'
            ? n(c.bruto, id === 'valor' || id === 'custo_parada' ? 2 : 4)
            : c.bruto
      valores.push(bruto, n(c?.normalizado), n(c?.peso), n(c?.contribuicao))
    }
    valores.push(
      n(m.score),
      n(m.posicao),
      m.classeValor,
      m.classeFinal,
      m.regraAplicada ?? '',
      m.manual ? 'Sim' : '',
      m.justificativa ?? '',
      '',
      m.motivo,
      n(m.estabilidade),
    )
    const l = ws.addRow(valores)
    ids.forEach((id, k) => {
      const cel = l.getCell(3 + 4 * k)
      if (typeof cel.value === 'number') cel.numFmt = fmtBruto(id, cel.value)
      else if (cel.value === 'sem dado') cel.font = { italic: true, color: { argb: CINZA_NOTA } }
      else cel.alignment = { horizontal: 'center' }
    })
    pintarClasse(l.getCell(c0 + 2), m.classeValor)
    pintarClasse(l.getCell(c0 + 3), m.classeFinal)
    l.getCell(c0 + 5).alignment = { horizontal: 'center' }
    marcarMudanca(l.getCell(c0 + 7), m.mudou)
    if (m.estabilidade !== null && m.estabilidade < 0.7)
      pintar(l.getCell(c0 + 9), { fundo: FUNDO_ALERTA, texto: TEXTO_ALERTA }, true)
  }
}

// ---------------------------------------------------------------------------
// 4. Parametros_Reposicao

function abaParametrosReposicao(wb: ExcelJS.Workbook, r: Resultado): void {
  const ws = criarAbaTabela(wb, 'Parametros_Reposicao', [
    { cabecalho: 'Item', largura: 14 }, // 1
    { cabecalho: 'Descrição', largura: 36 }, // 2
    { cabecalho: 'Classe', largura: 9 }, // 3
    { cabecalho: 'Unidade', largura: 9 }, // 4
    { cabecalho: 'Custo unitário', largura: 14, formato: FMT_MOEDA }, // 5
    { cabecalho: 'LT (dias)', largura: 9, formato: FMT_INT }, // 6
    { cabecalho: 'Nível de serviço', largura: 11, formato: FMT_PCT }, // 7
    { cabecalho: 'Z', largura: 8, formato: '0.000' }, // 8
    { cabecalho: 'Método de previsão', largura: 18 }, // 9
    { cabecalho: 'Previsão F (por período)', largura: 13, formato: FMT_DEC2 }, // 10
    { cabecalho: 'ES', largura: 11, formato: FMT_DEC2 }, // 11
    { cabecalho: 'ES manual', largura: 9 }, // 12
    { cabecalho: 'PP', largura: 11, formato: FMT_DEC2 }, // 13
    { cabecalho: 'EOQ', largura: 11, formato: FMT_DEC2 }, // 14
    { cabecalho: 'Q* (lote de compra)', largura: 12, formato: FMT_DEC2 }, // 15
    { cabecalho: 'Máx', largura: 11, formato: FMT_DEC2 }, // 16
    { cabecalho: 'Estoque atual', largura: 12, formato: FMT_DEC2 }, // 17
    { cabecalho: 'Pedidos em aberto', largura: 12, formato: FMT_DEC2 }, // 18
    { cabecalho: 'Posição', largura: 12, formato: FMT_DEC2 }, // 19
    { cabecalho: 'Cobertura (dias)', largura: 11, formato: '#,##0.0' }, // 20
    { cabecalho: 'Giro anualizado', largura: 11, formato: FMT_DEC2 }, // 21
    { cabecalho: 'Status', largura: 13 }, // 22
    { cabecalho: 'Custo total anual do lote (R$)', largura: 16, formato: FMT_MOEDA }, // 23
    { cabecalho: 'Penalidade do arredondamento', largura: 14, formato: '0.00%' }, // 24
    { cabecalho: 'Prob. faltar antes da chegada', largura: 14, formato: FMT_PCT }, // 25
    { cabecalho: 'Fill rate esperado', largura: 12, formato: '0.00%' }, // 26
    { cabecalho: 'WMAPE da previsão', largura: 12, formato: FMT_PCT }, // 27
    { cabecalho: 'Viés da previsão', largura: 12, formato: FMT_PCT }, // 28
  ])
  for (const i of r.itens) {
    const d = i.unidadeDiscreta
    const cobertura: number | string | null =
      i.coberturaDias === Infinity ? '∞' : n(i.coberturaDias, 1)
    const l = ws.addRow([
      i.codigo,
      i.descricao,
      i.classeCombinada,
      i.unidade,
      n(i.custo, 4),
      n(i.leadTimeDias),
      n(i.nivelServico),
      n(i.z, 6),
      i.metodo,
      n(i.previsao, 2),
      q(i.estoqueSeguranca, d),
      simNao(i.esManual),
      q(i.pontoPedido, d),
      n(i.eoq, 2),
      q(i.loteCompra, d),
      q(i.estoqueMaximo, d),
      n(i.estoqueAtual, 4),
      n(i.pedidosAbertos, 4),
      n(i.posicao, 4),
      cobertura,
      n(i.giro, 4),
      i.status,
      n(i.custoTotalLote, 2),
      n(i.penalidadeArredondamento),
      n(i.probFaltarAntesChegada),
      n(i.fillRate),
      n(i.wmape),
      n(i.vies),
    ])
    for (const c of [11, 13, 15, 16, 17, 18, 19]) {
      const cel = l.getCell(c)
      cel.numFmt = d ? FMT_INT : FMT_DEC2
      // Estoque/posição podem ser fracionários mesmo em unidade discreta: não esconder casas.
      if (d && c >= 17) cel.numFmt = fmtPorValor(typeof cel.value === 'number' ? cel.value : null)
    }
    if (cobertura === '∞') l.getCell(20).alignment = { horizontal: 'right' }
    pintar(l.getCell(3), COR_CLASSE[i.classeABC], true)
    l.getCell(3).alignment = { horizontal: 'center' }
    pintar(l.getCell(22), COR_STATUS[i.status], true)
    l.getCell(22).alignment = { horizontal: 'center' }
  }
}

// ---------------------------------------------------------------------------
// 5. Sugestao_Compras

function abaSugestaoCompras(
  wb: ExcelJS.Workbook,
  r: Resultado,
  codigos: string[] | undefined,
): void {
  const ws = criarAbaTabela(wb, 'Sugestao_Compras', [
    { cabecalho: 'Prioridade', largura: 11 },
    { cabecalho: 'Item', largura: 14 },
    { cabecalho: 'Descrição', largura: 38 },
    { cabecalho: 'Fornecedor', largura: 24 },
    { cabecalho: 'Qtd sugerida', largura: 13, formato: FMT_DEC2 },
    { cabecalho: 'Unidade', largura: 9 },
    { cabecalho: 'Custo unitário', largura: 14, formato: FMT_MOEDA },
    { cabecalho: 'Valor (R$)', largura: 16, formato: FMT_MOEDA },
    { cabecalho: 'Chegada estimada', largura: 13, formato: FMT_DATA },
    { cabecalho: 'Motivo', largura: 70 },
  ])
  const filtro = codigos ? new Set(codigos) : null
  const sugestoes = sugestoesOrdenadas(r.itens).filter((i) => !filtro || filtro.has(i.codigo))
  let total = 0
  for (const i of sugestoes) {
    const qtd = q(i.sugestaoQtd, i.unidadeDiscreta) ?? 0
    const valor = n(qtd * i.custo, 2) ?? 0
    total += valor
    const l = ws.addRow([
      i.prioridade ?? '',
      i.codigo,
      i.descricao,
      i.fornecedor,
      qtd,
      i.unidade,
      n(i.custo, 4),
      valor,
      dataParaExcel(i.dataChegada),
      i.motivo,
    ])
    l.getCell(5).numFmt = fmtQtd(i.unidadeDiscreta)
    const cor = i.prioridade ? COR_PRIORIDADE[i.prioridade] : undefined
    if (cor) pintar(l.getCell(1), cor, true)
    l.getCell(1).alignment = { horizontal: 'center' }
  }
  // Autofiltro só sobre os dados; o total fica fora, separado por uma linha em branco.
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sugestoes.length + 1), column: 10 },
  }
  if (sugestoes.length === 0) {
    ws.addRow(['', 'Nenhum item com sugestão de compra.']).font = { italic: true }
    return
  }
  ws.addRow([])
  const t = ws.addRow(['', 'Total', `${sugestoes.length} itens`, '', null, '', null, n(total, 2)])
  t.font = { bold: true }
  t.getCell(8).numFmt = FMT_MOEDA
  for (let c = 1; c <= 10; c++)
    t.getCell(c).border = { top: { style: 'thin', color: { argb: COR_MARINHO } } }
}

// ---------------------------------------------------------------------------
// 6. MRP_Semanal

const LINHAS_MRP: { rotulo: string; campo: 'nb' | 'rp' | 'ep' | 'nl' | 'recPlan' | 'libPlan' }[] = [
  { rotulo: 'Necessidade bruta (NB)', campo: 'nb' },
  { rotulo: 'Recebimentos programados (RP)', campo: 'rp' },
  { rotulo: 'Estoque projetado (EP)', campo: 'ep' },
  { rotulo: 'Necessidade líquida (NL)', campo: 'nl' },
  { rotulo: 'Recebimento planejado (RecPlan)', campo: 'recPlan' },
  { rotulo: 'Liberação planejada (LibPlan)', campo: 'libPlan' },
]

function letraColuna(c: number): string {
  let s = ''
  let x = c
  while (x > 0) {
    const resto = (x - 1) % 26
    s = String.fromCharCode(65 + resto) + s
    x = Math.floor((x - 1) / 26)
  }
  return s
}

function mensagemSemMRP(ws: ExcelJS.Worksheet, r: Resultado): void {
  ws.getColumn(1).width = 110
  const c = ws.getCell('A1')
  c.value = r.erroMRP ?? 'MRP não calculado (sem itens válidos para o horizonte).'
  c.font = { bold: true, color: { argb: 'FF991B1B' } }
  c.alignment = { wrapText: true }
}

function abaMRPSemanal(
  wb: ExcelJS.Workbook,
  r: Resultado,
  porCodigo: Map<string, ItemResultado>,
): void {
  const ws = wb.addWorksheet('MRP_Semanal', {
    properties: { tabColor: { argb: COR_ACO } },
    views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }],
  })
  const mrp = r.mrp
  if (!mrp) {
    mensagemSemMRP(ws, r)
    return
  }
  const H = mrp.semanas.length
  const colObs = H + 2
  ws.getColumn(1).width = 34
  for (let c = 2; c <= H + 1; c++) ws.getColumn(c).width = 12
  ws.getColumn(colObs).width = 60

  // Cabeçalho global (congelado): rótulo e data de início de cada semana.
  const cab = ws.getRow(1)
  cab.values = ['Item / registro', ...mrp.semanas.map((s) => s.rotulo), 'Observação']
  estilizarCabecalho(cab)
  const datas = ws.getRow(2)
  datas.values = ['Início da semana', ...mrp.semanas.map((s) => dataParaExcel(s.inicio))]
  for (let c = 1; c <= colObs; c++) {
    const cel = datas.getCell(c)
    preencher(cel, COR_ACO)
    cel.font = { bold: true, color: { argb: BRANCO } }
    cel.alignment = { horizontal: 'center' }
    if (c >= 2 && c <= H + 1) cel.numFmt = FMT_DATA
  }

  const ultimaSemana = letraColuna(H + 1)
  let prioridade = 1
  let linha = 4
  for (const reg of mrp.registros) {
    const item = porCodigo.get(reg.codigo)
    const discreta = item?.unidadeDiscreta ?? true

    // Linha de título do bloco: código, descrição e parâmetros (pares rótulo/valor).
    const t = ws.getRow(linha)
    t.getCell(1).value = `${reg.codigo} — ${item?.descricao ?? ''}`.trim()
    const pares: [string, number | string | null, string | undefined][] = [
      ['Nível', reg.nivel, FMT_INT],
      ['LT (sem.)', reg.ltSemanas, FMT_INT],
      ['ES', n(reg.estoqueSeguranca, 2), FMT_DEC2],
      ['Lote', reg.loteCompra === null ? '—' : q(reg.loteCompra, discreta), fmtQtd(discreta)],
      ['PP', reg.pontoPedido === null ? '—' : q(reg.pontoPedido, discreta), fmtQtd(discreta)],
      ['Unid.', item?.unidade ?? '', undefined],
      ['Origem NB', ROTULO_ORIGEM_NB[reg.origemNB], undefined],
    ]
    pares.forEach(([rot, val, fmt], k) => {
      t.getCell(2 + 2 * k).value = rot
      const cv = t.getCell(3 + 2 * k)
      cv.value = val
      if (fmt && typeof val === 'number') cv.numFmt = fmt
    })
    const ultimaColTitulo = Math.max(colObs, 1 + 2 * pares.length)
    for (let c = 1; c <= ultimaColTitulo; c++) {
      const cel = t.getCell(c)
      preencher(cel, COR_MARINHO)
      cel.font = { bold: c === 1 || c % 2 === 1, color: { argb: BRANCO } }
    }
    // A célula do ES (coluna G = 7) é a referência da formatação condicional do bloco.
    const refES = `$G$${linha}`

    LINHAS_MRP.forEach(({ rotulo, campo }, k) => {
      const l = ws.getRow(linha + 1 + k)
      l.getCell(1).value = rotulo
      l.getCell(1).font = { bold: campo === 'ep' || campo === 'libPlan' }
      reg.semanas.forEach((s, w) => {
        const v = n(s[campo], 2)
        const cel = l.getCell(2 + w)
        cel.value = v
        cel.numFmt = fmtPorValor(v)
        if (campo === 'libPlan' && s.libAtraso)
          pintar(cel, { fundo: COR_SEGURANCA, texto: TEXTO_ESCURO }, true)
      })
      if (campo === 'ep') {
        preencher(l.getCell(1), FUNDO_CARTAO)
        ws.addConditionalFormatting({
          ref: `B${linha + 1 + k}:${ultimaSemana}${linha + 1 + k}`,
          rules: [
            {
              type: 'cellIs',
              operator: 'lessThan',
              formulae: [refES],
              priority: prioridade++,
              style: {
                font: { color: { argb: 'FF991B1B' }, bold: true },
                fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFECACA' } },
              },
            },
          ],
        })
      }
      if (campo === 'rp' && reg.pedidosAtrasados > 0) {
        l.getCell(colObs).value =
          `${n(reg.pedidosAtrasados, 2)} em pedidos com data prevista vencida, lançados na semana 1.`
      }
      if (campo === 'libPlan' && reg.temLiberacaoAtraso) {
        const obs = l.getCell(colObs)
        obs.value =
          'Liberação em atraso: pelo lead time, este pedido já deveria ter sido liberado antes da semana 1.'
        pintar(obs, { fundo: COR_SEGURANCA, texto: TEXTO_ESCURO }, true)
      }
    })
    linha += 1 + LINHAS_MRP.length + 1 // título + 6 linhas + linha em branco
  }
}

// ---------------------------------------------------------------------------
// 7. MRP_Consolidado

function abaMRPConsolidado(
  wb: ExcelJS.Workbook,
  r: Resultado,
  porCodigo: Map<string, ItemResultado>,
): void {
  const mrp = r.mrp
  if (!mrp) {
    const ws = wb.addWorksheet('MRP_Consolidado', { properties: { tabColor: { argb: COR_ACO } } })
    mensagemSemMRP(ws, r)
    return
  }
  const H = mrp.semanas.length
  const ws = criarAbaTabela(wb, 'MRP_Consolidado', [
    { cabecalho: 'Item', largura: 14 },
    { cabecalho: 'Descrição', largura: 34 },
    { cabecalho: 'Unidade', largura: 9 },
    { cabecalho: 'Custo unitário', largura: 14, formato: FMT_MOEDA },
    ...mrp.semanas.map((s) => ({
      cabecalho: `${s.rotulo} (qtd)`,
      largura: 12,
      formato: FMT_DEC2,
    })),
    { cabecalho: 'Total (qtd)', largura: 12, formato: FMT_DEC2 },
    { cabecalho: 'Total (R$)', largura: 16, formato: FMT_MOEDA },
  ])
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
  const nCols = 4 + H + 2

  const comLib = mrp.registros.filter((reg) => reg.semanas.some((s) => s.libPlan > 0))
  // Bloco 1: quantidades.
  for (const reg of comLib) {
    const i = porCodigo.get(reg.codigo)
    const custo = i?.custo ?? 0
    const qtds = reg.semanas.map((s) => n(s.libPlan, 2) ?? 0)
    const totalQ = qtds.reduce((a, b) => a + b, 0)
    const l = ws.addRow([
      reg.codigo,
      i?.descricao ?? '',
      i?.unidade ?? '',
      n(custo, 4),
      ...qtds.map((x) => (x === 0 ? null : x)),
      n(totalQ, 2),
      n(totalQ * custo, 2),
    ])
    for (let c = 5; c <= 5 + H; c++) {
      const v = l.getCell(c).value
      l.getCell(c).numFmt = fmtPorValor(typeof v === 'number' ? v : null)
    }
    reg.semanas.forEach((s, w) => {
      if (s.libAtraso && s.libPlan > 0)
        pintar(l.getCell(5 + w), { fundo: COR_SEGURANCA, texto: TEXTO_ESCURO }, true)
    })
  }
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, comLib.length + 1), column: nCols },
  }
  if (comLib.length === 0) {
    ws.addRow(['', 'Nenhuma liberação planejada no horizonte.']).font = { italic: true }
    return
  }

  // Bloco 2: valores em R$ por semana, com o total por semana.
  ws.addRow([])
  const cab2 = ws.addRow([
    'Item',
    'Descrição',
    'Unidade',
    'Custo unitário',
    ...mrp.semanas.map((s) => `${s.rotulo} (R$)`),
    '',
    'Total (R$)',
  ])
  estilizarCabecalho(cab2)
  for (const reg of comLib) {
    const i = porCodigo.get(reg.codigo)
    const custo = i?.custo ?? 0
    const valores = reg.semanas.map((s) => n(s.libPlan * custo, 2) ?? 0)
    const l = ws.addRow([
      reg.codigo,
      i?.descricao ?? '',
      i?.unidade ?? '',
      n(custo, 4),
      ...valores.map((x) => (x === 0 ? null : x)),
      null,
      n(
        valores.reduce((a, b) => a + b, 0),
        2,
      ),
    ])
    for (let c = 5; c <= 4 + H; c++) l.getCell(c).numFmt = FMT_MOEDA
  }
  const totalSemana = mrp.semanas.map(
    (s) => n(mrp.consolidado.find((x) => x.semana === s.semana)?.valor ?? 0, 2) ?? 0,
  )
  const t = ws.addRow([
    'Total por semana',
    '',
    '',
    null,
    ...totalSemana,
    null,
    n(
      totalSemana.reduce((a, b) => a + b, 0),
      2,
    ),
  ])
  t.font = { bold: true }
  for (let c = 1; c <= nCols; c++) {
    const cel = t.getCell(c)
    preencher(cel, FUNDO_CARTAO)
    cel.border = { top: { style: 'thin', color: { argb: COR_MARINHO } } }
    if (c >= 5) cel.numFmt = FMT_MOEDA
  }
  const ni = ws.addRow([
    'Itens liberados na semana',
    '',
    '',
    null,
    ...mrp.semanas.map((_, w) => comLib.filter((reg) => reg.semanas[w].libPlan > 0).length),
  ])
  ni.font = { italic: true }
  for (let c = 5; c <= 4 + H; c++) ni.getCell(c).numFmt = FMT_INT
}

// ---------------------------------------------------------------------------
// 8. Alertas

function abaAlertas(
  wb: ExcelJS.Workbook,
  r: Resultado,
  porCodigo: Map<string, ItemResultado>,
): void {
  const ws = criarAbaTabela(wb, 'Alertas', [
    { cabecalho: 'Tipo', largura: 24 },
    { cabecalho: 'Gravidade', largura: 11 },
    { cabecalho: 'Item', largura: 14 },
    { cabecalho: 'Descrição', largura: 36 },
    { cabecalho: 'Mensagem', largura: 90 },
  ])
  for (const a of r.alertas) {
    const l = ws.addRow([
      a.tipo,
      ROTULO_GRAVIDADE[a.gravidade] ?? a.gravidade,
      a.codigo,
      porCodigo.get(a.codigo)?.descricao ?? '',
      a.mensagem,
    ])
    const cor = COR_GRAVIDADE[a.gravidade]
    if (cor) pintar(l.getCell(2), cor, true)
    l.getCell(2).alignment = { horizontal: 'center' }
  }
  if (r.alertas.length === 0) ws.addRow(['Nenhum alerta.']).font = { italic: true }
}

// ---------------------------------------------------------------------------
// 9. Qualidade_Dados

function abaQualidade(wb: ExcelJS.Workbook, r: Resultado): void {
  const ws = criarAbaTabela(wb, 'Qualidade_Dados', [
    { cabecalho: 'Regra', largura: 38 },
    { cabecalho: 'Gravidade', largura: 11 },
    { cabecalho: 'Aba', largura: 16 },
    { cabecalho: 'Linha de origem', largura: 10, formato: FMT_INT },
    { cabecalho: 'Código', largura: 16 },
    { cabecalho: 'Mensagem', largura: 100 },
  ])
  for (const p of r.qualidade.problemas) {
    const l = ws.addRow([
      DESCRICAO_REGRA[p.regra] ?? p.regra,
      ROTULO_GRAVIDADE[p.gravidade] ?? p.gravidade,
      p.aba,
      n(p.linha),
      p.codigo ?? '',
      p.mensagem,
    ])
    const cor = COR_GRAVIDADE[p.gravidade]
    if (cor) pintar(l.getCell(2), cor, true)
    l.getCell(2).alignment = { horizontal: 'center' }
  }
  if (r.qualidade.problemas.length === 0)
    ws.addRow(['Nenhum problema encontrado nos dados.']).font = { italic: true }
}

// ---------------------------------------------------------------------------
// 10. Parametros_Usados

function abaParametrosUsados(wb: ExcelJS.Workbook, r: Resultado): void {
  const ws = criarAbaTabela(wb, 'Parametros_Usados', [
    { cabecalho: 'Parâmetro', largura: 44 },
    { cabecalho: 'Valor', largura: 22 },
    { cabecalho: 'Observação', largura: 80 },
  ])
  ws.getColumn(4).width = 12
  const p = r.parametros
  const j = r.janela
  const linhas: [string, ExcelJS.CellValue, string | undefined, string][] = [
    ['Período de análise', p.periodicidade === 'mensal' ? 'Mensal' : 'Semanal', undefined, ''],
    [
      'Janela de histórico (períodos)',
      p.janelaPeriodos,
      FMT_INT,
      j.rotulos.length > 0 ? `Analisado: ${j.rotulos[0]} a ${j.rotulos[j.rotulos.length - 1]}` : '',
    ],
    [
      'Excluir período corrente incompleto',
      simNao(p.excluirPeriodoIncompleto),
      undefined,
      'Período parcial subestima a demanda',
    ],
    ['Corte ABC — classe A (valor acumulado anterior <)', p.corteA, FMT_PCT, 'Pareto clássico'],
    ['Corte ABC — classe B (valor acumulado anterior <)', p.corteB, FMT_PCT, 'C no restante'],
    ['Corte XYZ — X (CV ≤)', p.corteX, FMT_DEC2, ''],
    ['Corte XYZ — Y (CV ≤)', p.corteY, FMT_DEC2, 'Z acima'],
    ['Corte Syntetos-Boylan — ADI', p.corteADI, FMT_DEC2, 'Syntetos, Boylan & Croston (2005)'],
    ['Corte Syntetos-Boylan — CV²', p.corteCV2, FMT_DEC2, ''],
    [
      'Mínimo de períodos com dados',
      p.minPeriodos,
      FMT_INT,
      'Abaixo disso: "Histórico insuficiente"',
    ],
    ['Média móvel — itens suaves/erráticos (períodos)', p.periodosMediaMovel, FMT_INT, ''],
    ['α do SBA — itens intermitentes/irregulares', p.alphaSBA, FMT_DEC2, 'Croston corrigido'],
    ['Método de previsão', ROTULO_METODO_MODO[p.metodoPrevisao], undefined, ''],
    [
      'Dias por período',
      j.diasPorPeriodo,
      FMT_INT,
      p.diasPorPeriodo === null ? 'Padrão da periodicidade' : 'Informado',
    ],
    ['Períodos por ano', j.periodosPorAno, FMT_INT, 'Usado em toda anualização (D, giro, ABC)'],
    ['Custo de emissão do pedido (S)', p.custoPedido, FMT_MOEDA, ''],
    ['Taxa de manutenção de estoque (i, ao ano)', p.taxaManutencaoAnual, FMT_PCT, ''],
    ['Dias sem saída para "sem giro"', p.diasSemGiro, FMT_INT, ''],
    ['Abater devoluções ao estoque da demanda', simNao(p.abaterDevolucoes), undefined, ''],
    [
      'Lead time padrão (itens sem lead time, dias)',
      p.leadTimePadraoDias,
      FMT_INT,
      'Aplicado com aviso de qualidade',
    ],
    ['Horizonte do MRP (semanas)', p.horizonteMRP, FMT_INT, ''],
    ['Política de lote no MRP', ROTULO_POLITICA[p.politicaLote], undefined, ''],
    [
      'Período fixo — semanas por pedido (POQ)',
      p.periodoFixoSemanas,
      FMT_INT,
      'Usado só na política de período fixo',
    ],
    [
      'Data-base',
      dataParaExcel(r.dataBase),
      FMT_DATA,
      p.dataBase === null ? 'Data da última movimentação válida' : 'Informada',
    ],
  ]
  for (const [rot, val, fmt, obs] of linhas) {
    const l = ws.addRow([rot, typeof val === 'number' ? n(val) : val, obs])
    if (fmt) l.getCell(2).numFmt = fmt
    l.getCell(2).alignment = { horizontal: 'left' }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: linhas.length + 1, column: 3 } }

  ws.addRow([])
  const tit = ws.addRow(['Matriz de nível de serviço (ABC × XYZ)'])
  tit.font = { bold: true, size: 12, color: { argb: COR_MARINHO } }
  const cab = ws.addRow(['Classe', 'X', 'Y', 'Z'])
  estilizarCabecalho(cab)
  for (const abc of ['A', 'B', 'C'] as const) {
    const l = ws.addRow([
      abc,
      n(p.nivelServico[abc].X),
      n(p.nivelServico[abc].Y),
      n(p.nivelServico[abc].Z),
    ])
    pintar(l.getCell(1), COR_CLASSE[abc], true)
    l.getCell(1).alignment = { horizontal: 'center' }
    for (let c = 2; c <= 4; c++) {
      l.getCell(c).numFmt = FMT_PCT
      l.getCell(c).alignment = { horizontal: 'center' }
    }
  }

  blocoMulticriterio(ws, r)
}

/** Bloco "ABC multicritério" da aba Parametros_Usados (seção 16-B, "Saída Excel"). */
function blocoMulticriterio(ws: ExcelJS.Worksheet, r: Resultado): void {
  const mc = r.multicriterio
  const titulo = (texto: string, tamanho = 12) => {
    ws.addRow([])
    ws.addRow([texto]).font = { bold: true, size: tamanho, color: { argb: COR_MARINHO } }
  }
  const linha = (rotulo: string, valor: ExcelJS.CellValue, formato?: string, obs = '') => {
    const l = ws.addRow([rotulo, typeof valor === 'number' ? n(valor) : valor, obs])
    if (formato) l.getCell(2).numFmt = formato
    l.getCell(2).alignment = { horizontal: 'left' }
    return l
  }

  titulo('ABC multicritério', 13)
  linha(
    'Ligado',
    simNao(mc !== null),
    undefined,
    mc
      ? 'A classe final substitui a classe por valor na matriz ABC×XYZ, no nível de serviço, nas prioridades de compra e nos KPIs.'
      : 'Classe ABC só por valor de consumo anual.',
  )
  if (!mc) return
  const cfg = mc.config
  const ponderado = cfg.modo === 'ponderado'
  linha('Modo', ROTULO_MODO_MC[cfg.modo])
  if (ponderado) {
    linha(
      'Normalização',
      ROTULO_NORMALIZACAO[cfg.normalizacao],
      undefined,
      cfg.normalizacao === 'posto'
        ? '(posição no ranking crescente − 1) ÷ (n − 1), empates com a média dos postos; 1 = mais crítico; dado faltando = 0,5'
        : '(x − mín) ÷ (máx − mín); 1 = mais crítico; dado faltando = 0,5',
    )
    linha(
      'Método de classes',
      ROTULO_METODO_CLASSES[cfg.metodoClasses],
      undefined,
      'Score S = Σ peso × valor normalizado',
    )
    if (cfg.metodoClasses === 'percentual') {
      linha('Itens em A (% dos itens)', cfg.percentuais.A, FMT_PCT)
      linha('Itens em B (% dos itens)', cfg.percentuais.B, FMT_PCT, 'C no restante')
    } else if (cfg.metodoClasses === 'cortes') {
      linha('Corte de score — classe A (S ≥)', cfg.cortes.A, FMT_3)
      linha('Corte de score — classe B (S ≥)', cfg.cortes.B, FMT_3, 'C abaixo')
    }
    linha(
      'Simulações de estabilidade',
      cfg.simulacoes,
      FMT_INT,
      'Cada peso perturbado ao acaso e renormalizado para 100%',
    )
    linha(
      'Perturbação máxima de cada peso (± p.p.)',
      cfg.perturbacao,
      FMT_PCT,
      'Classe instável: mantida em menos de 70% das simulações',
    )
  }
  linha('Itens que subiram de classe', mc.subiram, FMT_INT)
  linha('Itens que desceram de classe', mc.desceram, FMT_INT)
  if (ponderado) linha('Itens com classe instável', mc.instaveis, FMT_INT)

  // Pesos efetivos (renormalizados) e direção de cada critério.
  if (ponderado) {
    titulo('Pesos dos critérios (efetivos, somando 100%)')
    estilizarCabecalho(ws.addRow(['Critério', 'Peso', 'Direção / observação']))
    for (const c of mc.criterios) {
      const peso = mc.pesos[c.id] ?? 0
      const partes = [c.direcao === 'menor' ? 'Menor = mais crítico' : 'Maior = mais crítico']
      if (c.id.startsWith('crit_'))
        partes.push(`critério próprio (${c.id}), direção escolhida na tela`)
      partes.push(`${c.itensComDado} itens com dado`)
      if (c.id === 'cv' && peso > 0)
        partes.push('atenção: a variabilidade já é o eixo XYZ e conta duas vezes no score')
      linha(c.nome, peso, FMT_PCT, partes.join('; '))
    }
  }

  // Regras de piso.
  titulo('Regras de piso')
  estilizarCabecalho(ws.addRow(['Regra', 'Ativa', 'Itens afetados']))
  if (cfg.regras.length === 0)
    ws.addRow(['Nenhuma regra de piso cadastrada.']).font = { italic: true }
  for (const rg of cfg.regras) {
    const texto = descreverRegra(rg)
    const afetados = r.itens.filter((i) => i.multicriterio?.regraAplicada === texto).length
    linha(
      texto,
      simNao(rg.ativa),
      undefined,
      rg.ativa ? `${afetados} item(ns) subiram por esta regra` : '',
    )
  }

  // Matriz VED (modo 2).
  if (cfg.modo === 'ved') {
    titulo('Matriz ABC por valor × criticidade (VED)')
    estilizarCabecalho(
      ws.addRow(['Classe por valor', 'Vital (V)', 'Essencial (E)', 'Desejável (D)']),
    )
    for (const abc of ['A', 'B', 'C'] as const) {
      const l = ws.addRow([abc, cfg.matrizVED[abc].V, cfg.matrizVED[abc].E, cfg.matrizVED[abc].D])
      pintarClasse(l.getCell(1), abc)
      for (const [k, ved] of (['V', 'E', 'D'] as const).entries())
        pintarClasse(l.getCell(2 + k), cfg.matrizVED[abc][ved])
    }
  }

  // Assistente AHP (Saaty), se usado.
  const ahp = cfg.ahp
  if (ahp) {
    const nomes = ahp.criterios.map(nomeCriterio)
    titulo('Assistente AHP — comparações par a par (escala de Saaty, linha ÷ coluna)')
    estilizarCabecalho(ws.addRow(['Critério', ...nomes, 'Peso AHP']))
    for (let c = 4; c <= nomes.length + 2; c++)
      ws.getColumn(c).width = Math.max(ws.getColumn(c).width ?? 0, 14)
    ahp.matriz.forEach((linhaM, i) => {
      const l = ws.addRow([nomes[i], ...linhaM.map((x) => n(x, 6)), n(ahp.pesos[i])])
      l.getCell(1).font = { bold: true }
      for (let c = 2; c <= nomes.length + 1; c++) {
        l.getCell(c).numFmt = FMT_3
        l.getCell(c).alignment = { horizontal: 'center' }
      }
      l.getCell(nomes.length + 2).numFmt = FMT_PCT
      l.getCell(nomes.length + 2).alignment = { horizontal: 'center' }
    })
    ws.addRow([])
    linha('λmáx', ahp.lambdaMax, FMT_3, 'Média de (A·w)ᵢ ÷ wᵢ')
    linha('CI', ahp.ci, FMT_3, 'CI = (λmáx − n) ÷ (n − 1)')
    const incoerente = ahp.cr > 0.1
    const lCR = linha(
      'CR',
      ahp.cr,
      FMT_3,
      incoerente
        ? 'CR > 0,10: comparações incoerentes. Revise os pares no assistente AHP.'
        : 'CR = CI ÷ RI; até 0,10 as comparações são consideradas coerentes.',
    )
    if (incoerente) {
      pintar(lCR.getCell(2), { fundo: FUNDO_ALERTA, texto: TEXTO_ALERTA }, true)
      lCR.getCell(3).font = { bold: true, color: { argb: TEXTO_ALERTA } }
    }
  }
}
