import { useCallback, useState } from 'react'
import { opcaoCategoriaClasse } from '../charts/categoria-classe'
import { opcaoEntradasSaidas } from '../charts/entradas-saidas'
import Grafico from '../charts/Grafico'
import { opcaoHistogramaCobertura } from '../charts/histograma-cobertura'
import { opcaoStatus } from '../charts/status-estoque'
import type { CoresGrafico } from '../charts/tema'
import { opcaoTopExcesso, opcaoTopRisco } from '../charts/top10'
import CartaoKPI from '../components/CartaoKPI'
import RelatorioQualidade from '../components/RelatorioQualidade'
import { Botao, Cartao } from '../components/ui'
import type { StatusItem } from '../engine/tipos'
import { moeda, moedaCompacta, num, numFixo, pct } from '../lib/formato'
import type { PropsAba } from './tipos'

function Alternar({
  valor,
  aoMudar,
}: {
  valor: 'itens' | 'valor'
  aoMudar: (v: 'itens' | 'valor') => void
}) {
  return (
    <div
      className="inline-flex rounded-md ring-1 ring-concreto dark:ring-aco"
      role="group"
      aria-label="Métrica"
    >
      {(['itens', 'valor'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={valor === v}
          onClick={() => aoMudar(v)}
          className={`px-2.5 py-1 text-xs first:rounded-l-md last:rounded-r-md ${valor === v ? 'bg-aco-claro text-white' : 'text-slate-600 dark:text-concreto'}`}
        >
          {v === 'itens' ? 'Itens' : 'R$'}
        </button>
      ))}
    </div>
  )
}

export { Alternar }

export default function VisaoGeral({ resultado: r, abrirItem, irPara }: PropsAba) {
  const k = r.kpis
  const [metricaStatus, setMetricaStatus] = useState<'itens' | 'valor'>('itens')
  const itens = r.itens
  const opStatus = useCallback(
    (c: CoresGrafico) => opcaoStatus(itens, metricaStatus, c),
    [itens, metricaStatus],
  )
  const opES = useCallback(
    (c: CoresGrafico) => opcaoEntradasSaidas(r.consolidado, c),
    [r.consolidado],
  )
  const opExcesso = useCallback((c: CoresGrafico) => opcaoTopExcesso(itens, c), [itens])
  const opRisco = useCallback((c: CoresGrafico) => opcaoTopRisco(itens, c), [itens])
  const opHist = useCallback((c: CoresGrafico) => opcaoHistogramaCobertura(itens, c), [itens])
  const opCat = useCallback((c: CoresGrafico) => opcaoCategoriaClasse(itens, c), [itens])
  const porStatus = (s: StatusItem) => irPara('reposicao', { status: s })

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <CartaoKPI
          rotulo="Valor em estoque"
          valor={k.valorEstoque}
          formatar={moedaCompacta}
          detalhe={moeda(k.valorEstoque)}
          formula="Σ estoque atual × custo unitário"
          aoClicar={() => irPara('reposicao', {})}
        />
        <CartaoKPI
          rotulo="SKUs ativos"
          valor={k.skusAtivos}
          formatar={(v) => num(v)}
          detalhe={`de ${num(k.totalItens)} itens`}
          formula="Itens com estoque > 0 ou demanda > 0"
          aoClicar={() => irPara('reposicao', { especial: 'ativos' })}
        />
        <CartaoKPI
          rotulo="Concentração A"
          valor={k.pctValorA}
          formatar={(v) => pct(v)}
          detalhe={`do consumo em ${pct(k.pctSkusA)} dos SKUs`}
          formula="% do valor de consumo anual nos itens A e % dos SKUs que são A"
          aoClicar={() => irPara('reposicao', { especial: 'classeA' })}
        />
        <CartaoKPI
          rotulo="Giro anualizado"
          valor={k.giro}
          formatar={(v) => (v === null ? '—' : `${numFixo(v, 1)}×`)}
          detalhe="vezes por ano"
          formula="CMV anualizado ÷ estoque médio em valor (saldo reconstruído)"
        />
        <CartaoKPI
          rotulo="Cobertura média"
          valor={k.coberturaMediaDias}
          formatar={(v) => (v === null ? '—' : `${num(v)} dias`)}
          formula="Valor em estoque ÷ consumo previsto em valor por dia"
        />
        <CartaoKPI
          rotulo="Itens em ruptura"
          tom="critico"
          valor={k.itensRuptura}
          formatar={(v) => num(v)}
          detalhe={pct(k.pctRuptura)}
          formula="Estoque atual ≤ 0 e previsão > 0"
          aoClicar={() => porStatus('Ruptura')}
        />
        <CartaoKPI
          rotulo="Abaixo do ES"
          tom="critico"
          valor={k.itensCriticos}
          formatar={(v) => num(v)}
          detalhe="status Crítico"
          formula="Estoque atual < estoque de segurança (status Crítico)"
          aoClicar={() => porStatus('Crítico')}
        />
        <CartaoKPI
          rotulo="Risco antes da chegada"
          tom="critico"
          valor={k.riscoAntesChegada}
          formatar={(v) => num(v)}
          detalhe="cobertura < lead time"
          formula="Itens cuja cobertura (dias) é menor que o lead time"
          aoClicar={() => irPara('reposicao', { especial: 'risco' })}
        />
        <CartaoKPI
          rotulo="Itens a comprar"
          tom="atencao"
          valor={k.itensComprar}
          formatar={(v) => num(v)}
          detalhe={moeda(k.valorSugestao)}
          formula="Itens com posição ≤ ponto de pedido e valor total da sugestão"
          aoClicar={() => irPara('compras')}
        />
        <CartaoKPI
          rotulo="Valor em excesso"
          tom="excesso"
          valor={k.valorExcesso}
          formatar={moedaCompacta}
          formula="Σ max(0, estoque − máximo) × custo"
          aoClicar={() => irPara('reposicao', { especial: 'excesso' })}
        />
        <CartaoKPI
          rotulo="Valor sem giro"
          valor={k.valorSemGiro}
          formatar={moedaCompacta}
          detalhe={`sem saída há ≥ ${r.parametros.diasSemGiro} dias`}
          formula="Σ estoque × custo dos itens sem giro"
          aoClicar={() => porStatus('Sem giro')}
        />
        <CartaoKPI
          rotulo="Nível de serviço alvo"
          valor={k.nivelServicoMedio}
          formatar={(v) => pct(v)}
          detalhe="médio ponderado"
          formula="Média do nível de serviço alvo ponderada pelo valor de consumo"
        />
        <CartaoKPI
          rotulo="Erro da previsão"
          valor={k.wmapeMedio}
          formatar={(v) => `WMAPE ${pct(v, 0)}`}
          detalhe={`viés ${pct(k.viesMedio)}`}
          formula="WMAPE = Σ|real − previsto| ÷ Σ real no backtest, ponderado pelo valor de consumo. Viés positivo = previsão acima do real."
        />
        <CartaoKPI
          rotulo="Qualidade dos dados"
          tom={k.qualidadeDados < 0.95 ? 'atencao' : 'ok'}
          valor={k.qualidadeDados}
          formatar={(v) => pct(v)}
          detalhe="linhas válidas"
          formula="% de linhas da planilha aproveitadas no cálculo"
        />
      </div>

      <RelatorioQualidade qualidade={r.qualidade} abrirItem={abrirItem} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao
          titulo="Status do estoque"
          acoes={<Alternar valor={metricaStatus} aoMudar={setMetricaStatus} />}
        >
          <Grafico
            opcao={opStatus}
            descricao={`Distribuição dos ${itens.length} itens por status de estoque.`}
            aoClicar={(p) => p.name && porStatus(p.name as StatusItem)}
          />
        </Cartao>
        <Cartao
          titulo={`Entradas vs saídas por ${r.janela.periodicidade === 'mensal' ? 'mês' : 'semana'}`}
        >
          <Grafico
            opcao={opES}
            descricao="Valor das entradas e saídas por período, com o saldo total reconstruído em estoque."
          />
        </Cartao>
        <Cartao titulo="Top 10 itens em excesso (R$)">
          <Grafico
            opcao={opExcesso}
            descricao="Os dez itens com maior valor acima do estoque máximo."
            aoClicar={(p) => p.name && abrirItem(p.name)}
          />
        </Cartao>
        <Cartao
          titulo="Top 10 risco de ruptura (cobertura × lead time)"
          acoes={
            <Botao variante="fantasma" onClick={() => irPara('reposicao', { especial: 'risco' })}>
              Ver todos
            </Botao>
          }
        >
          <Grafico
            opcao={opRisco}
            descricao="Itens com a menor cobertura em relação ao lead time."
            aoClicar={(p) => p.name && abrirItem(p.name)}
          />
        </Cartao>
        <Cartao titulo="Histograma de cobertura">
          <Grafico
            opcao={opHist}
            descricao="Quantidade de itens por faixa de cobertura em dias, com o lead time médio marcado."
          />
        </Cartao>
        <Cartao titulo="Valor em estoque por categoria e classe">
          <Grafico
            opcao={opCat}
            descricao="Valor em estoque por categoria, empilhado por classe ABC."
            aoClicar={(p) => p.name && irPara('reposicao', { categoria: p.name })}
          />
        </Cartao>
      </div>
    </div>
  )
}
