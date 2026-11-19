// Mensagens trocadas entre a interface e o worker de processamento.

import type { Parametros, Resultado } from '../engine/tipos'
import type { ArquivoEntrada, PendenciaMapeamento } from '../io/ler-planilha'
import type { MapaColunas, NomeAba } from '../io/mapeamento'

/** Mapeamento por índice de coluna (usado dentro de uma leitura). */
export type Mapas = Partial<Record<NomeAba, MapaColunas>>
/** Mapeamento por nome de cabeçalho (lembrado entre sessões). */
export type MapasNomes = Partial<Record<NomeAba, Record<string, string>>>

export type ParaWorker =
  | {
      tipo: 'ler'
      id: number
      arquivos: ArquivoEntrada[]
      mapasSalvos: MapasNomes
      parametros: Partial<Parametros>
    }
  | { tipo: 'mapear'; id: number; mapas: Mapas; parametros: Partial<Parametros> }
  | { tipo: 'recalcular'; id: number; parametros: Partial<Parametros> }

export type DoWorker =
  | { tipo: 'progresso'; id: number; etapa: string; fracao: number }
  | {
      tipo: 'mapeamento'
      id: number
      pendencias: PendenciaMapeamento[]
      todas: PendenciaMapeamento[]
    }
  | { tipo: 'resultado'; id: number; resultado: Resultado; mapasNomes: MapasNomes }
  | { tipo: 'erro'; id: number; mensagem: string }
