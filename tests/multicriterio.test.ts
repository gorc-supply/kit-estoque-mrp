import { describe, expect, it } from 'vitest'
import { processar } from '../src/engine/index'
import {
  calcularAHP,
  classeVED,
  classificarMulticriterio,
  completarConfigMC,
  interpretarCriticidade,
  matrizReciproca,
  normalizarMinMax,
  normalizarPosto,
  PRESETS,
  type EntradaMC,
} from '../src/engine/multicriterio'
import type { ClasseABC, ConfigMulticriterio } from '../src/engine/tipos'
import { lerEntrada } from '../src/io/ler-planilha'
import { DATA_BASE, entrada, material, saidasMensais } from './util'

function item(codigo: string, extra: Partial<EntradaMC>): EntradaMC {
  return {
    codigo,
    classeValor: 'C',
    valorAnual: 0,
    leadTime: 10,
    cv: 0.3,
    criticidade: null,
    equipamentos: null,
    fornecedores: null,
    substituto: null,
    custoParada: null,
    criterios: {},
    classeManual: null,
    justificativa: null,
    ...extra,
  }
}

// Exemplo do Gabriel (seção 13, testes 22 e 23)
const M = [
  item('M1', { classeValor: 'A', valorAnual: 120_000, leadTime: 5, criticidade: 0 }),
  item('M2', { classeValor: 'B', valorAnual: 40_000, leadTime: 90, criticidade: 1 }),
  item('M3', { classeValor: 'C', valorAnual: 10_000, leadTime: 20, criticidade: 0.5 }),
]
const PESOS = { valor: 0.4, lead_time: 0.25, criticidade: 0.35 }
const config = (c: Partial<ConfigMulticriterio> = {}) =>
  completarConfigMC({ ativo: true, pesos: PESOS, ...c })
const crit = (r: ReturnType<typeof classificarMulticriterio>, codigo: string, id: string) =>
  r.porItem.get(codigo)!.criterios.find((c) => c.id === id)!.normalizado

describe('Teste 22 — Exemplo do Gabriel (posto percentil)', () => {
  const r = classificarMulticriterio(M, config())
  it('normaliza cada critério para 0–1 (1 = mais crítico)', () => {
    expect(['M1', 'M2', 'M3'].map((c) => crit(r, c, 'valor'))).toEqual([1, 0.5, 0])
    expect(['M1', 'M2', 'M3'].map((c) => crit(r, c, 'lead_time'))).toEqual([0, 1, 0.5])
    expect(['M1', 'M2', 'M3'].map((c) => crit(r, c, 'criticidade'))).toEqual([0, 1, 0.5])
  })
  it('scores M1 = 0,40; M2 = 0,80; M3 = 0,30 → ordem M2 > M1 > M3', () => {
    expect(r.porItem.get('M1')!.score).toBeCloseTo(0.4, 12)
    expect(r.porItem.get('M2')!.score).toBeCloseTo(0.8, 12)
    expect(r.porItem.get('M3')!.score).toBeCloseTo(0.3, 12)
    expect(['M1', 'M2', 'M3'].map((c) => r.porItem.get(c)!.posicao)).toEqual([2, 1, 3])
  })
  it('mesma contagem do ABC por valor: M2 sobe para A e M1 desce para B, com motivo', () => {
    const m2 = r.porItem.get('M2')!
    expect(m2.classeFinal).toBe('A')
    expect(m2.mudou).toBe('subiu')
    expect(m2.motivo).toContain('Subiu de B para A')
    expect(m2.motivo).toContain('criticidade Alta (+0,35)')
    expect(m2.motivo).toContain('lead time de 90 dias (+0,25)')
    expect(m2.motivo).toContain('valor intermediário (+0,20)')
    expect(r.porItem.get('M1')!.classeFinal).toBe('B')
    expect(r.porItem.get('M1')!.mudou).toBe('desceu')
    expect(r.resumo).toMatchObject({ subiram: 1, desceram: 1 })
  })
})

describe('Teste 23 — Mesmo exemplo com mín-máx', () => {
  const r = classificarMulticriterio(M, config({ normalizacao: 'minmax' }))
  it('valor M2 = 0,2727; LT M3 = 0,1765; scores 0,4000 · 0,7091 · 0,2191', () => {
    expect(crit(r, 'M2', 'valor')).toBeCloseTo(30 / 110, 10)
    expect(crit(r, 'M3', 'lead_time')).toBeCloseTo(15 / 85, 10)
    expect(r.porItem.get('M1')!.score).toBeCloseTo(0.4, 4)
    expect(r.porItem.get('M2')!.score).toBeCloseTo(0.7091, 4)
    expect(r.porItem.get('M3')!.score).toBeCloseTo(0.2191, 4)
    expect(['M2', 'M1', 'M3'].map((c) => r.porItem.get(c)!.posicao)).toEqual([1, 2, 3])
  })
})

describe('Teste 24 — Empate no posto percentil', () => {
  it('[10, 20, 20, 40] → 0; 0,5; 0,5; 1', () => {
    expect(normalizarPosto([10, 20, 20, 40])).toEqual([0, 0.5, 0.5, 1])
  })
  it('dado faltando recebe 0,5 e não entra no ranking', () => {
    expect(normalizarPosto([10, null, 30])).toEqual([0, 0.5, 1])
    expect(normalizarMinMax([5, 5, null])).toEqual([0.5, 0.5, 0.5])
  })
})

describe('Teste 25 — AHP consistente', () => {
  it('aᵢⱼ = wᵢ ÷ wⱼ recupera 0,5 / 0,3 / 0,2 com CR = 0', () => {
    const w = [0.5, 0.3, 0.2]
    const r = calcularAHP(matrizReciproca(3, (i, j) => w[i] / w[j]))
    r.pesos.forEach((p, i) => expect(p).toBeCloseTo(w[i], 12))
    expect(r.lambdaMax).toBeCloseTo(3, 12)
    expect(r.cr).toBeCloseTo(0, 12)
    expect(r.parMaisContraditorio).toBeNull()
  })
  it('comparações incoerentes: CR > 0,10 e aponta o par mais contraditório', () => {
    // A > B (5), B > C (5), mas C > A (3): circular.
    const acima: Record<string, number> = { '0-1': 5, '0-2': 1 / 3, '1-2': 5 }
    const r = calcularAHP(matrizReciproca(3, (i, j) => acima[`${i}-${j}`]))
    expect(r.cr).toBeGreaterThan(0.1)
    expect(r.parMaisContraditorio).not.toBeNull()
  })
})

describe('Teste 26 — Matriz VED', () => {
  it('B por valor e Vital → A; C e Desejável → C', () => {
    const r = classificarMulticriterio(
      [
        item('V1', { classeValor: 'B', criticidade: 1 }),
        item('D1', { classeValor: 'C', criticidade: 0 }),
      ],
      config({ modo: 'ved' }),
    )
    expect(r.porItem.get('V1')!.classeFinal).toBe('A')
    expect(r.porItem.get('V1')!.ved).toBe('V')
    expect(r.porItem.get('D1')!.classeFinal).toBe('C')
    expect(r.porItem.get('D1')!.motivo).toContain('Matriz VED')
  })
  it('converte criticidade em V/E/D', () => {
    expect([1, 0.75, 0.5, 0.25, 0, null].map(classeVED)).toEqual(['V', 'V', 'E', 'E', 'D', 'E'])
  })
})

describe('Interpretação da criticidade', () => {
  it('Alta/A/V/5 = 1; Média/B/E/3 = 0,5; Baixa/C/D/1 = 0; escala 1–5', () => {
    expect(['Alta', 'a', 'V', 'Vital', 5, '5'].map(interpretarCriticidade)).toEqual([
      1, 1, 1, 1, 1, 1,
    ])
    expect(['Média', 'media', 'B', 'E', 3].map(interpretarCriticidade)).toEqual([
      0.5, 0.5, 0.5, 0.5, 0.5,
    ])
    expect(['Baixa', 'C', 'd', 'Desejável', 1].map(interpretarCriticidade)).toEqual([0, 0, 0, 0, 0])
    expect(interpretarCriticidade(4)).toBe(0.75)
    expect(interpretarCriticidade('')).toBeNull()
    expect(interpretarCriticidade('urgente')).toBeNull()
    expect(interpretarCriticidade(7)).toBeNull()
  })
})

describe('Regras de piso, classe manual e estabilidade', () => {
  const base = [
    item('P1', { classeValor: 'A', valorAnual: 900, leadTime: 5, criticidade: 0 }),
    item('P2', { classeValor: 'B', valorAnual: 500, leadTime: 10, criticidade: 0 }),
    item('P3', {
      classeValor: 'C',
      valorAnual: 10,
      leadTime: 90,
      criticidade: 1,
      substituto: false,
    }),
  ]
  it('regra "Alta, sem substituto e LT > 60 → nunca abaixo de B" sobe o item e fica registrada', () => {
    const regras = [
      {
        id: 'r',
        ativa: true,
        criticidadeMin: 1,
        semSubstituto: true,
        leadTimeMaiorQue: 60,
        classeMinima: 'B' as const,
      },
    ]
    const r = classificarMulticriterio(base, config({ pesos: { valor: 1 }, regras }))
    const p3 = r.porItem.get('P3')!
    expect(p3.classeCalculada).toBe('C')
    expect(p3.classeFinal).toBe('B')
    expect(p3.regraAplicada).toContain('nunca abaixo de B')
    expect(p3.motivo).toContain('Regra de piso')
  })
  it('preset Clássico reproduz o ABC por valor e é 100% estável', () => {
    const r = classificarMulticriterio(base, config({ pesos: PRESETS.classico.pesos }))
    for (const e of base) {
      expect(r.porItem.get(e.codigo)!.classeFinal).toBe(e.classeValor)
      expect(r.porItem.get(e.codigo)!.estabilidade).toBe(1)
    }
  })
  it('estabilidade é reprodutível (semente fixa) e fica entre 0 e 1', () => {
    const a = classificarMulticriterio(M, config())
    const b = classificarMulticriterio(M, config())
    for (const c of ['M1', 'M2', 'M3']) {
      const ea = a.porItem.get(c)!.estabilidade!
      expect(ea).toBe(b.porItem.get(c)!.estabilidade)
      expect(ea).toBeGreaterThanOrEqual(0)
      expect(ea).toBeLessThanOrEqual(1)
    }
  })
  it('métodos alternativos de classe: percentual e cortes de score', () => {
    const p = classificarMulticriterio(
      M,
      config({ metodoClasses: 'percentual', percentuais: { A: 0.34, B: 0.33 } }),
    )
    expect(['M2', 'M1', 'M3'].map((c) => p.porItem.get(c)!.classeFinal)).toEqual(['A', 'B', 'C'])
    const c = classificarMulticriterio(
      M,
      config({ metodoClasses: 'cortes', cortes: { A: 0.6, B: 0.35 } }),
    )
    expect(['M2', 'M1', 'M3'].map((x) => c.porItem.get(x)!.classeFinal)).toEqual(['A', 'B', 'C'])
  })
})

describe('Teste 27 — Dado faltando e classe manual (processamento completo)', () => {
  const demanda = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
  const r = processar(
    entrada({
      materiais: [
        material('X1', {
          estoqueAtual: 50,
          custoUnitario: 100,
          leadTimeDias: 90,
          criticidade: 'Alta',
        }),
        material('X2', { estoqueAtual: 50, custoUnitario: 50, leadTimeDias: 10 }),
        material('X3', {
          estoqueAtual: 50,
          custoUnitario: 1,
          leadTimeDias: 5,
          criticidade: 'Alta',
          classeManual: 'C',
          justificativaClasse: 'Item obsoleto',
        }),
      ],
      movimentacoes: [
        ...saidasMensais('X1', demanda),
        ...saidasMensais('X2', demanda),
        ...saidasMensais('X3', demanda),
      ],
    }),
    { dataBase: DATA_BASE, multicriterio: config() },
  )
  const porCodigo = new Map(r.itens.map((i) => [i.codigo, i]))
  it('item sem criticidade recebe 0,5 e gera aviso agregado', () => {
    const x2 = porCodigo.get('X2')!.multicriterio!
    const c = x2.criterios.find((k) => k.id === 'criticidade')!
    expect(c.normalizado).toBe(0.5)
    expect(c.faltando).toBe(true)
    const aviso = r.qualidade.problemas.find(
      (p) => p.regra === 'mc_dado_faltando' && p.mensagem.includes('Criticidade'),
    )
    expect(aviso?.mensagem).toContain('X2')
    expect(aviso?.gravidade).toBe('aviso')
  })
  it('classe manual prevalece sobre o score e fica marcada', () => {
    const x3 = porCodigo.get('X3')!
    expect(x3.classeABC).toBe('C')
    expect(x3.multicriterio!.manual).toBe(true)
    expect(x3.multicriterio!.motivo).toContain('Item obsoleto')
  })
  it('a classe final alimenta o nível de serviço e a matriz; a de valor continua visível', () => {
    expect(r.multicriterio).not.toBeNull()
    for (const i of r.itens) {
      expect(i.classeABC).toBe(i.multicriterio!.classeFinal)
      expect(i.classeABCValor).toBe(i.multicriterio!.classeValor)
      if (i.nivelServico !== null)
        expect(i.nivelServico).toBe(r.parametros.nivelServico[i.classeABC].X)
    }
    expect(r.matriz.reduce((s, c) => s + c.itens, 0)).toBe(3)
  })
})

describe('Teste 28 — OndeUsado', () => {
  it('item usado em E1 (Baixa) e E2 (Alta) → criticidade Alta; cadastro do item prevalece', () => {
    const r = processar(
      entrada({
        materiais: [
          material('I1', { estoqueAtual: 5, custoUnitario: 10 }),
          material('I2', { estoqueAtual: 5, custoUnitario: 10, criticidade: 'Baixa' }),
        ],
        movimentacoes: [...saidasMensais('I1', [5, 5, 5, 5]), ...saidasMensais('I2', [5, 5, 5, 5])],
        equipamentos: [
          { equipamento: 'E1', criticidade: 'Baixa' },
          { equipamento: 'E2', criticidade: 'Alta' },
        ],
        ondeUsado: [
          { codigo: 'I1', equipamento: 'E1' },
          { codigo: 'I1', equipamento: 'E2' },
          { codigo: 'I2', equipamento: 'E2' },
        ],
      }),
      {
        dataBase: DATA_BASE,
        multicriterio: config({ pesos: { criticidade: 0.5, equipamentos: 0.5 } }),
      },
    )
    const i1 = r.itens.find((i) => i.codigo === 'I1')!.multicriterio!
    const i2 = r.itens.find((i) => i.codigo === 'I2')!.multicriterio!
    expect(i1.criticidade).toBe(1)
    expect(i1.equipamentos).toEqual(['E1', 'E2'])
    expect(i2.criticidade).toBe(0)
    expect(i1.criterios.find((c) => c.id === 'equipamentos')!.bruto).toBe(2)
  })
})

describe('Módulo desligado e leitura das colunas novas', () => {
  it('desligado: nada muda (classe = classe por valor, sem detalhe multicritério)', () => {
    const r = processar(
      entrada({
        materiais: [material('Z', { estoqueAtual: 1, custoUnitario: 1, criticidade: 'Alta' })],
        movimentacoes: saidasMensais('Z', [1, 2, 3]),
      }),
      { dataBase: DATA_BASE },
    )
    expect(r.multicriterio).toBeNull()
    expect(r.itens[0].multicriterio).toBeNull()
    expect(r.itens[0].classeABC).toBe(r.itens[0].classeABCValor)
    expect(r.qualidade.problemas.some((p) => p.regra.startsWith('mc_'))).toBe(false)
  })

  it('lê criticidade, substituto, fornecedores, crit_* e as abas Equipamentos/OndeUsado (CSV)', () => {
    const buf = (t: string) => new TextEncoder().encode(t).buffer as ArrayBuffer
    const e = lerEntrada([
      {
        nome: 'materiais.csv',
        dados: buf(
          'codigo;descricao;unidade;estoque_atual;lead_time_dias;criticidade;num_fornecedores;possui_substituto;custo_parada_hora;classe_manual;justificativa_classe;crit_seguranca\nA;Item A;UN;1;10;Alta;1;Não;1.500,00;b;Norma NR-12;4\n',
        ),
      },
      {
        nome: 'movimentacoes.csv',
        dados: buf('data;codigo;tipo;quantidade\n01/01/2025;A;Saída;1\n'),
      },
      {
        nome: 'equipamentos.csv',
        dados: buf('equipamento;criticidade;setor\nPrensa 01;V;Estamparia\n'),
      },
      { nome: 'onde_usado.csv', dados: buf('codigo;equipamento\nA;Prensa 01\n') },
    ])
    expect(e.materiais[0]).toMatchObject({
      criticidade: 'Alta',
      numFornecedores: 1,
      possuiSubstituto: false,
      custoParadaHora: 1500,
      classeManual: 'B' as ClasseABC,
      justificativaClasse: 'Norma NR-12',
      criterios: { seguranca: 4 },
    })
    expect(e.equipamentos).toEqual([
      { equipamento: 'Prensa 01', criticidade: 'V', setor: 'Estamparia', linha: 2 },
    ])
    expect(e.ondeUsado).toEqual([{ codigo: 'A', equipamento: 'Prensa 01', linha: 2 }])
  })
})

describe('Sliders: rebalanceamento dos pesos', () => {
  it('ajusta um peso e redistribui os outros proporcionalmente, somando 100%', async () => {
    const { rebalancear } = await import('../src/lib/pesos')
    const ids = ['valor', 'lead_time', 'criticidade', 'fornecedores']
    const r = rebalancear(
      { valor: 0.4, lead_time: 0.25, criticidade: 0.25, fornecedores: 0.1 },
      'valor',
      0.7,
      ids,
    )
    expect(r.valor).toBeCloseTo(0.7, 12)
    expect(r.lead_time).toBeCloseTo(0.125, 12)
    expect(r.criticidade).toBeCloseTo(0.125, 12)
    expect(r.fornecedores).toBeCloseTo(0.05, 12)
    expect(Object.values(r).reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12)
  })
  it('com os outros pesos zerados, o critério fica em 100%', async () => {
    const { rebalancear } = await import('../src/lib/pesos')
    expect(rebalancear({ valor: 1 }, 'valor', 0.5, ['valor', 'lead_time']).valor).toBe(1)
  })
})
