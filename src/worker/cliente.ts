// Cliente do worker: transforma as mensagens em promessas e ignora respostas antigas
// (quando o usuário muda parâmetros rápido, só o último cálculo vale).

import type { Parametros, Resultado } from '../engine/tipos'
import type { ArquivoEntrada, PendenciaMapeamento } from '../io/ler-planilha'
import type { DoWorker, Mapas, MapasNomes, ParaWorker } from './protocolo'

export type RespostaProcessamento =
  | { tipo: 'resultado'; resultado: Resultado; mapasNomes: MapasNomes }
  | { tipo: 'mapeamento'; pendencias: PendenciaMapeamento[]; todas: PendenciaMapeamento[] }

type SemId<T> = T extends unknown ? Omit<T, 'id'> : never

export type AoProgresso = (etapa: string, fracao: number) => void

export class ClienteProcessador {
  private worker: Worker
  private proximoId = 1
  private pendente: {
    id: number
    resolver: (r: RespostaProcessamento) => void
    rejeitar: (e: Error) => void
    progresso: AoProgresso
  } | null = null

  constructor() {
    this.worker = new Worker(new URL('./processador.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.worker.onmessage = (ev: MessageEvent<DoWorker>) => this.receber(ev.data)
    this.worker.onerror = (ev) => {
      this.pendente?.rejeitar(new Error(ev.message || 'Erro inesperado no processamento.'))
      this.pendente = null
    }
  }

  private receber(m: DoWorker) {
    const p = this.pendente
    if (!p || m.id !== p.id) return // resposta de um pedido já substituído
    if (m.tipo === 'progresso') {
      p.progresso(m.etapa, m.fracao)
      return
    }
    this.pendente = null
    if (m.tipo === 'erro') p.rejeitar(new Error(m.mensagem))
    else if (m.tipo === 'mapeamento')
      p.resolver({ tipo: 'mapeamento', pendencias: m.pendencias, todas: m.todas })
    else p.resolver({ tipo: 'resultado', resultado: m.resultado, mapasNomes: m.mapasNomes })
  }

  private enviar(msg: SemId<ParaWorker>, progresso: AoProgresso, transferir: Transferable[] = []) {
    const id = this.proximoId++
    // Um novo pedido substitui o anterior (a resposta antiga será ignorada).
    this.pendente?.rejeitar(new CancelamentoError())
    return new Promise<RespostaProcessamento>((resolver, rejeitar) => {
      this.pendente = { id, resolver, rejeitar, progresso }
      this.worker.postMessage({ ...msg, id } as ParaWorker, transferir)
    })
  }

  ler(
    arquivos: ArquivoEntrada[],
    mapasSalvos: MapasNomes,
    parametros: Partial<Parametros>,
    progresso: AoProgresso,
  ) {
    return this.enviar(
      { tipo: 'ler', arquivos, mapasSalvos, parametros },
      progresso,
      arquivos.map((a) => a.dados),
    )
  }

  mapear(mapas: Mapas, parametros: Partial<Parametros>, progresso: AoProgresso) {
    return this.enviar({ tipo: 'mapear', mapas, parametros }, progresso)
  }

  recalcular(parametros: Partial<Parametros>, progresso: AoProgresso) {
    return this.enviar({ tipo: 'recalcular', parametros }, progresso)
  }

  encerrar() {
    this.worker.terminate()
  }
}

export class CancelamentoError extends Error {
  constructor() {
    super('cancelado')
  }
}
