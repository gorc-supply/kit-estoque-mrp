import { useMemo } from 'react'
import FiltrosItens from '../components/FiltrosItens'
import TabelaDados, { type Coluna } from '../components/TabelaDados'
import { Cartao, SeloABC, SeloStatus, SeloXYZ } from '../components/ui'
import { arredondarQuantidade } from '../engine/estatistica'
import type { ItemResultado } from '../engine/tipos'
import { aplicarFiltro, type Filtro } from '../lib/filtros'
import { dias, moeda, numFixo, pct, qtd } from '../lib/formato'
import type { PropsAba } from './tipos'

const arred = (i: ItemResultado, v: number | null) =>
  v === null ? null : arredondarQuantidade(v, i.unidadeDiscreta)

export default function Reposicao({
  resultado: r,
  abrirItem,
  filtro,
  aoMudarFiltro,
}: PropsAba & { filtro: Filtro; aoMudarFiltro: (f: Filtro) => void }) {
  const filtrados = useMemo(() => aplicarFiltro(r.itens, filtro), [r.itens, filtro])
  const q = (i: ItemResultado, v: number | null) =>
    v === null ? '—' : qtd(v, i.unidade, i.unidadeDiscreta)
  const colunas = useMemo<Coluna<ItemResultado>[]>(
    () => [
      {
        id: 'codigo',
        titulo: 'Código',
        valor: (i) => i.codigo,
        render: (i) => <span className="font-mono">{i.codigo}</span>,
      },
      {
        id: 'descricao',
        titulo: 'Descrição',
        valor: (i) => i.descricao,
        render: (i) => (
          <span className="block max-w-56 truncate" title={i.descricao}>
            {i.descricao}
          </span>
        ),
      },
      {
        id: 'abc',
        titulo: 'ABC',
        valor: (i) => i.classeABC,
        render: (i) => <SeloABC c={i.classeABC} />,
      },
      {
        id: 'xyz',
        titulo: 'XYZ',
        valor: (i) => i.classeXYZ,
        render: (i) => <SeloXYZ c={i.classeXYZ} />,
      },
      {
        id: 'status',
        titulo: 'Status',
        valor: (i) => i.status,
        render: (i) => <SeloStatus s={i.status} />,
      },
      {
        id: 'estoque',
        titulo: 'Estoque',
        numerica: true,
        valor: (i) => i.estoqueAtual,
        render: (i) => q(i, i.estoqueAtual),
      },
      {
        id: 'posicao',
        titulo: 'Posição',
        numerica: true,
        valor: (i) => i.posicao,
        render: (i) => q(i, i.posicao),
        ajuda: 'Estoque atual + pedidos em aberto',
      },
      {
        id: 'f',
        titulo: 'Previsão',
        numerica: true,
        valor: (i) => i.previsao,
        render: (i) => numFixo(i.previsao, 2),
        ajuda: 'Demanda prevista por período (F)',
      },
      { id: 'metodo', titulo: 'Método', valor: (i) => i.metodo },
      {
        id: 'nivel',
        titulo: 'Nível',
        numerica: true,
        valor: (i) => i.nivelServico,
        render: (i) => pct(i.nivelServico, 1),
        ajuda: 'Nível de serviço alvo (matriz ABC×XYZ)',
      },
      {
        id: 'es',
        titulo: 'ES',
        numerica: true,
        valor: (i) => i.estoqueSeguranca,
        csv: (i) => arred(i, i.estoqueSeguranca),
        render: (i) =>
          i.estoqueSeguranca === null ? (
            <span className="text-concreto-escuro" title={i.revisaoManual.join('; ')}>
              revisão
            </span>
          ) : (
            <span title={i.esManual ? 'ES manual' : undefined}>
              {q(i, i.estoqueSeguranca)}
              {i.esManual ? '*' : ''}
            </span>
          ),
        ajuda: 'Estoque de segurança = Z × σ × √LTₚ',
      },
      {
        id: 'pp',
        titulo: 'PP',
        numerica: true,
        valor: (i) => i.pontoPedido,
        csv: (i) => arred(i, i.pontoPedido),
        render: (i) => q(i, i.pontoPedido),
        ajuda: 'Ponto de pedido = F × LTₚ + ES',
      },
      {
        id: 'eoq',
        titulo: 'EOQ',
        numerica: true,
        valor: (i) => i.eoq,
        render: (i) => (i.eoq === null ? 'n/a' : numFixo(i.eoq, 1)),
        ajuda: 'Lote econômico √(2DS/H)',
      },
      {
        id: 'q',
        titulo: 'Q*',
        numerica: true,
        valor: (i) => i.loteCompra,
        render: (i) => q(i, i.loteCompra),
        ajuda: 'Lote ajustado ao mínimo e ao múltiplo',
      },
      {
        id: 'max',
        titulo: 'Máx',
        numerica: true,
        valor: (i) => i.estoqueMaximo,
        csv: (i) => arred(i, i.estoqueMaximo),
        render: (i) => q(i, i.estoqueMaximo),
        ajuda: 'Estoque máximo = ES + Q*',
      },
      {
        id: 'cobertura',
        titulo: 'Cobertura',
        numerica: true,
        valor: (i) => (Number.isFinite(i.coberturaDias) ? i.coberturaDias : 1e12),
        csv: (i) => i.coberturaDias,
        render: (i) => (
          <span className={i.riscoAntesChegada ? 'font-semibold text-critico' : ''}>
            {dias(i.coberturaDias)}
          </span>
        ),
      },
      {
        id: 'lt',
        titulo: 'LT',
        numerica: true,
        valor: (i) => i.leadTimeDias,
        render: (i) => dias(i.leadTimeDias),
      },
      {
        id: 'giro',
        titulo: 'Giro',
        numerica: true,
        valor: (i) => i.giro,
        render: (i) => (i.giro === null ? '—' : `${numFixo(i.giro, 1)}×`),
      },
      {
        id: 'custo',
        titulo: 'Custo',
        numerica: true,
        valor: (i) => i.custo,
        render: (i) => moeda(i.custo),
      },
      {
        id: 'sugestao',
        titulo: 'Sugestão',
        numerica: true,
        valor: (i) => i.sugestaoQtd,
        render: (i) => (i.sugestaoQtd > 0 ? q(i, i.sugestaoQtd) : '—'),
      },
      {
        id: 'fill',
        titulo: 'Fill rate',
        numerica: true,
        valor: (i) => i.fillRate,
        render: (i) => pct(i.fillRate, 2),
      },
      {
        id: 'pfalta',
        titulo: 'P(faltar)',
        numerica: true,
        valor: (i) => i.probFaltarAntesChegada,
        render: (i) => pct(i.probFaltarAntesChegada),
        ajuda: 'Probabilidade de faltar antes da próxima chegada, a partir da posição atual',
      },
      { id: 'categoria', titulo: 'Categoria', valor: (i) => i.categoria },
      { id: 'fornecedor', titulo: 'Fornecedor', valor: (i) => i.fornecedor },
    ],
    [],
  )
  return (
    <Cartao titulo="Parâmetros de reposição por item">
      <div className="flex flex-col gap-3">
        <FiltrosItens itens={r.itens} filtro={filtro} aoMudar={aoMudarFiltro} />
        <TabelaDados
          rotulo="Parâmetros de reposição"
          dados={filtrados}
          colunas={colunas}
          chave={(i) => i.codigo}
          aoClicarLinha={(i) => abrirItem(i.codigo)}
          nomeCSV="parametros-reposicao"
          ordenacaoInicial={[{ id: 'status', desc: false }]}
          alturaMax={640}
        />
        <p className="text-xs text-concreto-escuro dark:text-concreto/70">
          ES, PP e Máx arredondados para cima em unidades discretas. * = estoque de segurança
          manual. Clique numa linha para ver o cálculo.
        </p>
      </div>
    </Cartao>
  )
}
