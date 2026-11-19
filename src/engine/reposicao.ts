// Posição, status e sugestão de compra (seção 6.8).

import { ajustarLote } from './estatistica'
import { num } from './formatar'
import type { ClasseABC, Prioridade, StatusItem } from './tipos'

export interface EntradaReposicao {
  estoqueAtual: number
  pedidosAbertos: number
  F: number
  estoqueSeguranca: number | null
  pontoPedido: number | null
  estoqueMaximo: number | null
  /** Lote de compra ajustado (Q*), usado quando Máx fica abaixo da posição. */
  loteCompra: number | null
  loteMinimo: number
  multiplo: number
  custo: number
  leadTimeDias: number
  coberturaDias: number
  diasSemSaida: number | null
  diasSemGiro: number
  classeABC: ClasseABC
}

export interface SaidaReposicao {
  posicao: number
  status: StatusItem
  sugestaoQtd: number
  sugestaoValor: number
  riscoAntesChegada: boolean
  prioridade: Prioridade | null
  motivo: string
}

/** Status: o primeiro critério que bater, na ordem da seção 6.8. */
export function definirStatus(e: EntradaReposicao, posicao: number): StatusItem {
  if (e.estoqueAtual <= 0 && e.F > 0) return 'Ruptura'
  if (e.estoqueSeguranca !== null && e.estoqueAtual < e.estoqueSeguranca) return 'Crítico'
  if (e.pontoPedido !== null && posicao <= e.pontoPedido) return 'Comprar'
  if (e.estoqueMaximo !== null && e.estoqueAtual > e.estoqueMaximo && e.F > 0) return 'Excesso'
  if (e.estoqueAtual > 0 && (e.diasSemSaida === null || e.diasSemSaida >= e.diasSemGiro))
    return 'Sem giro'
  if (e.F === 0 && e.estoqueAtual === 0) return 'Sem demanda'
  return 'OK'
}

export function calcularReposicao(e: EntradaReposicao): SaidaReposicao {
  const posicao = e.estoqueAtual + e.pedidosAbertos
  const status = definirStatus(e, posicao)

  // Risco de ruptura antes da chegada: cobertura < lead time (só para itens com consumo).
  const riscoAntesChegada = e.F > 0 && e.coberturaDias < e.leadTimeDias

  let sugestaoQtd = 0
  let prioridade: Prioridade | null = null
  let motivo = ''
  let umLote = false
  if (e.pontoPedido !== null && e.estoqueMaximo !== null && posicao <= e.pontoPedido) {
    if (e.estoqueMaximo - posicao > 1e-9) {
      sugestaoQtd = ajustarLote(e.estoqueMaximo - posicao, e.loteMinimo, e.multiplo)
    } else if (e.loteCompra !== null && e.loteCompra > 0) {
      // Máx = ES + Q* pode ficar abaixo do PP quando a demanda no lead time supera o lote
      // (lead time longo, lote pequeno). Sem isso o item ficaria "Comprar" com sugestão zero:
      // nesse caso sugerimos um lote Q*.
      sugestaoQtd = e.loteCompra
      umLote = true
    }
    if (sugestaoQtd > 0) {
      if (riscoAntesChegada) prioridade = 'Urgente'
      else if (e.classeABC === 'A' || status === 'Ruptura' || status === 'Crítico')
        prioridade = 'Alta'
      else if (e.classeABC === 'B') prioridade = 'Média'
      else prioridade = 'Baixa'

      const cob = Number.isFinite(e.coberturaDias) ? `${num(e.coberturaDias)} d` : '∞'
      const comp = riscoAntesChegada ? '<' : e.coberturaDias === e.leadTimeDias ? '=' : '>'
      motivo = `Posição ${num(posicao, 2)} ≤ PP ${num(Math.ceil(e.pontoPedido - 1e-9))}; cobertura ${cob} ${comp} LT ${num(e.leadTimeDias)} d`
      if (status === 'Ruptura') motivo = `Estoque zerado; ${motivo}`
      else if (status === 'Crítico') motivo = `Estoque abaixo do ES; ${motivo}`
      if (umLote) motivo = `${motivo}; Máx abaixo da posição (lead time longo): sugerido 1 lote Q*`
    }
  }

  return {
    posicao,
    status,
    sugestaoQtd,
    sugestaoValor: sugestaoQtd * e.custo,
    riscoAntesChegada,
    prioridade,
    motivo,
  }
}

export const ORDEM_PRIORIDADE: Record<Prioridade, number> = {
  Urgente: 0,
  Alta: 1,
  Média: 2,
  Baixa: 3,
}
