// Aba Metodologia: explica cada fórmula do motor (src/engine) com notação, significado e
// exemplo numérico. Os números do exemplo vêm dos testes calculados à mão (CLAUDE.md, seção 13).

import type { ReactNode } from 'react'
import { ArrowUp, BookOpen, Calculator, Info } from 'lucide-react'

const SECOES = [
  { slug: 'visao-geral', titulo: 'Visão geral' },
  { slug: 'dados', titulo: 'Dados de entrada' },
  { slug: 'series', titulo: 'Séries de demanda' },
  { slug: 'custo', titulo: 'Custo unitário' },
  { slug: 'abc', titulo: 'Curva ABC' },
  { slug: 'xyz', titulo: 'XYZ e padrão de demanda' },
  { slug: 'previsao', titulo: 'Previsão e backtest' },
  { slug: 'parametros', titulo: 'Parâmetros de reposição' },
  { slug: 'reposicao', titulo: 'Status e sugestão de compra' },
  { slug: 'giro', titulo: 'Saldo histórico e giro' },
  { slug: 'mrp', titulo: 'MRP semanal' },
  { slug: 'matematica', titulo: 'A matemática por trás' },
  { slug: 'qualidade', titulo: 'Qualidade dos dados' },
  { slug: 'parametros-padrao', titulo: 'Parâmetros padrão' },
  { slug: 'glossario', titulo: 'Glossário' },
  { slug: 'referencias', titulo: 'Referências' },
] as const

type Slug = (typeof SECOES)[number]['slug']

const ID_SUMARIO = 'metodologia-sumario'

// ---------------------------------------------------------------------------
// Glossário (ordem alfabética)

const GLOSSARIO: readonly (readonly [string, string])[] = [
  [
    'ABC',
    'Classificação dos itens pelo valor de consumo anual: A concentra ~80% do valor, B os próximos ~15%, C o restante.',
  ],
  [
    'ADI',
    'Average Demand Interval: intervalo médio entre períodos com demanda (n ÷ períodos com demanda > 0). ADI = 1 é consumo todo período.',
  ],
  [
    'BOM',
    'Bill of Materials, estrutura de produto: lista de componentes (e quantidades) necessários para fazer um item.',
  ],
  ['Cobertura', 'Quantos dias o estoque atual dura no consumo previsto: estoque ÷ consumo diário.'],
  ['CV', 'Coeficiente de variação: desvio padrão ÷ média. Base da classe XYZ.'],
  [
    'CV²',
    'Quadrado do CV dos tamanhos de demanda não nulos; junto com o ADI, define o padrão de Syntetos-Boylan.',
  ],
  [
    'Código de nível mais baixo',
    'Low-level code: a maior profundidade em que um item aparece nas estruturas de produto. Define a ordem de cálculo do MRP.',
  ],
  [
    'Data-base',
    'A data de "hoje" da análise; por padrão, a data da última movimentação do arquivo.',
  ],
  [
    'EOQ',
    'Economic Order Quantity, lote econômico: a quantidade por pedido que minimiza o custo de pedir mais o de manter estoque.',
  ],
  [
    'ES',
    'Estoque de segurança: proteção contra demanda acima da média e atrasos durante o lead time.',
  ],
  [
    'Fill rate',
    'Nível de serviço tipo 2: percentual das peças pedidas que são atendidas direto do estoque.',
  ],
  ['Giro', 'Quantas vezes por ano o estoque se renova: consumo anual ÷ estoque médio.'],
  ['LT', 'Lead time: prazo entre emitir o pedido e o material estar disponível, em dias corridos.'],
  ['Máx', 'Estoque máximo: ES + Q*. É até onde a sugestão de compra repõe.'],
  [
    'MPS',
    'Master Production Schedule, plano mestre: quanto de cada produto final se planeja fazer ou vender em cada semana.',
  ],
  [
    'MRP',
    'Material Requirements Planning: cálculo semana a semana de necessidades, estoque projetado e liberações de pedidos.',
  ],
  [
    'Nível de serviço',
    'Tipo 1 (de ciclo): probabilidade de não faltar o item enquanto se espera uma reposição.',
  ],
  ['Posição de estoque', 'Estoque atual + pedidos em aberto. É comparada com o ponto de pedido.'],
  [
    'PP',
    'Ponto de pedido: quando a posição de estoque chega nele, é hora de comprar. PP = F × LTₚ + ES.',
  ],
  ['Q*', 'Lote de compra: o EOQ ajustado ao lote mínimo e ao múltiplo de embalagem.'],
  [
    'SBA',
    'Syntetos-Boylan Approximation: método de Croston com correção de viés, para demanda intermitente.',
  ],
  [
    'SES',
    'Suavização exponencial simples: média ponderada em que os períodos recentes pesam mais (peso α).',
  ],
  ['Viés', 'Erro sistemático da previsão: Σ(previsto − real) ÷ Σreal. Positivo = superestima.'],
  [
    'WMAPE',
    'Weighted Mean Absolute Percentage Error: erro absoluto total ÷ consumo total. Funciona com períodos de consumo zero.',
  ],
  [
    'XYZ',
    'Classificação pela variabilidade da demanda: X estável (CV ≤ 0,50), Y moderada, Z imprevisível (CV > 1,00).',
  ],
]

// ---------------------------------------------------------------------------
// Blocos de apresentação

function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="my-3 overflow-x-auto rounded-md bg-slate-100 px-4 py-3 font-mono text-sm leading-relaxed text-slate-800 dark:bg-marinho/70 dark:text-concreto">
      {children}
    </div>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p className="my-3 max-w-prose leading-relaxed">{children}</p>
}

function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 mb-2 text-lg font-semibold text-marinho dark:text-concreto">{children}</h3>
  )
}

function Lista({ children, ordenada = false }: { children: ReactNode; ordenada?: boolean }) {
  const classe = `my-3 max-w-prose space-y-1.5 pl-6 leading-relaxed ${ordenada ? 'list-decimal' : 'list-disc'}`
  return ordenada ? <ol className={classe}>{children}</ol> : <ul className={classe}>{children}</ul>
}

function Exemplo({
  titulo = 'Exemplo numérico',
  children,
}: {
  titulo?: string
  children: ReactNode
}) {
  return (
    <div className="my-4 rounded-r-md border-l-4 border-seguranca bg-amber-50 px-4 py-3 dark:bg-seguranca/10">
      <p className="flex items-center gap-2 font-semibold text-marinho dark:text-concreto">
        <Calculator aria-hidden="true" className="size-4 shrink-0" />
        {titulo}
      </p>
      <div className="max-w-prose">{children}</div>
    </div>
  )
}

function Nota({ titulo = 'Observação', children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="my-4 rounded-r-md border-l-4 border-aco-claro bg-sky-50 px-4 py-3 dark:bg-aco-claro/15">
      <p className="flex items-center gap-2 font-semibold text-marinho dark:text-concreto">
        <Info aria-hidden="true" className="size-4 shrink-0" />
        {titulo}
      </p>
      <div className="max-w-prose">{children}</div>
    </div>
  )
}

function Tabela({
  legenda,
  colunas,
  linhas,
}: {
  legenda: string
  colunas: readonly ReactNode[]
  linhas: readonly (readonly ReactNode[])[]
}) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-aco-claro/40">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-concreto/80">
          {legenda}
        </caption>
        <thead>
          <tr className="bg-slate-100 dark:bg-marinho/70">
            {colunas.map((c, i) => (
              <th
                key={i}
                scope="col"
                className="border-t border-slate-200 px-3 py-2 font-semibold text-marinho dark:border-aco-claro/40 dark:text-concreto"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} className="border-t border-slate-200 align-top dark:border-aco-claro/30">
              {linha.map((celula, j) =>
                j === 0 ? (
                  <th
                    key={j}
                    scope="row"
                    className="px-3 py-2 font-medium text-marinho dark:text-concreto"
                  >
                    {celula}
                  </th>
                ) : (
                  <td key={j} className="px-3 py-2">
                    {celula}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Secao({ slug, children }: { slug: Slug; children: ReactNode }) {
  const titulo = SECOES.find((s) => s.slug === slug)?.titulo ?? slug
  const id = `metodologia-${slug}`
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-aco-claro/40 dark:bg-aco/40"
    >
      <h2
        id={`${id}-titulo`}
        className="text-xl font-bold tracking-tight text-marinho sm:text-2xl dark:text-concreto"
      >
        {titulo}
      </h2>
      {children}
      <p className="mt-6 text-right text-sm">
        <a
          href={`#${ID_SUMARIO}`}
          className="inline-flex items-center gap-1 text-aco-claro underline-offset-2 hover:underline dark:text-seguranca"
        >
          <ArrowUp aria-hidden="true" className="size-3.5" />
          Voltar ao sumário
        </a>
      </p>
    </section>
  )
}

function Sumario() {
  return (
    <nav
      id={ID_SUMARIO}
      aria-label="Sumário da metodologia"
      className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto dark:border-aco-claro/40 dark:bg-aco/40"
    >
      <p className="mb-2 text-sm font-semibold tracking-wide text-marinho uppercase dark:text-concreto">
        Nesta página
      </p>
      <ol className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-1">
        {SECOES.map((s, i) => (
          <li key={s.slug}>
            <a
              href={`#metodologia-${s.slug}`}
              className="block rounded px-1 py-0.5 text-aco-claro hover:bg-slate-100 hover:underline dark:text-concreto dark:hover:bg-aco/60"
            >
              <span className="text-slate-500 tabular-nums dark:text-concreto/70">{i + 1}.</span>{' '}
              {s.titulo}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Página

export default function Metodologia() {
  return (
    <div className="text-slate-700 dark:text-concreto/90">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-marinho sm:text-3xl dark:text-concreto">
          <BookOpen aria-hidden="true" className="size-7 shrink-0 text-seguranca" />
          Metodologia
        </h1>
        <p className="mt-2 max-w-prose leading-relaxed">
          Como cada número da ferramenta é calculado: a fórmula, o que ela quer dizer em português
          simples e um exemplo com números. Nada aqui é caixa-preta: o painel &quot;Ver o
          cálculo&quot; de cada item mostra estas mesmas contas com os valores do seu item.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="mb-6 lg:mb-0">
          <Sumario />
        </aside>

        <div className="space-y-6">
          {/* ------------------------------------------------------------ 1 */}
          <Secao slug="visao-geral">
            <P>
              A ferramenta lê uma planilha com o cadastro de materiais e as movimentações de estoque
              e, sem enviar nada para servidor nenhum (todo o cálculo roda no seu navegador), produz
              a classificação ABC/XYZ, os parâmetros de reposição, a sugestão de compras e um MRP
              semanal. O caminho dos dados é sempre o mesmo:
            </P>
            <Lista ordenada>
              <li>
                <strong>Validação</strong> das abas e das linhas (relatório de qualidade).
              </li>
              <li>
                <strong>Janela de análise</strong> e <strong>séries de demanda</strong> por item e
                por período (mês ou semana).
              </li>
              <li>
                <strong>Custo unitário</strong> de cada item.
              </li>
              <li>
                <strong>Curva ABC</strong> pelo valor de consumo anualizado.
              </li>
              <li>
                <strong>Classe XYZ</strong> e <strong>padrão de demanda</strong> (Syntetos-Boylan).
              </li>
              <li>
                <strong>Previsão</strong> por período (F) e, opcionalmente, backtest dos métodos.
              </li>
              <li>
                <strong>Parâmetros</strong>: estoque de segurança, ponto de pedido, lote econômico,
                estoque máximo e cobertura.
              </li>
              <li>
                <strong>Status</strong> do item e <strong>sugestão de compra</strong> com
                prioridade.
              </li>
              <li>
                <strong>Saldo histórico</strong> reconstruído e <strong>giro</strong>.
              </li>
              <li>
                <strong>MRP</strong> semanal (com explosão da estrutura de produto, se houver).
              </li>
              <li>
                <strong>KPIs</strong> e alertas.
              </li>
            </Lista>
            <H3>O item de referência</H3>
            <P>
              Para que os exemplos conversem entre si, usamos ao longo da página o mesmo item
              fictício, cujas contas também estão nos testes automáticos do projeto:
            </P>
            <Tabela
              legenda="Dados do item de referência usados nos exemplos"
              colunas={['Dado', 'Valor']}
              linhas={[
                [
                  'Demanda mensal (12 meses)',
                  '100, 120, 80, 110, 90, 100, 130, 70, 100, 110, 90, 100',
                ],
                ['Lead time', '15 dias'],
                ['Nível de serviço', '98% (célula AX da matriz)'],
                ['Custo unitário', 'R$ 10,00'],
                ['Custo de emissão do pedido (S)', 'R$ 100,00'],
                ['Taxa de manutenção (i)', '25% ao ano'],
                ['Múltiplo de compra / lote mínimo', '50 / 100 unidades'],
                ['Estoque atual / pedidos em aberto', '60 unidades / nenhum'],
              ]}
            />
            <Nota titulo="Sugestões, não ordens">
              <P>
                Todos os resultados são sugestões que dependem da qualidade dos dados. Um estoque
                atual errado ou uma saída lançada como ajuste mudam o resultado. Por isso a
                ferramenta mostra o relatório de qualidade antes de qualquer número.
              </P>
            </Nota>
          </Secao>

          {/* ------------------------------------------------------------ 2 */}
          <Secao slug="dados">
            <P>
              A planilha tem duas abas obrigatórias e três opcionais. Os nomes das colunas não
              precisam ser exatos: a ferramenta reconhece sinônimos comuns (por exemplo,
              &quot;cod&quot;, &quot;sku&quot; ou &quot;material&quot; para <code>codigo</code>;
              &quot;qtd&quot; ou &quot;qtde&quot; para <code>quantidade</code>; &quot;prazo&quot; ou
              &quot;lt&quot; para <code>lead_time_dias</code>). Se alguma coluna obrigatória não for
              encontrada, aparece uma tela para você apontar qual coluna é qual.
            </P>
            <Tabela
              legenda="Resumo das abas da planilha de entrada"
              colunas={['Aba', 'Colunas', 'Para que serve']}
              linhas={[
                [
                  'Materiais (obrigatória)',
                  'codigo, descricao, unidade, estoque_atual, lead_time_dias; opcionais: custo_unitario, desvio_lead_time_dias, lote_minimo, multiplo_compra, estoque_seguranca_manual, fornecedor, categoria, tipo_item, data_cadastro',
                  'Cadastro: um item por linha, código único.',
                ],
                [
                  'Movimentacoes (obrigatória)',
                  'data, codigo, tipo, quantidade; opcionais: valor_total, documento',
                  'Histórico de entradas, saídas, ajustes e devoluções.',
                ],
                [
                  'PedidosAbertos',
                  'codigo, data_prevista, quantidade',
                  'Recebimentos programados (entram na posição e no MRP).',
                ],
                [
                  'BOM',
                  'codigo_pai, codigo_filho, quantidade_por, perda_pct',
                  'Estrutura de produto para explosão do MRP.',
                ],
                [
                  'MPS',
                  'codigo, semana_inicio, quantidade',
                  'Plano mestre (demanda independente) dos produtos.',
                ],
              ]}
            />
            <P>
              A <strong>quantidade é sempre positiva</strong>: quem diz se ela soma ou subtrai é o
              tipo do movimento. Datas podem vir como data do Excel, dd/mm/aaaa ou aaaa-mm-dd.
            </P>
            <H3>O que conta como demanda</H3>
            <P>
              Só o tipo <strong>Saída</strong> é demanda (consumo). Ajustes de inventário mexem no
              saldo, mas <strong>nunca</strong> entram na série de demanda: se entrassem, uma
              correção de contagem viraria &quot;consumo&quot; e distorceria ABC, XYZ e estoque de
              segurança.
            </P>
            <Tabela
              legenda="Efeito de cada tipo de movimento"
              colunas={['Tipo', 'Saldo', 'Demanda', 'Custo médio']}
              linhas={[
                ['Entrada', '+', '—', 'entra no cálculo (se tiver valor_total)'],
                ['Saída', '−', '+ (é a demanda)', '—'],
                ['Ajuste + / Ajuste −', '+ / −', '—', '—'],
                [
                  'Devolução ao estoque',
                  '+',
                  'abate a saída do mesmo período, sem deixar o período negativo (parâmetro, padrão Sim)',
                  '—',
                ],
                [
                  'Devolução ao fornecedor',
                  '−',
                  '—',
                  'abate das entradas (quantidade e valor) se tiver valor_total',
                ],
              ]}
            />
            <P>
              <strong>Devolução ao estoque</strong> é material que foi requisitado e voltou (da
              produção, da manutenção ou de um cliente): ele não foi consumido, por isso abate a
              saída do mesmo período. <strong>Devolução ao fornecedor</strong> é material comprado
              que voltou para quem vendeu: tira do saldo, não mexe na demanda e desconta a compra do
              custo médio.
            </P>
            <Lista>
              <li>
                &quot;Devolução&quot; sem destino é tratada como{' '}
                <strong>devolução ao estoque</strong>, com um aviso de qualidade pedindo
                confirmação.
              </li>
              <li>
                Sinônimos reconhecidos: &quot;dev. fornecedor&quot;, &quot;devolução de
                compra&quot;, &quot;estorno de entrada&quot; → ao fornecedor; &quot;dev.
                requisição&quot;, &quot;retorno ao almoxarifado&quot;, &quot;devolução de
                cliente&quot; → ao estoque.
              </li>
              <li>
                Códigos de movimento do SAP (101, 102, 122, 201, 202, 261, 262) são interpretados,
                mas sempre com aviso para você conferir.
              </li>
            </Lista>
            <Exemplo>
              <Lista>
                <li>
                  Saída de 100 e devolução ao estoque de 20 no mesmo mês → demanda do mês = 100 − 20
                  = <strong>80</strong>; saldo −100 + 20 = −80.
                </li>
                <li>
                  Devolução ao fornecedor de 10 → saldo −10; demanda <strong>inalterada</strong>.
                </li>
                <li>
                  Devolução ao estoque de 50 num mês com saída de 30 → demanda = max(0, 30 − 50) ={' '}
                  <strong>0</strong> (nunca negativa); o saldo ainda recebe +50.
                </li>
              </Lista>
            </Exemplo>
          </Secao>

          {/* ------------------------------------------------------------ 3 */}
          <Secao slug="series">
            <H3>Janela de análise</H3>
            <P>
              A análise usa os <strong>últimos N períodos completos</strong> (padrão: 12 meses). O
              período que contém a data-base (padrão: a data da última movimentação) fica de fora
              enquanto estiver incompleto, porque um mês pela metade subestima a demanda. Se a
              data-base for o último dia do período, ele está completo e entra. Meses são meses do
              calendário; semanas vão de segunda a domingo.
            </P>
            <Exemplo>
              <P>
                Data-base 15/11/2026, modo mensal, janela de 12 → novembro/2026 está incompleto e
                sai; a janela vai de <strong>nov/2025 a out/2026</strong>.
              </P>
            </Exemplo>
            <H3>Série de demanda e o início de cada item</H3>
            <P>
              Para cada item, somam-se as saídas de cada período (líquidas de devoluções ao estoque)
              e os <strong>períodos sem saída entram como zero</strong>. Esquecer os zeros é o erro
              mais comum em planilhas de estoque e destrói o cálculo de variabilidade.
            </P>
            <P>
              Mas um item que passou a existir no meio da janela não pode ser penalizado pelos meses
              em que ainda não existia. Por isso a série de cada item começa em:
            </P>
            <Formula>
              início_item = max( início da janela, período de data_cadastro )
              <br />
              (sem data_cadastro: período da 1ª movimentação de qualquer tipo do item no arquivo)
            </Formula>
            <P>
              Os períodos antes de início_item <strong>não</strong> contam como zero. O número de
              períodos do item, <em>n</em>, é contado a partir daí. Se n &lt; 3 (parâmetro
              &quot;mínimo de períodos&quot;), o item fica como{' '}
              <strong>Histórico insuficiente</strong>: a ABC é calculada normalmente (com consumo
              anualizado), a classe XYZ vira <strong>Novo</strong>, o estoque de segurança não é
              calculado e o item vai para revisão manual.
            </P>
            <Nota titulo="Limitação: item antigo que parece novo">
              <P>
                Se a extração da planilha começa numa data e um item antigo simplesmente não teve
                nenhum movimento no começo do arquivo, ele será tratado como novo (a série começa na
                primeira movimentação). Preencha a coluna <code>data_cadastro</code> para corrigir:
                com ela, a série começa no cadastro e os meses parados entram como zero.
              </P>
            </Nota>
            <H3>Estatísticas da série</H3>
            <Formula>
              d̄ = Σd<sub>t</sub> ÷ n
              <br />σ = √( Σ(d<sub>t</sub> − d̄)² ÷ (n − 1) )
              <br />
              Cv = Σd<sub>t</sub> × custo_unitário
              <br />
              Cv_anual = d̄ × custo_unitário × períodos_por_ano
            </Formula>
            <Lista>
              <li>
                <strong>d̄</strong> é a demanda média por período; <strong>σ</strong> é o desvio
                padrão amostral (divide por n − 1 porque estamos estimando a variabilidade a partir
                de uma amostra do histórico).
              </li>
              <li>
                <strong>Cv</strong> é o consumo em valor dentro da janela; <strong>Cv_anual</strong>{' '}
                é o mesmo consumo levado para um ano, base da curva ABC. Para itens com a janela
                completa, Cv_anual = Cv × períodos_por_ano ÷ n.
              </li>
              <li>
                Toda anualização usa <strong>períodos_por_ano</strong>: 12 no modo mensal e 52 no
                semanal.
              </li>
            </Lista>
            <Exemplo titulo="Exemplo: item de referência">
              <P>
                Σd = 1.200, n = 12 → d̄ = <strong>100</strong>. Σ(d − d̄)² = 0 + 400 + 400 + 100 + 100
                + 0 + 900 + 900 + 0 + 100 + 100 + 0 = 3.000 → σ = √(3.000 ÷ 11) ={' '}
                <strong>16,514</strong>. Cv = 1.200 × R$ 10,00 = R$ 12.000,00 e Cv_anual = 100 × R$
                10,00 × 12 = <strong>R$ 12.000,00</strong> (janela completa, os dois coincidem).
              </P>
            </Exemplo>
            <Exemplo titulo="Exemplo: item novo">
              <P>
                Janela de 12 meses, primeira movimentação no mês 9, saídas de 30, 30, 30, 30 nos
                meses 9 a 12. A série tem <strong>n = 4</strong> (e não 12): d̄ = 30, σ = 0, CV = 0 →
                classe X (se os 8 meses anteriores entrassem como zero, o CV seria 1,48 e o item
                cairia, injustamente, em Z). Com custo de R$ 10,00, Cv_anual = 30 × 10 × 12 = R$
                3.600,00, enquanto o consumo na janela foi só R$ 1.200,00. Se a primeira
                movimentação fosse no mês 11, n = 2 → Histórico insuficiente.
              </P>
            </Exemplo>
          </Secao>

          {/* ------------------------------------------------------------ 4 */}
          <Secao slug="custo">
            <P>O custo unitário de cada item segue esta ordem de prioridade:</P>
            <Lista ordenada>
              <li>
                <code>custo_unitario</code> do cadastro, se for maior que zero;
              </li>
              <li>
                custo médio ponderado das entradas <strong>dentro da janela</strong> que têm{' '}
                <code>valor_total</code>, descontadas as devoluções ao fornecedor com valor;
              </li>
              <li>último custo de entrada conhecido (de qualquer data);</li>
              <li>
                nada disso → custo = 0 e aviso &quot;item sem custo&quot;. O item fica fora da ABC
                por valor (vai para o fim da curva, classe C) e entra na lista de pendências.
              </li>
            </Lista>
            <Formula>
              custo médio = ( Σ valor_total<sub>entradas</sub> − Σ valor_total
              <sub>dev. fornecedor</sub> ) ÷ ( Σ qtd<sub>entradas</sub> − Σ qtd
              <sub>dev. fornecedor</sub> )
            </Formula>
            <Exemplo>
              <P>
                Entradas na janela: 100 un por R$ 1.000,00 e 200 un por R$ 2.400,00; uma devolução
                ao fornecedor de 50 un no valor de R$ 600,00. Custo = (1.000 + 2.400 − 600) ÷ (100 +
                200 − 50) = 2.800 ÷ 250 = <strong>R$ 11,20</strong>.
              </P>
            </Exemplo>
            <P>
              Sem custo, o lote econômico não pode ser calculado (o custo de manter seria zero).
              Nesse caso, se o item tem demanda, o lote de compra passa a ser{' '}
              <strong>um período de demanda</strong>, ajustado ao lote mínimo e ao múltiplo (veja{' '}
              <a
                href="#metodologia-parametros"
                className="text-aco-claro underline dark:text-seguranca"
              >
                Parâmetros de reposição
              </a>
              ).
            </P>
          </Secao>

          {/* ------------------------------------------------------------ 5 */}
          <Secao slug="abc">
            <P>
              A curva ABC separa os poucos itens que concentram a maior parte do dinheiro
              movimentado (A) dos muitos que valem pouco (C). A base padrão é o{' '}
              <strong>valor de consumo anualizado</strong> (Cv_anual), que não penaliza itens novos.
            </P>
            <Lista ordenada>
              <li>
                Ordenar os itens por Cv_anual decrescente (itens com Cv_anual = 0 vão para o fim,
                sempre classe C).
              </li>
              <li>Calcular, para cada item, o % acumulado dos itens anteriores a ele.</li>
              <li>Classe A se esse % for menor que 80%; B se menor que 95%; C caso contrário.</li>
            </Lista>
            <Formula>
              %acum_anterior<sub>k</sub> = ( Σ<sub>j &lt; k</sub> Cv_anual<sub>j</sub> ) ÷ Σ
              Cv_anual
              <br />A se %acum_anterior &lt; 80% · B se &lt; 95% · C caso contrário
            </Formula>
            <P>
              Usar o acumulado <strong>anterior</strong> garante que sempre exista ao menos um item
              A e que o item que cruza o corte fique na classe de cima.
            </P>
            <Tabela
              legenda="Exemplo de ABC com cinco itens (total R$ 10.000,00)"
              colunas={['Item', 'Consumo anual', '% acumulado anterior', 'Classe']}
              linhas={[
                ['1', 'R$ 5.000,00', '0%', 'A'],
                ['2', 'R$ 3.000,00', '50%', 'A'],
                ['3', 'R$ 1.000,00', '80%', 'B'],
                ['4', 'R$ 600,00', '90%', 'B'],
                ['5', 'R$ 400,00', '96%', 'C'],
              ]}
            />
            <P>
              Na aba ABC-XYZ também há a ABC por <strong>quantidade consumida</strong> (d̄ ×
              períodos_por_ano) e por <strong>valor em estoque</strong> (estoque atual × custo), com
              os mesmos cortes. A matriz ABC×XYZ e o nível de serviço usam sempre a ABC por valor de
              consumo.
            </P>
          </Secao>

          {/* ------------------------------------------------------------ 6 */}
          <Secao slug="xyz">
            <H3>Classe XYZ: o quanto a demanda varia</H3>
            <Formula>
              CV = σ ÷ d̄
              <br />X se CV ≤ 0,50 · Y se CV ≤ 1,00 · Z se CV &gt; 1,00
            </Formula>
            <P>
              O coeficiente de variação (CV) mede a variação em relação à média: CV = 0,20 quer
              dizer que o consumo costuma oscilar uns 20% em torno da média. Itens X são estáveis e
              fáceis de prever; Z são imprevisíveis. Dois casos especiais: d̄ = 0 → classe{' '}
              <strong>N (sem demanda)</strong>; n &lt; 3 → classe <strong>Novo</strong>.
            </P>
            <Exemplo titulo="Exemplo: item de referência">
              <P>
                CV = 16,514 ÷ 100 = <strong>0,165</strong> ≤ 0,50 → <strong>X</strong>.
              </P>
            </Exemplo>
            <H3>Padrão de demanda (Syntetos-Boylan)</H3>
            <P>
              O CV sozinho mistura duas coisas diferentes: a demanda aparecer raramente e o tamanho
              dela variar muito. A classificação de Syntetos, Boylan e Croston separa as duas e é
              ela que decide o método de previsão:
            </P>
            <Formula>
              ADI = n ÷ (número de períodos com demanda &gt; 0)
              <br />
              CV² = ( σ ÷ média, calculados só nos períodos com demanda &gt; 0 )²
            </Formula>
            <Lista>
              <li>
                <strong>ADI</strong> (intervalo médio entre demandas): ADI = 1 significa que há
                consumo todo período; ADI = 4, que há consumo, em média, a cada 4 períodos.
              </li>
              <li>
                <strong>CV²</strong> mede o quanto variam os tamanhos das demandas quando elas
                acontecem (desvio amostral). Com um único período não nulo, CV² = 0.
              </li>
            </Lista>
            <Tabela
              legenda="Quadrantes de Syntetos-Boylan (cortes ADI 1,32 e CV² 0,49)"
              colunas={['', 'CV² < 0,49 (tamanho estável)', 'CV² ≥ 0,49 (tamanho variável)']}
              linhas={[
                ['ADI < 1,32 (demanda frequente)', 'Suave → média móvel', 'Errático → média móvel'],
                [
                  'ADI ≥ 1,32 (demanda esporádica)',
                  'Intermitente → SBA',
                  'Irregular (lumpy) → SBA',
                ],
              ]}
            />
            <Exemplo titulo="Exemplo: item intermitente">
              <P>
                Série [0, 0, 50, 0, 0, 0, 40, 0, 0, 60, 0, 0]: 3 períodos com demanda em 12 → ADI =
                12 ÷ 3 = <strong>4</strong>. Tamanhos 50, 40 e 60: média 50, desvio 10, CV = 0,20 →
                CV² = <strong>0,04</strong>. ADI ≥ 1,32 e CV² &lt; 0,49 →{' '}
                <strong>Intermitente</strong>, previsão por SBA. O item de referência tem demanda
                todo mês (ADI = 1) e CV² = 0,165² = 0,027 → <strong>Suave</strong>.
              </P>
            </Exemplo>
          </Secao>

          {/* ------------------------------------------------------------ 7 */}
          <Secao slug="previsao">
            <P>
              A previsão F é a demanda esperada <strong>por período</strong> (mês ou semana). Ela
              alimenta o ponto de pedido, o lote econômico, a cobertura e o MRP.
            </P>
            <H3>Regra fixa (padrão)</H3>
            <Tabela
              legenda="Método de previsão pela regra fixa"
              colunas={['Situação', 'Método', 'Por quê']}
              linhas={[
                [
                  'Suave ou errático',
                  'Média móvel dos últimos 6 períodos (ou de todos, se houver menos de 6)',
                  'Reage a mudanças sem ser nervosa.',
                ],
                [
                  'Intermitente ou irregular',
                  'SBA (Croston corrigido), α = 0,10',
                  'A média simples erra muito com muitos zeros.',
                ],
                [
                  'Novo (n < 3)',
                  'Média dos períodos disponíveis',
                  'Não há histórico para nada mais sofisticado.',
                ],
                ['Sem demanda (N)', 'F = 0', 'Nenhuma saída na janela.'],
              ]}
            />
            <Exemplo titulo="Exemplo: item de referência">
              <P>
                Últimos 6 meses: 130, 70, 100, 110, 90, 100 → F = 600 ÷ 6 = <strong>100</strong> por
                mês.
              </P>
            </Exemplo>
            <H3>SBA passo a passo</H3>
            <P>
              O método de Croston prevê separadamente o <strong>tamanho</strong> da demanda (z)
              quando ela acontece e o <strong>intervalo</strong> entre demandas (p), e divide um
              pelo outro. Syntetos e Boylan mostraram que essa divisão superestima a demanda e
              propuseram o fator de correção (1 − α/2): é o SBA.
            </P>
            <Formula>
              Inicialização: z = 1ª demanda não nula; p = posição dessa demanda (contando de 1)
              <br />A cada período com demanda d: z ← z + α(d − z); p ← p + α(q − p)
              <br />
              (q = períodos desde a última demanda; em períodos com zero, nada muda)
              <br />F = (1 − α/2) × z ÷ p
            </Formula>
            <Tabela
              legenda="SBA para a série [0, 0, 50, 0, 0, 0, 40, 0, 0, 60, 0, 0] com α = 0,10"
              colunas={['Período', 'Demanda', 'Intervalo q', 'z', 'p']}
              linhas={[
                ['3', '50', '3', '50 (inicialização)', '3 (inicialização)'],
                ['7', '40', '4', '50 + 0,10 × (40 − 50) = 49', '3 + 0,10 × (4 − 3) = 3,1'],
                ['10', '60', '3', '49 + 0,10 × (60 − 49) = 50,1', '3,1 + 0,10 × (3 − 3,1) = 3,09'],
              ]}
            />
            <Formula>F = (1 − 0,05) × 50,1 ÷ 3,09 = 47,595 ÷ 3,09 = 15,40 por mês</Formula>
            <P>
              Repare que F não é a média simples da série (150 ÷ 12 = 12,5). O SBA estima &quot;o
              tamanho típico de um pedido dividido pelo intervalo típico entre pedidos&quot; e só se
              atualiza quando há demanda, por isso os dois zeros do fim da série não puxam a
              previsão para baixo.
            </P>
            <H3>Backtest: medir o erro antes de confiar</H3>
            <P>
              O backtest simula o passado: para cada um dos <strong>últimos 6 períodos</strong>, faz
              a previsão usando <strong>só os dados anteriores</strong> àquele período (origem
              móvel, um passo à frente) e compara com o que aconteceu. Cada origem precisa de pelo
              menos 2 períodos de histórico. Ele roda para itens X, Y e Z (não para Novo nem N).
            </P>
            <Lista>
              <li>
                Candidatos: média móvel de 3, 6 e 12 períodos (com menos histórico, usa tudo o que
                houver), suavização exponencial simples (SES) e, para intermitentes e irregulares,
                SBA.
              </li>
              <li>
                SES: F<sub>t+1</sub> = α × d<sub>t</sub> + (1 − α) × F<sub>t</sub>, começando no 1º
                valor da série. O α é escolhido <strong>em cada origem</strong> numa grade de 0,05 a
                0,50 (passo 0,05), pelo menor erro quadrático médio das previsões um passo à frente
                dentro do histórico disponível.
              </li>
              <li>
                Modo <strong>Automático</strong> (parâmetro &quot;Método de previsão&quot;): o item
                usa o método com <strong>menor MAE</strong> no backtest. No modo Regra fixa, o
                backtest é só informativo: o WMAPE e o viés do item são os do método da regra.
              </li>
            </Lista>
            <Formula>
              erro<sub>t</sub> = previsto<sub>t</sub> − real<sub>t</sub>
              <br />
              MAE = média |erro|
              <br />
              RMSE = √ média(erro²)
              <br />
              WMAPE = Σ|erro| ÷ Σreal
              <br />
              viés = Σerro ÷ Σreal (positivo = superestima)
            </Formula>
            <Lista>
              <li>
                <strong>MAE</strong>: quantas unidades, em média, a previsão erra.
              </li>
              <li>
                <strong>RMSE</strong>: parecido, mas pune mais os erros grandes.
              </li>
              <li>
                <strong>WMAPE</strong>: o erro total como % do consumo total; permite comparar itens
                de tamanhos diferentes.
              </li>
              <li>
                <strong>Viés</strong>: se a previsão erra sistematicamente para cima ou para baixo.
                Erros que se compensam dão viés zero mesmo com MAE alto.
              </li>
            </Lista>
            <Exemplo>
              <P>
                Real [10, 0, 20], previsto [12, 4, 14] → erros 2, 4, −6. MAE = 12 ÷ 3 ={' '}
                <strong>4,00</strong>; RMSE = √((4 + 16 + 36) ÷ 3) = √(56 ÷ 3) ={' '}
                <strong>4,32</strong>; WMAPE = 12 ÷ 30 = <strong>40,0%</strong>; viés = (2 + 4 − 6)
                ÷ 30 = <strong>0,0%</strong>.
              </P>
            </Exemplo>
            <Nota titulo="Por que não MAPE?">
              <P>
                O MAPE tradicional divide cada erro pelo real <em>daquele período</em>. No exemplo
                acima, o segundo período tem real 0: o erro de 4 unidades vira 4 ÷ 0, uma divisão
                por zero. Em estoque, meses sem consumo são comuns, então o MAPE explode ou precisa
                descartar períodos. O WMAPE divide pelo total e não tem esse problema.
              </P>
            </Nota>
            <Tabela
              legenda="Backtest do item de referência (reais dos meses 7 a 12: 130, 70, 100, 110, 90, 100)"
              colunas={['Método', 'MAE', 'RMSE', 'WMAPE', 'Viés']}
              linhas={[
                ['MM3 (vencedor pelo MAE)', '13,33', '19,81', '13,3%', '0,0%'],
                ['MM6', '14,72', '19,73', '14,7%', '+0,3%'],
                ['MM12', '14,21', '19,56', '14,2%', '+0,9%'],
                ['SES (α = 0,05)', '13,71', '18,72', '13,7%', '+0,2%'],
              ]}
            />
            <P>
              Note que o vencedor depende da métrica: pelo RMSE, a SES ganharia. A ferramenta usa o
              MAE porque ele é fácil de interpretar (unidades por período) e menos sensível a um
              único mês atípico. No dashboard, o WMAPE e o viés médios são ponderados pelo valor de
              consumo de cada item.
            </P>
          </Secao>

          {/* ------------------------------------------------------------ 8 */}
          <Secao slug="parametros">
            <P>Notação usada nesta seção:</P>
            <Formula>
              LTₚ = lead_time_dias ÷ dias_por_período (30 no mensal, 7 no semanal)
              <br />Z = NORM.S.INV(nível de serviço)
            </Formula>
            <P>
              O <strong>nível de serviço</strong> (de ciclo) é a probabilidade de não faltar o item
              durante a espera por uma reposição. Ele vem da matriz ABC×XYZ: itens A custam caro
              para faltar; itens Z são imprevisíveis e protegê-los a 98% exigiria estoque
              desproporcional.
            </P>
            <Tabela
              legenda="Matriz de nível de serviço padrão (editável)"
              colunas={['', 'X', 'Y', 'Z']}
              linhas={[
                ['A', '98%', '97%', '95%'],
                ['B', '96%', '95%', '92%'],
                ['C', '93%', '90%', '85%'],
              ]}
            />
            <P>
              Z é o número de desvios padrão correspondente: 85% → 1,036433; 90% → 1,281552; 95% →
              1,644854; 98% → 2,053749; 99% → 2,326348. Ele é calculado por um inverso da normal
              próprio (algoritmo de Acklam com um passo de refinamento de Halley), que dá o mesmo
              resultado do NORM.S.INV do Excel.
            </P>

            <H3>Estoque de segurança (ES)</H3>
            <Formula>
              Sem variabilidade de prazo: ES = Z × σ × √LTₚ
              <br />
              Com desvio_lead_time_dias (σ<sub>LT,p</sub> = desvio ÷ dias_por_período):
              <br />
              ES = Z × √( LTₚ × σ² + F² × σ<sub>LT,p</sub>² )
            </Formula>
            <P>
              O ES protege contra a demanda acima da média durante o lead time. A segunda fórmula
              acrescenta o risco de o fornecedor atrasar: quanto maior o consumo F, mais caro fica
              cada dia de atraso. Se o item tiver <code>estoque_seguranca_manual</code>, o valor
              manual substitui o calculado e o item é marcado como &quot;manual&quot;. Itens Novo e
              N não recebem ES calculado e vão para revisão manual.
            </P>
            <Exemplo titulo="Exemplo: item de referência">
              <P>
                LTₚ = 15 ÷ 30 = 0,5; Z = 2,053749. ES = 2,053749 × 16,514 × √0,5 = 2,053749 × 11,677
                = 23,98 → exibido <strong>24</strong>.
              </P>
              <P>
                Se o fornecedor tivesse desvio de prazo de 5 dias: σ<sub>LT,p</sub> = 5 ÷ 30 =
                0,1667; ES = 2,053749 × √(0,5 × 16,514² + 100² × 0,1667²) = 2,053749 × √(136,36 +
                277,78) = 2,053749 × 20,35 = 41,79 → <strong>42</strong>. A incerteza do prazo quase
                dobra o ES.
              </P>
            </Exemplo>

            <H3>Ponto de pedido (PP)</H3>
            <Formula>PP = F × LTₚ + ES</Formula>
            <P>
              É o estoque que cobre o consumo médio durante o lead time mais a proteção. Quando a
              posição de estoque chega nele, é hora de pedir. Se F = 0, não há PP (o item não gera
              &quot;Comprar&quot;), a menos que exista ES manual: nesse caso PP = ES. Itens Novo têm
              PP = F × LTₚ (sem ES).
            </P>
            <Exemplo>
              <P>
                PP = 100 × 0,5 + 23,98 = 73,98 → <strong>74</strong>.
              </P>
            </Exemplo>

            <H3>Lote econômico (EOQ) e lote de compra (Q*)</H3>
            <Formula>
              D = F × períodos_por_ano (demanda anual)
              <br />H = i × custo_unitário (custo anual de manter 1 unidade)
              <br />
              EOQ = √( 2 × D × S ÷ H )
              <br />
              Q* = max( lote_mínimo, ⌈EOQ ÷ múltiplo⌉ × múltiplo )
            </Formula>
            <P>
              O EOQ equilibra o custo de emitir pedidos (S, por pedido) com o custo de manter
              estoque (H, por unidade por ano). Q* ajusta o EOQ à embalagem (múltiplo) e ao lote
              mínimo do fornecedor. O EOQ &quot;não se aplica&quot; se D = 0, H = 0 (item sem custo)
              ou S = 0. Nesse caso, havendo demanda, o lote é <strong>1 período de demanda</strong>{' '}
              ajustado ao lote mínimo e ao múltiplo; sem demanda mas com ES manual, o lote é o maior
              entre o lote mínimo e o múltiplo.
            </P>
            <Exemplo>
              <P>
                D = 100 × 12 = 1.200; H = 25% × R$ 10,00 = R$ 2,50; EOQ = √(2 × 1.200 × 100 ÷ 2,5) =
                √96.000 = <strong>309,84</strong>. ⌈309,84 ÷ 50⌉ = ⌈6,197⌉ = 7 → 7 × 50 = 350;
                max(100, 350) → Q* = <strong>350</strong>.
              </P>
            </Exemplo>

            <H3>Estoque máximo, consumo diário e cobertura</H3>
            <Formula>
              Máx = ES + Q*
              <br />
              consumo diário = F ÷ dias_por_período
              <br />
              cobertura (dias) = estoque_atual ÷ consumo diário (∞ se o consumo for zero)
            </Formula>
            <Exemplo>
              <P>
                Máx = 23,98 + 350 = 373,98 → <strong>374</strong>. Consumo diário = 100 ÷ 30 =
                3,333; cobertura = 60 ÷ 3,333 = <strong>18 dias</strong>.
              </P>
            </Exemplo>

            <H3>Arredondamento</H3>
            <P>
              Tudo é calculado com casas decimais completas; só a exibição e a planilha de saída
              arredondam. Em unidades <strong>discretas</strong> (UN, PC, CX, PCT, PAR…), ES, PP,
              Máx e sugestões são arredondados <strong>para cima</strong> (não existe meia caixa e
              arredondar para baixo reduziria a proteção). Em unidades <strong>fracionáveis</strong>{' '}
              (KG, G, L, ML, M, M2, M3…) são exibidas 2 casas decimais. Por isso o Máx do exemplo é
              23,98 + 350 = 373,98 → 374, e não 24 + 350.
            </P>
          </Secao>

          {/* ------------------------------------------------------------ 9 */}
          <Secao slug="reposicao">
            <Formula>posição de estoque = estoque_atual + Σ pedidos em aberto</Formula>
            <P>
              A posição é o que você tem mais o que já está a caminho. É ela que se compara com o
              PP, para não pedir de novo o que já foi pedido.
            </P>
            <H3>Status do item</H3>
            <P>As regras são testadas nesta ordem; a primeira que bater define o status:</P>
            <Lista ordenada>
              <li>
                <strong>Ruptura</strong>: estoque_atual ≤ 0 e F &gt; 0.
              </li>
              <li>
                <strong>Crítico</strong>: estoque_atual &lt; ES.
              </li>
              <li>
                <strong>Comprar</strong>: posição ≤ PP.
              </li>
              <li>
                <strong>Excesso</strong>: estoque_atual &gt; Máx e F &gt; 0.
              </li>
              <li>
                <strong>Sem giro</strong>: nenhuma saída há 180 dias ou mais e estoque_atual &gt; 0
                (se o item nunca teve saída, conta-se desde o cadastro ou a primeira movimentação).
              </li>
              <li>
                <strong>Sem demanda</strong>: F = 0 e estoque_atual = 0.
              </li>
              <li>
                <strong>OK</strong>: nenhuma das anteriores.
              </li>
            </Lista>
            <H3>Sugestão de compra</H3>
            <P>Quando a posição está no PP ou abaixo, a ferramenta sugere repor até o Máx:</P>
            <Formula>
              Qtd = max( lote_mínimo, ⌈(Máx − posição) ÷ múltiplo⌉ × múltiplo )
              <br />
              Valor = Qtd × custo_unitário
              <br />
              Chegada estimada = data-base + lead_time_dias
            </Formula>
            <Exemplo titulo="Exemplo: item de referência">
              <P>
                Estoque 60 ≥ ES 23,98 (não é Crítico); posição 60 ≤ PP 73,98 → status{' '}
                <strong>Comprar</strong>. Qtd = ⌈(373,98 − 60) ÷ 50⌉ × 50 = ⌈6,28⌉ × 50 = 7 × 50 ={' '}
                <strong>350</strong>; valor = 350 × R$ 10,00 = <strong>R$ 3.500,00</strong>. Com
                data-base 15/11/2026, chegada estimada em 30/11/2026. Motivo gerado: &quot;Posição
                60 ≤ PP 74; cobertura 18 d &gt; LT 15 d&quot;.
              </P>
            </Exemplo>
            <P>
              Caso especial: quando a demanda durante o lead time é maior que o lote (lead time
              longo, lote pequeno), o Máx = ES + Q* pode ficar abaixo do PP. Se a posição estiver
              entre o Máx e o PP, a fórmula daria zero e o item ficaria &quot;Comprar&quot; sem
              sugestão. Nesse caso a ferramenta sugere <strong>um lote Q*</strong> e explica isso no
              motivo. Exemplo: F = 100, LT = 60 dias, ES = 24 e Q* = 150 dão PP = 224 e Máx = 174;
              com posição 200, a sugestão é 150.
            </P>
            <H3>Prioridade</H3>
            <Lista>
              <li>
                <strong>Urgente</strong>: risco de ruptura antes da chegada, isto é, cobertura
                (dias) &lt; lead_time_dias. O estoque físico acaba antes de um pedido feito hoje
                chegar.
              </li>
              <li>
                <strong>Alta</strong>: item classe A, ou com status Ruptura ou Crítico.
              </li>
              <li>
                <strong>Média</strong>: classe B.
              </li>
              <li>
                <strong>Baixa</strong>: classe C.
              </li>
            </Lista>
            <P>
              A aba Compras ordena por prioridade e, dentro dela, pelo valor da sugestão
              (decrescente). No exemplo, a cobertura de 18 dias é maior que o lead time de 15: não é
              urgente; sendo um item A, a prioridade é <strong>Alta</strong>.
            </P>
            <Nota titulo="Dois jeitos de olhar o risco">
              <P>
                O &quot;risco de ruptura antes da chegada&quot; usa só o estoque físico (cobertura ×
                lead time), de forma conservadora. Já a{' '}
                <a
                  href="#metodologia-matematica"
                  className="text-aco-claro underline dark:text-seguranca"
                >
                  probabilidade de faltar antes da chegada
                </a>{' '}
                usa a posição (estoque + pedidos em aberto) e a distribuição da demanda.
              </P>
            </Nota>
          </Secao>

          {/* ------------------------------------------------------------ 10 */}
          <Secao slug="giro">
            <H3>Reconstrução do saldo histórico</H3>
            <P>
              A planilha traz só o estoque de hoje. Para saber quanto havia em cada mês, a
              ferramenta parte do estoque atual na data-base e{' '}
              <strong>desfaz os movimentos de trás para frente</strong>, inclusive os que
              aconteceram depois do fim da janela (por exemplo, no mês corrente incompleto).
            </P>
            <Formula>
              saldo_fim(último período) = estoque_atual − efeito dos movimentos após a janela
              <br />
              saldo_fim(t − 1) = saldo_fim(t) − efeito(t)
              <br />
              efeito = +entradas +ajustes(+) +dev. ao estoque −saídas −ajustes(−) −dev. ao
              fornecedor
            </Formula>
            <P>
              Isso equivale à fórmula fechada: saldo no início = estoque_atual − Σentradas −
              ΣAjuste+ − ΣDevolução ao estoque + Σsaídas + ΣAjuste− + ΣDevolução ao fornecedor.
            </P>
            <Exemplo titulo="Exemplo (janela de 3 meses, para simplificar)">
              <P>
                Data-base 15/11/2026, estoque atual 60. Novembro (fora da janela): saída de 40.
                Outubro: saída de 100. Setembro: entrada de 200 e saída de 110. Agosto: saída de
                120.
              </P>
              <Lista>
                <li>Saldo fim de outubro = 60 + 40 = 100</li>
                <li>Saldo fim de setembro = 100 + 100 = 200</li>
                <li>Saldo fim de agosto = 200 − 200 + 110 = 110</li>
                <li>Saldo no início de agosto = 110 + 120 = 230</li>
              </Lista>
              <P>Conferência pela fórmula fechada: 60 − 200 + (40 + 100 + 110 + 120) = 230.</P>
            </Exemplo>
            <H3>Estoque médio e giro</H3>
            <Formula>
              estoque médio = média dos saldos de fim de período (a partir de início_item)
              <br />
              giro anualizado = (consumo em valor na janela × períodos_por_ano ÷ n) ÷ (estoque médio
              × custo)
            </Formula>
            <P>
              O giro diz quantas vezes por ano o estoque &quot;se renova&quot;. Como o custo aparece
              em cima e embaixo, para um item ele se cancela e o giro é a razão entre consumo anual
              e estoque médio em quantidade. No dashboard, o giro consolidado é o CMV anualizado (Σ
              Cv_anual) ÷ estoque médio em valor.
            </P>
            <Exemplo>
              <P>
                No exemplo acima: saldos de fim 110, 200 e 100 → estoque médio = 136,67. Consumo nos
                3 meses = 120 + 110 + 100 = 330 → anualizado 330 × 12 ÷ 3 = 1.320. Giro = 1.320 ÷
                136,67 = <strong>9,7 vezes por ano</strong>.
              </P>
            </Exemplo>
            <H3>Saldo inconsistente</H3>
            <P>
              Se algum saldo reconstruído ficar negativo, há movimento faltando no arquivo ou o
              estoque atual está errado (não dá para ter tido −40 peças na prateleira). A ferramenta
              emite o alerta <strong>saldo inconsistente</strong>, mas não bloqueia o cálculo.
            </P>
          </Secao>

          {/* ------------------------------------------------------------ 11 */}
          <Secao slug="mrp">
            <P>
              O MRP (planejamento das necessidades de materiais) projeta, semana a semana, quanto
              vai ser consumido, quanto vai chegar e quando é preciso liberar cada pedido. O
              horizonte padrão é de 12 semanas; as semanas começam na segunda-feira e a{' '}
              <strong>semana 1 é a que contém a data-base</strong>.
            </P>
            <Formula>LT em semanas = ⌈lead_time_dias ÷ 7⌉</Formula>
            <H3>As linhas do registro de MRP</H3>
            <Lista>
              <li>
                <strong>Necessidade bruta NB(t)</strong>. Sem BOM e MPS (planejamento por consumo):
                NB = F × 7 ÷ dias_por_período, igual em todas as semanas. Com BOM e MPS: os itens do
                MPS recebem a quantidade planejada, e os componentes recebem as liberações
                planejadas dos pais × quantidade_por × (1 + perda_pct).
              </li>
              <li>
                <strong>Recebimentos programados RP(t)</strong>: pedidos em aberto. Pedidos com data
                anterior à semana 1 (atrasados) entram na semana 1; os que caem depois do horizonte
                ficam de fora.
              </li>
              <li>
                <strong>Estoque projetado</strong>: EP(t) = EP(t − 1) + RP(t) + RecPlan(t) − NB(t),
                com EP(0) = estoque atual.
              </li>
              <li>
                <strong>Necessidade líquida</strong>, medida em relação ao ES: se EP(t − 1) + RP(t)
                − NB(t) &lt; ES, então NL(t) = ES − (EP(t − 1) + RP(t) − NB(t)).
              </li>
              <li>
                <strong>Recebimento planejado RecPlan(t)</strong>: a NL ajustada pela política de
                lote (abaixo).
              </li>
              <li>
                <strong>Liberação planejada</strong>: LibPlan(t − LT) = RecPlan(t). Se t − LT cair
                antes da semana 1, a liberação é lançada na semana 1 e marcada como{' '}
                <strong>liberação em atraso</strong> (o pedido já deveria ter sido feito).
              </li>
            </Lista>
            <H3>Políticas de lote</H3>
            <Tabela
              legenda="Políticas de lote do MRP (todas ajustadas depois ao lote mínimo e ao múltiplo)"
              colunas={['Política', 'Quantidade planejada']}
              linhas={[
                ['Lote econômico (padrão)', 'max(NL, Q*)'],
                ['Lote a lote', 'NL (exatamente o que falta)'],
                [
                  'Período fixo (POQ)',
                  'O necessário para manter o ES nas próximas n semanas, somando as necessidades delas (parâmetro "semanas por pedido", padrão 4)',
                ],
              ]}
            />
            <Exemplo titulo="Exemplo: item de referência, lote econômico">
              <P>
                NB = 100 × 7 ÷ 30 = 23,33 por semana; LT = ⌈15 ÷ 7⌉ = 3 semanas; ES = 23,98; EP(0) =
                60.
              </P>
              <Tabela
                legenda="Primeiras semanas do registro de MRP do item de referência"
                colunas={['Semana', 'NB', 'EP antes do RecPlan', 'NL', 'RecPlan', 'EP', 'LibPlan']}
                linhas={[
                  ['1', '23,33', '36,67', '0', '0', '36,67', '350 (em atraso)'],
                  ['2', '23,33', '13,33', '10,65', '350', '363,33', '0'],
                  ['3', '23,33', '340,00', '0', '0', '340,00', '0'],
                ]}
              />
              <P>
                Na semana 2 o estoque cairia para 13,33, abaixo do ES: NL = 23,98 − 13,33 = 10,65 e
                RecPlan = max(10,65; 350) = 350. Para chegar na semana 2 com LT de 3 semanas, o
                pedido deveria ter saído na semana −1: ele vai para a semana 1 como liberação em
                atraso. Com lote a lote, a quantidade seria ⌈10,65 ÷ 50⌉ × 50 = 50, elevada ao lote
                mínimo de 100. Com período fixo de 4 semanas (semanas 2 a 5): 23,98 − (60 − 5 ×
                23,33) = 80,65 → também 100.
              </P>
            </Exemplo>
            <H3>Explosão da estrutura de produto (BOM)</H3>
            <P>
              A explosão só acontece quando a planilha traz <strong>as duas abas</strong>, BOM e
              MPS. Cada item recebe um <strong>código de nível mais baixo</strong> (low-level code):
              a maior profundidade em que ele aparece em qualquer estrutura. Os itens são
              processados nível por nível, do 0 para baixo, para que um componente usado em vários
              níveis só seja calculado depois que todas as suas necessidades forem conhecidas.
            </P>
            <Exemplo>
              <P>
                O produto P usa 2 × C1, e C1 usa 3 × C2. Uma liberação planejada de 10 P na semana 4
                gera necessidade bruta de 20 C1 na semana 4. Se C1 é liberado na semana 3 (LT de 1
                semana, sem estoque, lote a lote), C2 recebe necessidade de 60 na semana 3.
              </P>
            </Exemplo>
            <Lista>
              <li>
                <strong>BOM circular</strong> (A usa B, que usa A): o MRP não é calculado e aparece
                uma mensagem amigável indicando o ciclo. O resto da análise (ABC, parâmetros,
                compras) funciona normalmente.
              </li>
              <li>
                Itens que não estão na estrutura seguem o <strong>planejamento por consumo</strong>{' '}
                (NB = previsão semanal).
              </li>
              <li>
                Linhas de MPS com semana anterior à semana 1 entram na semana 1; depois do
                horizonte, ficam de fora. Itens da BOM sem cadastro em Materiais entram com estoque
                0, lead time 0 e sem ES.
              </li>
            </Lista>
            <P>
              A visão consolidada soma as liberações planejadas por semana, em quantidade e em R$
              (quantidade × custo): é o &quot;fluxo de caixa de compras&quot; das próximas semanas.
            </P>
          </Secao>

          {/* ------------------------------------------------------------ 12 */}
          <Secao slug="matematica">
            <P>
              Algumas ideias de cálculo, probabilidade e álgebra linear aparecem por trás dos
              números. Esta seção explica cada uma em linguagem acessível, sempre com o item de
              referência.
            </P>

            <H3>a) Derivada: a curva de custo total do lote</H3>
            <Formula>
              CT(Q) = (D ÷ Q) × S + (Q ÷ 2) × H
              <br />
              dCT/dQ = −D × S ÷ Q² + H ÷ 2
              <br />
              dCT/dQ = 0 ⇒ Q = √(2 × D × S ÷ H) = EOQ
              <br />
              CT(EOQ) = √(2 × D × S × H)
              <br />
              penalidade do arredondamento = (CT(Q*) − CT(EOQ)) ÷ CT(EOQ)
            </Formula>
            <P>
              O primeiro termo é o custo de pedir (D ÷ Q pedidos por ano, cada um custando S); o
              segundo, o custo de manter o estoque médio (Q ÷ 2). Pedir pouco de cada vez gera
              muitos pedidos; pedir muito gera estoque parado. A derivada mede a inclinação da
              curva: onde ela vale zero, a curva para de descer e começa a subir. A segunda
              derivada, 2DS ÷ Q³, é positiva, o que confirma que esse ponto é um mínimo. No ótimo,
              custo de pedir = custo de manter.
            </P>
            <Exemplo>
              <P>
                CT(309,84) = 387,30 + 387,30 = <strong>R$ 774,60</strong> = √(2 × 1.200 × 100 × 2,5)
                = √600.000. CT(350) = 1.200 ÷ 350 × 100 + 350 ÷ 2 × 2,5 = 342,86 + 437,50 ={' '}
                <strong>R$ 780,36</strong>. Penalidade = (780,36 − 774,60) ÷ 774,60 ={' '}
                <strong>+0,74%</strong>: comprar 13% acima do EOQ, por causa da embalagem, custa
                menos de 1% a mais. A curva é bem achatada perto do mínimo.
              </P>
            </Exemplo>
            <P>
              <strong>Por que não usar descida do gradiente?</strong> A descida do gradiente
              procuraria o mínimo andando em passos: Q<sub>k+1</sub> = Q<sub>k</sub> − η × dCT/dQ.
              Partindo de Q₀ = 100, a derivada vale −1.200 × 100 ÷ 100² + 1,25 = −10,75 (negativa:
              aumentar Q reduz o custo); com passo η = 10, Q₁ = 207,5; ali a derivada ainda é −1,54,
              então Q₂ ≈ 222,9, e assim por diante, cada vez mais devagar, até chegar perto de
              309,84. Ela faria o mesmo caminho até onde a derivada vale zero, mas exige escolher o
              passo e dezenas de iterações. Como o problema tem solução fechada, a fórmula chega lá
              numa conta só.
            </P>

            <H3>b) Probabilidade: a demanda durante o lead time</H3>
            <Formula>
              demanda no LT ~ Normal( μ<sub>LT</sub> = F × LTₚ ; σ<sub>LT</sub> = σ × √LTₚ )
              <br />
              (ou σ<sub>LT</sub> = √(LTₚ × σ² + F² × σ<sub>LT,p</sub>²) com variabilidade de prazo)
              <br />
              P(ruptura no ciclo) = 1 − nível de serviço
              <br />
              P(faltar antes da chegada) = 1 − Φ( (posição − μ<sub>LT</sub>) ÷ σ<sub>LT</sub> )
            </Formula>
            <P>
              A demanda dos próximos dias de lead time é incerta; a ferramenta a modela como uma
              curva em sino centrada em μ<sub>LT</sub>. Pedir no PP significa aceitar que, em (1 −
              nível de serviço) dos ciclos, a demanda passe do PP. A segunda probabilidade responde
              a uma pergunta do dia a dia: com a <strong>posição atual</strong> (estoque + pedidos
              em aberto), qual a chance de faltar se eu pedir agora? Φ é a função de distribuição
              acumulada da normal, calculada com uma função erro (erf) própria. Com ES manual, a
              ruptura no ciclo vira 1 − Φ(ES ÷ σ<sub>LT</sub>).
            </P>
            <Exemplo>
              <P>
                μ<sub>LT</sub> = 100 × 0,5 = 50; σ<sub>LT</sub> = 16,514 × √0,5 = 11,677. Ruptura no
                ciclo = 1 − 98% = 2%. Posição 60 → z = (60 − 50) ÷ 11,677 = 0,8564 → P(faltar antes
                da chegada) = 1 − Φ(0,8564) ≈ <strong>19,6%</strong>. Ou seja: com 60 unidades, há
                cerca de 1 chance em 5 de faltar antes de um pedido feito hoje chegar.
              </P>
            </Exemplo>
            <Nota titulo="Itens intermitentes e irregulares">
              <P>
                Com muitos períodos zerados, a demanda está longe de uma curva em sino. Para itens
                intermitentes e irregulares, as probabilidades são marcadas como{' '}
                <strong>indicativas</strong>: servem para comparar itens, não como uma previsão
                precisa.
              </P>
            </Nota>

            <H3>c) Função de perda normal: fill rate</H3>
            <Formula>
              G(z) = φ(z) − z × (1 − Φ(z))
              <br />z efetivo = ES ÷ σ<sub>LT</sub>
              <br />
              ESC = σ<sub>LT</sub> × G(z) (falta esperada por ciclo, em unidades)
              <br />β = 1 − ESC ÷ Q* (fill rate: % das peças pedidas atendidas pelo estoque)
            </Formula>
            <P>
              O nível de serviço de ciclo (tipo 1, o parâmetro) conta <em>ciclos</em> com alguma
              falta, por menor que seja. O fill rate (tipo 2) conta <em>peças</em> não atendidas.
              G(z) é a falta média, em desvios padrão, quando o estoque de proteção vale z desvios.
              A ferramenta usa o z efetivo = ES ÷ σ<sub>LT</sub>: ele é igual ao Z quando o ES é
              calculado e diferente quando o ES é manual.
            </P>
            <Exemplo>
              <P>
                z = 2,053749: φ(z) = 0,048418 e 1 − Φ(z) = 0,02. G = 0,048418 − 2,053749 × 0,02 =
                0,007343. ESC = 11,677 × 0,007343 ≈ 0,0857 unidade por ciclo. β = 1 − 0,0857 ÷ 350 ≈{' '}
                <strong>99,98%</strong>.
              </P>
              <P>
                Por que 98% de ciclo vira mais de 99,9% de peças? Com lotes de 350, há só 1.200 ÷
                350 ≈ 3,4 reposições por ano; em 2% delas falta algo, e quando falta, falta em média
                menos de uma peça diante de 350 compradas. Lotes grandes em relação a σ<sub>LT</sub>{' '}
                fazem o fill rate ficar bem acima do nível de ciclo.
              </P>
            </Exemplo>

            <H3>d) Função de perda da previsão</H3>
            <P>
              &quot;Função de perda&quot; é a regra que diz quanto custa cada erro. O backtest usa
              duas: a perda absoluta (|erro|, que dá o MAE e o WMAPE) e a quadrática (erro², que dá
              o RMSE). A quadrática pune muito mais um erro grande do que vários pequenos. A escolha
              do α da SES é uma pequena otimização: entre 10 candidatos (0,05 a 0,50), fica o que
              minimiza a perda quadrática média dentro do histórico. Com só 10 candidatos, testar
              todos é exato e barato, sem precisar de derivadas. Detalhes e exemplo em{' '}
              <a
                href="#metodologia-previsao"
                className="text-aco-claro underline dark:text-seguranca"
              >
                Previsão e backtest
              </a>
              .
            </P>

            <H3>e) Nível de serviço × custo do estoque de segurança</H3>
            <Formula>
              custo anual do ES = ES(nível) × H = Z(nível) × σ<sub>LT</sub> × H
              <br />
              dES/d(nível) = σ<sub>LT</sub> ÷ φ(Z)
            </Formula>
            <P>
              Cada ponto percentual a mais de nível de serviço custa mais que o anterior, porque
              φ(Z) (a altura da curva em sino) fica cada vez menor na cauda. A ferramenta calcula a
              curva de 80% a 99,9% por item e por célula ABC×XYZ, para ajudar a calibrar a matriz.
            </P>
            <Tabela
              legenda="Curva do item de referência (σ_LT = 11,677; H = R$ 2,50)"
              colunas={['Nível de serviço', 'Z', 'ES (un)', 'Custo anual do ES']}
              linhas={[
                ['80%', '0,8416', '9,83', 'R$ 24,57'],
                ['90%', '1,2816', '14,97', 'R$ 37,41'],
                ['95%', '1,6449', '19,21', 'R$ 48,02'],
                ['98%', '2,0537', '23,98', 'R$ 59,96'],
                ['99%', '2,3263', '27,17', 'R$ 67,91'],
                ['99,9%', '3,0902', '36,09', 'R$ 90,22'],
              ]}
            />
            <P>
              Sair de 95% para 99% aumenta o ES em cerca de <strong>41%</strong> (Z vai de 1,645
              para 2,326; 2,326 ÷ 1,645 = 1,414). Na margem: perto de 95%, um ponto percentual a
              mais custa ≈ 1,1 unidade de ES; perto de 99%, ≈ 4,4 unidades, quase quatro vezes mais.
            </P>

            <H3>f) Matrizes: a BOM como matriz de requisitos totais</H3>
            <Formula>
              B[i][j] = quantidade do item i para fazer 1 unidade do item j (já com perda)
              <br />r = (I − B)⁻¹ × d = (I + B + B² + B³ + …) × d
            </Formula>
            <P>
              d é o vetor da demanda independente (o MPS somado no horizonte). Multiplicar por B
              &quot;desce&quot; um nível da estrutura; B² desce dois, e assim por diante. Somar tudo
              dá o requisito total de cada item. A soma é a versão para matrizes de 1 ÷ (1 − x) = 1
              + x + x² + …, e termina porque uma BOM sem ciclos tem uma potência de B que vale zero.
            </P>
            <Tabela
              legenda="Matriz B do exemplo P → 2 × C1 → 3 × C2 (linha = componente, coluna = pai)"
              colunas={['', 'P', 'C1', 'C2']}
              linhas={[
                ['P', '0', '0', '0'],
                ['C1', '2', '0', '0'],
                ['C2', '0', '3', '0'],
              ]}
            />
            <Exemplo>
              <P>
                d = (10, 0, 0). B × d = (0, 20, 0); B² × d = (0, 0, 60); B³ × d = 0. Logo r = (10,
                20, 60): 10 P, 20 C1 e 60 C2.
              </P>
            </Exemplo>
            <P>
              Isso serve como <strong>conferência</strong> do MRP. Os totais de necessidade bruta do
              MRP batem com r <strong>somente</strong> quando não há estoque nem pedidos em aberto
              dos pais, o ES é zero, a política é lote a lote sem lote mínimo nem múltiplo e todo o
              MPS cai dentro do horizonte. Fora disso, a diferença é esperada e tem explicação: o
              MRP trabalha com necessidades <strong>líquidas</strong> em cada nível (o estoque de C1
              reduz o que se pede de C2), o ES aumenta as ordens, e o lote econômico, o lote mínimo
              e o múltiplo arredondam para cima. Exemplo: se C1 tiver 5 em estoque, o MRP pede 15 C1
              e a necessidade bruta de C2 vira 45, não 60.
            </P>

            <H3>g) Vetores e similaridade de cosseno</H3>
            <Formula>
              perfil = (últimos 12 períodos de demanda) ÷ média desses períodos
              <br />
              cos θ = (a · b) ÷ (‖a‖ × ‖b‖)
            </Formula>
            <P>
              Cada item vira um vetor (uma lista de 12 números). O cosseno mede o ângulo entre dois
              vetores: 1 quando apontam na mesma direção (mesmo formato de consumo, mesmo que em
              escalas diferentes), 0 quando não têm nada em comum. No detalhe do item aparecem até 5
              itens parecidos com cos θ ≥ 0,80, úteis para achar itens que respondem ao mesmo motor
              de demanda e candidatos a compra conjunta. Só entram itens suaves ou erráticos com a
              janela completa; acima de 3.000 itens, a comparação é feita dentro da mesma categoria.
            </P>
            <Exemplo>
              <P>
                [1, 2, 3] e [2, 4, 6] → cos θ = <strong>1,00</strong> (mesmo formato, escala
                dobrada). [1, 0] e [0, 1] → <strong>0,00</strong>. [1, 1] e [1, 0] →{' '}
                <strong>0,7071</strong> (45°).
              </P>
            </Exemplo>
            <Nota titulo="Leia com cautela">
              <P>
                Dividir pela média deixa o perfil &quot;sem unidade&quot;, mas não muda o cosseno:
                ele já ignora a escala. E, como demandas são números positivos, o cosseno entre dois
                itens quaisquer tende a ser alto. Por exemplo, [100, 120, 80] e [80, 100, 120] têm
                tendências opostas e mesmo assim cos θ = 0,96. Portanto o corte de 0,80 é um filtro
                frouxo: a lista de parecidos é uma <strong>primeira pista</strong> para investigar,
                não uma prova de que os itens andam juntos. (Uma medida mais exigente seria subtrair
                a média antes, o que dá a correlação de Pearson.)
              </P>
            </Nota>
            <P>
              Ficam de fora, de propósito: softmax, embeddings e descida do gradiente como
              algoritmo. Eles pertencem a modelos de linguagem e redes neurais e não acrescentam
              nada a problemas que já têm solução exata ou estatística.
            </P>
          </Secao>

          {/* ------------------------------------------------------------ 13 */}
          <Secao slug="qualidade">
            <P>
              Antes de calcular, cada linha é validada. <strong>Erros bloqueantes</strong> impedem o
              cálculo e dizem exatamente o que corrigir e em qual linha. <strong>Avisos</strong> não
              impedem: a linha problemática é ignorada ou mantida com uma interpretação, e o aviso
              explica qual.
            </P>
            <Tabela
              legenda="Regras de validação dos dados de entrada"
              colunas={['Regra', 'Gravidade', 'O que acontece']}
              linhas={[
                ['Aba Materiais vazia', 'Erro bloqueante', 'Nada é calculado.'],
                ['Material sem código', 'Erro bloqueante', 'Preencher o código ou apagar a linha.'],
                [
                  'Código duplicado no cadastro',
                  'Erro bloqueante',
                  'Cada item precisa de código único; as duas linhas são indicadas.',
                ],
                [
                  'Estoque atual vazio ou não numérico',
                  'Erro bloqueante',
                  'Informe o saldo físico (pode ser 0).',
                ],
                [
                  'Coluna obrigatória ausente',
                  'Erro bloqueante',
                  'Abre a tela de mapeamento de colunas; o cálculo só roda com as colunas obrigatórias.',
                ],
                ['Movimentação de código sem cadastro', 'Aviso', 'Linha ignorada.'],
                ['Data inválida', 'Aviso', 'Linha ignorada.'],
                [
                  'Data posterior à data-base',
                  'Aviso',
                  'Linha ignorada. Só ocorre se a data-base for editada, pois o padrão é a última movimentação.',
                ],
                [
                  'Quantidade zero, negativa ou não numérica',
                  'Aviso',
                  'Linha ignorada (o sinal vem do tipo, não da quantidade).',
                ],
                ['Tipo de movimento desconhecido', 'Aviso', 'Linha ignorada.'],
                [
                  'Tipo de movimento ambíguo',
                  'Aviso',
                  '"Devolução" sem destino vira devolução ao estoque; códigos SAP são traduzidos. Linha mantida.',
                ],
                [
                  'Item sem custo',
                  'Aviso',
                  'Custo 0: fora da ABC por valor, lote = 1 período de demanda, lista de pendências.',
                ],
                ['Item sem lead time', 'Aviso', 'Usa o padrão de 30 dias (vazio ou negativo).'],
                [
                  'Saldo reconstruído negativo',
                  'Aviso',
                  'Movimento faltando ou estoque atual errado; o cálculo segue.',
                ],
                [
                  'Linha duplicada em movimentações',
                  'Aviso',
                  'Mesmo código, data, tipo, quantidade, valor e documento. Linha mantida: confira se não foi lançada duas vezes.',
                ],
                [
                  'Pedido em aberto inválido',
                  'Aviso',
                  'Sem cadastro, data inválida ou quantidade não positiva: linha ignorada.',
                ],
                [
                  'Linha de BOM inválida',
                  'Aviso',
                  'Pai ou filho vazio, item componente de si mesmo, quantidade não positiva ou perda inválida: linha ignorada.',
                ],
                [
                  'BOM circular',
                  'Aviso',
                  'O MRP não é calculado; o resto da análise segue normalmente.',
                ],
                [
                  'Linha de MPS inválida',
                  'Aviso',
                  'Código vazio, semana inválida ou quantidade não positiva: linha ignorada.',
                ],
              ]}
            />
            <Formula>
              qualidade dos dados = linhas válidas ÷ total de linhas (Materiais + Movimentações +
              Pedidos + BOM + MPS)
            </Formula>
            <P>
              Linhas ignoradas contam como inválidas; linhas mantidas com aviso (duplicada, tipo
              ambíguo) continuam válidas.
            </P>
          </Secao>

          {/* ------------------------------------------------------------ 14 */}
          <Secao slug="parametros-padrao">
            <P>
              Todos os parâmetros podem ser alterados no painel lateral. Os valores padrão, e o
              motivo de cada um:
            </P>
            <Tabela
              legenda="Parâmetros globais e seus valores padrão"
              colunas={['Parâmetro', 'Padrão', 'Por que esse valor']}
              linhas={[
                [
                  'Período de análise',
                  'Mensal (alternativa: semanal)',
                  'O mês suaviza o ruído para ABC e XYZ.',
                ],
                [
                  'Janela de histórico',
                  'Últimos 12 períodos completos',
                  'Um ano captura a sazonalidade anual (no modo semanal, 12 períodos são 12 semanas).',
                ],
                [
                  'Excluir período corrente incompleto',
                  'Sim',
                  'Um mês parcial subestima a demanda.',
                ],
                ['Data-base', 'Data da última movimentação', 'Editável.'],
                [
                  'Cortes ABC (valor acumulado)',
                  'A < 80%, B < 95%, C restante',
                  'Pareto clássico 80/15/5.',
                ],
                [
                  'Cortes XYZ (CV)',
                  'X ≤ 0,50; Y ≤ 1,00; Z > 1,00',
                  'Faixas usuais para dados mensais.',
                ],
                [
                  'Cortes Syntetos-Boylan',
                  'ADI 1,32; CV² 0,49',
                  'Valores publicados por Syntetos, Boylan e Croston (2005).',
                ],
                [
                  'Mínimo de períodos com dados',
                  '3',
                  'Abaixo disso, desvio e CV não são confiáveis: "Histórico insuficiente".',
                ],
                [
                  'Previsão de suaves/erráticos',
                  'Média móvel de 6 períodos',
                  'Reage a mudanças sem ser nervosa.',
                ],
                [
                  'Previsão de intermitentes/irregulares',
                  'SBA, α = 0,10',
                  'A média simples erra muito com muitos zeros.',
                ],
                [
                  'Método de previsão',
                  'Regra fixa (alternativa: automático)',
                  'Previsível e fácil de auditar; o automático escolhe pelo menor MAE.',
                ],
                [
                  'Dias por período',
                  '30 (mensal) / 7 (semanal)',
                  'O lead time é informado em dias corridos.',
                ],
                [
                  'Períodos por ano',
                  '12 (mensal) / 52 (semanal)',
                  'Usado em toda anualização (D, giro, ABC).',
                ],
                [
                  'Custo de emissão do pedido (S)',
                  'R$ 100,00',
                  'Valor provisório: informe o custo real da sua empresa.',
                ],
                [
                  'Taxa de manutenção de estoque (i)',
                  '25% ao ano',
                  'Faixa usual da literatura: 20% a 30% ao ano.',
                ],
                [
                  'Dias sem saída para "sem giro"',
                  '180',
                  'Seis meses parado indica risco de obsolescência.',
                ],
                [
                  'Abater devoluções ao estoque da demanda',
                  'Sim',
                  'Material requisitado e devolvido não foi consumido.',
                ],
                [
                  'Lead time padrão (item sem lead time)',
                  '30 dias',
                  'Evita parar o cálculo; vem sempre com aviso.',
                ],
                ['Horizonte do MRP', '12 semanas', 'Cerca de um trimestre.'],
                [
                  'Política de lote no MRP',
                  'Lote econômico (alternativas: lote a lote, período fixo)',
                  'Coerente com o Q* dos parâmetros de reposição.',
                ],
                ['Semanas por pedido (período fixo)', '4', 'Aproximadamente um pedido por mês.'],
                [
                  'Matriz de nível de serviço',
                  'AX 98% … CZ 85% (ver Parâmetros de reposição)',
                  'Mais proteção onde faltar custa caro e a demanda é previsível.',
                ],
              ]}
            />
            <P>
              Alguns valores são fixos no cálculo: backtest nos últimos 6 períodos; grade do α da
              SES de 0,05 a 0,50; similaridade com corte 0,80, até 5 itens e comparação por
              categoria acima de 3.000 itens; curva de nível de serviço de 80% a 99,9%.
            </P>
          </Secao>

          {/* ------------------------------------------------------------ 15 */}
          <Secao slug="glossario">
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
              {GLOSSARIO.map(([termo, definicao]) => (
                <div key={termo} className="contents">
                  <dt className="font-semibold text-marinho dark:text-concreto">{termo}</dt>
                  <dd className="mb-2 max-w-prose leading-relaxed sm:mb-0">{definicao}</dd>
                </div>
              ))}
            </dl>
          </Secao>

          {/* ------------------------------------------------------------ 16 */}
          <Secao slug="referencias">
            <ol className="my-3 max-w-prose list-decimal space-y-2 pl-6 leading-relaxed">
              <li>
                CROSTON, J. D. Forecasting and stock control for intermittent demands.{' '}
                <em>Operational Research Quarterly</em>, v. 23, n. 3, p. 289–303, 1972.
              </li>
              <li>
                SYNTETOS, A. A.; BOYLAN, J. E. The accuracy of intermittent demand estimates.{' '}
                <em>International Journal of Forecasting</em>, v. 21, n. 2, p. 303–314, 2005.
                (Origem do SBA.)
              </li>
              <li>
                SYNTETOS, A. A.; BOYLAN, J. E.; CROSTON, J. D. On the categorization of demand
                patterns. <em>Journal of the Operational Research Society</em>, v. 56, n. 5, p.
                495–503, 2005. (Cortes ADI 1,32 e CV² 0,49.)
              </li>
              <li>
                HARRIS, F. W. How many parts to make at once.{' '}
                <em>Factory, The Magazine of Management</em>, v. 10, n. 2, p. 135–136, 152, 1913.
                WILSON, R. H. A scientific routine for stock control.{' '}
                <em>Harvard Business Review</em>, v. 13, p. 116–128, 1934. (Lote econômico.)
              </li>
              <li>
                ACKLAM, P. J.{' '}
                <em>
                  An algorithm for computing the inverse normal cumulative distribution function
                </em>
                . Nota técnica do autor, 2003. (Inverso da normal usado para Z.)
              </li>
              <li>
                SILVER, E. A.; PYKE, D. F.; THOMAS, D. J.{' '}
                <em>Inventory and Production Management in Supply Chains</em>. 4. ed. Boca Raton:
                CRC Press, 2017. (Estoque de segurança, função de perda normal, fill rate e MRP.)
              </li>
            </ol>
          </Secao>
        </div>
      </div>
    </div>
  )
}
