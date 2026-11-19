// KPIs do dashboard (seções 6.11 e 6.12d).

import type { ItemResultado, KPIs, RelatorioQualidade } from './tipos'

function mediaPonderada(pares: { v: number | null; w: number }[]): number | null {
  let s = 0
  let w = 0
  for (const p of pares) {
    if (p.v === null || !Number.isFinite(p.v) || !(p.w > 0)) continue
    s += p.v * p.w
    w += p.w
  }
  return w > 0 ? s / w : null
}

export function calcularKPIs(
  itens: readonly ItemResultado[],
  qualidade: RelatorioQualidade,
  diasPorPeriodo: number,
): KPIs {
  const total = itens.length
  let valorEstoque = 0
  let skusAtivos = 0
  let qtdA = 0
  let valorA = 0
  let valorConsumo = 0
  let cmvAnual = 0
  let estoqueMedioValor = 0
  let consumoValorDia = 0
  let ruptura = 0
  let criticos = 0
  let comprar = 0
  let valorSugestao = 0
  let valorExcesso = 0
  let valorSemGiro = 0
  let risco = 0

  for (const i of itens) {
    const estoquePos = Math.max(0, i.estoqueAtual)
    valorEstoque += estoquePos * i.custo
    if (i.estoqueAtual > 0 || i.media > 0) skusAtivos++
    valorConsumo += i.consumoAnualValor
    if (i.classeABC === 'A' && i.consumoAnualValor > 0) {
      qtdA++
      valorA += i.consumoAnualValor
    }
    cmvAnual += i.consumoAnualValor
    estoqueMedioValor += Math.max(0, i.estoqueMedio) * i.custo
    consumoValorDia += (i.previsao * i.custo) / diasPorPeriodo
    if (i.status === 'Ruptura') ruptura++
    if (i.status === 'Crítico') criticos++
    if (i.sugestaoQtd > 0) {
      comprar++
      valorSugestao += i.sugestaoValor
    }
    if (i.estoqueMaximo !== null && i.previsao > 0)
      valorExcesso += Math.max(0, i.estoqueAtual - i.estoqueMaximo) * i.custo
    if (i.status === 'Sem giro') valorSemGiro += estoquePos * i.custo
    if (i.riscoAntesChegada) risco++
  }

  return {
    valorEstoque,
    skusAtivos,
    totalItens: total,
    pctSkusA: total > 0 ? qtdA / total : 0,
    pctValorA: valorConsumo > 0 ? valorA / valorConsumo : 0,
    giro: estoqueMedioValor > 0 ? cmvAnual / estoqueMedioValor : null,
    coberturaMediaDias: consumoValorDia > 0 ? valorEstoque / consumoValorDia : null,
    itensRuptura: ruptura,
    pctRuptura: total > 0 ? ruptura / total : 0,
    itensCriticos: criticos,
    itensComprar: comprar,
    valorSugestao,
    valorExcesso,
    valorSemGiro,
    riscoAntesChegada: risco,
    nivelServicoMedio: mediaPonderada(
      itens.map((i) => ({ v: i.nivelServico, w: i.consumoAnualValor })),
    ),
    qualidadeDados: qualidade.percentualValidas,
    wmapeMedio: mediaPonderada(itens.map((i) => ({ v: i.wmape, w: i.consumoAnualValor }))),
    viesMedio: mediaPonderada(itens.map((i) => ({ v: i.vies, w: i.consumoAnualValor }))),
  }
}
