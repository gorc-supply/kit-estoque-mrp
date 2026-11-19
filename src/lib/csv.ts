// Exportação CSV no padrão brasileiro (separador ";", vírgula decimal, BOM para o Excel).

import { baixarArquivo } from './download'

function celula(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return v === Infinity ? '∞' : ''
    return String(Math.round(v * 1e6) / 1e6).replace('.', ',')
  }
  const s = String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function gerarCSV(cabecalho: string[], linhas: (string | number | null)[][]): string {
  return [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')
}

export function baixarCSV(
  nome: string,
  cabecalho: string[],
  linhas: (string | number | null)[][],
): void {
  const bom = String.fromCharCode(0xfeff)
  const blob = new Blob([bom + gerarCSV(cabecalho, linhas)], { type: 'text/csv;charset=utf-8' })
  baixarArquivo(blob, nome.endsWith('.csv') ? nome : `${nome}.csv`)
}
