import ExcelJS from 'exceljs'
import { beforeAll, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { gerarDemoIndustria, gerarDemoMontagem } from '../scripts/demo/dados'
import { escreverDemo } from '../scripts/demo/escrever'
import { arredondarQuantidade } from '../src/engine/estatistica'
import { processar, sugestoesOrdenadas, type Resultado } from '../src/engine/index'
import {
  completarConfigMC,
  matrizReciproca,
  nomeCriterio,
  registroAHP,
} from '../src/engine/multicriterio'
import type { Entrada, Parametros } from '../src/engine/tipos'
import {
  ABAS_SAIDA,
  exportarExcel,
  MENSAGEM_MC_DESLIGADO,
  nomeArquivoSaida,
} from '../src/io/exportar-excel'
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

  it('ABC_Multicriterio com o módulo desligado: só a mensagem', () => {
    expect(r.multicriterio).toBeNull()
    expect(linhasSheetJS(wbX, 'ABC_Multicriterio')).toEqual([[MENSAGEM_MC_DESLIGADO]])
    // ABC-XYZ sem a coluna "Classe por valor".
    expect(linhasSheetJS(wbX, 'ABC-XYZ')[0]).not.toContain('Classe por valor')
    const pu = linhasSheetJS(wbX, 'Parametros_Usados')
    const k = pu.findIndex((l) => l[0] === 'ABC multicritério')
    expect(k).toBeGreaterThan(0)
    expect(pu[k + 1].slice(0, 2)).toEqual(['Ligado', 'Não'])
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

describe('Exportação Excel — ABC multicritério', () => {
  let entrada: Entrada

  beforeAll(async () => {
    const b = await escreverDemo(ExcelJS, gerarDemoIndustria(), 'teste')
    entrada = lerEntrada([{ nome: 'demo-industria.xlsx', dados: b }])
  }, 60_000)

  async function exportarMC(mc: Partial<Parametros['multicriterio']>) {
    const r = processar(entrada, { multicriterio: completarConfigMC({ ativo: true, ...mc }) })
    const buf = await exportarExcel(ExcelJS, r, OPCOES)
    return { r, wbJS: await reabrirExcelJS(buf), wbX: XLSX.read(buf, { type: 'array' }) }
  }

  it('modo ponderado: uma linha por item, critérios, score e classe final do motor', async () => {
    const { r, wbJS, wbX } = await exportarMC({})
    const mc = r.multicriterio!
    expect(mc).not.toBeNull()
    conferirEstrutura(wbJS)

    const linhas = linhasSheetJS(wbX, 'ABC_Multicriterio')
    const cab = linhas[0] as string[]
    expect(linhas.length).toBe(r.itens.length + 1)
    // Quatro colunas por critério, na ordem dos pesos efetivos.
    const ids = Object.keys(mc.pesos)
    expect(ids.length).toBeGreaterThan(0)
    ids.forEach((id, k) => {
      expect(cab[3 + 4 * k]).toBe(`${nomeCriterio(id)} (normalizado)`)
      expect(cab[4 + 4 * k]).toBe(`${nomeCriterio(id)} (peso)`)
      expect(cab[5 + 4 * k]).toBe(`${nomeCriterio(id)} (contribuição)`)
    })
    const col = (nome: string) => cab.indexOf(nome)
    const cScore = col('Score')
    const cPos = col('Posição')
    const cFinal = col('Classe final')
    const cValor = col('Classe por valor')
    const cEstab = col('Estabilidade')
    expect(cScore).toBe(2 + 4 * ids.length)

    // Ordenada pela posição do score.
    expect(linhas.slice(1).map((l) => l[cPos])).toEqual(r.itens.map((_, k) => k + 1))

    const porCodigo = new Map(r.itens.map((i) => [i.codigo, i]))
    for (const l of linhas.slice(1)) {
      const item = porCodigo.get(l[0] as string)!
      const m = item.multicriterio!
      expect(l[cScore] as number).toBeCloseTo(m.score!, 9)
      expect(l[cFinal]).toBe(item.classeABC)
      expect(l[cFinal]).toBe(m.classeFinal)
      expect(l[cValor]).toBe(item.classeABCValor)
    }
    // Contribuição de um critério = peso × normalizado, como no motor.
    const item = porCodigo.get(linhas[1][0] as string)!
    const c0 = item.multicriterio!.criterios.find((c) => c.id === ids[0])!
    expect(linhas[1][3] as number).toBeCloseTo(c0.normalizado, 9)
    expect(linhas[1][5] as number).toBeCloseTo(c0.contribuicao, 9)

    // Estabilidade < 70% destacada com preenchimento direto; classe final colorida.
    const ws = wbJS.getWorksheet('ABC_Multicriterio')!
    linhas.slice(1).forEach((l, k) => {
      const est = l[cEstab] as number
      const fill = ws.getCell(k + 2, cEstab + 1).fill as ExcelJS.FillPattern | undefined
      if (est < 0.7) expect(fill?.fgColor?.argb).toBe('FFFECACA')
      else expect(fill?.fgColor?.argb).toBeUndefined()
    })
    const finalA = linhas.findIndex((l) => l[cFinal] === 'A')
    expect((ws.getCell(finalA + 1, cFinal + 1).fill as ExcelJS.FillPattern).fgColor?.argb).toBe(
      'FF1D4ED8',
    )

    // ABC-XYZ ganha a coluna "Classe por valor" ao lado da classe.
    const abc = linhasSheetJS(wbX, 'ABC-XYZ')
    expect(abc[0][9]).toBe('Classe ABC (final)')
    expect(abc[0][10]).toBe('Classe por valor')
    for (const l of abc.slice(1)) {
      const i = porCodigo.get(l[0] as string)!
      expect(l[9]).toBe(i.classeABC)
      expect(l[10]).toBe(i.classeABCValor)
    }

    // Parametros_Usados: bloco ligado, modo e pesos efetivos.
    const pu = linhasSheetJS(wbX, 'Parametros_Usados')
    const k = pu.findIndex((l) => l[0] === 'ABC multicritério')
    expect(pu[k + 1].slice(0, 2)).toEqual(['Ligado', 'Sim'])
    expect(pu.some((l) => l[0] === 'Modo' && l[1] === 'Pontuação ponderada')).toBe(true)
    expect(pu.some((l) => l[0] === 'Normalização' && l[1] === 'Posto percentil')).toBe(true)
    const kp = pu.findIndex((l) => String(l[0]).startsWith('Pesos dos critérios'))
    expect(kp).toBeGreaterThan(k)
    for (const id of ids) {
      const l = pu.slice(kp).find((x) => x[0] === nomeCriterio(id))!
      expect(l[1] as number).toBeCloseTo(mc.pesos[id], 9)
    }
    const kr = pu.findIndex((l) => l[0] === 'Regras de piso')
    expect(kr).toBeGreaterThan(kp)
    expect(pu.some((l) => l[1] === 'Não' && String(l[0]).includes('nunca abaixo de B'))).toBe(true)

    // Leia-me cita a nova aba.
    expect(linhasSheetJS(wbX, 'Leia-me').flat()).toContain('ABC_Multicriterio')
  }, 60_000)

  it('modo VED: criticidade, VED e classes, ordenado pela classe final', async () => {
    const { r, wbJS, wbX } = await exportarMC({ modo: 'ved' })
    conferirEstrutura(wbJS)
    const linhas = linhasSheetJS(wbX, 'ABC_Multicriterio')
    expect(linhas[0].slice(0, 6)).toEqual([
      'Item',
      'Descrição',
      'Criticidade',
      'VED',
      'Classe por valor',
      'Classe final',
    ])
    expect(linhas[0]).not.toContain('Score')
    expect(linhas.length).toBe(r.itens.length + 1)
    const finais = linhas.slice(1).map((l) => l[5] as string)
    expect(finais).toEqual([...finais].sort())
    const porCodigo = new Map(r.itens.map((i) => [i.codigo, i]))
    for (const l of linhas.slice(1)) {
      const i = porCodigo.get(l[0] as string)!
      expect(l[5]).toBe(i.classeABC)
      expect(['Vital', 'Essencial', 'Desejável']).toContain(l[3])
    }
    const pu = linhasSheetJS(wbX, 'Parametros_Usados')
    const kv = pu.findIndex((l) => l[0] === 'Matriz ABC por valor × criticidade (VED)')
    expect(kv).toBeGreaterThan(0)
    expect(pu[kv + 1]).toEqual(['Classe por valor', 'Vital (V)', 'Essencial (E)', 'Desejável (D)'])
    expect(pu[kv + 2]).toEqual(['A', 'A', 'A', 'B'])
    expect(pu[kv + 4]).toEqual(['C', 'B', 'C', 'C'])
    expect(pu.some((l) => String(l[0]).startsWith('Pesos dos critérios'))).toBe(false)
  }, 60_000)

  it('AHP registrado: matriz, pesos, λmáx, CI e CR (com aviso se CR > 0,10)', async () => {
    const criterios = ['valor', 'lead_time', 'criticidade']
    const nomes = criterios.map(nomeCriterio)

    // Comparações incoerentes: valor > lead time > criticidade > valor.
    const incoerente = registroAHP(
      criterios,
      matrizReciproca(3, (i, j) => (i === 0 && j === 2 ? 1 / 5 : 3)),
    )
    expect(incoerente.cr).toBeGreaterThan(0.1)
    const pesos = Object.fromEntries(criterios.map((id, k) => [id, incoerente.pesos[k]]))
    const { r, wbJS, wbX } = await exportarMC({ pesos, ahp: incoerente })
    conferirEstrutura(wbJS)
    for (const [k, id] of criterios.entries())
      expect(r.multicriterio!.pesos[id]).toBeCloseTo(incoerente.pesos[k], 9)

    const pu = linhasSheetJS(wbX, 'Parametros_Usados')
    const ka = pu.findIndex((l) => String(l[0]).startsWith('Assistente AHP'))
    expect(ka).toBeGreaterThan(0)
    expect(pu[ka + 1]).toEqual(['Critério', ...nomes, 'Peso AHP'])
    for (let i = 0; i < 3; i++) {
      expect(pu[ka + 2 + i][0]).toBe(nomes[i])
      for (let j = 0; j < 3; j++)
        expect(pu[ka + 2 + i][1 + j] as number).toBeCloseTo(incoerente.matriz[i][j], 6)
      expect(pu[ka + 2 + i][4] as number).toBeCloseTo(incoerente.pesos[i], 9)
    }
    const lambda = pu.find((l) => l[0] === 'λmáx')!
    expect(lambda[1] as number).toBeCloseTo(incoerente.lambdaMax, 9)
    expect(pu.find((l) => l[0] === 'CI')![1] as number).toBeCloseTo(incoerente.ci, 9)
    const cr = pu.find((l) => l[0] === 'CR')!
    expect(cr[1] as number).toBeCloseTo(incoerente.cr, 9)
    expect(String(cr[2])).toContain('CR > 0,10: comparações incoerentes')
    expect(pu.indexOf(cr)).toBeGreaterThan(ka)
    // CR com 3 casas e destacado por preenchimento direto (não formatação condicional).
    const ws = wbJS.getWorksheet('Parametros_Usados')!
    let linhaCR = 0
    ws.eachRow((row, numero) => {
      if (row.getCell(1).value === 'CR') linhaCR = numero
    })
    expect(ws.getCell(linhaCR, 2).numFmt).toBe('0.000')
    expect((ws.getCell(linhaCR, 2).fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFFECACA')

    // Comparações coerentes (aᵢⱼ = wᵢ ÷ wⱼ): CR = 0, sem aviso.
    const w = [0.5, 0.3, 0.2]
    const coerente = registroAHP(
      criterios,
      matrizReciproca(3, (i, j) => w[i] / w[j]),
    )
    const pesosC = Object.fromEntries(criterios.map((id, k) => [id, coerente.pesos[k]]))
    const res = await exportarMC({ pesos: pesosC, ahp: coerente })
    const puC = linhasSheetJS(res.wbX, 'Parametros_Usados')
    const crC = puC.find((l) => l[0] === 'CR')!
    expect(crC[1] as number).toBeCloseTo(0, 9)
    expect(String(crC[2])).not.toContain('incoerentes')
  }, 60_000)
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
