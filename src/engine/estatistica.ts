// Funções estatísticas e numéricas básicas (seções 6.3, 6.7 e 6.12).

export function soma(valores: readonly number[]): number {
  let s = 0
  for (const v of valores) s += v
  return s
}

export function media(valores: readonly number[]): number {
  return valores.length === 0 ? 0 : soma(valores) / valores.length
}

/** Desvio padrão amostral: √(Σ(x − x̄)² ÷ (n − 1)). Com n < 2, retorna 0. */
export function desvioAmostral(valores: readonly number[]): number {
  const n = valores.length
  if (n < 2) return 0
  const m = media(valores)
  let q = 0
  for (const v of valores) q += (v - m) * (v - m)
  return Math.sqrt(q / (n - 1))
}

/** Coeficiente de variação σ ÷ x̄ (null se x̄ = 0). */
export function coeficienteVariacao(valores: readonly number[]): number | null {
  const m = media(valores)
  if (m === 0) return null
  return desvioAmostral(valores) / m
}

// ---------------------------------------------------------------------------
// Distribuição normal

const RAIZ_PI = Math.sqrt(Math.PI)
const RAIZ_2 = Math.SQRT2
const RAIZ_2PI = Math.sqrt(2 * Math.PI)

/**
 * Função erro complementar erfc(x), precisão ~1e-14.
 * |x| < 2,5: série de Taylor de erf; caso contrário, fração contínua de erfc.
 */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN
  if (x < 0) return 2 - erfc(-x)
  if (x < 2.5) return 1 - erfSerie(x)
  // Fração contínua (Laplace): erfc(x) = e^{-x²}/√π · 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + 2/(x + …)))))
  let f = x
  for (let k = 60; k >= 1; k--) f = x + k / 2 / f
  return Math.exp(-x * x) / RAIZ_PI / f
}

function erfSerie(x: number): number {
  // erf(x) = 2/√π · Σ (−1)^n x^(2n+1) / (n! (2n+1))
  let termo = x
  let s = x
  const x2 = x * x
  for (let n = 1; n < 200; n++) {
    termo *= -x2 / n
    const parcela = termo / (2 * n + 1)
    s += parcela
    if (Math.abs(parcela) < 1e-17 * Math.abs(s)) break
  }
  return (2 / RAIZ_PI) * s
}

export function erf(x: number): number {
  return 1 - erfc(x)
}

/** Densidade da normal padrão φ(z). */
export function phi(z: number): number {
  return Math.exp(-0.5 * z * z) / RAIZ_2PI
}

/** CDF da normal padrão Φ(z) = ½ · erfc(−z/√2). */
export function Phi(z: number): number {
  if (z === Infinity) return 1
  if (z === -Infinity) return 0
  return 0.5 * erfc(-z / RAIZ_2)
}

/** Função de perda normal padrão G(z) = φ(z) − z·(1 − Φ(z)). */
export function perdaNormal(z: number): number {
  return phi(z) - z * (1 - Phi(z))
}

// Coeficientes do algoritmo de Peter J. Acklam para o inverso da normal.
const A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
  -3.066479806614716e1, 2.506628277459239,
]
const B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
  -1.328068155288572e1,
]
const C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
  4.374664141464968, 2.938163982698783,
]
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]

/**
 * Inverso da CDF normal padrão (NORM.S.INV do Excel).
 * Algoritmo de Acklam + um passo de refinamento de Halley (erro < 1e-12).
 */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity
    if (p === 1) return Infinity
    return NaN
  }
  const pBaixo = 0.02425
  const pAlto = 1 - pBaixo
  let x: number
  if (p < pBaixo) {
    const q = Math.sqrt(-2 * Math.log(p))
    x =
      (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
      ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1)
  } else if (p <= pAlto) {
    const q = p - 0.5
    const r = q * q
    x =
      ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) /
      (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    x =
      -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
      ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1)
  }
  // Refinamento de Halley.
  const e = Phi(x) - p
  const u = e * RAIZ_2PI * Math.exp((x * x) / 2)
  x = x - u / (1 + (x * u) / 2)
  return x
}

// ---------------------------------------------------------------------------
// Arredondamento por unidade (seção 6.7)

/** Unidades fracionáveis: exibidas com 2 casas; as demais são discretas (arredondar para cima). */
const UNIDADES_FRACIONAVEIS = new Set([
  'KG',
  'G',
  'MG',
  'T',
  'TON',
  'L',
  'ML',
  'M',
  'M2',
  'M3',
  'CM',
  'MM',
])

export function normalizarUnidade(unidade: string): string {
  return unidade
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[.\s]/g, '')
    .replace('²', '2')
    .replace('³', '3')
}

export function ehUnidadeDiscreta(unidade: string): boolean {
  return !UNIDADES_FRACIONAVEIS.has(normalizarUnidade(unidade))
}

/** Teto tolerante a ruído de ponto flutuante (350,0000000001 → 350). */
export function tetoSeguro(x: number): number {
  return Math.ceil(x - 1e-9)
}

/** Arredondamento para exibição/saída: para cima em discretas; 2 casas em fracionáveis. */
export function arredondarQuantidade(valor: number, discreta: boolean): number {
  if (!Number.isFinite(valor)) return valor
  if (discreta) return tetoSeguro(valor)
  return Math.round(valor * 100) / 100
}

/** Ajusta uma quantidade a lote mínimo e múltiplo: max(lote_min, ⌈q ÷ múltiplo⌉ × múltiplo). */
export function ajustarLote(q: number, loteMinimo: number, multiplo: number): number {
  const m = multiplo > 0 ? multiplo : 1
  const ajustado = tetoSeguro(q / m) * m
  return Math.max(loteMinimo, ajustado)
}
