import { describe, expect, it } from 'vitest'
import { arredondarQuantidade } from '../src/engine/estatistica'
import { processar } from '../src/engine/index'
import { DATA_BASE, entrada, material, saidasMensais } from './util'

// Teste 4 (e 11, 12, 13): item de referência X, suave, calculado à mão na seção 13.
const demanda = [100, 120, 80, 110, 90, 100, 130, 70, 100, 110, 90, 100]
const r = processar(
  entrada({
    materiais: [
      material('REF', {
        estoqueAtual: 60,
        custoUnitario: 10,
        leadTimeDias: 15,
        multiploCompra: 50,
        loteMinimo: 100,
      }),
    ],
    movimentacoes: saidasMensais('REF', demanda),
  }),
  { dataBase: DATA_BASE },
)
const item = r.itens[0]

describe('Teste 4 — Item de referência', () => {
  it('janela jan–dez/2025 e série de 12 períodos', () => {
    expect(r.qualidade.bloqueante).toBe(false)
    expect(r.janela.rotulos[0]).toBe('jan/25')
    expect(r.janela.rotulos[11]).toBe('dez/25')
    expect(item.serie).toEqual(demanda)
  })
  it('d̄ = 100; σ = 16,514; CV = 0,165 → X, suave', () => {
    expect(item.media).toBe(100)
    expect(item.desvio).toBeCloseTo(16.514, 3)
    expect(item.cv).toBeCloseTo(0.165, 3)
    expect(item.classeXYZ).toBe('X')
    expect(item.padrao).toBe('Suave')
  })
  it('F = média dos últimos 6 = 100 (MM6)', () => {
    expect(item.metodo).toBe('MM6')
    expect(item.previsao).toBe(100)
  })
  it('LTₚ = 0,5; nível 98%; Z = 2,053749', () => {
    expect(item.classeABC).toBe('A')
    expect(item.ltPeriodos).toBe(0.5)
    expect(item.nivelServico).toBe(0.98)
    expect(item.z).toBeCloseTo(2.053749, 5)
  })
  it('ES = 23,98 → 24; PP = 73,98 → 74', () => {
    expect(item.estoqueSeguranca).toBeCloseTo(23.98, 2)
    expect(arredondarQuantidade(item.estoqueSeguranca!, true)).toBe(24)
    expect(item.pontoPedido).toBeCloseTo(73.98, 2)
    expect(arredondarQuantidade(item.pontoPedido!, true)).toBe(74)
  })
  it('H = 2,50; D = 1.200; EOQ = 309,84; Q* = 350; Máx = 374', () => {
    expect(item.custoManutencao).toBe(2.5)
    expect(item.demandaAnual).toBe(1200)
    expect(item.eoq).toBeCloseTo(309.84, 2)
    expect(item.loteCompra).toBe(350)
    expect(arredondarQuantidade(item.estoqueMaximo!, true)).toBe(374)
  })
  it('posição 60 ≤ 74 → Comprar; sugestão 350 = R$ 3.500,00', () => {
    expect(item.posicao).toBe(60)
    expect(item.status).toBe('Comprar')
    expect(item.sugestaoQtd).toBe(350)
    expect(item.sugestaoValor).toBe(3500)
  })
  it('consumo diário 3,333; cobertura 18 dias > LT 15 → não urgente', () => {
    expect(item.consumoDiario).toBeCloseTo(3.333, 3)
    expect(item.coberturaDias).toBeCloseTo(18, 10)
    expect(item.riscoAntesChegada).toBe(false)
    expect(item.prioridade).not.toBe('Urgente')
    expect(item.prioridade).toBe('Alta') // classe A
    expect(item.motivo).toBe('Posição 60 ≤ PP 74; cobertura 18 d > LT 15 d')
  })
})

describe('Teste 11 — Custo total do lote', () => {
  it('CT(EOQ) = 774,60 = √600.000; CT(350) = 780,36; penalidade +0,74%', () => {
    expect(item.custoTotalEOQ).toBeCloseTo(Math.sqrt(600000), 8)
    expect(item.custoTotalEOQ).toBeCloseTo(774.6, 2)
    expect(item.custoTotalLote).toBeCloseTo(342.857 + 437.5, 2)
    expect(item.penalidadeArredondamento! * 100).toBeCloseTo(0.74, 2)
  })
})

describe('Teste 12 — Probabilidade de faltar antes da chegada', () => {
  it('μ_LT = 50; σ_LT = 11,677; z = 0,8564; P ≈ 19,6%', () => {
    expect(item.mediaLT).toBe(50)
    expect(item.sigmaLT).toBeCloseTo(11.677, 3)
    expect(Math.abs(item.probFaltarAntesChegada! - 0.196)).toBeLessThan(0.001)
    expect(item.probRupturaCiclo).toBeCloseTo(0.02, 12)
  })
})

describe('Teste 13 — Fill rate', () => {
  it('G(z) = 0,007349; ESC = 0,0858; β = 99,98%', () => {
    // Valor exato 0,0073432 (a seção 13 usa φ arredondado; ver estatistica.test.ts).
    expect(item.perdaNormalG).toBeCloseTo(0.007349, 4)
    expect(item.faltaEsperadaCiclo).toBeCloseTo(0.0858, 3) // exato: 0,08575
    expect(item.fillRate! * 100).toBeCloseTo(99.98, 2)
  })
})

describe('Saldo reconstruído e giro (6.9)', () => {
  it('saldo inicial = 60 + 1.200 de saídas; giro anualizado', () => {
    expect(item.saldoInicial).toBe(1260)
    expect(item.saldosFimPeriodo[11]).toBe(60)
    expect(item.saldoInconsistente).toBe(false)
    const estoqueMedio = item.saldosFimPeriodo.reduce((s, x) => s + x, 0) / 12
    expect(item.giro).toBeCloseTo((1200 * 10) / (estoqueMedio * 10), 10)
  })
})
