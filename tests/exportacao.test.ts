import ExcelJS from 'exceljs'
import { beforeAll, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { gerarDemoIndustria, gerarDemoMontagem } from '../scripts/demo/dados'
import { escreverDemo } from '../scripts/demo/escrever'
import { arredondarQuantidade } from '../src/engine/estatistica'
import { processar, sugestoesOrdenadas, type Resultado } from '../src/engine/index'
import { ABAS_SAIDA, exportarExcel, nomeArquivoSaida } from '../src/io/exportar-excel'
import { lerEntrada } from '../src/io/ler-planilha'

// PNG 1×1 transparente.
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const OPCOES = { nomeArquivoOriginal: 'demo.xlsx', urlFerramenta: 'https://exemplo.github.io/kit' }

async function resultadoDemo(nome: string, dados: ReturnType<typeof gerarDemoIndustria>) {
  const b = await escreverDemo(ExcelJS, dados, 'teste')
  return processar(lerEntrada([{ nome, dados: b }]))
}

async function reabrirExcelJS(buf: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  return wb
}

/** Linhas de dados (sem cabeçalho) de uma aba, via SheetJS. */
function linhasSheetJS(wb: XLSX.WorkBook, aba: string): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1, blankrows: false })
}

/** Conferências estruturais contra o aviso de reparo do Excel. */
function conferirEstrutura(wb: ExcelJS.Workbook): void {
  expect(wb.worksheets.map((w) => w.name)).toEqual([...ABAS_SAIDA])
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value
        if (typeof v === 'number')
          expect(Number.isFinite(v), `${ws.name}!${cell.address}`).toBe(true)
        if (v instanceof Date) expect(Number.isNaN(v.getTime())).toBe(false)
      })
    })
    const cf = (
      ws as unknown as { conditionalFormattings?: { ref: string; rules: { type: string }[] }[] }
    ).conditionalFormattings
    for (const bloco of cf ?? [])
      for (const regra of bloco.rules) expect(['cellIs', 'expression']).toContain(regra.type)
    if (ws.name !== 'MRP_Semanal') expect(cf ?? []).toHaveLength(0)
  }
}

describe('Exportação Excel — nome do arquivo', () => {
  it('MRP_<nome>_<aaaa-mm-dd>.xlsx', () => {
    const hoje = new Date(Date.UTC(2026, 10, 19))
    expect(nomeArquivoSaida('demo-industria.xlsx', hoje)).toBe('MRP_demo-industria_2026-11-19.xlsx')
    expect(nomeArquivoSaida('C:\\pasta\\Estoque Jan:26.csv', hoje)).toBe(
      'MRP_Estoque_Jan_26_2026-11-19.xlsx',
    )
    expect(nomeArquivoSaida('.xlsx', hoje)).toBe('MRP_planilha_2026-11-19.xlsx')
  })
})

describe('Exportação Excel — demo-industria', () => {
  let r: Resultado
  let buf: ArrayBuffer
  let wbJS: ExcelJS.Workbook
  let wbX: XLSX.WorkBook

  beforeAll(async () => {
    r = await resultadoDemo('demo-industria.xlsx', gerarDemoIndustria())
    buf = await exportarExcel(ExcelJS, r, {
      ...OPCOES,
      nomeArquivoOriginal: 'demo-industria.xlsx',
      hoje: new Date(Date.UTC(2026, 10, 19)),
    })
    wbJS = await reabrirExcelJS(buf)
    wbX = XLSX.read(buf, { type: 'array' })
  }, 60_000)

  it('abas na ordem da seção 11 (SheetJS e ExcelJS)', () => {
    expect(wbX.SheetNames).toEqual([...ABAS_SAIDA])
    expect(wbJS.worksheets.map((w) => w.name)).toEqual([...ABAS_SAIDA])
  })

  it('estrutura sem NaN/Infinity e só cellIs/expression na formatação condicional', () => {
    conferirEstrutura(wbJS)
    const ws = wbJS.getWorksheet('MRP_Semanal')!
    const cf = (ws as unknown as { conditionalFormattings: unknown[] }).conditionalFormattings
    expect(cf.length).toBe(r.mrp!.registros.length)
  })

  it('ABC-XYZ: uma linha por item, ordenada pela posição ABC, com valores-chave', () => {
    const linhas = linhasSheetJS(wbX, 'ABC-XYZ')
    expect(linhas.length).toBe(r.itens.length + 1)
    expect(linhas[0][0]).toBe('Item')
    const primeiro = [...r.itens].sort((a, b) => a.posicaoABC - b.posicaoABC)[0]
    expect(linhas[1][0]).toBe(primeiro.codigo)
    expect(linhas[1][9]).toBe('A')
    // Cor da classe A aplicada como preenchimento direto.
    const cel = wbJS.getWorksheet('ABC-XYZ')!.getCell('J2')
    expect((cel.fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FF1D4ED8')
  })

  it('Parametros_Reposicao: ES/PP arredondados e status colorido', () => {
    const linhas = linhasSheetJS(wbX, 'Parametros_Reposicao')
    expect(linhas.length).toBe(r.itens.length + 1)
    const idx = r.itens.findIndex((i) => i.estoqueSeguranca !== null && i.pontoPedido !== null)
    const item = r.itens[idx]
    const linha = linhas[idx + 1]
    expect(linha[0]).toBe(item.codigo)
    expect(linha[10]).toBe(arredondarQuantidade(item.estoqueSeguranca!, item.unidadeDiscreta))
    expect(linha[12]).toBe(arredondarQuantidade(item.pontoPedido!, item.unidadeDiscreta))
    expect(linha[21]).toBe(item.status)
    const status = wbJS.getWorksheet('Parametros_Reposicao')!.getCell(idx + 2, 22)
    expect(status.value).toBe(item.status)
    expect((status.fill as ExcelJS.FillPattern).fgColor?.argb).toMatch(/^FF[0-9A-F]{6}$/)
  })

  it('Sugestao_Compras: uma linha por sugestão, na ordem de sugestoesOrdenadas', () => {
    const sug = sugestoesOrdenadas(r.itens)
    expect(sug.length).toBeGreaterThan(0)
    const ws = wbJS.getWorksheet('Sugestao_Compras')!
    // Cabeçalho + sugestões + linha em branco + total.
    expect(ws.rowCount).toBe(sug.length + 3)
    sug.forEach((i, k) => {
      expect(ws.getCell(k + 2, 2).value).toBe(i.codigo)
      expect(ws.getCell(k + 2, 5).value).toBe(
        arredondarQuantidade(i.sugestaoQtd, i.unidadeDiscreta),
      )
    })
    const chegada = ws.getCell(2, 9).value as Date
    expect(chegada.toISOString().slice(0, 10)).toBe(sug[0].dataChegada.toISOString().slice(0, 10))
    const total = ws.getCell(sug.length + 3, 8).value as number
    expect(total).toBeCloseTo(
      sug.reduce((s, i) => s + i.sugestaoValor, 0),
      1,
    )
  })

  it('Sugestao_Compras respeita codigosCompras', async () => {
    const sug = sugestoesOrdenadas(r.itens)
    const escolhidos = [sug[2].codigo, sug[0].codigo]
    const b = await exportarExcel(ExcelJS, r, { ...OPCOES, codigosCompras: escolhidos })
    const ws = (await reabrirExcelJS(b)).getWorksheet('Sugestao_Compras')!
    expect(ws.rowCount).toBe(2 + 3)
    // Mantém a ordem de prioridade, não a ordem da seleção.
    expect(ws.getCell(2, 2).value).toBe(sug[0].codigo)
    expect(ws.getCell(3, 2).value).toBe(sug[2].codigo)
  })

  it('MRP_Semanal: um bloco por item com as 6 linhas; MRP_Consolidado com total por semana', () => {
    const ws = wbJS.getWorksheet('MRP_Semanal')!
    const H = r.mrp!.semanas.length
    expect(ws.getCell(1, 2).value).toBe(r.mrp!.semanas[0].rotulo)
    const reg = r.mrp!.registros[0]
    expect(String(ws.getCell(4, 1).value)).toContain(reg.codigo)
    expect(ws.getCell(5, 1).value).toBe('Necessidade bruta (NB)')
    expect(ws.getCell(10, 1).value).toBe('Liberação planejada (LibPlan)')
    expect(ws.getCell(7, 2).value).toBeCloseTo(reg.semanas[0].ep, 2)
    expect(ws.getCell(7, H + 1).value).toBeCloseTo(reg.semanas[H - 1].ep, 2)
    // Bloco seguinte começa depois de uma linha em branco.
    expect(String(ws.getCell(12, 1).value)).toContain(r.mrp!.registros[1].codigo)

    const cons = linhasSheetJS(wbX, 'MRP_Consolidado')
    const total = cons.find((l) => l[0] === 'Total por semana')!
    const totalGeral = r.mrp!.consolidado.reduce((s, x) => s + x.valor, 0)
    expect(total[total.length - 1] as number).toBeCloseTo(totalGeral, 0)
  })

  it('Alertas, Qualidade_Dados e Parametros_Usados', () => {
    expect(linhasSheetJS(wbX, 'Alertas').length).toBe(r.alertas.length + 1)
    const q = linhasSheetJS(wbX, 'Qualidade_Dados')
    expect(q.length).toBe(r.qualidade.problemas.length + 1)
    expect(q.some((l) => l[0] === 'Movimentação de código sem cadastro')).toBe(true)
    const pu = linhasSheetJS(wbX, 'Parametros_Usados')
    const cab = pu.findIndex((l) => l[0] === 'Classe' && l[1] === 'X')
    expect(pu[cab + 1]).toEqual(['A', 0.98, 0.97, 0.95])
  })

  it('Dashboard sem imagens e Leia-me com link', () => {
    const dash = wbJS.getWorksheet('Dashboard')!
    expect(dash.getImages()).toHaveLength(0)
    expect(dash.getCell('B4').value).toBe('Valor total em estoque')
    expect(dash.getCell('B5').value).toBeCloseTo(r.kpis.valorEstoque, 2)
    const leia = linhasSheetJS(wbX, 'Leia-me').flat()
    expect(leia).toContain('https://exemplo.github.io/kit')
    expect(leia).toContain('demo-industria.xlsx')
  })
})

describe('Exportação Excel — demo-montagem (BOM + MPS)', () => {
  it('exporta com imagem no Dashboard e reabre nas duas bibliotecas', async () => {
    const r = await resultadoDemo('demo-montagem.xlsx', gerarDemoMontagem())
    expect(r.mrp?.comBOM).toBe(true)
    const buf = await exportarExcel(ExcelJS, r, {
      ...OPCOES,
      imagens: [
        { titulo: 'Pareto ABC', dataUrl: PNG_1X1 },
        { titulo: 'Inválida', dataUrl: 'data:text/plain;base64,AAAA' },
      ],
    })
    const wbX = XLSX.read(buf, { type: 'array' })
    expect(wbX.SheetNames).toEqual([...ABAS_SAIDA])
    expect(linhasSheetJS(wbX, 'ABC-XYZ').length).toBe(r.itens.length + 1)

    const wb = await reabrirExcelJS(buf)
    conferirEstrutura(wb)
    expect(wb.getWorksheet('Dashboard')!.getImages()).toHaveLength(1)

    // Blocos do MRP com os componentes da BOM e a origem da NB.
    const ws = wb.getWorksheet('MRP_Semanal')!
    const titulos: string[] = []
    ws.eachRow((row) => {
      const v = row.getCell(1).value
      if (typeof v === 'string' && v.includes(' — ')) titulos.push(v)
    })
    expect(titulos.length).toBe(r.mrp!.registros.length)
    expect(titulos.some((t) => t.startsWith('PA-100'))).toBe(true)
  }, 60_000)

  it('sem MRP: mensagem única nas abas de MRP', async () => {
    const r = await resultadoDemo('demo-montagem.xlsx', gerarDemoMontagem())
    const semMRP: Resultado = { ...r, mrp: null, erroMRP: 'BOM circular: A → B → A' }
    const wb = await reabrirExcelJS(await exportarExcel(ExcelJS, semMRP, OPCOES))
    conferirEstrutura(wb)
    expect(wb.getWorksheet('MRP_Semanal')!.getCell('A1').value).toBe('BOM circular: A → B → A')
    expect(wb.getWorksheet('MRP_Consolidado')!.getCell('A1').value).toBe('BOM circular: A → B → A')
  }, 60_000)
})
