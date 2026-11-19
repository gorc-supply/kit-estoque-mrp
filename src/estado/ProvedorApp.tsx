import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Parametros } from '../engine/tipos'
import { gravar, ler } from '../lib/armazenamento'
import {
  CancelamentoError,
  ClienteProcessador,
  type RespostaProcessamento,
} from '../worker/cliente'
import type { Mapas, MapasNomes } from '../worker/protocolo'
import { ContextoApp, type EstadoApp } from './contexto'

const CHAVE_PARAMETROS = 'parametros'
const CHAVE_MAPEAMENTO = 'mapeamento'

/** Parâmetros que não fazem sentido lembrar entre planilhas. */
function persistiveis(p: Partial<Parametros>): Partial<Parametros> {
  const { dataBase: _dataBase, ...resto } = p
  void _dataBase
  return resto
}

export function ProvedorApp({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoApp>(() => ({
    fase: 'inicio',
    progresso: { etapa: '', fracao: 0 },
    erro: null,
    resultado: null,
    nomeArquivo: '',
    pendencias: [],
    todasAbas: [],
    parametros: ler<Partial<Parametros>>(CHAVE_PARAMETROS, {}),
    recalculando: false,
  }))
  const cliente = useRef<ClienteProcessador | null>(null)
  const parametrosRef = useRef(estado.parametros)
  const temporizador = useRef<number | undefined>(undefined)
  const temResultado = useRef(false)

  useEffect(() => {
    cliente.current = new ClienteProcessador()
    return () => cliente.current?.encerrar()
  }, [])

  // Link direto para o exemplo: ?demo=industria ou ?demo=montagem
  const demoInicial = useRef(new URLSearchParams(window.location.search).get('demo'))

  const progresso = useCallback((etapa: string, fracao: number) => {
    setEstado((e) => ({ ...e, progresso: { etapa, fracao } }))
  }, [])

  const tratar = useCallback((p: Promise<RespostaProcessamento>, recalculo = false) => {
    p.then((r) => {
      if (r.tipo === 'mapeamento') {
        setEstado((e) => ({
          ...e,
          fase: 'mapeamento',
          pendencias: r.pendencias,
          todasAbas: r.todas,
        }))
        return
      }
      const lembrado = ler<MapasNomes>(CHAVE_MAPEAMENTO, {})
      gravar(CHAVE_MAPEAMENTO, { ...lembrado, ...r.mapasNomes })
      temResultado.current = true
      setEstado((e) => ({
        ...e,
        fase: 'resultado',
        resultado: r.resultado,
        recalculando: false,
        erro: null,
      }))
    }).catch((err: unknown) => {
      if (err instanceof CancelamentoError) return
      const mensagem = err instanceof Error ? err.message : String(err)
      setEstado((e) => ({
        ...e,
        fase: recalculo && e.resultado ? 'resultado' : 'inicio',
        recalculando: false,
        erro: mensagem,
      }))
    })
  }, [])

  const carregarArquivos = useCallback(
    (arquivos: File[]) => {
      if (!arquivos.length || !cliente.current) return
      const nome = arquivos.length === 1 ? arquivos[0].name : `${arquivos.length} arquivos`
      setEstado((e) => ({
        ...e,
        fase: 'processando',
        erro: null,
        nomeArquivo: nome,
        progresso: { etapa: 'Abrindo o arquivo', fracao: 0.02 },
      }))
      const p = Promise.all(
        arquivos.map(async (f) => ({ nome: f.name, dados: await f.arrayBuffer() })),
      ).then((lidos) => {
        const params = { ...parametrosRef.current, dataBase: null }
        parametrosRef.current = params
        setEstado((e) => ({ ...e, parametros: params }))
        return cliente.current!.ler(lidos, ler<MapasNomes>(CHAVE_MAPEAMENTO, {}), params, progresso)
      })
      tratar(p)
    },
    [progresso, tratar],
  )

  const carregarDemo = useCallback(
    (qual: 'industria' | 'montagem') => {
      const nome = qual === 'industria' ? 'demo-industria.xlsx' : 'demo-montagem.xlsx'
      setEstado((e) => ({
        ...e,
        fase: 'processando',
        erro: null,
        nomeArquivo: nome,
        progresso: { etapa: 'Baixando os dados de exemplo', fracao: 0.02 },
      }))
      const p = fetch(`${import.meta.env.BASE_URL}exemplos/${nome}`)
        .then((r) => {
          if (!r.ok) throw new Error('Não foi possível carregar os dados de exemplo.')
          return r.arrayBuffer()
        })
        .then((dados) => {
          const params = { ...parametrosRef.current, dataBase: null }
          parametrosRef.current = params
          setEstado((e) => ({ ...e, parametros: params }))
          return cliente.current!.ler([{ nome, dados }], {}, params, progresso)
        })
      tratar(p)
    },
    [progresso, tratar],
  )

  useEffect(() => {
    const d = demoInicial.current
    if (d !== 'industria' && d !== 'montagem') return
    // O ref só é zerado dentro do timer: no StrictMode o efeito roda duas vezes.
    const t = window.setTimeout(() => {
      demoInicial.current = null
      carregarDemo(d)
    }, 0)
    return () => window.clearTimeout(t)
  }, [carregarDemo])

  const confirmarMapeamento = useCallback(
    (mapas: Mapas) => {
      if (!cliente.current) return
      setEstado((e) => ({
        ...e,
        fase: 'processando',
        progresso: { etapa: 'Aplicando o mapeamento', fracao: 0.2 },
      }))
      tratar(cliente.current.mapear(mapas, parametrosRef.current, progresso))
    },
    [progresso, tratar],
  )

  const agendarRecalculo = useCallback(() => {
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => {
      if (!cliente.current) return
      setEstado((e) => (e.resultado ? { ...e, recalculando: true } : e))
      tratar(
        cliente.current.recalcular(parametrosRef.current, () => {}),
        true,
      )
    }, 400)
  }, [tratar])

  const alterarParametros = useCallback(
    (patch: Partial<Parametros>) => {
      const novo = { ...parametrosRef.current, ...patch }
      parametrosRef.current = novo
      gravar(CHAVE_PARAMETROS, persistiveis(novo))
      setEstado((e) => ({ ...e, parametros: novo }))
      if (temResultado.current) agendarRecalculo()
    },
    [agendarRecalculo],
  )

  const restaurarPadroes = useCallback(() => {
    parametrosRef.current = {}
    gravar(CHAVE_PARAMETROS, {})
    setEstado((e) => ({ ...e, parametros: {} }))
    if (temResultado.current) agendarRecalculo()
  }, [agendarRecalculo])

  const voltarInicio = useCallback(() => {
    temResultado.current = false
    setEstado((e) => ({
      ...e,
      fase: 'inicio',
      resultado: null,
      erro: null,
      pendencias: [],
      todasAbas: [],
    }))
  }, [])

  const limparErro = useCallback(() => setEstado((e) => ({ ...e, erro: null })), [])

  const valor = useMemo(
    () => ({
      ...estado,
      carregarArquivos,
      carregarDemo,
      confirmarMapeamento,
      alterarParametros,
      restaurarPadroes,
      voltarInicio,
      limparErro,
    }),
    [
      estado,
      carregarArquivos,
      carregarDemo,
      confirmarMapeamento,
      alterarParametros,
      restaurarPadroes,
      voltarInicio,
      limparErro,
    ],
  )

  return <ContextoApp.Provider value={valor}>{children}</ContextoApp.Provider>
}
