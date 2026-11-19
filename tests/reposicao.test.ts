import { describe, expect, it } from 'vitest'
import { calcularReposicao, definirStatus, type EntradaReposicao } from '../src/engine/reposicao'

const base: EntradaReposicao = {
  estoqueAtual: 60,
  pedidosAbertos: 0,
  F: 100,
  estoqueSeguranca: 23.98,
  pontoPedido: 73.98,
  estoqueMaximo: 373.98,
  loteCompra: 350,
  loteMinimo: 100,
  multiplo: 50,
  custo: 10,
  leadTimeDias: 15,
  coberturaDias: 18,
  diasSemSaida: 10,
  diasSemGiro: 180,
  classeABC: 'B',
}

describe('Status e sugestão (6.8)', () => {
  it('ordem dos status', () => {
    expect(definirStatus({ ...base, estoqueAtual: 0 }, 0)).toBe('Ruptura')
    expect(definirStatus({ ...base, estoqueAtual: 10 }, 10)).toBe('Crítico')
    expect(definirStatus(base, 60)).toBe('Comprar')
    expect(definirStatus({ ...base, estoqueAtual: 500 }, 500)).toBe('Excesso')
    expect(definirStatus({ ...base, estoqueAtual: 100, diasSemSaida: 200 }, 100)).toBe('Sem giro')
    expect(
      definirStatus(
        { ...base, F: 0, estoqueAtual: 0, estoqueSeguranca: null, pontoPedido: null },
        0,
      ),
    ).toBe('Sem demanda')
    expect(definirStatus({ ...base, estoqueAtual: 100 }, 100)).toBe('OK')
  })

  it('pedidos em aberto entram na posição', () => {
    const r = calcularReposicao({ ...base, pedidosAbertos: 50 })
    expect(r.posicao).toBe(110)
    expect(r.sugestaoQtd).toBe(0)
  })

  it('prioridade: urgente quando a cobertura é menor que o lead time', () => {
    expect(calcularReposicao({ ...base, coberturaDias: 10 }).prioridade).toBe('Urgente')
    expect(calcularReposicao(base).prioridade).toBe('Média')
    expect(calcularReposicao({ ...base, classeABC: 'C' }).prioridade).toBe('Baixa')
  })

  it('Máx abaixo da posição (lead time longo) sugere 1 lote em vez de zero', () => {
    // F 100, LT 60 d, ES 24, Q* 150 → PP 224, Máx 174; posição 200 ≤ PP.
    const r = calcularReposicao({
      ...base,
      estoqueAtual: 200,
      estoqueSeguranca: 24,
      pontoPedido: 224,
      estoqueMaximo: 174,
      loteCompra: 150,
      loteMinimo: 0,
      leadTimeDias: 60,
      coberturaDias: 60,
    })
    expect(r.status).toBe('Comprar')
    expect(r.sugestaoQtd).toBe(150)
    expect(r.motivo).toContain('1 lote')
  })
})
