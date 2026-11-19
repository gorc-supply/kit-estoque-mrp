// Estilos compartilhados das planilhas geradas (modelo, demo e saída).
// Recebe o módulo ExcelJS por parâmetro: no navegador ele é carregado sob demanda.

import type ExcelJS from 'exceljs'

export type ModuloExcel = typeof ExcelJS

export const COR_MARINHO = 'FF0B1F3A'
export const COR_ACO = 'FF1E3A5F'
export const COR_SEGURANCA = 'FFF59E0B'
export const COR_CONCRETO = 'FFE5E7EB'

export const FMT_MOEDA = '"R$" #,##0.00'
export const FMT_PCT = '0.0%'
export const FMT_DATA = 'dd/mm/yyyy'
export const FMT_NUM = '#,##0.##'
export const FMT_INT = '#,##0'
export const FMT_DEC2 = '#,##0.00'

/** Cabeçalho marinho com texto branco, negrito, centralizado. */
export function estilizarCabecalho(linha: ExcelJS.Row): void {
  linha.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  linha.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  linha.height = 30
  linha.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_MARINHO } }
    c.border = { bottom: { style: 'thin', color: { argb: COR_SEGURANCA } } }
  })
}

/** Cria uma aba de tabela com cabeçalho formatado, painel congelado e autofiltro. */
export function criarAbaTabela(
  wb: ExcelJS.Workbook,
  nome: string,
  colunas: { cabecalho: string; largura?: number; formato?: string }[],
  cor = COR_ACO,
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(nome, {
    properties: { tabColor: { argb: cor } },
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }],
  })
  ws.columns = colunas.map((c) => ({
    header: c.cabecalho,
    width: c.largura ?? Math.max(12, c.cabecalho.length + 4),
    style: c.formato ? { numFmt: c.formato } : {},
  }))
  estilizarCabecalho(ws.getRow(1))
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } }
  return ws
}

/** Converte Date (meia-noite UTC) para Date local equivalente, para o ExcelJS gravar o dia certo. */
export function dataParaExcel(d: Date | null | undefined): Date | null {
  if (!d) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}
