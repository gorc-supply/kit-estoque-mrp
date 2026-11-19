// Utilitários para montar entradas de teste.

import { dataUTC } from '../src/engine/datas'
import type { Entrada, Material, Movimento, TipoMovimento } from '../src/engine/tipos'

export function material(codigo: string, extra: Partial<Material> = {}): Material {
  return {
    codigo,
    descricao: `Item ${codigo}`,
    unidade: 'UN',
    estoqueAtual: 0,
    leadTimeDias: 15,
    ...extra,
  }
}

export function mov(
  codigo: string,
  ano: number,
  mes: number,
  dia: number,
  tipo: TipoMovimento,
  quantidade: number,
  valorTotal?: number,
): Movimento {
  return { codigo, data: dataUTC(ano, mes, dia), tipo, quantidade, valorTotal }
}

/** Saídas mensais (dia 15) a partir de um mês de 2025; zeros não geram movimento. */
export function saidasMensais(
  codigo: string,
  demanda: number[],
  mesInicial = 1,
  ano = 2025,
): Movimento[] {
  const saida: Movimento[] = []
  demanda.forEach((q, k) => {
    if (q <= 0) return
    const m = mesInicial + k
    const a = ano + Math.floor((m - 1) / 12)
    const mm = ((m - 1) % 12) + 1
    saida.push(mov(codigo, a, mm, 15, 'Saída', q))
  })
  return saida
}

export function entrada(parcial: Partial<Entrada>): Entrada {
  return { materiais: [], movimentacoes: [], pedidosAbertos: [], bom: [], mps: [], ...parcial }
}

/** Data-base padrão dos testes: 31/12/2025 (dezembro completo → janela jan–dez/2025). */
export const DATA_BASE = dataUTC(2025, 12, 31)
