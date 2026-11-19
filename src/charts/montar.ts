// Combina as opções base (tema, tooltip, toolbox, acessibilidade) com as de cada gráfico.

import { echarts, type OpcaoGrafico } from './echarts'
import { baseGrafico, coresGrafico, type CoresGrafico } from './tema'

export function montarOpcao(
  c: CoresGrafico,
  descricao: string,
  especifica: OpcaoGrafico,
  animar = true,
): OpcaoGrafico {
  const base = baseGrafico(c, descricao)
  return {
    ...base,
    ...especifica,
    animation: animar && (especifica.animation ?? true),
    tooltip: { ...(base.tooltip as object), ...((especifica.tooltip as object) ?? {}) },
    legend:
      especifica.legend === false
        ? undefined
        : { ...(base.legend as object), ...((especifica.legend as object) ?? {}) },
    toolbox: { ...(base.toolbox as object), ...((especifica.toolbox as object) ?? {}) },
  }
}

/** Renderiza um gráfico fora da tela e devolve o PNG (data URL), para a planilha de saída. */
export function renderizarPNG(
  titulo: string,
  opcao: (c: CoresGrafico) => OpcaoGrafico,
  largura = 900,
  altura = 420,
): string {
  const c = coresGrafico(false)
  const div = document.createElement('div')
  const g = echarts.init(div, undefined, { renderer: 'canvas', width: largura, height: altura })
  try {
    g.setOption({ ...montarOpcao(c, titulo, opcao(c), false), toolbox: { show: false } })
    return g.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#FFFFFF' })
  } finally {
    g.dispose()
  }
}
