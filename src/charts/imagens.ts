// Imagens PNG dos gráficos principais para a aba Dashboard da planilha de saída.

import type { Resultado } from '../engine/tipos'
import { opcaoEntradasSaidas } from './entradas-saidas'
import { opcaoLiberacoes } from './liberacoes'
import { opcaoMatriz } from './matriz-abc-xyz'
import { renderizarPNG } from './montar'
import { opcaoPareto } from './pareto'
import { opcaoStatus } from './status-estoque'

export function imagensDashboard(r: Resultado): { titulo: string; dataUrl: string }[] {
  const lista: { titulo: string; dataUrl: string }[] = []
  const add = (titulo: string, f: Parameters<typeof renderizarPNG>[1]) => {
    try {
      lista.push({ titulo, dataUrl: renderizarPNG(titulo, f) })
    } catch {
      // um gráfico com problema não impede a exportação
    }
  }
  add('Curva ABC (Pareto)', (c) =>
    opcaoPareto(r.itens, r.parametros.corteA, r.parametros.corteB, c),
  )
  add('Matriz ABC × XYZ (itens)', (c) => opcaoMatriz(r.matriz, 'itens', c))
  add('Status do estoque', (c) => opcaoStatus(r.itens, 'itens', c))
  add('Entradas vs saídas (R$)', (c) => opcaoEntradasSaidas(r.consolidado, c))
  const mrp = r.mrp
  if (mrp) add('Liberações planejadas por semana (R$)', (c) => opcaoLiberacoes(mrp, c))
  return lista
}
