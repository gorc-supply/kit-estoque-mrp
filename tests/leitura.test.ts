import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { gerarDemoIndustria, gerarDemoMontagem } from '../scripts/demo/dados'
import { escreverDemo } from '../scripts/demo/escrever'
import { processar } from '../src/engine/index'
import { lerData, lerNumero, lerPercentual } from '../src/io/conversao'
import { gerarModelo } from '../src/io/gerar-modelo'
import {
  converter,
  decodificarTexto,
  lerArquivos,
  lerEntrada,
  mapearTabelas,
} from '../src/io/ler-planilha'
import { identificarAbaPorNome, interpretarTipo, mapearColunas } from '../src/io/mapeamento'

const buf = (texto: string) => new TextEncoder().encode(texto).buffer as ArrayBuffer
const iso = (d: Date | null) => d?.toISOString().slice(0, 10)

describe('Teste 10 — Leitura', () => {
  it('números pt-BR e en', () => {
    expect(lerNumero('1.234,56')).toBe(1234.56)
    expect(lerNumero('1234,5')).toBe(1234.5)
    expect(lerNumero('R$ 10,00')).toBe(10)
    expect(lerNumero('1.000')).toBe(1000)
    expect(lerNumero('1,234.56')).toBe(1234.56)
    expect(lerNumero('1.5', 'ponto')).toBe(1.5)
    expect(lerNumero('abc')).toBeNaN()
    expect(lerNumero('')).toBeNaN()
    expect(lerPercentual('5%')).toBeCloseTo(0.05)
    expect(lerPercentual(5)).toBeCloseTo(0.05)
    expect(lerPercentual(0.05)).toBeCloseTo(0.05)
  })

  it('datas em três formatos (série do Excel, dd/mm/aaaa, aaaa-mm-dd)', () => {
    expect(iso(lerData(46022))).toBe('2025-12-31')
    expect(iso(lerData('31/12/2025'))).toBe('2025-12-31')
    expect(iso(lerData('2025-12-31'))).toBe('2025-12-31')
    expect(iso(lerData('5/1/25'))).toBe('2025-01-05')
    expect(lerData('31/02/2026')).toBeNull()
    expect(lerData('ontem')).toBeNull()
  })

  it('cabeçalhos com sinônimos e acentos', () => {
    const { mapa, faltando } = mapearColunas(
      ['Cód.', 'Descrição', 'UN', 'Saldo', 'Preço unitário', 'Prazo de entrega'],
      'Materiais',
    )
    expect(faltando).toEqual([])
    expect(mapa).toMatchObject({
      codigo: 0,
      descricao: 1,
      unidade: 2,
      estoque_atual: 3,
      custo_unitario: 4,
      lead_time_dias: 5,
    })
    expect(
      mapearColunas(['SKU', 'Qtde', 'Data mov', 'Natureza'], 'Movimentacoes').faltando,
    ).toEqual([])
    expect(identificarAbaPorNome('Movimentações')).toBe('Movimentacoes')
    expect(identificarAbaPorNome('pedidos_abertos.csv')).toBe('PedidosAbertos')
  })

  it('tipos de movimento e sinônimos', () => {
    expect(interpretarTipo('Saída').tipo).toBe('Saída')
    expect(interpretarTipo('S').tipo).toBe('Saída')
    expect(interpretarTipo('ENT').tipo).toBe('Entrada')
    expect(interpretarTipo('Ajuste +').tipo).toBe('Ajuste +')
    expect(interpretarTipo('ajuste-').tipo).toBe('Ajuste -')
    expect(interpretarTipo('Dev. fornecedor').tipo).toBe('Devolução ao fornecedor')
    expect(interpretarTipo('Retorno ao almoxarifado').tipo).toBe('Devolução ao estoque')
    expect(interpretarTipo('Devolução')).toMatchObject({ tipo: 'Devolução ao estoque' })
    expect(interpretarTipo('Devolução').ambiguo).toBeTruthy()
    expect(interpretarTipo('261')).toMatchObject({ tipo: 'Saída' })
    expect(interpretarTipo('261').ambiguo).toBeTruthy()
    expect(interpretarTipo('Ajuste').tipo).toBeNull()
    expect(interpretarTipo('Transferência').tipo).toBeNull()
  })

  it('CSV com ";" e vírgula decimal (um arquivo por aba)', () => {
    const materiais =
      'Código;Descrição;Unidade;Estoque atual;Custo;Lead time\nA1;Óleo hidráulico;L;12,5;18,90;10\nB2;Parafuso M8;UN;1.200;0,45;15\n'
    const movs =
      'Data;Código;Tipo;Qtd;Valor total\n15/01/2025;A1;Saída;2,5;\n2025-02-10;B2;Entrada;1.000;450,00\n46000;B2;S;300;\n'
    const entrada = lerEntrada([
      { nome: 'materiais.csv', dados: buf(materiais) },
      { nome: 'movimentacoes.csv', dados: buf(movs) },
    ])
    expect(entrada.materiais).toHaveLength(2)
    expect(entrada.materiais[0]).toMatchObject({
      codigo: 'A1',
      unidade: 'L',
      estoqueAtual: 12.5,
      custoUnitario: 18.9,
      leadTimeDias: 10,
      linha: 2,
    })
    expect(entrada.materiais[1].estoqueAtual).toBe(1200)
    expect(entrada.movimentacoes.map((m) => [iso(m.data), m.tipo, m.quantidade])).toEqual([
      ['2025-01-15', 'Saída', 2.5],
      ['2025-02-10', 'Entrada', 1000],
      ['2025-12-09', 'Saída', 300],
    ])
    expect(entrada.movimentacoes[1].valorTotal).toBe(450)
  })

  it('CSV com "," como separador e ponto decimal', () => {
    const t = lerArquivos([
      {
        nome: 'materiais.csv',
        dados: buf(
          'codigo,descricao,unidade,estoque_atual,lead_time_dias\nX,"Item, com vírgula",KG,"1,500.75",7\n',
        ),
      },
      {
        nome: 'movimentacoes.csv',
        dados: buf('data,codigo,tipo,quantidade\n2025-01-01,X,Saída,2.5\n'),
      },
    ])
    const { mapas } = mapearTabelas(t)
    const e = converter(t, mapas)
    expect(e.materiais[0]).toMatchObject({ descricao: 'Item, com vírgula', estoqueAtual: 1500.75 })
    expect(e.movimentacoes[0].quantidade).toBe(2.5)
  })

  it('decodifica CSV em Windows-1252 (acentos do Excel antigo)', () => {
    const bytes = new Uint8Array([0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0xe7, 0xe3, 0x6f]) // "Descrição"
    expect(decodificarTexto(bytes.buffer)).toBe('Descrição')
  })

  it('aponta colunas obrigatórias ausentes para a tela de mapeamento', () => {
    const t = lerArquivos([
      { nome: 'materiais.csv', dados: buf('Item;Nome;Medida;Saldo;Prazo\nA;B;UN;1;5\n') },
      { nome: 'movimentacoes.csv', dados: buf('Quando;Item;Tipo;Qtd\n01/01/2025;A;Saída;1\n') },
    ])
    const { pendencias } = mapearTabelas(t)
    expect(pendencias.map((p) => [p.aba, p.faltando])).toEqual([
      ['Materiais', ['unidade']], // "Nome" é sinônimo de descrição; "Medida" não é reconhecida
      ['Movimentacoes', ['data']],
    ])
  })

  it('erro amigável quando falta a aba de movimentações', () => {
    expect(() =>
      lerEntrada([
        {
          nome: 'materiais.csv',
          dados: buf('codigo;descricao;unidade;estoque_atual;lead_time_dias\nA;B;UN;1;5\n'),
        },
      ]),
    ).toThrow(/Movimentacoes/)
  })
})

describe('Planilhas .xlsx (modelo e demonstração)', () => {
  it('a planilha-modelo é lida de volta sem erros', async () => {
    const b = await gerarModelo(ExcelJS)
    const e = lerEntrada([{ nome: 'modelo.xlsx', dados: b }])
    expect(e.materiais[0]).toMatchObject({
      codigo: 'PAR-M8X30',
      estoqueAtual: 1200,
      leadTimeDias: 15,
    })
    expect(iso(e.movimentacoes[0].data)).toBe('2025-01-15')
    expect(e.bom[0].perdaPct).toBeCloseTo(0.02)
    const r = processar(e)
    expect(r.qualidade.bloqueante).toBe(false)
  })

  it('demo-industria: ~150 itens, 18 meses, mistura de padrões e problemas de qualidade', async () => {
    const dados = gerarDemoIndustria()
    const b = await escreverDemo(ExcelJS, dados, 'teste')
    const r = processar(lerEntrada([{ nome: 'demo-industria.xlsx', dados: b }]))
    expect(r.itens.length).toBeGreaterThanOrEqual(140)
    expect(iso(r.dataBase)).toBe('2026-10-31')
    expect(r.qualidade.bloqueante).toBe(false)
    const regras = r.qualidade.contagemPorRegra
    expect(regras.mov_sem_cadastro).toBeGreaterThan(0)
    expect(regras.quantidade_invalida).toBeGreaterThan(0)
    const padroes = new Set(r.itens.map((i) => i.padrao))
    for (const p of ['Suave', 'Errático', 'Intermitente', 'Irregular'])
      expect(padroes.has(p as never)).toBe(true)
    const status = new Set(r.itens.map((i) => i.status))
    for (const s of ['Ruptura', 'Comprar', 'Excesso', 'Sem giro', 'OK'])
      expect(status.has(s as never)).toBe(true)
    expect(r.itens.some((i) => i.classeXYZ === 'Novo')).toBe(true)
  })

  it('demo-montagem: BOM de 3 níveis e MPS de 12 semanas explodem no MRP', async () => {
    const b = await escreverDemo(ExcelJS, gerarDemoMontagem(), 'teste')
    const r = processar(lerEntrada([{ nome: 'demo-montagem.xlsx', dados: b }]))
    expect(r.erroMRP).toBeNull()
    expect(r.mrp?.comBOM).toBe(true)
    expect(Math.max(...r.mrp!.registros.map((x) => x.nivel))).toBe(2)
    const m = r.mrp!.matricial!
    expect(m.requisitoTotal[m.codigos.indexOf('PA-100')]).toBe(
      m.nbTotalMRP[m.codigos.indexOf('PA-100')],
    )
  })
})
