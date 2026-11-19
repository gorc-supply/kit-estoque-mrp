// Download de arquivos gerados no navegador (nada sai do computador).

export function baixarArquivo(conteudo: Blob | ArrayBuffer, nome: string, tipo?: string): void {
  const blob =
    conteudo instanceof Blob
      ? conteudo
      : new Blob([conteudo], { type: tipo ?? 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Carrega o ExcelJS sob demanda (fora do pacote inicial). */
export async function carregarExcel() {
  const m = await import('exceljs')
  return (m.default ?? m) as typeof import('exceljs')
}
