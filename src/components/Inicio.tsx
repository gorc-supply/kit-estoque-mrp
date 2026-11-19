import {
  BarChart3,
  Boxes,
  Calculator,
  FileDown,
  FileSpreadsheet,
  Factory,
  ShieldCheck,
  ShoppingCart,
  Upload,
} from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useApp } from '../estado/contexto'
import { baixarArquivo, carregarExcel, TIPO_XLSX } from '../lib/download'
import { Botao } from './ui'

const RECURSOS = [
  {
    icone: BarChart3,
    titulo: 'Curva ABC-XYZ',
    texto: 'Pareto por valor de consumo, variabilidade da demanda e padrão de Syntetos-Boylan.',
  },
  {
    icone: Calculator,
    titulo: 'Parâmetros de reposição',
    texto: 'Estoque de segurança, ponto de pedido, lote econômico, máximo, cobertura e giro.',
  },
  {
    icone: ShoppingCart,
    titulo: 'Sugestão de compras',
    texto: 'O que comprar, quanto, quando e quanto custa, com prioridade.',
  },
  {
    icone: Factory,
    titulo: 'MRP semanal',
    texto: 'Registro time-phased e explosão de BOM em vários níveis.',
  },
]

export default function Inicio() {
  const { carregarArquivos, carregarDemo } = useApp()
  const entrada = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)
  const [gerandoModelo, setGerandoModelo] = useState(false)

  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    const arquivos = Array.from(e.dataTransfer.files)
    if (arquivos.length) carregarArquivos(arquivos)
  }

  const baixarModelo = async () => {
    setGerandoModelo(true)
    try {
      const [Excel, { gerarModelo }] = await Promise.all([
        carregarExcel(),
        import('../io/gerar-modelo'),
      ])
      baixarArquivo(await gerarModelo(Excel), 'planilha-modelo-kit-estoque-mrp.xlsx', TIPO_XLSX)
    } finally {
      setGerandoModelo(false)
    }
  }

  return (
    <div>
      <section className="fundo-hero relative overflow-hidden text-white">
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
              <ShieldCheck className="size-4 text-seguranca" aria-hidden />
              Seus dados não saem do seu computador
            </p>
            <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-5xl">
              Kit Estoque <span className="text-seguranca">MRP</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-concreto sm:text-lg">
              Suba sua planilha de estoque e receba curva ABC-XYZ, parâmetros de reposição, sugestão
              de compras e MRP em segundos — de graça e sem seus dados saírem do computador.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Botao
                variante="primario"
                onClick={() => carregarDemo('industria')}
                className="px-5 py-2.5 text-base"
              >
                <Boxes className="size-5" aria-hidden /> Testar com dados de exemplo
              </Botao>
              <Botao
                onClick={baixarModelo}
                disabled={gerandoModelo}
                className="border-white/30 px-5 py-2.5 text-base text-white hover:bg-white/10 dark:text-white"
              >
                <FileDown className="size-5" aria-hidden />{' '}
                {gerandoModelo ? 'Gerando…' : 'Baixar planilha-modelo'}
              </Botao>
            </div>
            <p className="mt-3 text-sm text-concreto/80">
              Tem estrutura de produto?{' '}
              <button
                type="button"
                onClick={() => carregarDemo('montagem')}
                className="font-medium text-seguranca underline underline-offset-2 hover:brightness-110"
              >
                Veja o exemplo com BOM e MPS
              </button>
              .
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={soltar}
            className={`rounded-2xl border-2 border-dashed p-8 text-center backdrop-blur-sm transition-colors ${arrastando ? 'border-seguranca bg-seguranca/15' : 'border-white/35 bg-marinho/50'}`}
          >
            <FileSpreadsheet className="mx-auto size-12 text-seguranca" aria-hidden />
            <p className="mt-3 text-lg font-semibold">Enviar planilha</p>
            <p className="mt-1 text-sm text-concreto/85">
              Arraste o arquivo .xlsx aqui (ou um .csv para cada aba)
            </p>
            <Botao variante="primario" className="mt-5" onClick={() => entrada.current?.click()}>
              <Upload className="size-4" aria-hidden /> Escolher arquivo
            </Botao>
            <input
              ref={entrada}
              type="file"
              accept=".xlsx,.xlsm,.xls,.csv,.txt"
              multiple
              className="sr-only"
              aria-label="Escolher planilha"
              onChange={(e) => {
                const arquivos = Array.from(e.target.files ?? [])
                e.target.value = ''
                if (arquivos.length) carregarArquivos(arquivos)
              }}
            />
            <p className="mt-4 text-xs text-concreto/70">
              Abas necessárias: <b>Materiais</b> e <b>Movimentacoes</b>. Opcionais: PedidosAbertos,
              BOM e MPS.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="titulo-recursos">
        <h2 id="titulo-recursos" className="text-xl font-semibold text-marinho dark:text-white">
          O que você recebe
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
            <li
              key={titulo}
              className="rounded-xl border border-concreto bg-white/80 p-4 shadow-sm dark:border-aco dark:bg-aco/40"
            >
              <Icone className="size-6 text-aco-claro dark:text-seguranca" aria-hidden />
              <h3 className="mt-2 font-semibold text-marinho dark:text-white">{titulo}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-concreto/80">{texto}</p>
            </li>
          ))}
        </ul>
        <ol className="mt-10 grid gap-4 text-sm text-slate-700 sm:grid-cols-3 dark:text-concreto/90">
          {[
            [
              '1',
              'Baixe a planilha-modelo ou use a exportação do seu sistema (os nomes das colunas podem variar).',
            ],
            [
              '2',
              'Envie o arquivo: o cálculo roda no seu navegador, num processo separado que não trava a tela.',
            ],
            [
              '3',
              'Ajuste os parâmetros, confira cada número em "Ver o cálculo" e baixe a planilha MRP pronta.',
            ],
          ].map(([n, t]) => (
            <li key={n} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-seguranca font-bold text-marinho">
                {n}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
