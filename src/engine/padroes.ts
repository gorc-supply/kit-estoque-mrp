// Valores padrão dos parâmetros globais (seção 6.1).

import type { MatrizNivelServico, Parametros } from './tipos'

export const MATRIZ_NIVEL_PADRAO: MatrizNivelServico = {
  A: { X: 0.98, Y: 0.97, Z: 0.95 },
  B: { X: 0.96, Y: 0.95, Z: 0.92 },
  C: { X: 0.93, Y: 0.9, Z: 0.85 },
}

export const PARAMETROS_PADRAO: Parametros = {
  periodicidade: 'mensal',
  janelaPeriodos: 12,
  excluirPeriodoIncompleto: true,
  corteA: 0.8,
  corteB: 0.95,
  corteX: 0.5,
  corteY: 1.0,
  corteADI: 1.32,
  corteCV2: 0.49,
  minPeriodos: 3,
  periodosMediaMovel: 6,
  alphaSBA: 0.1,
  diasPorPeriodo: null,
  custoPedido: 100,
  taxaManutencaoAnual: 0.25,
  diasSemGiro: 180,
  abaterDevolucoes: true,
  horizonteMRP: 12,
  politicaLote: 'lote_economico',
  periodoFixoSemanas: 4,
  dataBase: null,
  metodoPrevisao: 'regra_fixa',
  nivelServico: MATRIZ_NIVEL_PADRAO,
  leadTimePadraoDias: 30,
}

/** Combina parâmetros parciais com os padrões (inclusive a matriz de nível de serviço). */
export function completarParametros(p: Partial<Parametros> = {}): Parametros {
  return {
    ...PARAMETROS_PADRAO,
    ...p,
    nivelServico: {
      A: { ...MATRIZ_NIVEL_PADRAO.A, ...p.nivelServico?.A },
      B: { ...MATRIZ_NIVEL_PADRAO.B, ...p.nivelServico?.B },
      C: { ...MATRIZ_NIVEL_PADRAO.C, ...p.nivelServico?.C },
    },
  }
}
