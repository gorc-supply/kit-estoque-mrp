import { describe, expect, it } from 'vitest'
import { adicionarDias, dataUTC } from '../src/engine/datas'
import { processar } from '../src/engine/index'
import type { Material, Movimento } from '../src/engine/tipos'
import { entrada, material } from './util'

/** Gerador pseudoaleatório determinístico (mulberry32). */
function rng(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('Teste 20 — Giro no modo semanal', () => {
  it('fica a ±10% do giro mensal (anualização com 52 períodos)', () => {
    const r = rng(42)
    const movs: Movimento[] = []
    const inicio = dataUTC(2024, 1, 1)
    let saldo = 500
    for (let d = 0; d < 731; d++) {
      const data = adicionarDias(inicio, d)
      const q = 8 + Math.round(r() * 4)
      movs.push({ codigo: 'G', data, tipo: 'Saída', quantidade: q })
      saldo -= q
      if (saldo < 150) {
        movs.push({ codigo: 'G', data, tipo: 'Entrada', quantidade: 400 })
        saldo += 400
      }
    }
    const e = entrada({
      materiais: [material('G', { estoqueAtual: saldo, custoUnitario: 5 })],
      movimentacoes: movs,
    })
    const dataBase = dataUTC(2025, 12, 31)
    const mensal = processar(e, { dataBase })
    const semanal = processar(e, { dataBase, periodicidade: 'semanal', janelaPeriodos: 52 })
    expect(semanal.janela.periodosPorAno).toBe(52)
    const gm = mensal.itens[0].giro!
    const gs = semanal.itens[0].giro!
    expect(gm).toBeGreaterThan(0)
    expect(Math.abs(gs - gm) / gm).toBeLessThan(0.1)
  })
})

describe('Teste 21 — Volume (motor)', () => {
  it('100 mil movimentações e 2 mil itens processam em poucos segundos', () => {
    const r = rng(7)
    const materiais: Material[] = []
    for (let i = 0; i < 2000; i++) {
      materiais.push(
        material(`IT${String(i).padStart(5, '0')}`, {
          estoqueAtual: Math.round(r() * 500),
          custoUnitario: 1 + r() * 200,
          categoria: `Cat${i % 6}`,
        }),
      )
    }
    const movs: Movimento[] = []
    const inicio = dataUTC(2024, 7, 1)
    for (let k = 0; k < 100_000; k++) {
      const item = materiais[Math.floor(r() * materiais.length)]
      movs.push({
        codigo: item.codigo,
        data: adicionarDias(inicio, Math.floor(r() * 548)),
        tipo: r() < 0.8 ? 'Saída' : 'Entrada',
        quantidade: 1 + Math.floor(r() * 20),
      })
    }
    const t0 = performance.now()
    const res = processar(entrada({ materiais, movimentacoes: movs }))
    const ms = performance.now() - t0
    expect(res.itens).toHaveLength(2000)
    expect(res.qualidade.bloqueante).toBe(false)
    console.info(`[volume] 100.000 movimentações × 2.000 itens: ${Math.round(ms)} ms`)
    expect(ms).toBeLessThan(15_000)
  }, 30_000)
})
