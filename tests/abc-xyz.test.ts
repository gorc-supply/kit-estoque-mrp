import { describe, expect, it } from 'vitest'
import { classificarABC } from '../src/engine/abc'
import { PARAMETROS_PADRAO } from '../src/engine/padroes'
import { backtest, mediaMovel, metricasErro, sba } from '../src/engine/previsao'
import { cosseno } from '../src/engine/similaridade'
import { classificarXYZ } from '../src/engine/xyz'

describe('Teste 2 — Curva ABC pelo % acumulado anterior', () => {
  it('5.000, 3.000, 1.000, 600, 400 → A, A, B, B, C', () => {
    const r = classificarABC([
      { codigo: 'E', valor: 400 },
      { codigo: 'A', valor: 5000 },
      { codigo: 'C', valor: 1000 },
      { codigo: 'B', valor: 3000 },
      { codigo: 'D', valor: 600 },
    ])
    expect(r.map((x) => x.codigo)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(r.map((x) => x.pctAcumuladoAnterior)).toEqual([0, 0.5, 0.8, 0.9, 0.96])
    expect(r.map((x) => x.classe)).toEqual(['A', 'A', 'B', 'B', 'C'])
  })
  it('itens com valor zero vão para o fim, classe C; sempre existe ao menos um A', () => {
    const r = classificarABC([
      { codigo: 'Z', valor: 0 },
      { codigo: 'X', valor: 10 },
    ])
    expect(r[0]).toMatchObject({ codigo: 'X', classe: 'A' })
    expect(r[1]).toMatchObject({ codigo: 'Z', classe: 'C' })
  })
})

describe('Teste 5 — Intermitente (Syntetos-Boylan) com previsão SBA', () => {
  const serie = [0, 0, 50, 0, 0, 0, 40, 0, 0, 60, 0, 0]
  it('ADI = 4, CV² = 0,04 → Intermitente', () => {
    const r = classificarXYZ(serie, PARAMETROS_PADRAO)
    expect(r.adi).toBe(4)
    expect(r.cv2).toBeCloseTo(0.04, 12)
    expect(r.padrao).toBe('Intermitente')
  })
  it('SBA: z = 50,1; p = 3,09; F = 0,95 × 50,1 ÷ 3,09', () => {
    // Início z=50, p=3; demanda 40 após 4 períodos: z=49, p=3,1; demanda 60 após 3: z=50,1, p=3,09.
    expect(sba(serie, 0.1)).toBeCloseTo((0.95 * 50.1) / 3.09, 10)
  })
})

describe('Teste 6 — Sem demanda', () => {
  it('série toda zero → N, sem padrão', () => {
    const r = classificarXYZ(new Array(12).fill(0), PARAMETROS_PADRAO)
    expect(r.classe).toBe('N')
    expect(r.padrao).toBeNull()
  })
})

describe('XYZ — faixas de CV', () => {
  it('X, Y e Z', () => {
    expect(classificarXYZ([10, 10, 10, 10], PARAMETROS_PADRAO).classe).toBe('X')
    expect(classificarXYZ([0, 20, 5, 15, 0, 25], PARAMETROS_PADRAO).classe).toBe('Y')
    expect(classificarXYZ([0, 0, 0, 0, 0, 100], PARAMETROS_PADRAO).classe).toBe('Z')
  })
})

describe('Teste 14 — Métricas de erro', () => {
  it('real [10,0,20], previsto [12,4,14]', () => {
    const m = metricasErro([10, 0, 20], [12, 4, 14])
    expect(m.mae).toBeCloseTo(4, 12)
    expect(m.rmse).toBeCloseTo(Math.sqrt(56 / 3), 12)
    expect(m.rmse).toBeCloseTo(4.32, 2)
    expect(m.wmape).toBeCloseTo(0.4, 12)
    expect(m.vies).toBeCloseTo(0, 12)
  })
  it('WMAPE e viés são nulos quando não há consumo real', () => {
    expect(metricasErro([0, 0], [1, 2]).wmape).toBeNull()
  })
})

describe('Backtest com origem móvel', () => {
  it('usa só dados anteriores a cada período e escolhe o menor MAE', () => {
    const serie = [10, 10, 10, 10, 10, 10, 10, 10, 50, 50, 50, 50]
    const bt = backtest(serie, 'Suave', 0.1)!
    expect(bt.periodos).toEqual([6, 7, 8, 9, 10, 11])
    const mm3 = bt.metodos.find((m) => m.metodo === 'MM3')!
    expect(mm3.previsoes[0]).toBe(mediaMovel(serie.slice(0, 6), 3))
    expect(mm3.reais).toEqual(serie.slice(6))
    const menor = Math.min(...bt.metodos.map((m) => m.mae))
    expect(bt.metodos.find((m) => m.metodo === bt.melhor)!.mae).toBe(menor)
    expect(bt.metodos.some((m) => m.metodo === 'SBA')).toBe(false)
  })
})

describe('Teste 16 — Similaridade de cosseno', () => {
  it('[1,2,3]·[2,4,6] = 1; [1,0]·[0,1] = 0; [1,1]·[1,0] = 0,7071', () => {
    expect(cosseno([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12)
    expect(cosseno([1, 0], [0, 1])).toBeCloseTo(0, 12)
    expect(cosseno([1, 1], [1, 0])).toBeCloseTo(0.7071, 4)
  })
})
