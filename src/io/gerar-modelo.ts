// Planilha-modelo para download (seção 5): abas, cabeçalhos, exemplo, validações e instruções.

import type ExcelJS from 'exceljs'
import { TIPOS_MOVIMENTO } from '../engine/tipos'
import {
  COR_SEGURANCA,
  criarAbaTabela,
  FMT_DATA,
  FMT_MOEDA,
  type ModuloExcel,
} from './estilo-excel'

/** ExcelJS tem dataValidations em tempo de execução, mas falta na tipagem. */
function validacoes(ws: ExcelJS.Worksheet) {
  return (
    ws as unknown as {
      dataValidations: { add(intervalo: string, v: ExcelJS.DataValidation): void }
    }
  ).dataValidations
}

const UNIDADES = 'UN,PC,CX,PCT,PAR,KG,G,L,ML,M,M2,M3'

export async function gerarModelo(Excel: ModuloExcel): Promise<ArrayBuffer> {
  const wb = new Excel.Workbook()
  wb.creator = 'Kit Estoque MRP'
  wb.created = new Date()

  // Instruções
  const ins = wb.addWorksheet('Instruções', { properties: { tabColor: { argb: COR_SEGURANCA } } })
  ins.getColumn(1).width = 26
  ins.getColumn(2).width = 100
  const titulo = ins.addRow(['Kit Estoque MRP — planilha-modelo'])
  titulo.font = { bold: true, size: 16 }
  ins.addRow(['Seus dados não saem do seu computador: o processamento é 100% no navegador.'])
  ins.addRow([])
  const linhas: [string, string][] = [
    [
      'Materiais (obrigatória)',
      'Uma linha por item. Obrigatórias: codigo, descricao, unidade, estoque_atual, lead_time_dias. custo_unitario é opcional: se faltar, usa o custo médio das entradas.',
    ],
    [
      'Movimentacoes (obrigatória)',
      'Uma linha por movimento. Obrigatórias: data, codigo, tipo, quantidade. A quantidade é sempre positiva; o sinal vem do tipo.',
    ],
    [
      'Tipos de movimento',
      'Entrada, Saída, Ajuste +, Ajuste -, Devolução ao estoque, Devolução ao fornecedor. Só "Saída" conta como consumo; devolução ao estoque abate a saída do mesmo período.',
    ],
    ['PedidosAbertos (opcional)', 'Recebimentos programados: codigo, data_prevista, quantidade.'],
    [
      'BOM (opcional)',
      'Estrutura de produto: codigo_pai, codigo_filho, quantidade_por, perda_pct (5 = 5%). Com BOM e MPS, o MRP explode as necessidades.',
    ],
    [
      'MPS (opcional)',
      'Plano mestre: codigo, semana_inicio (data da segunda-feira da semana), quantidade.',
    ],
    ['Datas', 'Aceita data do Excel, dd/mm/aaaa ou aaaa-mm-dd.'],
    ['Números', 'Use vírgula como separador decimal (1.234,56) ou números do próprio Excel.'],
    [
      'data_cadastro',
      'Opcional. Se o item é antigo mas não teve movimento no início do histórico, informe a data de cadastro para ele não ser tratado como item novo.',
    ],
    [
      'Cabeçalhos',
      'Os nomes das colunas podem variar (ex.: "cód", "SKU", "qtd"). Se o app não reconhecer, ele pede para você indicar qual coluna é qual.',
    ],
    ['Exemplo', 'Cada aba traz uma linha de exemplo. Apague e cole os seus dados.'],
  ]
  for (const [a, b] of linhas) {
    const r = ins.addRow([a, b])
    r.getCell(1).font = { bold: true }
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  }

  // Materiais
  const mat = criarAbaTabela(wb, 'Materiais', [
    { cabecalho: 'codigo', largura: 14 },
    { cabecalho: 'descricao', largura: 36 },
    { cabecalho: 'unidade', largura: 10 },
    { cabecalho: 'estoque_atual', largura: 14 },
    { cabecalho: 'custo_unitario', largura: 15, formato: FMT_MOEDA },
    { cabecalho: 'lead_time_dias', largura: 15 },
    { cabecalho: 'desvio_lead_time_dias', largura: 21 },
    { cabecalho: 'lote_minimo', largura: 13 },
    { cabecalho: 'multiplo_compra', largura: 16 },
    { cabecalho: 'estoque_seguranca_manual', largura: 24 },
    { cabecalho: 'fornecedor', largura: 24 },
    { cabecalho: 'categoria', largura: 16 },
    { cabecalho: 'tipo_item', largura: 12 },
    { cabecalho: 'data_cadastro', largura: 14, formato: FMT_DATA },
  ])
  mat.addRow([
    'PAR-M8X30',
    'Parafuso sextavado M8x30 zincado',
    'UN',
    1200,
    0.45,
    15,
    null,
    500,
    100,
    null,
    'Fornecedor Exemplo',
    'Componentes',
    'Comprado',
    new Date(Date.UTC(2023, 0, 10)),
  ])
  validacoes(mat).add('C2:C10000', { type: 'list', allowBlank: true, formulae: [`"${UNIDADES}"`] })
  validacoes(mat).add('M2:M10000', {
    type: 'list',
    allowBlank: true,
    formulae: ['"Comprado,Fabricado"'],
  })

  // Movimentações
  const mov = criarAbaTabela(wb, 'Movimentacoes', [
    { cabecalho: 'data', largura: 13, formato: FMT_DATA },
    { cabecalho: 'codigo', largura: 14 },
    { cabecalho: 'tipo', largura: 24 },
    { cabecalho: 'quantidade', largura: 12 },
    { cabecalho: 'valor_total', largura: 14, formato: FMT_MOEDA },
    { cabecalho: 'documento', largura: 16 },
  ])
  mov.addRow([new Date(Date.UTC(2025, 0, 15)), 'PAR-M8X30', 'Saída', 300, null, 'REQ-0001'])
  validacoes(mov).add('C2:C200000', {
    type: 'list',
    allowBlank: false,
    formulae: [`"${TIPOS_MOVIMENTO.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Tipo inválido',
    error: 'Escolha um dos tipos da lista.',
  })

  const ped = criarAbaTabela(wb, 'PedidosAbertos', [
    { cabecalho: 'codigo', largura: 14 },
    { cabecalho: 'data_prevista', largura: 14, formato: FMT_DATA },
    { cabecalho: 'quantidade', largura: 12 },
  ])
  ped.addRow(['PAR-M8X30', new Date(Date.UTC(2025, 1, 10)), 1000])

  const bom = criarAbaTabela(wb, 'BOM', [
    { cabecalho: 'codigo_pai', largura: 14 },
    { cabecalho: 'codigo_filho', largura: 14 },
    { cabecalho: 'quantidade_por', largura: 15 },
    { cabecalho: 'perda_pct', largura: 11 },
  ])
  bom.addRow(['PROD-01', 'PAR-M8X30', 8, 2])

  const mps = criarAbaTabela(wb, 'MPS', [
    { cabecalho: 'codigo', largura: 14 },
    { cabecalho: 'semana_inicio', largura: 14, formato: FMT_DATA },
    { cabecalho: 'quantidade', largura: 12 },
  ])
  mps.addRow(['PROD-01', new Date(Date.UTC(2025, 1, 3)), 50])

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}
