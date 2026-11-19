import { FilePlus2, Moon, SlidersHorizontal, Sun } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import prateleiraVazia from './assets/ilustracoes/prateleira-vazia.svg'
import Inicio from './components/Inicio'
import PainelParametros from './components/PainelParametros'
import Progresso from './components/Progresso'
import RelatorioQualidade from './components/RelatorioQualidade'
import TelaMapeamento from './components/TelaMapeamento'
import { Botao, FaixaSeguranca } from './components/ui'
import { useTema } from './components/useTema'
import { useApp } from './estado/contexto'
import { ProvedorApp } from './estado/ProvedorApp'
import { ContextoTema, useTemaAtual } from './estado/tema'
import { URL_LINKEDIN, URL_REPOSITORIO } from './config'

// Abas de resultado (com ECharts) carregadas sob demanda: o pacote inicial fica leve.
const Resultados = lazy(() => import('./pages/Resultados'))

function Cabecalho({ aoAbrirParametros }: { aoAbrirParametros: () => void }) {
  const { fase, voltarInicio } = useApp()
  const { tema, alternar } = useTemaAtual()
  return (
    <header className="sticky top-0 z-30 bg-marinho text-white shadow-md print:static print:shadow-none">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        <button
          type="button"
          onClick={voltarInicio}
          className="flex items-center gap-2 rounded text-lg font-semibold tracking-tight"
          aria-label="Kit Estoque MRP: voltar ao início"
        >
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-7" />
          <span>
            Kit Estoque <span className="text-seguranca">MRP</span>
          </span>
        </button>
        <nav className="flex items-center gap-1 print:hidden" aria-label="Ações">
          {fase === 'resultado' && (
            <>
              <Botao
                variante="fantasma"
                onClick={aoAbrirParametros}
                className="text-white hover:bg-white/10 dark:text-white"
              >
                <SlidersHorizontal className="size-4" aria-hidden />
                <span className="hidden sm:inline">Parâmetros</span>
              </Botao>
              <Botao
                variante="fantasma"
                onClick={voltarInicio}
                className="text-white hover:bg-white/10 dark:text-white"
              >
                <FilePlus2 className="size-4" aria-hidden />
                <span className="hidden sm:inline">Nova planilha</span>
              </Botao>
            </>
          )}
          <button
            type="button"
            onClick={alternar}
            className="rounded-md p-2 hover:bg-white/10"
            aria-label={tema === 'escuro' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}
            title={tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}
          >
            {tema === 'escuro' ? (
              <Sun className="size-5" aria-hidden />
            ) : (
              <Moon className="size-5" aria-hidden />
            )}
          </button>
        </nav>
      </div>
      <FaixaSeguranca className="h-1" />
    </header>
  )
}

function Rodape() {
  return (
    <footer className="mt-12 border-t border-concreto bg-white/60 px-4 py-6 text-center text-sm text-slate-600 dark:border-aco dark:bg-marinho dark:text-concreto/80 print:hidden">
      <p className="font-medium text-marinho dark:text-concreto">
        🔒 Seus dados não saem do seu computador: o processamento é 100% no seu navegador e a
        planilha nunca é enviada a nenhum servidor.
      </p>
      <p className="mt-2">
        Desenvolvido por Gabriel Cunha ·{' '}
        <a
          href={URL_LINKEDIN}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-seguranca"
        >
          LinkedIn
        </a>{' '}
        ·{' '}
        <a
          href={URL_REPOSITORIO}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-seguranca"
        >
          Código no GitHub
        </a>{' '}
        · Licença MIT · Sem rastreadores e sem cookies
      </p>
    </footer>
  )
}

function Conteudo() {
  const app = useApp()
  const [parametrosAbertos, setParametrosAbertos] = useState(false)
  return (
    <div className="fundo-paletes flex min-h-svh flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-seguranca focus:px-3 focus:py-2 focus:text-marinho"
      >
        Pular para o conteúdo
      </a>
      <Cabecalho aoAbrirParametros={() => setParametrosAbertos(true)} />
      <main id="conteudo" className="flex-1">
        {app.erro && (
          <div
            role="alert"
            className="mx-auto mt-4 flex max-w-5xl items-start gap-3 rounded-lg border-l-4 border-critico bg-red-50 px-4 py-3 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100"
          >
            <span className="flex-1">{app.erro}</span>
            <button type="button" className="font-semibold underline" onClick={app.limparErro}>
              Fechar
            </button>
          </div>
        )}
        {app.fase === 'inicio' && <Inicio />}
        {app.fase === 'processando' && <Progresso />}
        {app.fase === 'mapeamento' && <TelaMapeamento />}
        {app.fase === 'resultado' && app.resultado && app.resultado.qualidade.bloqueante && (
          <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-4 flex items-center gap-4">
              <img src={prateleiraVazia} alt="" className="h-24 w-auto" />
              <div>
                <h1 className="text-xl font-bold text-marinho dark:text-white">
                  A planilha tem erros que impedem o cálculo
                </h1>
                <p className="text-sm text-slate-600 dark:text-concreto/80">
                  Corrija as linhas indicadas abaixo e envie de novo.
                </p>
              </div>
            </div>
            <RelatorioQualidade qualidade={app.resultado.qualidade} aberto />
            <Botao variante="primario" className="mt-4" onClick={app.voltarInicio}>
              Enviar outra planilha
            </Botao>
          </div>
        )}
        {app.fase === 'resultado' && app.resultado && !app.resultado.qualidade.bloqueante && (
          <Suspense fallback={<Progresso />}>
            <Resultados resultado={app.resultado} />
          </Suspense>
        )}
      </main>
      <Rodape />
      <PainelParametros aberto={parametrosAbertos} aoFechar={() => setParametrosAbertos(false)} />
    </div>
  )
}

export default function App() {
  const tema = useTema()
  return (
    <ContextoTema.Provider value={tema}>
      <ProvedorApp>
        <Conteudo />
      </ProvedorApp>
    </ContextoTema.Provider>
  )
}
