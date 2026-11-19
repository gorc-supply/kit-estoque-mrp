// Mapeamento flexível de abas, colunas e tipos de movimento (seção 5.4).

import type { TipoMovimento } from '../engine/tipos'

/** Minúsculas, sem acento, sem pontuação de separação e sem espaço extra. */
export function normalizarTexto(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[_\-./\\:()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type NomeAba =
  'Materiais' | 'Movimentacoes' | 'PedidosAbertos' | 'BOM' | 'MPS' | 'Equipamentos' | 'OndeUsado'

export const ABAS: readonly NomeAba[] = [
  'Materiais',
  'Movimentacoes',
  'PedidosAbertos',
  'BOM',
  'MPS',
  'Equipamentos',
  'OndeUsado',
]
export const ABAS_OBRIGATORIAS: readonly NomeAba[] = ['Materiais', 'Movimentacoes']

export const SINONIMOS_ABA: Record<NomeAba, string[]> = {
  Materiais: [
    'materiais',
    'material',
    'cadastro',
    'cadastro de materiais',
    'itens',
    'produtos',
    'skus',
  ],
  Movimentacoes: [
    'movimentacoes',
    'movimentacao',
    'movimentos',
    'movimento',
    'mov',
    'kardex',
    'historico',
    'entradas e saidas',
  ],
  PedidosAbertos: [
    'pedidosabertos',
    'pedidos abertos',
    'pedidos em aberto',
    'pedidos',
    'recebimentos programados',
    'ordens abertas',
    'pedidos de compra',
  ],
  BOM: ['bom', 'estrutura', 'estrutura de produto', 'lista de materiais'],
  MPS: ['mps', 'plano mestre', 'plano mestre de producao', 'programa mestre'],
  Equipamentos: [
    'equipamentos',
    'equipamento',
    'maquinas',
    'ativos',
    'criticidade de equipamentos',
  ],
  OndeUsado: ['ondeusado', 'onde usado', 'onde e usado', 'aplicacao', 'aplicacoes', 'where used'],
}

export interface CampoDef {
  campo: string
  rotulo: string
  obrigatorio: boolean
  sinonimos: string[]
}

const COD = [
  'codigo',
  'cod',
  'sku',
  'material',
  'item',
  'cod material',
  'codigo material',
  'codigo do item',
  'cod item',
  'part number',
  'pn',
  'referencia',
  'ref',
]

export const CAMPOS: Record<NomeAba, CampoDef[]> = {
  Materiais: [
    { campo: 'codigo', rotulo: 'Código', obrigatorio: true, sinonimos: COD },
    {
      campo: 'descricao',
      rotulo: 'Descrição',
      obrigatorio: true,
      sinonimos: ['descricao', 'desc', 'descricao do item', 'nome', 'denominacao', 'texto breve'],
    },
    {
      campo: 'unidade',
      rotulo: 'Unidade',
      obrigatorio: true,
      sinonimos: ['unidade', 'un', 'und', 'unid', 'um', 'unidade de medida'],
    },
    {
      campo: 'estoque_atual',
      rotulo: 'Estoque atual',
      obrigatorio: true,
      sinonimos: [
        'estoque atual',
        'estoque',
        'saldo',
        'saldo atual',
        'qtd estoque',
        'quantidade em estoque',
        'saldo fisico',
        'on hand',
      ],
    },
    {
      campo: 'custo_unitario',
      rotulo: 'Custo unitário',
      obrigatorio: false,
      sinonimos: [
        'custo unitario',
        'custo',
        'preco unitario',
        'valor unitario',
        'cmm',
        'custo medio',
        'preco',
        'vl unitario',
      ],
    },
    {
      campo: 'lead_time_dias',
      rotulo: 'Lead time (dias)',
      obrigatorio: true,
      sinonimos: [
        'lead time dias',
        'lead time',
        'leadtime',
        'prazo',
        'prazo entrega',
        'prazo de entrega',
        'lt',
        'prazo dias',
      ],
    },
    {
      campo: 'desvio_lead_time_dias',
      rotulo: 'Desvio do lead time (dias)',
      obrigatorio: false,
      sinonimos: ['desvio lead time dias', 'desvio lead time', 'desvio prazo', 'desvio lt'],
    },
    {
      campo: 'lote_minimo',
      rotulo: 'Lote mínimo',
      obrigatorio: false,
      sinonimos: ['lote minimo', 'lote min', 'qtd minima', 'quantidade minima de compra', 'moq'],
    },
    {
      campo: 'multiplo_compra',
      rotulo: 'Múltiplo de compra',
      obrigatorio: false,
      sinonimos: [
        'multiplo compra',
        'multiplo',
        'multiplo de compra',
        'embalagem',
        'qtd embalagem',
      ],
    },
    {
      campo: 'estoque_seguranca_manual',
      rotulo: 'ES manual',
      obrigatorio: false,
      sinonimos: [
        'estoque seguranca manual',
        'es manual',
        'estoque de seguranca',
        'estoque seguranca',
        'es',
      ],
    },
    {
      campo: 'fornecedor',
      rotulo: 'Fornecedor',
      obrigatorio: false,
      sinonimos: ['fornecedor', 'fornecedor principal', 'vendor'],
    },
    {
      campo: 'categoria',
      rotulo: 'Categoria',
      obrigatorio: false,
      sinonimos: ['categoria', 'familia', 'grupo', 'grupo de material', 'classe material'],
    },
    {
      campo: 'tipo_item',
      rotulo: 'Tipo do item',
      obrigatorio: false,
      sinonimos: ['tipo item', 'tipo', 'tipo de item', 'origem'],
    },
    {
      campo: 'data_cadastro',
      rotulo: 'Data de cadastro',
      obrigatorio: false,
      sinonimos: [
        'data cadastro',
        'data de cadastro',
        'cadastrado em',
        'data criacao',
        'inicio de vida',
      ],
    },
    // ABC multicritério (seção 16-B)
    {
      campo: 'criticidade',
      rotulo: 'Criticidade',
      obrigatorio: false,
      sinonimos: ['criticidade', 'criticidade item', 'classe ved', 'ved', 'importancia'],
    },
    {
      campo: 'num_fornecedores',
      rotulo: 'Nº de fornecedores',
      obrigatorio: false,
      sinonimos: [
        'num fornecedores',
        'numero de fornecedores',
        'n fornecedores',
        'qtd fornecedores',
        'fornecedores',
      ],
    },
    {
      campo: 'possui_substituto',
      rotulo: 'Possui substituto',
      obrigatorio: false,
      sinonimos: ['possui substituto', 'substituto', 'tem substituto', 'item substituto'],
    },
    {
      campo: 'custo_parada_hora',
      rotulo: 'Custo de parada (R$/h)',
      obrigatorio: false,
      sinonimos: ['custo parada hora', 'custo de parada', 'custo parada', 'custo hora parada'],
    },
    {
      campo: 'classe_manual',
      rotulo: 'Classe manual',
      obrigatorio: false,
      sinonimos: ['classe manual', 'classe abc manual'],
    },
    {
      campo: 'justificativa_classe',
      rotulo: 'Justificativa da classe',
      obrigatorio: false,
      sinonimos: ['justificativa classe', 'justificativa da classe', 'justificativa'],
    },
  ],
  Movimentacoes: [
    {
      campo: 'data',
      rotulo: 'Data',
      obrigatorio: true,
      sinonimos: [
        'data',
        'dt',
        'data movimento',
        'data do movimento',
        'data lancamento',
        'data mov',
      ],
    },
    { campo: 'codigo', rotulo: 'Código', obrigatorio: true, sinonimos: COD },
    {
      campo: 'tipo',
      rotulo: 'Tipo',
      obrigatorio: true,
      sinonimos: [
        'tipo',
        'movimento',
        'tipo mov',
        'tipo movimento',
        'tipo de movimento',
        'natureza',
        'operacao',
        'es',
        'e s',
      ],
    },
    {
      campo: 'quantidade',
      rotulo: 'Quantidade',
      obrigatorio: true,
      sinonimos: ['quantidade', 'qtd', 'qtde', 'quant', 'qde', 'qty'],
    },
    {
      campo: 'valor_total',
      rotulo: 'Valor total',
      obrigatorio: false,
      sinonimos: ['valor total', 'valor', 'vl total', 'total', 'valor movimento'],
    },
    {
      campo: 'documento',
      rotulo: 'Documento',
      obrigatorio: false,
      sinonimos: ['documento', 'doc', 'nf', 'nota fiscal', 'requisicao', 'op', 'numero documento'],
    },
  ],
  PedidosAbertos: [
    { campo: 'codigo', rotulo: 'Código', obrigatorio: true, sinonimos: COD },
    {
      campo: 'data_prevista',
      rotulo: 'Data prevista',
      obrigatorio: true,
      sinonimos: [
        'data prevista',
        'previsao',
        'data entrega',
        'previsao entrega',
        'data de entrega',
        'entrega',
      ],
    },
    {
      campo: 'quantidade',
      rotulo: 'Quantidade',
      obrigatorio: true,
      sinonimos: [
        'quantidade',
        'qtd',
        'qtde',
        'quant',
        'saldo pedido',
        'qtd pendente',
        'qtd aberta',
      ],
    },
  ],
  BOM: [
    {
      campo: 'codigo_pai',
      rotulo: 'Código pai',
      obrigatorio: true,
      sinonimos: ['codigo pai', 'pai', 'cod pai', 'produto', 'item pai', 'montagem'],
    },
    {
      campo: 'codigo_filho',
      rotulo: 'Código filho',
      obrigatorio: true,
      sinonimos: ['codigo filho', 'filho', 'cod filho', 'componente', 'item filho'],
    },
    {
      campo: 'quantidade_por',
      rotulo: 'Quantidade por',
      obrigatorio: true,
      sinonimos: ['quantidade por', 'qtd por', 'quantidade', 'qtd', 'consumo', 'qtd unitaria'],
    },
    {
      campo: 'perda_pct',
      rotulo: 'Perda (%)',
      obrigatorio: false,
      sinonimos: ['perda pct', 'perda', 'perda %', 'refugo', 'perda percentual'],
    },
  ],
  MPS: [
    { campo: 'codigo', rotulo: 'Código', obrigatorio: true, sinonimos: COD },
    {
      campo: 'semana_inicio',
      rotulo: 'Semana (início)',
      obrigatorio: true,
      sinonimos: ['semana inicio', 'semana', 'data', 'inicio semana', 'periodo'],
    },
    {
      campo: 'quantidade',
      rotulo: 'Quantidade',
      obrigatorio: true,
      sinonimos: ['quantidade', 'qtd', 'qtde', 'quant'],
    },
  ],
  Equipamentos: [
    {
      campo: 'equipamento',
      rotulo: 'Equipamento',
      obrigatorio: true,
      sinonimos: ['equipamento', 'maquina', 'ativo', 'tag', 'codigo equipamento'],
    },
    {
      campo: 'criticidade',
      rotulo: 'Criticidade',
      obrigatorio: false,
      sinonimos: ['criticidade', 'classe ved', 'ved', 'importancia'],
    },
    {
      campo: 'setor',
      rotulo: 'Setor',
      obrigatorio: false,
      sinonimos: ['setor', 'area', 'linha', 'local'],
    },
  ],
  OndeUsado: [
    { campo: 'codigo', rotulo: 'Código', obrigatorio: true, sinonimos: COD },
    {
      campo: 'equipamento',
      rotulo: 'Equipamento',
      obrigatorio: true,
      sinonimos: ['equipamento', 'maquina', 'ativo', 'tag', 'codigo equipamento'],
    },
  ],
}

/** Mapa campo → índice da coluna (ou null). */
export type MapaColunas = Record<string, number | null>

export interface ResultadoMapeamento {
  mapa: MapaColunas
  faltando: string[]
}

/**
 * Mapeia cabeçalhos para campos: primeiro correspondência exata do nome do campo,
 * depois sinônimos (na ordem). Cada coluna é usada uma vez só.
 */
export function mapearColunas(
  cabecalhos: readonly unknown[],
  aba: NomeAba,
  salvo?: MapaColunas,
): ResultadoMapeamento {
  const normal = cabecalhos.map(normalizarTexto)
  const usados = new Set<number>()
  const mapa: MapaColunas = {}
  const defs = CAMPOS[aba]

  // Mapeamento lembrado (localStorage) vale se o cabeçalho ainda existir.
  if (salvo) {
    for (const d of defs) {
      const i = salvo[d.campo]
      if (i !== undefined && i !== null && i < normal.length && normal[i] && !usados.has(i)) {
        mapa[d.campo] = i
        usados.add(i)
      }
    }
  }
  for (const passo of ['exato', 'sinonimo'] as const) {
    for (const d of defs) {
      if (mapa[d.campo] !== undefined && mapa[d.campo] !== null) continue
      const alvos =
        passo === 'exato' ? [normalizarTexto(d.campo)] : d.sinonimos.map(normalizarTexto)
      for (const alvo of alvos) {
        const i = normal.findIndex((h, k) => h === alvo && !usados.has(k))
        if (i >= 0) {
          mapa[d.campo] = i
          usados.add(i)
          break
        }
      }
    }
  }
  for (const d of defs) if (mapa[d.campo] === undefined) mapa[d.campo] = null
  const faltando = defs.filter((d) => d.obrigatorio && mapa[d.campo] === null).map((d) => d.campo)
  return { mapa, faltando }
}

/** Identifica a aba pelo nome da planilha (ou do arquivo CSV). */
export function identificarAbaPorNome(nome: string): NomeAba | null {
  const n = normalizarTexto(nome.replace(/\.(csv|txt|xlsx|xlsm|xls)$/i, ''))
  const compacto = n.replace(/\s/g, '')
  for (const aba of ABAS) {
    for (const s of SINONIMOS_ABA[aba]) {
      const sn = normalizarTexto(s)
      if (n === sn || compacto === sn.replace(/\s/g, '')) return aba
    }
  }
  return null
}

/** Pontua o quanto os cabeçalhos combinam com cada aba (para planilhas com nomes livres). */
export function identificarAbaPorCabecalhos(cabecalhos: readonly unknown[]): NomeAba | null {
  let melhor: NomeAba | null = null
  let melhorNota = 0
  for (const aba of ABAS) {
    const { mapa, faltando } = mapearColunas(cabecalhos, aba)
    const achados = Object.values(mapa).filter((x) => x !== null).length
    const obrig = CAMPOS[aba].filter((d) => d.obrigatorio).length
    const nota = faltando.length === 0 ? 10 + achados + obrig : achados - faltando.length * 2
    if (nota > melhorNota) {
      melhorNota = nota
      melhor = aba
    }
  }
  return melhorNota >= 10 ? melhor : null
}

// ---------------------------------------------------------------------------
// Tipo de movimento

export interface TipoInterpretado {
  tipo: TipoMovimento | null
  ambiguo?: string
}

const MAPA_TIPOS: [string[], TipoMovimento][] = [
  [
    ['entrada', 'e', 'ent', 'compra', 'recebimento', 'entrada nf', 'entrada de compra', 'in'],
    'Entrada',
  ],
  [
    ['saida', 's', 'sai', 'consumo', 'requisicao', 'baixa', 'saida requisicao', 'venda', 'out'],
    'Saída',
  ],
  [
    [
      'ajuste +',
      'ajuste+',
      'ajuste positivo',
      'ajuste entrada',
      'ajuste de entrada',
      'inventario +',
      'acerto +',
      'aj +',
      'aj+',
    ],
    'Ajuste +',
  ],
  [
    [
      'ajuste -',
      'ajuste-',
      'ajuste negativo',
      'ajuste saida',
      'ajuste de saida',
      'inventario -',
      'acerto -',
      'aj -',
      'aj-',
    ],
    'Ajuste -',
  ],
  [
    [
      'devolucao ao estoque',
      'devolucao estoque',
      'dev estoque',
      'dev requisicao',
      'devolucao de requisicao',
      'retorno ao almoxarifado',
      'retorno almoxarifado',
      'devolucao de cliente',
      'devolucao cliente',
      'dev cliente',
    ],
    'Devolução ao estoque',
  ],
  [
    [
      'devolucao ao fornecedor',
      'devolucao fornecedor',
      'dev fornecedor',
      'devolucao de compra',
      'estorno de entrada',
      'estorno entrada',
    ],
    'Devolução ao fornecedor',
  ],
]

/** Como normalizarTexto, mas preserva + e − (e padroniza "ajuste-" → "ajuste -"). */
export function normalizarTipo(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[_./\\:()]+/g, ' ')
    .replace(/\s*([+-])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()
}

const INDICE_TIPOS = new Map<string, TipoMovimento>()
for (const [nomes, tipo] of MAPA_TIPOS)
  for (const n of nomes) INDICE_TIPOS.set(normalizarTipo(n), tipo)

const CODIGOS_SAP: Record<string, TipoMovimento> = {
  '101': 'Entrada',
  '102': 'Devolução ao fornecedor',
  '122': 'Devolução ao fornecedor',
  '201': 'Saída',
  '202': 'Devolução ao estoque',
  '261': 'Saída',
  '262': 'Devolução ao estoque',
}

export function interpretarTipo(valor: unknown): TipoInterpretado {
  const n = normalizarTipo(valor)
  const direto = INDICE_TIPOS.get(n)
  if (direto) return { tipo: direto }
  if (CODIGOS_SAP[n]) {
    return {
      tipo: CODIGOS_SAP[n],
      ambiguo: `tipo de movimento SAP ${n} interpretado como "${CODIGOS_SAP[n]}". Confira se é isso mesmo.`,
    }
  }
  if (n === 'devolucao' || n === 'dev' || n === 'devol') {
    return {
      tipo: 'Devolução ao estoque',
      ambiguo:
        '"Devolução" sem destino: tratada como devolução ao estoque. Confirme ou use "Devolução ao fornecedor".',
    }
  }
  return { tipo: null }
}
