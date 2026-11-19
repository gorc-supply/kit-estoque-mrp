import {
  BellRing,
  BookOpen,
  Factory,
  FileSpreadsheet,
  Grid3x3,
  LayoutDashboard,
  Printer,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import GavetaItem from '../components/GavetaItem'
import { Botao } from '../components/ui'
import type { Resultado } from '../engine/tipos'
import { useApp } from '../estado/contexto'
import { baixarArquivo, carregarExcel, TIPO_XLSX } from '../lib/download'
import type { Filtro } from '../lib/filtros'
import { data, num } from '../lib/formato'
import AbaABCXYZ from './AbaABCXYZ'
import Alertas from './Alertas'
import Compras from './Compras'
import MRP from './MRP'
import Reposicao from './Reposicao'
import type { IdAba } from './tipos'
import VisaoGeral from './VisaoGeral'

const Metodologia = lazy(() => import('./Metodologia'))

const ABAS: { id: IdAba; rotulo: string; icone: typeof LayoutDashboard }[] = [
  { id: 'visao', rotulo: 'Visão geral', icone: LayoutDashboard },
  { id: 'abc', rotulo: 'ABC-XYZ', icone: Grid3x3 },
  { id: 'reposicao', rotulo: 'Reposição', icone: SlidersHorizontal },
  { id: 'compras', rotulo: 'Compras', icone: ShoppingCart },
  { id: 'mrp', rotulo: 'MRP', icone: Factory },
  { id: 'alertas', rotulo: 'Alertas', icone: BellRing },
  { id: 'metodologia', rotulo: 'Metodologia', icone: BookOpen },
]

async function exportarPlanilha(r: Resultado, nomeArquivo: string, codigosCompras?: string[]) {
  const [Excel, mod, img] = await Promise.all([
    carregarExcel(),
    import('../io/exportar-excel'),
    import('../charts/imagens'),
  ])
  const imagens = img.imagensDashboard(r)
  const buf = await mod.exportarExcel(Excel, r, {
    nomeArquivoOriginal: nomeArquivo,
    urlFerramenta: `${window.location.origin}${import.meta.env.BASE_URL}`,
    imagens,
    codigosCompras,
  })
  baixarArquivo(buf, mod.nomeArquivoSaida(nomeArquivo, new Date()), TIPO_XLSX)
}

export default function Resultados({ resultado: r }: { resultado: Resultado }) {
  const { nomeArquivo, recalculando } = useApp()
  const [aba, setAba] = useState<IdAba>(() => {
    const pedida = new URLSearchParams(window.location.search).get('aba')
    return ABAS.some((a) => a.id === pedida) ? (pedida as IdAba) : 'visao'
  })
  const [filtro, setFiltro] = useState<Filtro>({})
  const [codigoItem, setCodigoItem] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const [erroExport, setErroExport] = useState<string | null>(null)
  const ancoraPendente = useRef<string | null>(null)
  const porCodigo = useMemo(() => new Map(r.itens.map((i) => [i.codigo, i])), [r.itens])
  const item = codigoItem ? (porCodigo.get(codigoItem) ?? null) : null

  const irPara = useCallback((destino: IdAba, f?: Filtro) => {
    setAba(destino)
    if (f) setFiltro(f)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const abrirItem = useCallback((codigo: string) => setCodigoItem(codigo), [])
  const fecharItem = useCallback(() => setCodigoItem(null), [])

  // Links "metodologia" dentro do "Ver o cálculo": troca de aba e rola até a seção.
  useEffect(() => {
    const clique = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest(
        'a[data-ir-metodologia]',
      ) as HTMLAnchorElement | null
      if (!a) return
      e.preventDefault()
      ancoraPendente.current = `metodologia-${a.dataset.irMetodologia}`
      setCodigoItem(null)
      setAba('metodologia')
    }
    document.addEventListener('click', clique)
    return () => document.removeEventListener('click', clique)
  }, [])
  useEffect(() => {
    if (aba !== 'metodologia' || !ancoraPendente.current) return
    const id = ancoraPendente.current
    let tentativas = 0
    const t = window.setInterval(() => {
      const el = document.getElementById(id)
      if (el || ++tentativas > 40) {
        window.clearInterval(t)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        ancoraPendente.current = null
      }
    }, 50)
    return () => window.clearInterval(t)
  }, [aba])

  const exportar = async (codigos?: string[]) => {
    setExportando(true)
    setErroExport(null)
    try {
      await exportarPlanilha(r, nomeArquivo, codigos)
    } catch (e) {
      setErroExport(
        `Não foi possível gerar a planilha: ${e instanceof Error ? e.message : String(e)}`,
      )
    } finally {
      setExportando(false)
    }
  }

  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ABAS.findIndex((a) => a.id === aba)
    let j = -1
    if (e.key === 'ArrowRight') j = (i + 1) % ABAS.length
    else if (e.key === 'ArrowLeft') j = (i - 1 + ABAS.length) % ABAS.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = ABAS.length - 1
    if (j < 0) return
    e.preventDefault()
    setAba(ABAS[j].id)
    document.getElementById(`aba-${ABAS[j].id}`)?.focus()
  }

  const props = { resultado: r, abrirItem, irPara }
  const alertasAltos = r.alertas.filter((a) => a.gravidade === 'alta').length

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-marinho dark:text-white">{nomeArquivo}</h1>
          <p className="text-sm text-slate-600 dark:text-concreto/80">
            {num(r.itens.length)} itens · data-base {data(r.dataBase)} · janela{' '}
            {r.janela.rotulos[0]} a {r.janela.rotulos.at(-1)} ({r.janela.periodicidade}) · calculado
            em {num(r.tempoMs)} ms
            {recalculando && <span className="ml-2 font-medium text-seguranca">recalculando…</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Botao variante="primario" onClick={() => exportar()} disabled={exportando}>
            <FileSpreadsheet className="size-4" aria-hidden />{' '}
            {exportando ? 'Gerando planilha…' : 'Baixar planilha MRP (.xlsx)'}
          </Botao>
          <Botao onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Imprimir / PDF
          </Botao>
        </div>
      </div>
      {erroExport && (
        <p
          role="alert"
          className="mb-3 rounded-md bg-red-50 p-2 text-sm text-critico dark:bg-red-950/40"
        >
          {erroExport}
        </p>
      )}

      <div
        role="tablist"
        aria-label="Resultados"
        onKeyDown={teclado}
        className="sticky top-14 z-20 -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-concreto bg-slate-50/95 px-4 backdrop-blur print:hidden dark:border-aco dark:bg-marinho/95"
      >
        {ABAS.map(({ id, rotulo, icone: Icone }) => (
          <button
            key={id}
            id={`aba-${id}`}
            role="tab"
            type="button"
            aria-selected={aba === id}
            aria-controls={`painel-${id}`}
            tabIndex={aba === id ? 0 : -1}
            onClick={() => setAba(id)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${aba === id ? 'border-seguranca text-marinho dark:text-white' : 'border-transparent text-slate-500 hover:text-marinho dark:text-concreto/70 dark:hover:text-white'}`}
          >
            <Icone className="size-4" aria-hidden />
            {rotulo}
            {id === 'alertas' && alertasAltos > 0 && (
              <span className="rounded-full bg-critico px-1.5 text-xs text-white">
                {alertasAltos}
              </span>
            )}
            {id === 'compras' && r.kpis.itensComprar > 0 && (
              <span className="rounded-full bg-seguranca px-1.5 text-xs text-marinho">
                {r.kpis.itensComprar}
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`painel-${aba}`}
        aria-labelledby={`aba-${aba}`}
        key={aba}
        className="animate-[aparecer_.25s_ease-out] motion-reduce:animate-none"
      >
        {aba === 'visao' && <VisaoGeral {...props} />}
        {aba === 'abc' && <AbaABCXYZ {...props} />}
        {aba === 'reposicao' && <Reposicao {...props} filtro={filtro} aoMudarFiltro={setFiltro} />}
        {aba === 'compras' && (
          <Compras {...props} aoExportarSelecao={(c) => exportar(c)} exportando={exportando} />
        )}
        {aba === 'mrp' && <MRP {...props} />}
        {aba === 'alertas' && <Alertas {...props} />}
        {aba === 'metodologia' && (
          <Suspense fallback={<p className="p-6 text-sm">Carregando a metodologia…</p>}>
            <Metodologia />
          </Suspense>
        )}
      </div>

      <GavetaItem item={item} resultado={r} aoFechar={fecharItem} aoAbrirItem={abrirItem} />
    </div>
  )
}
