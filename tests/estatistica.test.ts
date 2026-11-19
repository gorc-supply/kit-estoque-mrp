import { describe, expect, it } from 'vitest'
import {
  ajustarLote,
  arredondarQuantidade,
  desvioAmostral,
  ehUnidadeDiscreta,
  erf,
  normInv,
  phi,
  Phi,
  perdaNormal,
} from '../src/engine/estatistica'

describe('Teste 1 — normInv (inverso da normal)', () => {
  const casos: [number, number][] = [
    [0.85, 1.036433],
    [0.9, 1.281552],
    [0.95, 1.644854],
    [0.98, 2.053749],
    [0.99, 2.326348],
  ]
  it.each(casos)('normInv(%f) = %f', (p, z) => {
    expect(Math.abs(normInv(p) - z)).toBeLessThan(1e-5)
  })
  it('é simétrico e cobre as caudas', () => {
    expect(normInv(0.5)).toBeCloseTo(0, 12)
    expect(normInv(0.02)).toBeCloseTo(-normInv(0.98), 10)
    expect(normInv(0.001)).toBeCloseTo(-3.090232, 5)
    expect(normInv(0)).toBe(-Infinity)
    expect(Number.isNaN(normInv(1.5))).toBe(true)
  })
})

describe('Φ, φ, erf e função de perda', () => {
  it('Φ(0) = 0,5 e Φ(1,644854) = 0,95', () => {
    expect(Phi(0)).toBeCloseTo(0.5, 12)
    expect(Phi(1.644854)).toBeCloseTo(0.95, 6)
    expect(Phi(-1.644854)).toBeCloseTo(0.05, 6)
  })
  it('erf em pontos conhecidos (ambos os ramos)', () => {
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 12)
    expect(erf(3)).toBeCloseTo(0.9999779095030014, 12)
    expect(erf(-0.5)).toBeCloseTo(-0.5204998778130465, 12)
  })
  it('φ(2,053749) ≈ 0,048424 e G(z) ≈ 0,007349 (teste 13)', () => {
    // A seção 13 arredonda φ para 0,048424; o valor exato é 0,0484181 (e^{−2,10894}/√2π),
    // o que dá G(z) = 0,0073432. A diferença (6e-6) não muda ESC (0,0858) nem β (99,98%).
    expect(phi(2.053749)).toBeCloseTo(0.0484181, 6)
    expect(phi(2.053749)).toBeCloseTo(0.048424, 4)
    expect(perdaNormal(2.053749)).toBeCloseTo(0.0073432, 6)
    expect(perdaNormal(2.053749)).toBeCloseTo(0.007349, 4)
  })
})

describe('desvio e arredondamentos', () => {
  it('desvio amostral do item de referência = 16,514', () => {
    const d = [100, 120, 80, 110, 90, 100, 130, 70, 100, 110, 90, 100]
    expect(desvioAmostral(d)).toBeCloseTo(Math.sqrt(3000 / 11), 10)
    expect(desvioAmostral([5])).toBe(0)
  })
  it('arredonda para cima em unidades discretas e 2 casas nas fracionáveis', () => {
    expect(ehUnidadeDiscreta('UN')).toBe(true)
    expect(ehUnidadeDiscreta('kg')).toBe(false)
    expect(ehUnidadeDiscreta('m²')).toBe(false)
    expect(arredondarQuantidade(23.98, true)).toBe(24)
    expect(arredondarQuantidade(350.0000000001, true)).toBe(350)
    expect(arredondarQuantidade(23.987, false)).toBe(23.99)
  })
  it('ajusta lote a mínimo e múltiplo', () => {
    expect(ajustarLote(309.84, 100, 50)).toBe(350)
    expect(ajustarLote(20, 100, 50)).toBe(100)
    expect(ajustarLote(7, 0, 1)).toBe(7)
  })
})
