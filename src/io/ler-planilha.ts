// Leitura de .xlsx/.csv → tabelas brutas → estrutura normalizada do engine.
// Roda dentro do worker (SheetJS e PapaParse não dependem de DOM).

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type {
  Entrada,
  ItemBOM,
  ItemMPS,
  Material,
  Movimento,
  PedidoAberto,
  TipoItem,
} from '../engine/tipos'
import {
  lerData,
  lerNumero,
  lerNumeroOpcional,
  lerPercentual,
  lerTexto,
  type EstiloDecimal,
} from './conversao'
import {
  ABAS_OBRIGATORIAS,
  CAMPOS,
  identificarAbaPorCabecalhos,
  identificarAbaPorNome,
  interpretarTipo,
  mapearColunas,
  normalizarTexto,
  type MapaColunas,
  type NomeAba,
} from './mapeamento'

export interface ArquivoEntrada {
  nome: string
  dados: ArrayBuffer
}

export interface TabelaBruta {
  /** Nome da aba (xlsx) ou do arquivo (csv). */
  origem: string
  cabecalhos: string[]
  linhas: unknown[][]
  /** Número (1-based) da linha de cada registro na planilha. */
  numerosLinha: number[]
  estiloDecimal: EstiloDecimal
  data1904: boolean
}

export type Tabelas = Partial<Record<NomeAba, TabelaBruta>>

export class ErroLeitura extends Error {}

const linhaVazia = (l: readonly unknown[]) =>
  l.every((c) => c === null || c === undefined || String(c).trim() === '')

/** Separa cabeçalho (1ª linha com ≥ 2 células preenchidas entre as 10 primeiras) e dados. */
function montarTabela(
  origem: string,
  matriz: unknown[][],
  primeiraLinha: number,
  estilo: EstiloDecimal,
  data1904: boolean,
): TabelaBruta | null {
  let h = -1
  for (let i = 0; i < Math.min(10, matriz.length); i++) {
    const preenchidas = (matriz[i] ?? []).filter(
      (c) => c !== null && c !== undefined && String(c).trim() !== '',
    ).length
    if (preenchidas >= 2) {
      h = i
      break
    }
  }
  if (h < 0) return null
  const cabecalhos = (matriz[h] ?? []).map((c) => lerTexto(c))
  const linhas: unknown[][] = []
  const numerosLinha: number[] = []
  for (let i = h + 1; i < matriz.length; i++) {
    const l = matriz[i] ?? []
    if (linhaVazia(l)) continue
    linhas.push(l)
    numerosLinha.push(primeiraLinha + i)
  }
  return { origem, cabecalhos, linhas, numerosLinha, estiloDecimal: estilo, data1904 }
}

const BOM_UTF8 = new RegExp('^' + String.fromCharCode(0xfeff))

/** Decodifica bytes de CSV: UTF-8 (com ou sem BOM); se inválido, Windows-1252. */
export function decodificarTexto(dados: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(dados).replace(BOM_UTF8, '')
  } catch {
    return new TextDecoder('windows-1252').decode(dados)
  }
}

export function lerCSV(nome: string, texto: string): TabelaBruta | null {
  const r = Papa.parse<string[]>(texto, { delimiter: '', skipEmptyLines: false })
  const delim = r.meta.delimiter
  const estilo: EstiloDecimal = delim === ',' ? 'ponto' : 'virgula'
  return montarTabela(nome, r.data as unknown[][], 1, estilo, false)
}

/** Lê todas as abas relevantes de um .xlsx (só as necessárias, em modo denso). */
export function lerXLSX(nome: string, dados: ArrayBuffer): TabelaBruta[] {
  const livroNomes = XLSX.read(dados, { type: 'array', bookSheets: true })
  const nomes = livroNomes.SheetNames.filter(
    (n) => !/^(instru|leia|readme|lista|listas|config)/i.test(normalizarTexto(n)),
  )
  const livro = XLSX.read(dados, {
    type: 'array',
    dense: true,
    cellDates: false,
    cellNF: false,
    cellText: false,
    sheets: nomes,
  })
  const data1904 = Boolean(livro.Workbook?.WBProps?.date1904)
  const tabelas: TabelaBruta[] = []
  for (const n of nomes) {
    const ws = livro.Sheets[n]
    if (!ws || !ws['!ref']) continue
    const inicio = XLSX.utils.decode_range(ws['!ref']).s.r + 1
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    })
    const t = montarTabela(n, matriz, inicio, 'virgula', data1904)
    if (t) tabelas.push(t)
  }
  if (tabelas.length === 0)
    throw new ErroLeitura(`O arquivo "${nome}" não tem nenhuma aba com dados.`)
  return tabelas
}

/** Lê um ou mais arquivos (.xlsx ou .csv) e identifica as abas. */
export function lerArquivos(arquivos: readonly ArquivoEntrada[]): Tabelas {
  const brutas: TabelaBruta[] = []
  for (const a of arquivos) {
    if (/\.(csv|txt)$/i.test(a.nome)) {
      const t = lerCSV(a.nome, decodificarTexto(a.dados))
      if (t) brutas.push(t)
    } else if (/\.(xlsx|xlsm)$/i.test(a.nome)) {
      brutas.push(...lerXLSX(a.nome, a.dados))
    } else if (/\.xls$/i.test(a.nome)) {
      brutas.push(...lerXLSX(a.nome, a.dados))
    } else {
      throw new ErroLeitura(`Formato não suportado: "${a.nome}". Envie .xlsx ou .csv.`)
    }
  }

  const tabelas: Tabelas = {}
  const sobra: TabelaBruta[] = []
  for (const t of brutas) {
    const aba = identificarAbaPorNome(t.origem)
    if (aba && !tabelas[aba]) tabelas[aba] = t
    else sobra.push(t)
  }
  for (const t of sobra) {
    const aba = identificarAbaPorCabecalhos(t.cabecalhos)
    if (aba && !tabelas[aba]) tabelas[aba] = t
  }

  const faltam = ABAS_OBRIGATORIAS.filter((a) => !tabelas[a])
  if (faltam.length) {
    const encontradas = brutas.map((t) => `"${t.origem}"`).join(', ')
    throw new ErroLeitura(
      `Não encontrei ${faltam.map((a) => `a aba "${a}"`).join(' nem ')}. Abas/arquivos lidos: ${encontradas}. ` +
        'Renomeie as abas como na planilha-modelo (Materiais e Movimentacoes) ou envie um CSV para cada uma.',
    )
  }
  return tabelas
}

export interface PendenciaMapeamento {
  aba: NomeAba
  origem: string
  cabecalhos: string[]
  amostra: string[][]
  mapa: MapaColunas
  faltando: string[]
}

/** Mapeia as colunas de todas as abas encontradas. */
export function mapearTabelas(
  tabelas: Tabelas,
  salvos: Partial<Record<NomeAba, MapaColunas>> = {},
): {
  mapas: Partial<Record<NomeAba, MapaColunas>>
  pendencias: PendenciaMapeamento[]
  todas: PendenciaMapeamento[]
} {
  const mapas: Partial<Record<NomeAba, MapaColunas>> = {}
  const pendencias: PendenciaMapeamento[] = []
  const todas: PendenciaMapeamento[] = []
  for (const [aba, t] of Object.entries(tabelas) as [NomeAba, TabelaBruta][]) {
    const { mapa, faltando } = mapearColunas(t.cabecalhos, aba, salvos[aba])
    mapas[aba] = mapa
    const info: PendenciaMapeamento = {
      aba,
      origem: t.origem,
      cabecalhos: t.cabecalhos,
      amostra: t.linhas.slice(0, 5).map((l) => t.cabecalhos.map((_, i) => lerTexto(l[i]))),
      mapa,
      faltando,
    }
    todas.push(info)
    if (faltando.length) pendencias.push(info)
  }
  return { mapas, pendencias, todas }
}

function tipoItem(v: unknown): TipoItem {
  const n = normalizarTexto(v)
  return n.startsWith('fab') || n === 'f' || n.startsWith('prod') || n === 'manufaturado'
    ? 'Fabricado'
    : 'Comprado'
}

/** Converte as tabelas mapeadas na estrutura `Entrada` do engine. */
export function converter(tabelas: Tabelas, mapas: Partial<Record<NomeAba, MapaColunas>>): Entrada {
  const pegar = (aba: NomeAba) => {
    const t = tabelas[aba]
    const mapa = mapas[aba]
    if (!t || !mapa) return null
    const faltando = CAMPOS[aba].filter(
      (d) => d.obrigatorio && (mapa[d.campo] === null || mapa[d.campo] === undefined),
    )
    if (faltando.length)
      throw new ErroLeitura(
        `Aba ${aba}: faltam as colunas ${faltando.map((d) => d.rotulo).join(', ')}.`,
      )
    const col = (linha: unknown[], campo: string) => {
      const i = mapa[campo]
      return i === null || i === undefined ? null : linha[i]
    }
    return { t, col }
  }

  const materiais: Material[] = []
  const mat = pegar('Materiais')
  if (mat) {
    const { t, col } = mat
    const num = (l: unknown[], c: string) => lerNumeroOpcional(col(l, c), t.estiloDecimal)
    t.linhas.forEach((l, k) => {
      materiais.push({
        codigo: lerTexto(col(l, 'codigo')),
        descricao: lerTexto(col(l, 'descricao')),
        unidade: lerTexto(col(l, 'unidade')).toUpperCase() || 'UN',
        estoqueAtual: lerNumero(col(l, 'estoque_atual'), t.estiloDecimal),
        custoUnitario: num(l, 'custo_unitario'),
        leadTimeDias: num(l, 'lead_time_dias'),
        desvioLeadTimeDias: num(l, 'desvio_lead_time_dias'),
        loteMinimo: num(l, 'lote_minimo'),
        multiploCompra: num(l, 'multiplo_compra'),
        estoqueSegurancaManual: num(l, 'estoque_seguranca_manual'),
        fornecedor: lerTexto(col(l, 'fornecedor')) || undefined,
        categoria: lerTexto(col(l, 'categoria')) || undefined,
        tipoItem: tipoItem(col(l, 'tipo_item')),
        dataCadastro: lerData(col(l, 'data_cadastro'), t.data1904) ?? undefined,
        linha: t.numerosLinha[k],
      })
    })
  }

  const movimentacoes: Movimento[] = []
  const mv = pegar('Movimentacoes')
  if (mv) {
    const { t, col } = mv
    t.linhas.forEach((l, k) => {
      const tipoBruto = col(l, 'tipo')
      const { tipo, ambiguo } = interpretarTipo(tipoBruto)
      movimentacoes.push({
        data: lerData(col(l, 'data'), t.data1904),
        codigo: lerTexto(col(l, 'codigo')),
        tipo,
        tipoOriginal: lerTexto(tipoBruto),
        tipoAmbiguo: ambiguo,
        quantidade: lerNumero(col(l, 'quantidade'), t.estiloDecimal),
        valorTotal: lerNumeroOpcional(col(l, 'valor_total'), t.estiloDecimal),
        documento: lerTexto(col(l, 'documento')) || undefined,
        linha: t.numerosLinha[k],
      })
    })
  }

  const pedidosAbertos: PedidoAberto[] = []
  const pa = pegar('PedidosAbertos')
  if (pa) {
    const { t, col } = pa
    t.linhas.forEach((l, k) =>
      pedidosAbertos.push({
        codigo: lerTexto(col(l, 'codigo')),
        dataPrevista: lerData(col(l, 'data_prevista'), t.data1904),
        quantidade: lerNumero(col(l, 'quantidade'), t.estiloDecimal),
        linha: t.numerosLinha[k],
      }),
    )
  }

  const bom: ItemBOM[] = []
  const b = pegar('BOM')
  if (b) {
    const { t, col } = b
    t.linhas.forEach((l, k) =>
      bom.push({
        codigoPai: lerTexto(col(l, 'codigo_pai')),
        codigoFilho: lerTexto(col(l, 'codigo_filho')),
        quantidadePor: lerNumero(col(l, 'quantidade_por'), t.estiloDecimal),
        perdaPct: lerPercentual(col(l, 'perda_pct'), t.estiloDecimal),
        linha: t.numerosLinha[k],
      }),
    )
  }

  const mps: ItemMPS[] = []
  const m = pegar('MPS')
  if (m) {
    const { t, col } = m
    t.linhas.forEach((l, k) =>
      mps.push({
        codigo: lerTexto(col(l, 'codigo')),
        semanaInicio: lerData(col(l, 'semana_inicio'), t.data1904),
        quantidade: lerNumero(col(l, 'quantidade'), t.estiloDecimal),
        linha: t.numerosLinha[k],
      }),
    )
  }

  return { materiais, movimentacoes, pedidosAbertos, bom, mps }
}

/** Atalho: lê, mapeia automaticamente e converte (lança se faltar coluna obrigatória). */
export function lerEntrada(arquivos: readonly ArquivoEntrada[]): Entrada {
  const tabelas = lerArquivos(arquivos)
  const { mapas, pendencias } = mapearTabelas(tabelas)
  if (pendencias.length) {
    const p = pendencias[0]
    throw new ErroLeitura(`Aba ${p.aba}: não encontrei as colunas ${p.faltando.join(', ')}.`)
  }
  return converter(tabelas, mapas)
}
