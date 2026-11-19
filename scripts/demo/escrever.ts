// Grava os dados de demonstração num .xlsx no formato da planilha-modelo.

import {
  COR_SEGURANCA,
  criarAbaTabela,
  FMT_DATA,
  FMT_MOEDA,
  type ModuloExcel,
} from '../../src/io/estilo-excel'
import type { DadosDemo } from './dados'

const nulo = (x: number | null | undefined) =>
  x === null || x === undefined || Number.isNaN(x) ? null : x

export async function escreverDemo(
  Excel: ModuloExcel,
  dados: DadosDemo,
  descricao: string,
): Promise<ArrayBuffer> {
  const wb = new Excel.Workbook()
  wb.creator = 'Kit Estoque MRP — dados sintéticos'

  const leia = wb.addWorksheet('Leia-me', { properties: { tabColor: { argb: COR_SEGURANCA } } })
  leia.getColumn(1).width = 110
  leia.addRow(['Metalúrgica Exemplo Ltda — dados de demonstração']).font = { bold: true, size: 14 }
  leia.addRow([descricao])
  leia.addRow([
    'Todos os dados são 100% sintéticos, gerados por scripts/gerar-dados-demo.ts com semente fixa. Nenhum dado real de empresa.',
  ])

  // Colunas do ABC multicritério (seção 16-B): só quando algum item tem esses dados.
  const temMC = dados.materiais.some(
    (m) =>
      m.criticidade !== null ||
      m.num_fornecedores !== null ||
      m.possui_substituto !== null ||
      m.custo_parada_hora !== null ||
      m.classe_manual !== null,
  )
  const temCritSeguranca = dados.materiais.some((m) => m.crit_seguranca !== null)
  const colunasMC: { cabecalho: string; largura: number; formato?: string }[] = temMC
    ? [
        { cabecalho: 'criticidade', largura: 12 },
        { cabecalho: 'num_fornecedores', largura: 16 },
        { cabecalho: 'possui_substituto', largura: 17 },
        { cabecalho: 'custo_parada_hora', largura: 17, formato: FMT_MOEDA },
        { cabecalho: 'classe_manual', largura: 13 },
        { cabecalho: 'justificativa_classe', largura: 44 },
      ]
    : []
  if (temCritSeguranca) colunasMC.push({ cabecalho: 'crit_seguranca', largura: 14 })

  const mat = criarAbaTabela(wb, 'Materiais', [
    { cabecalho: 'codigo', largura: 12 },
    { cabecalho: 'descricao', largura: 40 },
    { cabecalho: 'unidade', largura: 9 },
    { cabecalho: 'estoque_atual', largura: 13 },
    { cabecalho: 'custo_unitario', largura: 14, formato: FMT_MOEDA },
    { cabecalho: 'lead_time_dias', largura: 14 },
    { cabecalho: 'desvio_lead_time_dias', largura: 20 },
    { cabecalho: 'lote_minimo', largura: 12 },
    { cabecalho: 'multiplo_compra', largura: 15 },
    { cabecalho: 'estoque_seguranca_manual', largura: 23 },
    { cabecalho: 'fornecedor', largura: 30 },
    { cabecalho: 'categoria', largura: 16 },
    { cabecalho: 'tipo_item', largura: 11 },
    { cabecalho: 'data_cadastro', largura: 13, formato: FMT_DATA },
    ...colunasMC,
  ])
  for (const m of dados.materiais) {
    const extras: (string | number | null)[] = temMC
      ? [
          m.criticidade,
          nulo(m.num_fornecedores),
          m.possui_substituto,
          nulo(m.custo_parada_hora),
          m.classe_manual,
          m.justificativa_classe,
        ]
      : []
    if (temCritSeguranca) extras.push(nulo(m.crit_seguranca))
    mat.addRow([
      m.codigo,
      m.descricao,
      m.unidade,
      m.estoque_atual,
      nulo(m.custo_unitario),
      nulo(m.lead_time_dias),
      nulo(m.desvio_lead_time_dias),
      nulo(m.lote_minimo),
      nulo(m.multiplo_compra),
      nulo(m.estoque_seguranca_manual),
      m.fornecedor,
      m.categoria,
      m.tipo_item,
      m.data_cadastro,
      ...extras,
    ])
  }

  const mov = criarAbaTabela(wb, 'Movimentacoes', [
    { cabecalho: 'data', largura: 12, formato: FMT_DATA },
    { cabecalho: 'codigo', largura: 12 },
    { cabecalho: 'tipo', largura: 24 },
    { cabecalho: 'quantidade', largura: 12 },
    { cabecalho: 'valor_total', largura: 14, formato: FMT_MOEDA },
    { cabecalho: 'documento', largura: 16 },
  ])
  for (const m of dados.movimentacoes)
    mov.addRow([m.data, m.codigo, m.tipo, m.quantidade, nulo(m.valor_total), m.documento])

  const ped = criarAbaTabela(wb, 'PedidosAbertos', [
    { cabecalho: 'codigo', largura: 12 },
    { cabecalho: 'data_prevista', largura: 14, formato: FMT_DATA },
    { cabecalho: 'quantidade', largura: 12 },
  ])
  for (const p of dados.pedidos) ped.addRow([p.codigo, p.data_prevista, p.quantidade])

  if (dados.bom.length) {
    const bom = criarAbaTabela(wb, 'BOM', [
      { cabecalho: 'codigo_pai', largura: 12 },
      { cabecalho: 'codigo_filho', largura: 12 },
      { cabecalho: 'quantidade_por', largura: 15 },
      { cabecalho: 'perda_pct', largura: 10 },
    ])
    for (const b of dados.bom)
      bom.addRow([b.codigo_pai, b.codigo_filho, b.quantidade_por, b.perda_pct])
  }
  if (dados.mps.length) {
    const mps = criarAbaTabela(wb, 'MPS', [
      { cabecalho: 'codigo', largura: 12 },
      { cabecalho: 'semana_inicio', largura: 14, formato: FMT_DATA },
      { cabecalho: 'quantidade', largura: 12 },
    ])
    for (const m of dados.mps) mps.addRow([m.codigo, m.semana_inicio, m.quantidade])
  }
  if (dados.equipamentos.length) {
    const eq = criarAbaTabela(wb, 'Equipamentos', [
      { cabecalho: 'equipamento', largura: 34 },
      { cabecalho: 'criticidade', largura: 12 },
      { cabecalho: 'setor', largura: 16 },
    ])
    for (const e of dados.equipamentos) eq.addRow([e.equipamento, e.criticidade, e.setor])
  }
  if (dados.ondeUsado.length) {
    const ou = criarAbaTabela(wb, 'OndeUsado', [
      { cabecalho: 'codigo', largura: 12 },
      { cabecalho: 'equipamento', largura: 34 },
    ])
    for (const u of dados.ondeUsado) ou.addRow([u.codigo, u.equipamento])
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}
