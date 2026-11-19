// Vetores e similaridade de cosseno (6.12g).

/** cos θ = (a · b) ÷ (‖a‖ × ‖b‖). Retorna 0 se algum vetor for nulo. */
export function cosseno(a: readonly number[], b: readonly number[]): number {
  let ab = 0
  let aa = 0
  let bb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    ab += a[i] * b[i]
    aa += a[i] * a[i]
    bb += b[i] * b[i]
  }
  if (aa === 0 || bb === 0) return 0
  return ab / (Math.sqrt(aa) * Math.sqrt(bb))
}

/** Perfil de forma: vetor dividido pela própria média (sem escala). */
export function perfilNormalizado(v: readonly number[]): number[] {
  const m = v.reduce((s, x) => s + x, 0) / (v.length || 1)
  return m > 0 ? v.map((x) => x / m) : v.map(() => 0)
}

export interface VetorItem {
  codigo: string
  categoria: string
  perfil: number[]
}

/**
 * Para cada item, os `top` itens com cos θ ≥ `limite`. Custo O(n²); acima de `maxGlobal`
 * itens, compara só dentro da mesma categoria.
 */
export function calcularParecidos(
  vetores: readonly VetorItem[],
  limite = 0.8,
  top = 5,
  maxGlobal = 3000,
): Map<string, { codigo: string; similaridade: number }[]> {
  const saida = new Map<string, { codigo: string; similaridade: number }[]>()
  const grupos = new Map<string, VetorItem[]>()
  if (vetores.length > maxGlobal) {
    for (const v of vetores) {
      const g = grupos.get(v.categoria) ?? []
      g.push(v)
      grupos.set(v.categoria, g)
    }
  } else {
    grupos.set('*', [...vetores])
  }

  for (const grupo of grupos.values()) {
    const candidatos = new Map<string, { codigo: string; similaridade: number }[]>()
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        const s = cosseno(grupo[i].perfil, grupo[j].perfil)
        if (s < limite) continue
        const a = candidatos.get(grupo[i].codigo) ?? []
        a.push({ codigo: grupo[j].codigo, similaridade: s })
        candidatos.set(grupo[i].codigo, a)
        const b = candidatos.get(grupo[j].codigo) ?? []
        b.push({ codigo: grupo[i].codigo, similaridade: s })
        candidatos.set(grupo[j].codigo, b)
      }
    }
    for (const [codigo, lista] of candidatos) {
      lista.sort((x, y) => y.similaridade - x.similaridade)
      saida.set(codigo, lista.slice(0, top))
    }
  }
  return saida
}
