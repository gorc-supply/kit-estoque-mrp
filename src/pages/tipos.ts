import type { Resultado } from '../engine/tipos'
import type { Filtro } from '../lib/filtros'

export type IdAba = 'visao' | 'abc' | 'reposicao' | 'compras' | 'mrp' | 'alertas' | 'metodologia'

export interface PropsAba {
  resultado: Resultado
  abrirItem: (codigo: string) => void
  irPara: (aba: IdAba, filtro?: Filtro) => void
}
