import { describe, expect, it } from 'vitest'

// Teste de fumaça da Fase 0: garante que o ambiente formata números e datas em pt-BR,
// base de toda a exibição do app. Os testes do motor (seção 13) chegam na Fase 1.
// Intl usa espaço não separável (U+00A0) entre "R$" e o número; a classe \s do regex JS o inclui.
const semNbsp = (s: string) => s.replace(/\s/g, ' ')

describe('ambiente pt-BR', () => {
  it('formata moeda como R$ 1.234,56', () => {
    const texto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      1234.56,
    )
    expect(semNbsp(texto)).toBe('R$ 1.234,56')
  })

  it('formata datas como dd/mm/aaaa', () => {
    expect(new Intl.DateTimeFormat('pt-BR').format(new Date(2026, 10, 19))).toBe('19/11/2026')
  })

  it('usa vírgula como separador decimal', () => {
    expect((0.165).toLocaleString('pt-BR', { maximumFractionDigits: 3 })).toBe('0,165')
  })
})
