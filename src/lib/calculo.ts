// "Ver o cálculo": passo a passo de cada número do item, com fórmula, valores e resultado.

import { NOME_VED, rotuloCriticidade } from '../engine/multicriterio'
import type { ItemResultado, Resultado } from '../engine/tipos'
import { data, dias, moeda, num, numFixo, pct, qtd } from './formato'

export interface Passo {
  titulo: string
  formula: string
  conta: string
  resultado: string
  nota?: string
  ancora?: string
}

export interface GrupoPassos {
  titulo: string
  passos: Passo[]
}

const ORIGEM_CUSTO = {
  cadastro: 'custo_unitario do cadastro',
  media_entradas: 'custo médio ponderado das entradas na janela',
  ultima_entrada: 'último custo de entrada conhecido',
  sem_custo: 'sem custo (nem cadastro, nem entradas com valor)',
}

export function montarCalculo(i: ItemResultado, r: Resultado): GrupoPassos[] {
  const p = r.parametros
  const ppa = r.janela.periodosPorAno
  const dpp = r.janela.diasPorPeriodo
  const per = r.janela.periodicidade === 'mensal' ? 'mês' : 'semana'
  const u = (v: number | null) => (v === null ? '—' : qtd(v, i.unidade, i.unidadeDiscreta))
  const n2 = (v: number | null | undefined) => numFixo(v, 2)
  const grupos: GrupoPassos[] = []

  // 1. Série e custo
  grupos.push({
    titulo: 'Série de demanda e custo',
    passos: [
      {
        titulo: 'Períodos considerados',
        formula: 'n = períodos desde o início do item (máx. janela)',
        conta: `início = ${r.janela.rotulos[i.inicioSerie] ?? '—'} · janela ${r.janela.rotulos[0]} → ${r.janela.rotulos.at(-1)}`,
        resultado: `n = ${i.n}`,
        nota: i.historicoInsuficiente
          ? `Menos de ${p.minPeriodos} períodos: histórico insuficiente.`
          : undefined,
        ancora: 'series',
      },
      {
        titulo: 'Demanda média',
        formula: 'd̄ = Σdₜ ÷ n',
        conta: `${num(i.consumoQtd, 2)} ÷ ${i.n}`,
        resultado: `d̄ = ${n2(i.media)} ${i.unidade}/${per}`,
      },
      {
        titulo: 'Desvio padrão amostral',
        formula: 'σ = √( Σ(dₜ − d̄)² ÷ (n − 1) )',
        conta: `série: ${i.serie.map((d) => num(d, 2)).join('; ')}`,
        resultado: `σ = ${n2(i.desvio)}`,
      },
      {
        titulo: 'Custo unitário',
        formula: 'cadastro → média das entradas → última entrada',
        conta: ORIGEM_CUSTO[i.origemCusto],
        resultado: moeda(i.custo),
        ancora: 'custo',
      },
    ],
  })

  // 2. Classificação
  grupos.push({
    titulo: 'Classificação ABC e XYZ',
    passos: [
      {
        titulo: 'Consumo anual em valor',
        formula: `Cv_anual = d̄ × custo × ${ppa}`,
        conta: `${n2(i.media)} × ${moeda(i.custo)} × ${ppa}`,
        resultado: moeda(i.consumoAnualValor),
        ancora: 'abc',
      },
      {
        titulo: 'Classe ABC',
        formula: `A se % acumulado anterior < ${pct(p.corteA, 0)}; B se < ${pct(p.corteB, 0)}`,
        conta: `posição ${i.posicaoABC} · acumulado anterior ${pct(i.pctAcumuladoAnterior)}`,
        resultado: `Classe ${i.classeABC}`,
      },
      {
        titulo: 'Coeficiente de variação',
        formula: 'CV = σ ÷ d̄',
        conta: i.media > 0 ? `${n2(i.desvio)} ÷ ${n2(i.media)}` : 'd̄ = 0',
        resultado:
          i.classeXYZ === 'Novo'
            ? 'XYZ = Novo (histórico insuficiente)'
            : i.classeXYZ === 'N'
              ? 'XYZ = N (sem demanda)'
              : `CV = ${numFixo(i.cv, 3)} → ${i.classeXYZ} (X ≤ ${n2(p.corteX)}; Y ≤ ${n2(p.corteY)})`,
        ancora: 'xyz',
      },
      ...(i.adi !== null
        ? [
            {
              titulo: 'Padrão de demanda (Syntetos-Boylan)',
              formula: 'ADI = n ÷ períodos com demanda; CV² dos tamanhos não nulos',
              conta: `ADI = ${n2(i.adi)} (corte ${n2(p.corteADI)}) · CV² = ${n2(i.cv2)} (corte ${n2(p.corteCV2)})`,
              resultado: i.padrao ?? '—',
            },
          ]
        : []),
    ],
  })

  // 2-B. ABC multicritério (seção 16-B)
  const mc = i.multicriterio
  if (mc && r.multicriterio) {
    const cfg = r.multicriterio.config
    const passosMC: Passo[] = []
    if (mc.score !== null) {
      mc.criterios.forEach((k, idx) => {
        const invertido = k.id === 'fornecedores' ? ', invertido (menor = mais crítico)' : ''
        passosMC.push({
          titulo: `Critério: ${k.nome}`,
          formula:
            k.id === 'criticidade' || k.id === 'substituto'
              ? 'categórico: Alta / sem substituto = 1 · Média = 0,5 · Baixa / com substituto = 0'
              : cfg.normalizacao === 'minmax'
                ? `mín-máx = (x − mín) ÷ (máx − mín)${invertido}`
                : `posto percentil = (posição − 1) ÷ (n − 1)${invertido}`,
          conta: k.faltando
            ? 'dado faltando: valor neutro 0,5'
            : `bruto ${typeof k.bruto === 'number' ? num(k.bruto, 2) : k.bruto} → normalizado ${numFixo(k.normalizado, 3)}; peso ${pct(k.peso, 1)}`,
          resultado: `contribuição +${numFixo(k.contribuicao, 3)}`,
          ancora: idx === 0 ? 'multicriterio' : undefined,
        })
      })
      passosMC.push({
        titulo: 'Score multicritério',
        formula: 'S = Σ pesoₖ × normalizadoₖ',
        conta: mc.criterios
          .map((k) => `${pct(k.peso, 0)} × ${numFixo(k.normalizado, 2)}`)
          .join(' + '),
        resultado: `S = ${numFixo(mc.score, 3)} → posição ${mc.posicao}`,
      })
      passosMC.push({
        titulo: 'Classe calculada',
        formula:
          cfg.metodoClasses === 'mesma_contagem'
            ? 'mesma quantidade de A/B/C do ABC por valor, pela ordem do score'
            : cfg.metodoClasses === 'percentual'
              ? `${pct(cfg.percentuais.A, 0)} dos itens em A e ${pct(cfg.percentuais.B, 0)} em B, pela ordem do score`
              : `A se S ≥ ${numFixo(cfg.cortes.A, 2)}; B se S ≥ ${numFixo(cfg.cortes.B, 2)}`,
        conta: `classe por valor ${mc.classeValor}`,
        resultado: `classe calculada ${mc.classeCalculada}`,
        nota:
          mc.estabilidade !== null
            ? `Estável em ${pct(mc.estabilidade, 0)} das ${cfg.simulacoes} simulações com pesos perturbados em até ±${num(cfg.perturbacao * 100)} p.p.`
            : undefined,
      })
    } else {
      passosMC.push({
        titulo: 'Matriz VED',
        formula: 'classe final = matriz[classe por valor][V/E/D]',
        conta: `valor ${mc.classeValor} × criticidade ${rotuloCriticidade(mc.criticidade)} (${NOME_VED[mc.ved]})`,
        resultado: `classe ${mc.classeCalculada}`,
        ancora: 'multicriterio',
      })
    }
    if (mc.regraAplicada || mc.manual) {
      passosMC.push({
        titulo: mc.manual ? 'Classe manual' : 'Regra de piso',
        formula: mc.manual
          ? 'classe_manual do cadastro prevalece sobre tudo'
          : (mc.regraAplicada ?? ''),
        conta: mc.manual
          ? (mc.justificativa ?? 'sem justificativa')
          : `calculada ${mc.classeCalculada}`,
        resultado: `classe final ${mc.classeFinal}`,
      })
    }
    passosMC.push({
      titulo: 'Resultado',
      formula:
        'a classe final substitui a de valor no nível de serviço, nas prioridades e nos KPIs',
      conta: mc.motivo,
      resultado: `classe final ${mc.classeFinal}`,
    })
    grupos.push({ titulo: 'Classificação multicritério', passos: passosMC })
  }

  // 3. Previsão
  grupos.push({
    titulo: 'Previsão',
    passos: [
      {
        titulo: `Método: ${i.metodo}`,
        formula:
          i.metodo === 'SBA'
            ? 'F = (1 − α/2) × z ÷ p'
            : i.metodo === 'SES'
              ? 'Fₜ₊₁ = α·dₜ + (1 − α)·Fₜ'
              : i.metodo.startsWith('MM')
                ? `F = média dos últimos ${i.metodo.slice(2)} períodos`
                : i.metodo === 'Média do histórico'
                  ? 'F = d̄'
                  : 'F = 0',
        conta: i.motivoMetodo + (i.alphaSES !== null ? ` (α = ${n2(i.alphaSES)})` : ''),
        resultado: `F = ${n2(i.previsao)} ${i.unidade}/${per}`,
        nota:
          i.wmape !== null ? `Backtest: WMAPE ${pct(i.wmape)} · viés ${pct(i.vies)}` : undefined,
        ancora: 'previsao',
      },
    ],
  })

  // 4. Parâmetros
  const ltp = `LTₚ = ${num(i.leadTimeDias, 2)} ÷ ${dpp} = ${n2(i.ltPeriodos)}`
  const passosParam: Passo[] = []
  if (i.esManual) {
    passosParam.push({
      titulo: 'Estoque de segurança',
      formula: 'ES informado no cadastro',
      conta: 'estoque_seguranca_manual',
      resultado: u(i.estoqueSeguranca),
      ancora: 'parametros',
    })
  } else if (i.estoqueSeguranca !== null && i.nivelServico !== null && i.z !== null) {
    passosParam.push({
      titulo: 'Fator de segurança',
      formula: 'Z = NORM.S.INV(nível de serviço)',
      conta: `nível ${i.classeABC}${i.classeXYZ} = ${pct(i.nivelServico)}`,
      resultado: `Z = ${numFixo(i.z, 6)}`,
      ancora: 'parametros',
    })
    passosParam.push(
      i.desvioLeadTimeDias !== null
        ? {
            titulo: 'Estoque de segurança (com variabilidade de prazo)',
            formula: 'ES = Z × √( LTₚ × σ² + F² × σ_LTₚ² )',
            conta: `${ltp}; σ_LTₚ = ${num(i.desvioLeadTimeDias, 2)} ÷ ${dpp}; ${numFixo(i.z, 4)} × √(${n2(i.ltPeriodos)} × ${n2(i.desvio)}² + ${n2(i.previsao)}² × ${n2(i.desvioLeadTimeDias / dpp)}²)`,
            resultado: `ES = ${n2(i.estoqueSeguranca)} → ${u(i.estoqueSeguranca)}`,
          }
        : {
            titulo: 'Estoque de segurança',
            formula: 'ES = Z × σ × √LTₚ',
            conta: `${ltp}; ${numFixo(i.z, 4)} × ${n2(i.desvio)} × √${n2(i.ltPeriodos)}`,
            resultado: `ES = ${n2(i.estoqueSeguranca)} → ${u(i.estoqueSeguranca)}`,
          },
    )
  } else {
    passosParam.push({
      titulo: 'Estoque de segurança',
      formula: 'não calculado',
      conta: i.revisaoManual.join('; ') || 'sem demanda ou histórico insuficiente',
      resultado: '— (revisão manual)',
      ancora: 'parametros',
    })
  }
  if (i.pontoPedido !== null)
    passosParam.push({
      titulo: 'Ponto de pedido',
      formula: 'PP = F × LTₚ + ES',
      conta: `${n2(i.previsao)} × ${n2(i.ltPeriodos)} + ${n2(i.estoqueSeguranca ?? 0)}`,
      resultado: `PP = ${n2(i.pontoPedido)} → ${u(i.pontoPedido)}`,
    })
  passosParam.push({
    titulo: 'Demanda anual',
    formula: `D = F × ${ppa}`,
    conta: `${n2(i.previsao)} × ${ppa}`,
    resultado: `D = ${n2(i.demandaAnual)}`,
  })
  passosParam.push({
    titulo: 'Custo de manter uma unidade por ano',
    formula: 'H = i × custo',
    conta: `${pct(p.taxaManutencaoAnual)} × ${moeda(i.custo)}`,
    resultado: `H = ${moeda(i.custoManutencao)}`,
  })
  passosParam.push(
    i.eoq !== null
      ? {
          titulo: 'Lote econômico',
          formula: 'EOQ = √( 2 × D × S ÷ H )',
          conta: `√(2 × ${n2(i.demandaAnual)} × ${moeda(p.custoPedido)} ÷ ${moeda(i.custoManutencao)})`,
          resultado: `EOQ = ${n2(i.eoq)}`,
        }
      : {
          titulo: 'Lote econômico',
          formula: 'EOQ = √( 2 × D × S ÷ H )',
          conta: 'D = 0 ou H = 0',
          resultado: 'não se aplica',
        },
  )
  if (i.loteCompra !== null)
    passosParam.push({
      titulo: 'Lote de compra ajustado',
      formula:
        i.origemLote === 'eoq'
          ? 'Q* = max(lote mínimo, ⌈EOQ ÷ múltiplo⌉ × múltiplo)'
          : i.origemLote === 'um_periodo'
            ? 'Q* = max(lote mínimo, ⌈F ÷ múltiplo⌉ × múltiplo)'
            : 'Q* = lote mínimo ou 1 múltiplo',
      conta: `lote mínimo ${num(i.loteMinimo, 2)}; múltiplo ${num(i.multiploCompra, 2)}`,
      resultado: `Q* = ${u(i.loteCompra)}`,
      nota:
        i.origemLote === 'um_periodo'
          ? 'EOQ não se aplica: o lote cobre um período de demanda.'
          : undefined,
    })
  if (i.estoqueMaximo !== null)
    passosParam.push({
      titulo: 'Estoque máximo',
      formula: 'Máx = ES + Q*',
      conta: `${n2(i.estoqueSeguranca ?? 0)} + ${n2(i.loteCompra)}`,
      resultado: `Máx = ${n2(i.estoqueMaximo)} → ${u(i.estoqueMaximo)}`,
    })
  passosParam.push({
    titulo: 'Consumo diário',
    formula: 'F ÷ dias por período',
    conta: `${n2(i.previsao)} ÷ ${dpp}`,
    resultado: `${numFixo(i.consumoDiario, 3)} ${i.unidade}/dia`,
  })
  passosParam.push({
    titulo: 'Cobertura',
    formula: 'estoque atual ÷ consumo diário',
    conta: `${num(i.estoqueAtual, 2)} ÷ ${numFixo(i.consumoDiario, 3)}`,
    resultado: dias(i.coberturaDias),
  })
  grupos.push({ titulo: 'Parâmetros de reposição', passos: passosParam })

  // 5. Reposição
  const passosRep: Passo[] = [
    {
      titulo: 'Posição de estoque',
      formula: 'posição = estoque atual + pedidos em aberto',
      conta: `${num(i.estoqueAtual, 2)} + ${num(i.pedidosAbertos, 2)}`,
      resultado: u(i.posicao),
      ancora: 'reposicao',
    },
    {
      titulo: 'Status',
      formula:
        'Ruptura → Crítico → Comprar → Excesso → Sem giro → Sem demanda → OK (o primeiro que bater)',
      conta: `estoque ${num(i.estoqueAtual, 2)}; ES ${n2(i.estoqueSeguranca)}; PP ${n2(i.pontoPedido)}; Máx ${n2(i.estoqueMaximo)}; dias sem saída ${i.diasSemSaida ?? '—'}`,
      resultado: i.status,
    },
  ]
  if (i.sugestaoQtd > 0)
    passosRep.push({
      titulo: 'Sugestão de compra',
      formula: 'Qtd = max(lote mínimo, ⌈(Máx − posição) ÷ múltiplo⌉ × múltiplo)',
      conta: `⌈(${n2(i.estoqueMaximo)} − ${n2(i.posicao)}) ÷ ${num(i.multiploCompra, 2)}⌉ × ${num(i.multiploCompra, 2)}`,
      resultado: `${u(i.sugestaoQtd)} · ${moeda(i.sugestaoValor)} · chegada ${data(i.dataChegada)}`,
      nota: `${i.motivo}. Prioridade ${i.prioridade}${i.riscoAntesChegada ? ' (cobertura menor que o lead time)' : ''}.`,
    })
  grupos.push({ titulo: 'Posição, status e compra', passos: passosRep })

  // 6. Saldo e giro
  grupos.push({
    titulo: 'Saldo reconstruído e giro',
    passos: [
      {
        titulo: 'Saldo no início da série',
        formula: 'estoque atual − entradas + saídas … (movimentos desfeitos de trás para frente)',
        conta: `fim de cada período: ${i.saldosFimPeriodo.map((s) => num(s, 2)).join('; ')}`,
        resultado: num(i.saldoInicial, 2),
        nota: i.saldoInconsistente
          ? 'Saldo negativo em algum período: falta movimento ou o estoque atual está errado.'
          : undefined,
        ancora: 'giro',
      },
      {
        titulo: 'Estoque médio',
        formula: 'média dos saldos de fim de período',
        conta: `${i.n} períodos`,
        resultado: num(i.estoqueMedio, 2),
      },
      {
        titulo: 'Giro anualizado',
        formula: `(consumo em valor × ${ppa} ÷ n) ÷ (estoque médio × custo)`,
        conta: `(${moeda(i.consumoValor)} × ${ppa} ÷ ${i.n}) ÷ (${num(i.estoqueMedio, 2)} × ${moeda(i.custo)})`,
        resultado: i.giro !== null ? `${n2(i.giro)} voltas/ano` : '—',
      },
    ],
  })

  // 7. Matemática (6.12)
  const passosMat: Passo[] = []
  if (i.custoTotalEOQ !== null && i.custoTotalLote !== null)
    passosMat.push({
      titulo: 'Custo total do lote e penalidade do arredondamento',
      formula: 'CT(Q) = (D ÷ Q) × S + (Q ÷ 2) × H; CT(EOQ) = √(2DSH)',
      conta: `CT(EOQ) = ${moeda(i.custoTotalEOQ)}; CT(Q*) = ${moeda(i.custoTotalLote)}`,
      resultado: `penalidade = ${pct(i.penalidadeArredondamento, 2)}`,
      ancora: 'matematica',
    })
  if (i.probFaltarAntesChegada !== null)
    passosMat.push({
      titulo: 'Probabilidade de faltar antes da chegada',
      formula: '1 − Φ((posição − μ_LT) ÷ σ_LT)',
      conta: `μ_LT = ${n2(i.mediaLT)}; σ_LT = ${n2(i.sigmaLT)}; posição = ${num(i.posicao, 2)}`,
      resultado: pct(i.probFaltarAntesChegada),
      nota: i.probIndicativa
        ? 'Indicativo: para demanda intermitente a Normal é uma aproximação fraca.'
        : undefined,
    })
  if (i.fillRate !== null)
    passosMat.push({
      titulo: 'Fill rate esperado (nível tipo 2)',
      formula: 'β = 1 − σ_LT × G(z) ÷ Q*; G(z) = φ(z) − z(1 − Φ(z))',
      conta: `z = ES ÷ σ_LT = ${numFixo((i.estoqueSeguranca ?? 0) / (i.sigmaLT || 1), 4)}; G(z) = ${numFixo(i.perdaNormalG, 6)}; falta por ciclo = ${numFixo(i.faltaEsperadaCiclo, 4)}`,
      resultado: `β = ${pct(i.fillRate, 2)} (ciclo: ${pct(i.nivelServico ?? 1 - (i.probRupturaCiclo ?? 0))})`,
    })
  if (passosMat.length) grupos.push({ titulo: 'A matemática por trás', passos: passosMat })
  return grupos
}
