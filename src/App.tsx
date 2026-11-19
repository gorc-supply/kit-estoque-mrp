import { useTema } from './components/useTema'

// Página provisória da Fase 0: só confirma que o tema, a fonte e o modo escuro
// estão aplicados. O hero e as abas de verdade chegam na Fase 3.

const amostras = [
  { nome: 'Marinho', classe: 'bg-marinho', texto: 'text-white' },
  { nome: 'Aço', classe: 'bg-aco', texto: 'text-white' },
  { nome: 'Aço claro', classe: 'bg-aco-claro', texto: 'text-white' },
  { nome: 'Segurança', classe: 'bg-seguranca', texto: 'text-marinho' },
  { nome: 'Concreto', classe: 'bg-concreto', texto: 'text-marinho' },
  { nome: 'OK', classe: 'bg-ok', texto: 'text-white' },
  { nome: 'Crítico', classe: 'bg-critico', texto: 'text-white' },
  { nome: 'Excesso', classe: 'bg-excesso', texto: 'text-white' },
  { nome: 'Sem giro', classe: 'bg-sem-giro', texto: 'text-white' },
  { nome: 'Classe A', classe: 'bg-classe-a', texto: 'text-white' },
  { nome: 'Classe B', classe: 'bg-classe-b', texto: 'text-marinho' },
  { nome: 'Classe C', classe: 'bg-classe-c', texto: 'text-marinho' },
  { nome: 'X', classe: 'bg-classe-x', texto: 'text-white' },
  { nome: 'Y', classe: 'bg-classe-y', texto: 'text-marinho' },
  { nome: 'Z', classe: 'bg-classe-z', texto: 'text-marinho' },
]

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const data = new Intl.DateTimeFormat('pt-BR')

export default function App() {
  const { tema, alternar } = useTema()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 bg-marinho text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-lg font-semibold tracking-tight">
            Kit Estoque <span className="text-seguranca">MRP</span>
          </span>
          <button
            type="button"
            onClick={alternar}
            className="rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
            aria-label={tema === 'escuro' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}
          >
            {tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Kit Estoque MRP</h1>
        <p className="mt-3 max-w-2xl text-lg text-concreto-escuro dark:text-concreto/80">
          Curva ABC-XYZ, parâmetros de reposição, sugestão de compras e MRP a partir da sua
          planilha.
        </p>
        <p className="mt-4 inline-block rounded-full bg-ok/10 px-3 py-1 text-sm font-medium text-ok dark:bg-ok/20 dark:text-green-300">
          Seus dados não saem do seu computador
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-md bg-seguranca px-4 py-2 font-semibold text-marinho hover:brightness-110"
          >
            Botão principal
          </button>
          <button
            type="button"
            className="rounded-md border border-aco-claro px-4 py-2 font-medium text-aco hover:bg-aco-claro/10 dark:text-concreto"
          >
            Botão secundário
          </button>
        </div>

        <section className="mt-10" aria-labelledby="titulo-paleta">
          <h2 id="titulo-paleta" className="text-xl font-semibold">
            Paleta do tema
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {amostras.map((a) => (
              <li
                key={a.nome}
                className={`${a.classe} ${a.texto} rounded-lg px-3 py-4 text-sm font-medium shadow-sm`}
              >
                {a.nome}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="mt-10 rounded-lg border border-concreto bg-white/80 p-4 backdrop-blur dark:border-aco dark:bg-aco/40"
          aria-labelledby="titulo-formatos"
        >
          <h2 id="titulo-formatos" className="text-xl font-semibold">
            Formatação pt-BR
          </h2>
          <p className="mt-2 tabular-nums">
            {moeda.format(1234.56)} · {data.format(new Date(2026, 10, 19))} ·{' '}
            {(0.987).toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 1 })}
          </p>
        </section>
      </main>

      <footer className="border-t border-concreto px-4 py-6 text-center text-sm text-concreto-escuro dark:border-aco dark:text-concreto/70">
        Desenvolvido por Gabriel Cunha ·{' '}
        <a
          href="https://www.linkedin.com/in/gabriel-cunha-xp"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-seguranca"
        >
          LinkedIn
        </a>{' '}
        · Processamento 100% no seu navegador: a planilha nunca é enviada a nenhum servidor.
      </footer>
    </div>
  )
}
