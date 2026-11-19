import { describe, expect, it } from 'vitest'
import { dataUTC } from '../src/engine/datas'
import { processar } from '../src/engine/index'
import type { Movimento, RegraQualidade } from '../src/engine/tipos'
import { DATA_BASE, entrada, material, mov } from './util'

// Teste 9 — cada regra da seção 7 com um caso que dispara.

function regras(r: ReturnType<typeof processar>): RegraQualidade[] {
  return r.qualidade.problemas.map((p) => p.regra)
}

describe('Teste 9 — Qualidade dos dados', () => {
  const ok = mov('OK', 2025, 6, 10, 'Saída', 5)
  const base = (movs: Movimento[], extra = {}) =>
    processar(
      entrada({
        materiais: [material('OK', { estoqueAtual: 100, custoUnitario: 1 })],
        movimentacoes: [ok, ...movs],
        ...extra,
      }),
      { dataBase: DATA_BASE },
    )

  it('código em movimentação sem cadastro (aviso; ignora a linha)', () => {
    const r = base([mov('FANTASMA', 2025, 6, 10, 'Saída', 5)])
    expect(regras(r)).toContain('mov_sem_cadastro')
    expect(r.qualidade.bloqueante).toBe(false)
    expect(r.qualidade.linhasValidas).toBe(r.qualidade.totalLinhas - 1)
  })
  it('data inválida', () => {
    expect(regras(base([{ codigo: 'OK', data: null, tipo: 'Saída', quantidade: 1 }]))).toContain(
      'data_invalida',
    )
  })
  it('data futura em relação à data-base', () => {
    expect(regras(base([mov('OK', 2026, 3, 1, 'Saída', 1)]))).toContain('data_futura')
  })
  it('quantidade zero, negativa ou não numérica', () => {
    const r = base([
      mov('OK', 2025, 6, 1, 'Saída', 0),
      mov('OK', 2025, 6, 2, 'Saída', -3),
      mov('OK', 2025, 6, 3, 'Saída', NaN),
    ])
    expect(regras(r).filter((x) => x === 'quantidade_invalida')).toHaveLength(3)
  })
  it('tipo de movimento desconhecido', () => {
    expect(
      regras(
        base([
          {
            codigo: 'OK',
            data: dataUTC(2025, 6, 1),
            tipo: null,
            tipoOriginal: 'Transferência',
            quantidade: 1,
          },
        ]),
      ),
    ).toContain('tipo_desconhecido')
  })
  it('tipo ambíguo ("Devolução" sem destino) gera aviso e mantém a linha', () => {
    const r = base([
      {
        codigo: 'OK',
        data: dataUTC(2025, 6, 1),
        tipo: 'Devolução ao estoque',
        tipoAmbiguo: '"Devolução" sem destino: tratada como devolução ao estoque.',
        quantidade: 1,
      },
    ])
    expect(regras(r)).toContain('tipo_ambiguo')
  })
  it('item sem custo', () => {
    const r = processar(
      entrada({
        materiais: [material('SC', { estoqueAtual: 1 })],
        movimentacoes: [mov('SC', 2025, 6, 1, 'Saída', 1)],
      }),
      { dataBase: DATA_BASE },
    )
    expect(regras(r)).toContain('item_sem_custo')
    expect(r.itens[0].origemCusto).toBe('sem_custo')
  })
  it('item sem lead time usa 30 dias com aviso', () => {
    const r = processar(
      entrada({
        materiais: [material('SL', { estoqueAtual: 1, custoUnitario: 1, leadTimeDias: undefined })],
      }),
      { dataBase: DATA_BASE },
    )
    expect(regras(r)).toContain('item_sem_lead_time')
    expect(r.itens[0].leadTimeDias).toBe(30)
    expect(r.itens[0].leadTimePadrao).toBe(true)
  })
  it('código duplicado no cadastro é erro bloqueante com as linhas', () => {
    const r = processar(
      entrada({
        materiais: [
          material('D', { estoqueAtual: 1, linha: 2 }),
          material('D', { estoqueAtual: 2, linha: 5 }),
        ],
      }),
    )
    expect(regras(r)).toContain('codigo_duplicado')
    expect(r.qualidade.bloqueante).toBe(true)
    expect(r.qualidade.problemas.find((p) => p.regra === 'codigo_duplicado')!.mensagem).toContain(
      'linhas 2 e 5',
    )
    expect(r.itens).toHaveLength(0)
  })
  it('saldo reconstruído negativo (aviso, sem bloquear)', () => {
    const r = processar(
      entrada({
        materiais: [material('NEG', { estoqueAtual: 0, custoUnitario: 1 })],
        movimentacoes: [mov('NEG', 2025, 6, 1, 'Entrada', 10)],
      }),
      { dataBase: DATA_BASE },
    )
    expect(regras(r)).toContain('saldo_negativo')
    expect(r.itens[0].saldoInconsistente).toBe(true)
    expect(r.qualidade.bloqueante).toBe(false)
  })
  it('linhas duplicadas idênticas (aviso; a linha é mantida)', () => {
    const r = base([mov('OK', 2025, 6, 10, 'Saída', 5)])
    expect(regras(r)).toContain('linha_duplicada')
    expect(r.itens[0].consumoQtd).toBe(10)
  })
  it('custo médio das entradas quando não há custo no cadastro', () => {
    const r = processar(
      entrada({
        materiais: [material('CM', { estoqueAtual: 30 })],
        movimentacoes: [
          mov('CM', 2025, 2, 1, 'Entrada', 10, 100),
          mov('CM', 2025, 3, 1, 'Entrada', 30, 360),
          mov('CM', 2025, 4, 1, 'Devolução ao fornecedor', 10, 120),
        ],
      }),
      { dataBase: DATA_BASE },
    )
    expect(r.itens[0].origemCusto).toBe('media_entradas')
    expect(r.itens[0].custo).toBeCloseTo((100 + 360 - 120) / 30, 10)
  })
})
