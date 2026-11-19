/// <reference lib="webworker" />
// Worker de processamento: lê a planilha e roda o motor sem travar a interface.
// A planilha fica só na memória deste worker; nada é enviado para fora do navegador.

import { processar } from '../engine/index'
import type { Entrada } from '../engine/tipos'
import {
  converter,
  ErroLeitura,
  lerArquivos,
  mapearTabelas,
  type Tabelas,
} from '../io/ler-planilha'
import type { MapaColunas, NomeAba } from '../io/mapeamento'
import type { DoWorker, Mapas, MapasNomes, ParaWorker } from './protocolo'

declare const self: DedicatedWorkerGlobalScope

let tabelas: Tabelas | null = null
let entrada: Entrada | null = null
let mapasAtuais: Mapas = {}

const enviar = (m: DoWorker) => self.postMessage(m)

/** Nomes de cabeçalho → índices da tabela atual. */
function nomesParaIndices(t: Tabelas, salvos: MapasNomes): Mapas {
  const saida: Mapas = {}
  for (const [aba, campos] of Object.entries(salvos) as [NomeAba, Record<string, string>][]) {
    const tab = t[aba]
    if (!tab || !campos) continue
    const mapa: MapaColunas = {}
    for (const [campo, nome] of Object.entries(campos)) {
      const i = tab.cabecalhos.indexOf(nome)
      if (i >= 0) mapa[campo] = i
    }
    saida[aba] = mapa
  }
  return saida
}

function indicesParaNomes(t: Tabelas, mapas: Mapas): MapasNomes {
  const saida: MapasNomes = {}
  for (const [aba, mapa] of Object.entries(mapas) as [NomeAba, MapaColunas][]) {
    const tab = t[aba]
    if (!tab || !mapa) continue
    const nomes: Record<string, string> = {}
    for (const [campo, i] of Object.entries(mapa)) {
      if (i !== null && i !== undefined && tab.cabecalhos[i]) nomes[campo] = tab.cabecalhos[i]
    }
    saida[aba] = nomes
  }
  return saida
}

function calcular(id: number, parametros: ParaWorker['parametros']) {
  if (!entrada || !tabelas) throw new ErroLeitura('Nenhuma planilha carregada.')
  const resultado = processar(entrada, parametros, (etapa, fracao) =>
    enviar({ tipo: 'progresso', id, etapa, fracao: 0.3 + fracao * 0.7 }),
  )
  enviar({ tipo: 'resultado', id, resultado, mapasNomes: indicesParaNomes(tabelas, mapasAtuais) })
}

self.onmessage = (ev: MessageEvent<ParaWorker>) => {
  const msg = ev.data
  try {
    if (msg.tipo === 'ler') {
      enviar({ tipo: 'progresso', id: msg.id, etapa: 'Lendo a planilha', fracao: 0.05 })
      tabelas = lerArquivos(msg.arquivos)
      entrada = null
      const { mapas, pendencias, todas } = mapearTabelas(
        tabelas,
        nomesParaIndices(tabelas, msg.mapasSalvos),
      )
      mapasAtuais = mapas
      if (pendencias.length) {
        enviar({ tipo: 'mapeamento', id: msg.id, pendencias, todas })
        return
      }
      enviar({ tipo: 'progresso', id: msg.id, etapa: 'Convertendo os dados', fracao: 0.25 })
      entrada = converter(tabelas, mapas)
      calcular(msg.id, msg.parametros)
    } else if (msg.tipo === 'mapear') {
      if (!tabelas) throw new ErroLeitura('Envie a planilha novamente.')
      mapasAtuais = { ...mapasAtuais, ...msg.mapas }
      enviar({ tipo: 'progresso', id: msg.id, etapa: 'Convertendo os dados', fracao: 0.25 })
      entrada = converter(tabelas, mapasAtuais)
      calcular(msg.id, msg.parametros)
    } else if (msg.tipo === 'recalcular') {
      calcular(msg.id, msg.parametros)
    }
  } catch (e) {
    const mensagem =
      e instanceof ErroLeitura
        ? e.message
        : `Não foi possível processar a planilha. Detalhe técnico: ${e instanceof Error ? e.message : String(e)}`
    enviar({ tipo: 'erro', id: msg.id, mensagem })
  }
}
