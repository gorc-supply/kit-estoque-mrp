import { useCallback, useEffect, useState } from 'react'

export type Tema = 'claro' | 'escuro'

const CHAVE = 'kit-estoque-mrp:tema'
const consultaEscuro = '(prefers-color-scheme: dark)'

function lerPreferencia(): Tema | null {
  try {
    const valor = localStorage.getItem(CHAVE)
    return valor === 'claro' || valor === 'escuro' ? valor : null
  } catch {
    return null
  }
}

function gravarPreferencia(tema: Tema): void {
  try {
    localStorage.setItem(CHAVE, tema)
  } catch {
    // Armazenamento bloqueado (aba anônima etc.): o tema vale só nesta sessão.
  }
}

function temaDoSistema(): Tema {
  return window.matchMedia(consultaEscuro).matches ? 'escuro' : 'claro'
}

/**
 * Tema claro/escuro: segue o sistema até o usuário escolher manualmente;
 * a escolha manual fica no localStorage.
 */
export function useTema() {
  const [preferencia, setPreferencia] = useState<Tema | null>(lerPreferencia)
  const [sistema, setSistema] = useState<Tema>(temaDoSistema)
  const tema = preferencia ?? sistema

  useEffect(() => {
    const mq = window.matchMedia(consultaEscuro)
    const aoMudar = () => setSistema(mq.matches ? 'escuro' : 'claro')
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro')
  }, [tema])

  const alternar = useCallback(() => {
    const novo: Tema = tema === 'escuro' ? 'claro' : 'escuro'
    gravarPreferencia(novo)
    setPreferencia(novo)
  }, [tema])

  return { tema, alternar }
}
