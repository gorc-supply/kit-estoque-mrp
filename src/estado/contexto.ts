import { createContext, useContext } from 'react'
import type { Parametros, Resultado } from '../engine/tipos'
import type { PendenciaMapeamento } from '../io/ler-planilha'
import type { Mapas } from '../worker/protocolo'

export type Fase = 'inicio' | 'processando' | 'mapeamento' | 'resultado'

export interface EstadoApp {
  fase: Fase
  progresso: { etapa: string; fracao: number }
  erro: string | null
  resultado: Resultado | null
  nomeArquivo: string
  pendencias: PendenciaMapeamento[]
  todasAbas: PendenciaMapeamento[]
  /** Parâmetros alterados pelo usuário (o restante vem dos padrões). */
  parametros: Partial<Parametros>
  recalculando: boolean
}

export interface AcoesApp {
  carregarArquivos: (arquivos: File[]) => void
  carregarDemo: (qual: 'industria' | 'montagem') => void
  confirmarMapeamento: (mapas: Mapas) => void
  alterarParametros: (patch: Partial<Parametros>) => void
  restaurarPadroes: () => void
  voltarInicio: () => void
  limparErro: () => void
}

export const ContextoApp = createContext<(EstadoApp & AcoesApp) | null>(null)

export function useApp() {
  const c = useContext(ContextoApp)
  if (!c) throw new Error('useApp fora do ProvedorApp')
  return c
}
