// Filtros de itens usados pelas tabelas e pelos KPIs clicáveis.

import type { ClasseABC, ClasseXYZ, ItemResultado, StatusItem } from '../engine/tipos'

export type FiltroEspecial =
  'risco' | 'sugestao' | 'excesso' | 'ativos' | 'classeA' | 'revisao' | 'semCusto'

export interface Filtro {
  abc?: ClasseABC
  xyz?: ClasseXYZ
  status?: StatusItem
  categoria?: string
  fornecedor?: string
  busca?: string
  especial?: FiltroEspecial
}

export const ROTULO_ESPECIAL: Record<FiltroEspecial, string> = {
  risco: 'Risco de ruptura antes da chegada',
  sugestao: 'Com sugestão de compra',
  excesso: 'Valor em excesso',
  ativos: 'SKUs ativos',
  classeA: 'Itens classe A',
  revisao: 'Revisão manual',
  semCusto: 'Sem custo',
}

function especial(i: ItemResultado, e: FiltroEspecial): boolean {
  switch (e) {
    case 'risco':
      return i.riscoAntesChegada
    case 'sugestao':
      return i.sugestaoQtd > 0
    case 'excesso':
      return i.estoqueMaximo !== null && i.previsao > 0 && i.estoqueAtual > i.estoqueMaximo
    case 'ativos':
      return i.estoqueAtual > 0 || i.media > 0
    case 'classeA':
      return i.classeABC === 'A' && i.consumoAnualValor > 0
    case 'revisao':
      return i.revisaoManual.length > 0
    case 'semCusto':
      return i.origemCusto === 'sem_custo'
  }
}

export function aplicarFiltro(itens: readonly ItemResultado[], f: Filtro): ItemResultado[] {
  const busca = f.busca?.trim().toLowerCase()
  return itens.filter(
    (i) =>
      (!f.abc || i.classeABC === f.abc) &&
      (!f.xyz || i.classeXYZ === f.xyz) &&
      (!f.status || i.status === f.status) &&
      (!f.categoria || i.categoria === f.categoria) &&
      (!f.fornecedor || i.fornecedor === f.fornecedor) &&
      (!f.especial || especial(i, f.especial)) &&
      (!busca ||
        i.codigo.toLowerCase().includes(busca) ||
        i.descricao.toLowerCase().includes(busca)),
  )
}

export function filtroVazio(f: Filtro): boolean {
  return !f.abc && !f.xyz && !f.status && !f.categoria && !f.fornecedor && !f.busca && !f.especial
}
