// Parâmetros de reposição (6.7) e análises 6.12a, 6.12b, 6.12c e 6.12e.

import { ajustarLote, normInv, Phi, perdaNormal } from './estatistica'

export interface EntradaParametros {
  /** Previsão por período. */
  F: number
  /** Desvio padrão da demanda por período. */
  sigma: number
  /** ES pode ser calculado (série com histórico suficiente e demanda > 0). */
  esCalculavel: boolean
  leadTimeDias: number
  desvioLeadTimeDias: number | null
  diasPorPeriodo: number
  periodosPorAno: number
  nivelServico: number | null
  custo: number
  custoPedido: number
  taxaManutencao: number
  loteMinimo: number
  multiplo: number
  esManual: number | null
  estoqueAtual: number
  posicao: number
}

export interface SaidaParametros {
  ltPeriodos: number
  z: number | null
  /** Desvio da demanda no lead time (σ√LTₚ ou com variabilidade de prazo). */
  sigmaLT: number
  estoqueSeguranca: number | null
  esManual: boolean
  pontoPedido: number | null
  demandaAnual: number
  custoManutencao: number
  eoq: number | null
  loteCompra: number | null
  origemLote: 'eoq' | 'um_periodo' | 'minimo'
  estoqueMaximo: number | null
  consumoDiario: number
  coberturaDias: number
  custoTotalEOQ: number | null
  custoTotalLote: number | null
  penalidadeArredondamento: number | null
  mediaLT: number
  probRupturaCiclo: number | null
  probFaltarAntesChegada: number | null
  perdaNormalG: number | null
  faltaEsperadaCiclo: number | null
  fillRate: number | null
}

/** σ da demanda no lead time: σ√LTₚ, ou √(LTₚσ² + F²σ_LTₚ²) com variabilidade de prazo. */
export function sigmaLeadTime(
  sigma: number,
  F: number,
  ltPeriodos: number,
  desvioLTPeriodos: number | null,
): number {
  if (desvioLTPeriodos !== null && desvioLTPeriodos > 0) {
    return Math.sqrt(ltPeriodos * sigma * sigma + F * F * desvioLTPeriodos * desvioLTPeriodos)
  }
  return sigma * Math.sqrt(ltPeriodos)
}

/** Custo total anual relevante do lote: CT(Q) = (D/Q)·S + (Q/2)·H. */
export function custoTotalLote(Q: number, D: number, S: number, H: number): number {
  return (D / Q) * S + (Q / 2) * H
}

export function calcularParametros(e: EntradaParametros): SaidaParametros {
  const ltPeriodos = e.leadTimeDias / e.diasPorPeriodo
  const desvioLTp = e.desvioLeadTimeDias !== null ? e.desvioLeadTimeDias / e.diasPorPeriodo : null
  const sigmaLT = sigmaLeadTime(e.sigma, e.F, ltPeriodos, desvioLTp)
  const z = e.nivelServico !== null ? normInv(e.nivelServico) : null

  // Estoque de segurança
  let estoqueSeguranca: number | null = null
  const manual = e.esManual !== null && Number.isFinite(e.esManual) && e.esManual >= 0
  if (manual) estoqueSeguranca = e.esManual
  else if (e.esCalculavel && z !== null) estoqueSeguranca = Math.max(0, z * sigmaLT)

  // Ponto de pedido: só faz sentido com demanda prevista (ou ES manual).
  const pontoPedido = e.F > 0 || manual ? e.F * ltPeriodos + (estoqueSeguranca ?? 0) : null

  // Lote econômico
  const demandaAnual = e.F * e.periodosPorAno
  const H = e.taxaManutencao * e.custo
  const S = e.custoPedido
  const eoq = demandaAnual > 0 && H > 0 && S > 0 ? Math.sqrt((2 * demandaAnual * S) / H) : null

  let loteCompra: number | null = null
  let origemLote: SaidaParametros['origemLote'] = 'minimo'
  if (eoq !== null) {
    loteCompra = ajustarLote(eoq, e.loteMinimo, e.multiplo)
    origemLote = 'eoq'
  } else if (e.F > 0) {
    // EOQ não se aplica (ex.: item sem custo): lote = 1 período de demanda.
    loteCompra = ajustarLote(e.F, e.loteMinimo, e.multiplo)
    origemLote = 'um_periodo'
  } else if (pontoPedido !== null) {
    loteCompra = ajustarLote(0, Math.max(e.loteMinimo, e.multiplo > 0 ? e.multiplo : 1), e.multiplo)
    origemLote = 'minimo'
  }

  const estoqueMaximo =
    pontoPedido !== null && loteCompra !== null ? (estoqueSeguranca ?? 0) + loteCompra : null

  const consumoDiario = e.F / e.diasPorPeriodo
  const coberturaDias = consumoDiario > 0 ? Math.max(0, e.estoqueAtual) / consumoDiario : Infinity

  // 6.12a — custo total do lote e penalidade do arredondamento
  let custoTotalEOQ: number | null = null
  let custoTotalQ: number | null = null
  let penalidade: number | null = null
  if (eoq !== null && loteCompra !== null && loteCompra > 0) {
    custoTotalEOQ = Math.sqrt(2 * demandaAnual * S * H)
    custoTotalQ = custoTotalLote(loteCompra, demandaAnual, S, H)
    penalidade = (custoTotalQ - custoTotalEOQ) / custoTotalEOQ
  }

  // 6.12b — distribuição da demanda no lead time
  const mediaLT = e.F * ltPeriodos
  let probRupturaCiclo: number | null = null
  let probFaltar: number | null = null
  if (e.F > 0) {
    if (e.nivelServico !== null && !manual) probRupturaCiclo = 1 - e.nivelServico
    else if (estoqueSeguranca !== null && sigmaLT > 0)
      probRupturaCiclo = 1 - Phi(estoqueSeguranca / sigmaLT)
    if (sigmaLT > 0) probFaltar = 1 - Phi((e.posicao - mediaLT) / sigmaLT)
    else probFaltar = e.posicao < mediaLT ? 1 : 0
  }

  // 6.12c — função de perda e fill rate (z efetivo = ES ÷ σ_LT)
  let G: number | null = null
  let esc: number | null = null
  let fillRate: number | null = null
  if (estoqueSeguranca !== null && sigmaLT > 0 && loteCompra !== null && loteCompra > 0) {
    const zEf = estoqueSeguranca / sigmaLT
    G = perdaNormal(zEf)
    esc = sigmaLT * G
    fillRate = 1 - esc / loteCompra
  }

  return {
    ltPeriodos,
    z,
    sigmaLT,
    estoqueSeguranca,
    esManual: manual,
    pontoPedido,
    demandaAnual,
    custoManutencao: H,
    eoq,
    loteCompra,
    origemLote,
    estoqueMaximo,
    consumoDiario,
    coberturaDias,
    custoTotalEOQ,
    custoTotalLote: custoTotalQ,
    penalidadeArredondamento: penalidade,
    mediaLT,
    probRupturaCiclo,
    probFaltarAntesChegada: probFaltar,
    perdaNormalG: G,
    faltaEsperadaCiclo: esc,
    fillRate,
  }
}

// ---------------------------------------------------------------------------
// 6.12e — curva nível de serviço × custo do estoque de segurança

export const NIVEIS_CURVA = [0.8, 0.85, 0.9, 0.92, 0.94, 0.95, 0.96, 0.97, 0.98, 0.99, 0.995, 0.999]

export interface PontoCurvaNivel {
  nivel: number
  z: number
  es: number
  custoAnual: number
}

export function curvaNivelServico(
  sigmaLT: number,
  H: number,
  niveis = NIVEIS_CURVA,
): PontoCurvaNivel[] {
  return niveis.map((nivel) => {
    const z = normInv(nivel)
    const es = Math.max(0, z * sigmaLT)
    return { nivel, z, es, custoAnual: es * H }
  })
}

/** Pontos da curva de custo total do lote (6.12a) para o gráfico. */
export function curvaCustoLote(
  D: number,
  S: number,
  H: number,
  qMax: number,
  pontos = 60,
): { q: number; pedir: number; manter: number; total: number }[] {
  const saida: { q: number; pedir: number; manter: number; total: number }[] = []
  if (!(D > 0 && S > 0 && H > 0 && qMax > 0)) return saida
  const qMin = qMax / pontos
  for (let i = 1; i <= pontos; i++) {
    const q = qMin * i
    const pedir = (D / q) * S
    const manter = (q / 2) * H
    saida.push({ q, pedir, manter, total: pedir + manter })
  }
  return saida
}
