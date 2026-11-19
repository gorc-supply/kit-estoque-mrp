import { describe, expect, it } from 'vitest'
import { dataUTC } from '../src/engine/datas'
import { processar } from '../src/engine/index'
import {
  calcularMRP,
  calcularNiveis,
  ErroBOMCircular,
  type ItemMRPEntrada,
} from '../src/engine/mrp'
import { entrada, material } from './util'

const SEGUNDA = dataUTC(2025, 1, 6) // semana 1 começa numa segunda-feira

function itemMRP(codigo: string, extra: Partial<ItemMRPEntrada> = {}): ItemMRPEntrada {
  return {
    codigo,
    estoqueAtual: 0,
    estoqueSeguranca: 0,
    pontoPedido: null,
    loteCompra: null,
    loteMinimo: 0,
    multiplo: 1,
    leadTimeDias: 7,
    custo: 1,
    nbSemanalPrevisao: 0,
    ...extra,
  }
}

describe('Teste 7 — MRP lote a lote (caso de livro-texto)', () => {
  // Estoque 30; NB 20/semana; RP 25 na semana 3; LT 14 dias = 2 semanas; ES 0.
  // Sem 1: 30−20 = 10                         → EP 10
  // Sem 2: 10−20 = −10 → NL 10, Rec 10, libera na semana 0 → ATRASO (vai para a semana 1) → EP 0
  // Sem 3: 0+25−20 = 5                        → EP 5
  // Sem 4: 5−20 = −15  → NL 15, Rec 15, libera na semana 2 → EP 0
  // Sem 5: −20 → NL 20, libera na semana 3; Sem 6: −20 → NL 20, libera na semana 4
  const r = calcularMRP(
    [itemMRP('X', { estoqueAtual: 30, leadTimeDias: 14, nbSemanalPrevisao: 20, custo: 2 })],
    [{ codigo: 'X', dataPrevista: dataUTC(2025, 1, 22), quantidade: 25 }],
    [],
    [],
    { dataBase: SEGUNDA, horizonte: 6, politica: 'lote_a_lote', periodoFixoSemanas: 4 },
  )
  const s = r.registros[0].semanas

  it('registro semana a semana', () => {
    expect(r.registros[0].ltSemanas).toBe(2)
    expect(s.map((l) => l.nb)).toEqual([20, 20, 20, 20, 20, 20])
    expect(s.map((l) => l.rp)).toEqual([0, 0, 25, 0, 0, 0])
    expect(s.map((l) => l.nl)).toEqual([0, 10, 0, 15, 20, 20])
    expect(s.map((l) => l.recPlan)).toEqual([0, 10, 0, 15, 20, 20])
    expect(s.map((l) => l.ep)).toEqual([10, 0, 5, 0, 0, 0])
    expect(s.map((l) => l.libPlan)).toEqual([10, 15, 20, 20, 0, 0])
  })
  it('marca a liberação em atraso na semana 1', () => {
    expect(s[0].libAtraso).toBe(true)
    expect(r.registros[0].temLiberacaoAtraso).toBe(true)
  })
  it('consolida liberações em quantidade e R$', () => {
    expect(r.consolidado.map((c) => c.quantidade)).toEqual([10, 15, 20, 20, 0, 0])
    expect(r.consolidado[1].valor).toBe(30)
  })
})

describe('Políticas de lote', () => {
  const base = (politica: 'lote_economico' | 'periodo_fixo') =>
    calcularMRP(
      [
        itemMRP('Y', {
          estoqueAtual: 0,
          leadTimeDias: 0,
          nbSemanalPrevisao: 10,
          loteCompra: 35,
          multiplo: 5,
          estoqueSeguranca: 5,
        }),
      ],
      [],
      [],
      [],
      { dataBase: SEGUNDA, horizonte: 4, politica, periodoFixoSemanas: 2 },
    ).registros[0].semanas
  it('lote econômico: max(NL, Q*) ajustado ao múltiplo, mantendo o ES', () => {
    const s = base('lote_economico')
    expect(s[0].nl).toBe(15)
    expect(s[0].recPlan).toBe(35)
    expect(s.map((l) => l.ep)).toEqual([25, 15, 5, 30])
  })
  it('período fixo de 2 semanas cobre as necessidades das próximas 2 semanas', () => {
    const s = base('periodo_fixo')
    expect(s[0].recPlan).toBe(25) // 10 + 10 + ES 5
    expect(s.map((l) => l.ep)).toEqual([15, 5, 15, 5])
  })
})

describe('Teste 8 — Explosão da BOM', () => {
  // P usa 2 × C1; C1 usa 3 × C2. MPS: 10 P na semana 6, LT de P = 2 semanas → libera na semana 4.
  const itens = [
    itemMRP('P', { leadTimeDias: 14 }),
    itemMRP('C1', { leadTimeDias: 7 }),
    itemMRP('C2', { leadTimeDias: 7 }),
  ]
  const bom = [
    { codigoPai: 'P', codigoFilho: 'C1', quantidadePor: 2, perdaPct: 0 },
    { codigoPai: 'C1', codigoFilho: 'C2', quantidadePor: 3, perdaPct: 0 },
  ]
  const r = calcularMRP(
    itens,
    [],
    bom,
    [{ codigo: 'P', semanaInicio: dataUTC(2025, 2, 10), quantidade: 10 }],
    {
      dataBase: SEGUNDA,
      horizonte: 8,
      politica: 'lote_a_lote',
      periodoFixoSemanas: 4,
    },
  )
  const reg = (c: string) => r.registros.find((x) => x.codigo === c)!

  it('níveis: P = 0, C1 = 1, C2 = 2', () => {
    expect(reg('P').nivel).toBe(0)
    expect(reg('C1').nivel).toBe(1)
    expect(reg('C2').nivel).toBe(2)
  })
  it('liberação de 10 P na semana 4 → 20 C1 na semana 4 → 60 C2 na semana 3', () => {
    expect(reg('P').semanas[3].libPlan).toBe(10)
    expect(reg('C1').semanas[3].nb).toBe(20)
    expect(reg('C1').semanas[2].libPlan).toBe(20)
    expect(reg('C2').semanas[2].nb).toBe(60)
  })
  it('Teste 15 — r = (I − B)⁻¹ d = [10, 20, 60], igual ao total do MRP', () => {
    const m = r.matricial!
    expect(m.codigos).toEqual(['P', 'C1', 'C2'])
    expect(m.matrizB[1][0]).toBe(2)
    expect(m.matrizB[2][1]).toBe(3)
    expect(m.requisitoTotal).toEqual([10, 20, 60])
    expect(m.nbTotalMRP).toEqual([10, 20, 60])
  })
  it('perda_pct aumenta a necessidade do filho', () => {
    const r2 = calcularMRP(
      itens,
      [],
      [{ ...bom[0], perdaPct: 0.05 }, bom[1]],
      [{ codigo: 'P', semanaInicio: dataUTC(2025, 2, 10), quantidade: 10 }],
      {
        dataBase: SEGUNDA,
        horizonte: 8,
        politica: 'lote_a_lote',
        periodoFixoSemanas: 4,
      },
    )
    expect(r2.registros.find((x) => x.codigo === 'C1')!.semanas[3].nb).toBeCloseTo(21, 10)
  })
})

describe('BOM circular', () => {
  it('acusa o ciclo com os códigos', () => {
    expect(() =>
      calcularNiveis(
        [
          { codigoPai: 'A', codigoFilho: 'B', quantidadePor: 1, perdaPct: 0 },
          { codigoPai: 'B', codigoFilho: 'C', quantidadePor: 1, perdaPct: 0 },
          { codigoPai: 'C', codigoFilho: 'A', quantidadePor: 1, perdaPct: 0 },
        ],
        [],
      ),
    ).toThrow(ErroBOMCircular)
  })
  it('no processamento completo vira erro amigável do MRP, sem derrubar o resto', () => {
    const r = processar(
      entrada({
        materiais: [material('A', { estoqueAtual: 1 }), material('B', { estoqueAtual: 1 })],
        bom: [
          { codigoPai: 'A', codigoFilho: 'B', quantidadePor: 1, perdaPct: 0 },
          { codigoPai: 'B', codigoFilho: 'A', quantidadePor: 1, perdaPct: 0 },
        ],
        mps: [{ codigo: 'A', semanaInicio: dataUTC(2025, 1, 6), quantidade: 1 }],
      }),
    )
    expect(r.erroMRP).toContain('circular')
    expect(r.erroMRP).toContain('A → B → A')
    expect(r.itens).toHaveLength(2)
  })
})
