import { describe, expect, it } from 'vitest'
import { dataUTC } from '../src/engine/datas'
import { processar } from '../src/engine/index'
import { DATA_BASE, entrada, material, mov, saidasMensais } from './util'

describe('Teste 3 — Série com zeros', () => {
  it('movimentos em só 3 de 12 meses geram série de 12 posições', () => {
    const r = processar(
      entrada({
        materiais: [material('Z3', { estoqueAtual: 100, custoUnitario: 1 })],
        movimentacoes: [
          mov('Z3', 2025, 1, 10, 'Saída', 5),
          mov('Z3', 2025, 5, 10, 'Saída', 7),
          mov('Z3', 2025, 9, 10, 'Saída', 3),
        ],
      }),
      { dataBase: DATA_BASE },
    )
    expect(r.itens[0].serie).toEqual([5, 0, 0, 0, 7, 0, 0, 0, 3, 0, 0, 0])
    expect(r.itens[0].n).toBe(12)
  })

  it('data_cadastro antiga mantém os zeros do início da janela', () => {
    const r = processar(
      entrada({
        materiais: [
          material('Z4', { estoqueAtual: 10, custoUnitario: 1, dataCadastro: dataUTC(2020, 1, 1) }),
        ],
        movimentacoes: [mov('Z4', 2025, 11, 10, 'Saída', 5)],
      }),
      { dataBase: DATA_BASE },
    )
    expect(r.itens[0].n).toBe(12)
  })
})

describe('Teste 17 — Item novo', () => {
  it('1ª movimentação no mês 9 → n = 4, CV = 0 → X; Cv_anual = 30 × custo × 12', () => {
    const r = processar(
      entrada({
        materiais: [material('NOVO', { estoqueAtual: 50, custoUnitario: 2 })],
        movimentacoes: saidasMensais('NOVO', [30, 30, 30, 30], 9),
      }),
      { dataBase: DATA_BASE },
    )
    const i = r.itens[0]
    expect(i.n).toBe(4)
    expect(i.inicioSerie).toBe(8)
    expect(i.media).toBe(30)
    expect(i.desvio).toBe(0)
    expect(i.cv).toBe(0)
    expect(i.classeXYZ).toBe('X')
    expect(i.consumoAnualValor).toBe(30 * 2 * 12)
  })
})

describe('Teste 18 — Menos de 3 períodos', () => {
  it('1ª movimentação no mês 11 → n = 2 → Histórico insuficiente, XYZ Novo, sem ES', () => {
    const r = processar(
      entrada({
        materiais: [material('N2', { estoqueAtual: 10, custoUnitario: 3 })],
        movimentacoes: saidasMensais('N2', [20, 40], 11),
      }),
      { dataBase: DATA_BASE },
    )
    const i = r.itens[0]
    expect(i.n).toBe(2)
    expect(i.historicoInsuficiente).toBe(true)
    expect(i.classeXYZ).toBe('Novo')
    expect(i.estoqueSeguranca).toBeNull()
    expect(i.consumoAnualValor).toBe(30 * 3 * 12)
    expect(i.revisaoManual.join()).toContain('Histórico insuficiente')
  })
})

describe('Teste 6 — Sem demanda no processamento completo', () => {
  it('XYZ = N, ES não calculado, EOQ não se aplica', () => {
    const r = processar(
      entrada({
        materiais: [
          material('PARADO', {
            estoqueAtual: 5,
            custoUnitario: 3,
            dataCadastro: dataUTC(2020, 1, 1),
          }),
        ],
      }),
      { dataBase: DATA_BASE },
    )
    const i = r.itens[0]
    expect(i.classeXYZ).toBe('N')
    expect(i.estoqueSeguranca).toBeNull()
    expect(i.eoq).toBeNull()
    expect(i.status).toBe('Sem giro')
  })
})

describe('Teste 19 — Devoluções', () => {
  const base = (movs: ReturnType<typeof mov>[], abater = true) =>
    processar(
      entrada({
        materiais: [
          material('DV', {
            estoqueAtual: 1000,
            custoUnitario: 1,
            dataCadastro: dataUTC(2020, 1, 1),
          }),
        ],
        movimentacoes: movs,
      }),
      { dataBase: DATA_BASE, abaterDevolucoes: abater },
    ).itens[0]

  it('saída 100 e devolução ao estoque 20 no mesmo mês → demanda 80, saldo −80', () => {
    const i = base([
      mov('DV', 2025, 6, 5, 'Saída', 100),
      mov('DV', 2025, 6, 20, 'Devolução ao estoque', 20),
    ])
    expect(i.serie[5]).toBe(80)
    // Saldo no fim de maio − saldo no fim de junho = 80
    expect(i.saldosFimPeriodo[4] - i.saldosFimPeriodo[5]).toBe(80)
  })
  it('devolução ao fornecedor de 10 → saldo −10, demanda inalterada', () => {
    const i = base([
      mov('DV', 2025, 6, 5, 'Saída', 100),
      mov('DV', 2025, 6, 20, 'Devolução ao fornecedor', 10),
    ])
    expect(i.serie[5]).toBe(100)
    expect(i.saldosFimPeriodo[4] - i.saldosFimPeriodo[5]).toBe(110)
  })
  it('devolução ao estoque de 50 num mês com saída de 30 → demanda 0 (nunca negativa)', () => {
    const i = base([
      mov('DV', 2025, 6, 5, 'Saída', 30),
      mov('DV', 2025, 6, 20, 'Devolução ao estoque', 50),
    ])
    expect(i.serie[5]).toBe(0)
  })
  it('com o parâmetro desligado, a devolução não abate a demanda', () => {
    const i = base(
      [mov('DV', 2025, 6, 5, 'Saída', 100), mov('DV', 2025, 6, 20, 'Devolução ao estoque', 20)],
      false,
    )
    expect(i.serie[5]).toBe(100)
  })
})

describe('Janela e período incompleto', () => {
  it('data-base no meio do mês exclui o mês corrente; desligado, inclui', () => {
    const e = entrada({
      materiais: [material('J', { estoqueAtual: 1, custoUnitario: 1 })],
      movimentacoes: [mov('J', 2025, 1, 2, 'Saída', 1)],
    })
    const r1 = processar(e, { dataBase: dataUTC(2025, 12, 15) })
    expect(r1.janela.rotulos.at(-1)).toBe('nov/25')
    const r2 = processar(e, { dataBase: dataUTC(2025, 12, 15), excluirPeriodoIncompleto: false })
    expect(r2.janela.rotulos.at(-1)).toBe('dez/25')
  })
  it('movimentos após o fim da janela entram na reconstrução do saldo', () => {
    const r = processar(
      entrada({
        materiais: [material('K', { estoqueAtual: 10, custoUnitario: 1 })],
        movimentacoes: [mov('K', 2025, 1, 2, 'Entrada', 50), mov('K', 2025, 12, 10, 'Saída', 40)],
      }),
      { dataBase: dataUTC(2025, 12, 15) },
    )
    // Janela termina em nov/25: saldo de fim de novembro = 10 + 40 = 50.
    expect(r.itens[0].saldosFimPeriodo.at(-1)).toBe(50)
  })
})
