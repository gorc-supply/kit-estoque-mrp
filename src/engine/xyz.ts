// Classificação XYZ e padrão de demanda de Syntetos-Boylan (seção 6.5).

import { coeficienteVariacao, desvioAmostral, media } from './estatistica'
import type { ClasseXYZ, PadraoDemanda } from './tipos'

export interface CortesXYZ {
  corteX: number
  corteY: number
  corteADI: number
  corteCV2: number
  minPeriodos: number
}

export interface SaidaXYZ {
  classe: ClasseXYZ
  media: number
  desvio: number
  cv: number | null
  adi: number | null
  cv2: number | null
  padrao: PadraoDemanda | null
  historicoInsuficiente: boolean
}

export function classificarXYZ(serie: readonly number[], c: CortesXYZ): SaidaXYZ {
  const n = serie.length
  const m = media(serie)
  const s = desvioAmostral(serie)

  if (n < c.minPeriodos) {
    return {
      classe: 'Novo',
      media: m,
      desvio: s,
      cv: m > 0 ? s / m : null,
      adi: null,
      cv2: null,
      padrao: null,
      historicoInsuficiente: true,
    }
  }
  if (m === 0) {
    return {
      classe: 'N',
      media: 0,
      desvio: 0,
      cv: null,
      adi: null,
      cv2: null,
      padrao: null,
      historicoInsuficiente: false,
    }
  }

  const cv = s / m
  const classe: ClasseXYZ = cv <= c.corteX ? 'X' : cv <= c.corteY ? 'Y' : 'Z'
  const { adi, cv2, padrao } = padraoSyntetosBoylan(serie, c.corteADI, c.corteCV2)
  return { classe, media: m, desvio: s, cv, adi, cv2, padrao, historicoInsuficiente: false }
}

/**
 * ADI = n ÷ (períodos com demanda > 0); CV² = (CV dos tamanhos não nulos)², desvio amostral.
 * Com um só período não nulo, CV² = 0.
 */
export function padraoSyntetosBoylan(
  serie: readonly number[],
  corteADI = 1.32,
  corteCV2 = 0.49,
): { adi: number; cv2: number; padrao: PadraoDemanda } {
  const naoNulos = serie.filter((d) => d > 0)
  const adi = naoNulos.length > 0 ? serie.length / naoNulos.length : Infinity
  const cvNaoNulos = naoNulos.length > 1 ? (coeficienteVariacao(naoNulos) ?? 0) : 0
  const cv2 = cvNaoNulos * cvNaoNulos
  let padrao: PadraoDemanda
  if (adi < corteADI) padrao = cv2 < corteCV2 ? 'Suave' : 'Errático'
  else padrao = cv2 < corteCV2 ? 'Intermitente' : 'Irregular'
  return { adi, cv2, padrao }
}
