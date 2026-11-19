// Janela de análise, séries de demanda por período (6.3) e reconstrução do saldo (6.9).

import {
  dataDeSerial,
  diaSerial,
  fimPeriodo,
  indicePeriodo,
  inicioPeriodo,
  rotuloPeriodo,
} from './datas'
import type { Janela, Material, Movimento, Parametros, TipoMovimento } from './tipos'

export function diasPorPeriodo(p: Parametros): number {
  return p.diasPorPeriodo ?? (p.periodicidade === 'mensal' ? 30 : 7)
}

export function periodosPorAno(p: Parametros): number {
  return p.periodicidade === 'mensal' ? 12 : 52
}

/**
 * Janela = últimos N períodos. O período que contém a data-base só entra se estiver
 * completo ou se "excluir período incompleto" estiver desligado.
 */
export function calcularJanela(dataBaseDia: number, p: Parametros): Janela {
  const atual = indicePeriodo(dataBaseDia, p.periodicidade)
  const incompleto = dataBaseDia < fimPeriodo(atual, p.periodicidade)
  const fim = p.excluirPeriodoIncompleto && incompleto ? atual - 1 : atual
  const inicio = fim - Math.max(1, Math.round(p.janelaPeriodos)) + 1
  const rotulos: string[] = []
  const datasInicio: Date[] = []
  for (let i = inicio; i <= fim; i++) {
    rotulos.push(rotuloPeriodo(i, p.periodicidade))
    datasInicio.push(dataDeSerial(inicioPeriodo(i, p.periodicidade)))
  }
  return {
    periodicidade: p.periodicidade,
    inicio,
    fim,
    rotulos,
    datasInicio,
    diasPorPeriodo: diasPorPeriodo(p),
    periodosPorAno: periodosPorAno(p),
  }
}

/** Efeito de cada tipo de movimento no saldo (tabela da seção 5.2). */
export function sinalSaldo(tipo: TipoMovimento): 1 | -1 {
  switch (tipo) {
    case 'Entrada':
    case 'Ajuste +':
    case 'Devolução ao estoque':
      return 1
    case 'Saída':
    case 'Ajuste -':
    case 'Devolução ao fornecedor':
      return -1
  }
}

export interface SerieItem {
  /** Posição (na janela) onde a série do item começa. */
  inicioSerie: number
  /** Demanda por período a partir de inicioSerie (saídas líquidas de devoluções ao estoque, ≥ 0). */
  demanda: number[]
  /** Entradas (qtd) por período da janela inteira, líquidas de devoluções ao fornecedor. */
  entradasJanela: number[]
  /** Demanda por período da janela inteira (zeros antes do início do item). */
  demandaJanela: number[]
  /** Saldo ao fim de cada período, a partir de inicioSerie. */
  saldosFim: number[]
  /** Saldo ao fim de cada período da janela inteira (para o consolidado). */
  saldosFimJanela: number[]
  saldoInicial: number
  /** Dia serial da última saída (qualquer data), ou null. */
  ultimaSaidaDia: number | null
  /** Dia serial de referência de "início de vida" (cadastro ou 1ª movimentação), ou null. */
  inicioVidaDia: number | null
}

/**
 * Monta a série de demanda de um item.
 * Início da série: max(início da janela, período de data_cadastro; senão, da 1ª movimentação).
 * Períodos antes do início do item não entram como zero.
 */
export function montarSerie(
  material: Material,
  movimentos: readonly Movimento[],
  janela: Janela,
  dataBaseDia: number,
  abaterDevolucoes: boolean,
): SerieItem {
  const L = janela.fim - janela.inicio + 1
  const per = janela.periodicidade
  const fimJanelaDia = fimPeriodo(janela.fim, per)

  const saidas = new Array<number>(L).fill(0)
  const devEstoque = new Array<number>(L).fill(0)
  const entradas = new Array<number>(L).fill(0)
  const efeito = new Array<number>(L).fill(0)
  let efeitoAposJanela = 0
  let primeiroDia: number | null = null
  let ultimaSaidaDia: number | null = null

  for (const m of movimentos) {
    if (!m.data || !m.tipo) continue
    const dia = diaSerial(m.data)
    if (dia > dataBaseDia) continue
    if (primeiroDia === null || dia < primeiroDia) primeiroDia = dia
    if (m.tipo === 'Saída' && (ultimaSaidaDia === null || dia > ultimaSaidaDia))
      ultimaSaidaDia = dia

    const ef = sinalSaldo(m.tipo) * m.quantidade
    if (dia > fimJanelaDia) {
      efeitoAposJanela += ef
      continue
    }
    const k = indicePeriodo(dia, per) - janela.inicio
    if (k < 0) continue
    efeito[k] += ef
    if (m.tipo === 'Saída') saidas[k] += m.quantidade
    else if (m.tipo === 'Devolução ao estoque') devEstoque[k] += m.quantidade
    else if (m.tipo === 'Entrada') entradas[k] += m.quantidade
    else if (m.tipo === 'Devolução ao fornecedor') entradas[k] -= m.quantidade
  }

  const inicioVidaDia = material.dataCadastro ? diaSerial(material.dataCadastro) : primeiroDia
  let inicioSerie = 0
  if (inicioVidaDia !== null) {
    inicioSerie = Math.max(0, indicePeriodo(inicioVidaDia, per) - janela.inicio)
  }
  inicioSerie = Math.min(inicioSerie, L) // item que começou depois da janela: série vazia

  const demandaJanela = saidas.map((s, k) => {
    const d = abaterDevolucoes ? s - devEstoque[k] : s
    return k < inicioSerie ? 0 : Math.max(0, d)
  })

  // Saldo: parte do estoque atual (na data-base) e desfaz os movimentos de trás para frente.
  const saldosFimJanela = new Array<number>(L).fill(0)
  let saldo =
    (Number.isFinite(material.estoqueAtual) ? material.estoqueAtual : 0) - efeitoAposJanela
  for (let k = L - 1; k >= 0; k--) {
    saldosFimJanela[k] = saldo
    saldo -= efeito[k]
  }
  const saldoInicial =
    inicioSerie < L
      ? saldosFimJanela[inicioSerie] - efeito[inicioSerie]
      : (saldosFimJanela[L - 1] ?? 0)

  return {
    inicioSerie,
    demanda: demandaJanela.slice(inicioSerie),
    entradasJanela: entradas,
    demandaJanela,
    saldosFim: saldosFimJanela.slice(inicioSerie),
    saldosFimJanela,
    saldoInicial,
    ultimaSaidaDia,
    inicioVidaDia,
  }
}

/** Primeiro dia da janela e último dia da janela (seriais). */
export function limitesJanela(janela: Janela): { inicioDia: number; fimDia: number } {
  return {
    inicioDia: inicioPeriodo(janela.inicio, janela.periodicidade),
    fimDia: fimPeriodo(janela.fim, janela.periodicidade),
  }
}
