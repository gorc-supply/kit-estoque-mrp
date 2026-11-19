// Previsão de demanda por período (6.6) e backtest com métricas de erro (6.12d).

import { media } from './estatistica'
import type { Backtest, ClasseXYZ, ErroMetodo, NomeMetodo, PadraoDemanda } from './tipos'

/** Média dos últimos k períodos (ou de todos, se houver menos de k). */
export function mediaMovel(serie: readonly number[], k: number): number {
  if (serie.length === 0) return 0
  return media(serie.slice(-Math.max(1, k)))
}

/**
 * SBA (Croston com correção de Syntetos-Boylan).
 * Inicializa z com o 1º valor não nulo e p com o 1º intervalo (posição do 1º não nulo, contando de 1).
 * A cada demanda seguinte: z ← z + α(d − z); p ← p + α(q − p), q = intervalo desde a última demanda.
 * F = (1 − α/2) · z ÷ p.
 */
export function sba(serie: readonly number[], alpha: number): number {
  let z = 0
  let p = 0
  let ultimo = -1
  for (let t = 0; t < serie.length; t++) {
    const d = serie[t]
    if (d <= 0) continue
    const q = t - ultimo
    if (ultimo < 0) {
      z = d
      p = q
    } else {
      z = z + alpha * (d - z)
      p = p + alpha * (q - p)
    }
    ultimo = t
  }
  if (ultimo < 0 || p === 0) return 0
  return ((1 - alpha / 2) * z) / p
}

/** Suavização exponencial simples: previsão para o próximo período. Inicializa com o 1º valor. */
export function ses(serie: readonly number[], alpha: number): number {
  if (serie.length === 0) return 0
  let f = serie[0]
  for (let t = 1; t < serie.length; t++) f = alpha * serie[t] + (1 - alpha) * f
  // Após processar d_{n−1}, f = previsão de n.
  return serie.length === 1 ? serie[0] : f
}

export const GRADE_ALPHA = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5]

/** α da SES que minimiza o erro quadrático médio das previsões um passo à frente dentro da série. */
export function melhorAlphaSES(serie: readonly number[]): number {
  if (serie.length < 3) return 0.1
  let melhor = GRADE_ALPHA[0]
  let menorEQM = Infinity
  for (const a of GRADE_ALPHA) {
    let f = serie[0]
    let eqm = 0
    for (let t = 1; t < serie.length; t++) {
      eqm += (serie[t] - f) ** 2
      f = a * serie[t] + (1 - a) * f
    }
    if (eqm < menorEQM - 1e-12) {
      menorEQM = eqm
      melhor = a
    }
  }
  return melhor
}

export function preverCom(
  serie: readonly number[],
  metodo: NomeMetodo,
  alphaSBA: number,
): { valor: number; alpha: number | null } {
  if (metodo === 'SBA') return { valor: sba(serie, alphaSBA), alpha: alphaSBA }
  if (metodo === 'SES') {
    const a = melhorAlphaSES(serie)
    return { valor: ses(serie, a), alpha: a }
  }
  if (metodo === 'Sem demanda') return { valor: 0, alpha: null }
  if (metodo === 'Média do histórico') return { valor: media(serie), alpha: null }
  const k = Number(metodo.slice(2))
  return { valor: mediaMovel(serie, k), alpha: null }
}

/** Método pela regra fixa da seção 6.6. */
export function metodoRegraFixa(
  classe: ClasseXYZ,
  padrao: PadraoDemanda | null,
  periodosMediaMovel: number,
): { metodo: NomeMetodo; motivo: string } {
  if (classe === 'N')
    return { metodo: 'Sem demanda', motivo: 'Sem saídas na janela: previsão zero.' }
  if (classe === 'Novo')
    return {
      metodo: 'Média do histórico',
      motivo: 'Histórico insuficiente: usa a média dos poucos períodos disponíveis.',
    }
  if (padrao === 'Intermitente' || padrao === 'Irregular')
    return {
      metodo: 'SBA',
      motivo: `Padrão ${padrao.toLowerCase()} (muitos períodos sem consumo): SBA (Croston corrigido), porque a média simples erra muito com zeros.`,
    }
  return {
    metodo: `MM${periodosMediaMovel}`,
    motivo: `Padrão ${(padrao ?? 'suave').toLowerCase()}: média móvel dos últimos ${periodosMediaMovel} períodos.`,
  }
}

// ---------------------------------------------------------------------------
// Métricas de erro (6.12d)

export function metricasErro(
  reais: readonly number[],
  previstos: readonly number[],
): { mae: number; rmse: number; wmape: number | null; vies: number | null } {
  const n = reais.length
  if (n === 0) return { mae: 0, rmse: 0, wmape: null, vies: null }
  let somaAbs = 0
  let somaQuad = 0
  let somaErro = 0
  let somaReal = 0
  for (let i = 0; i < n; i++) {
    const e = previstos[i] - reais[i]
    somaAbs += Math.abs(e)
    somaQuad += e * e
    somaErro += e
    somaReal += reais[i]
  }
  return {
    mae: somaAbs / n,
    rmse: Math.sqrt(somaQuad / n),
    wmape: somaReal > 0 ? somaAbs / somaReal : null,
    vies: somaReal > 0 ? somaErro / somaReal : null,
  }
}

/**
 * Backtest com origem móvel nos últimos `nTeste` períodos: para cada período t,
 * prevê usando só os dados anteriores a t. Exige ao menos 2 períodos de histórico por origem.
 */
export function backtest(
  serie: readonly number[],
  padrao: PadraoDemanda | null,
  alphaSBA: number,
  nTeste = 6,
): Backtest | null {
  const n = serie.length
  const primeiro = Math.max(2, n - nTeste)
  if (primeiro >= n) return null
  const periodos: number[] = []
  for (let t = primeiro; t < n; t++) periodos.push(t)

  const candidatos: NomeMetodo[] = ['MM3', 'MM6', 'MM12', 'SES']
  if (padrao === 'Intermitente' || padrao === 'Irregular') candidatos.push('SBA')

  const metodos: ErroMetodo[] = candidatos.map((metodo) => {
    const previsoes: number[] = []
    const reais: number[] = []
    const alphas: number[] = []
    for (const t of periodos) {
      const hist = serie.slice(0, t)
      const r = preverCom(hist, metodo, alphaSBA)
      previsoes.push(r.valor)
      reais.push(serie[t])
      if (r.alpha !== null) alphas.push(r.alpha)
    }
    const m = metricasErro(reais, previsoes)
    return {
      metodo,
      alpha:
        metodo === 'SES' && alphas.length
          ? alphas[alphas.length - 1]
          : metodo === 'SBA'
            ? alphaSBA
            : undefined,
      previsoes,
      reais,
      ...m,
    }
  })

  let melhor: NomeMetodo | null = null
  let menorMAE = Infinity
  for (const m of metodos) {
    if (m.mae < menorMAE - 1e-12) {
      menorMAE = m.mae
      melhor = m.metodo
    }
  }
  return { periodos, metodos, melhor }
}
