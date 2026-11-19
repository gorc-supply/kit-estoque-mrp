// Ponto de entrada do motor: processar(entrada, params) → Resultado.

import { classificarABC } from './abc'
import { calcularCusto } from './custo'
import { adicionarDias, diaSerial } from './datas'
import { ehUnidadeDiscreta } from './estatistica'
import { moeda, num } from './formatar'
import { calcularKPIs } from './kpis'
import { calcularMRP, ErroBOMCircular, type ItemMRPEntrada } from './mrp'
import {
  classificarMulticriterio,
  prepararDadosMC,
  type EntradaMC,
  type SaidaMC,
} from './multicriterio'
import { completarParametros } from './padroes'
import { calcularParametros } from './parametros'
import { backtest, metodoRegraFixa, preverCom } from './previsao'
import { montarRelatorio, validarEntrada } from './qualidade'
import { calcularReposicao, ORDEM_PRIORIDADE } from './reposicao'
import { calcularJanela, limitesJanela, montarSerie, type SerieItem } from './series'
import { calcularParecidos, perfilNormalizado } from './similaridade'
import type {
  Alerta,
  AoProgresso,
  CelulaMatriz,
  Entrada,
  ItemResultado,
  KPIs,
  Material,
  NomeMetodo,
  Parametros,
  ProblemaQualidade,
  Resultado,
  ResultadoMRP,
  SerieConsolidada,
} from './tipos'
import { classificarXYZ } from './xyz'

export * from './tipos'
export { PARAMETROS_PADRAO, MATRIZ_NIVEL_PADRAO, completarParametros } from './padroes'

const KPIS_VAZIOS: KPIs = {
  valorEstoque: 0,
  skusAtivos: 0,
  totalItens: 0,
  pctSkusA: 0,
  pctValorA: 0,
  giro: null,
  coberturaMediaDias: null,
  itensRuptura: 0,
  pctRuptura: 0,
  itensCriticos: 0,
  itensComprar: 0,
  valorSugestao: 0,
  valorExcesso: 0,
  valorSemGiro: 0,
  riscoAntesChegada: 0,
  nivelServicoMedio: null,
  qualidadeDados: 0,
  wmapeMedio: null,
  viesMedio: null,
}

const relogio = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** Executa todo o cálculo (seções 6 e 7). Nunca lança: erros vão para `qualidade` ou `erroMRP`. */
export function processar(
  entrada: Entrada,
  parametrosParciais: Partial<Parametros> = {},
  aoProgresso: AoProgresso = () => {},
): Resultado {
  const t0 = relogio()
  const p = completarParametros(parametrosParciais)

  aoProgresso('Validando os dados', 0.05)
  const v = validarEntrada(entrada, p.dataBase, p.leadTimePadraoDias)
  const dataBase = v.dataBase
  const dataBaseDia = diaSerial(dataBase)
  const janela = calcularJanela(dataBaseDia, p)
  const { inicioDia, fimDia } = limitesJanela(janela)
  const L = janela.fim - janela.inicio + 1

  const vazio: Resultado = {
    dataBase,
    parametros: p,
    janela,
    qualidade: v.relatorio,
    itens: [],
    matriz: [],
    kpis: { ...KPIS_VAZIOS, qualidadeDados: v.relatorio.percentualValidas },
    alertas: [],
    mrp: null,
    erroMRP: null,
    consolidado: { rotulos: janela.rotulos, entradasValor: [], saidasValor: [], saldoValor: [] },
    multicriterio: null,
    tempoMs: 0,
  }
  if (v.relatorio.bloqueante) return { ...vazio, tempoMs: relogio() - t0 }

  const problemasExtra: ProblemaQualidade[] = []

  // ---------------------------------------------------------------- séries
  aoProgresso('Montando as séries de demanda', 0.15)
  interface Parcial {
    m: Material
    serie: SerieItem
    custo: ReturnType<typeof calcularCusto>
    xyz: ReturnType<typeof classificarXYZ>
    consumoAnual: number
  }
  const parciais: Parcial[] = []
  for (const m of v.materiais) {
    const movs = v.movimentosPorCodigo.get(m.codigo) ?? []
    const serie = montarSerie(m, movs, janela, dataBaseDia, p.abaterDevolucoes)
    const custo = calcularCusto(m, movs, inicioDia, fimDia)
    const xyz = classificarXYZ(serie.demanda, p)
    const consumoAnual = xyz.media * custo.custo * janela.periodosPorAno
    parciais.push({ m, serie, custo, xyz, consumoAnual })
  }

  // ---------------------------------------------------------------- ABC
  aoProgresso('Classificando ABC e XYZ', 0.3)
  const abc = new Map(
    classificarABC(
      parciais.map((x) => ({ codigo: x.m.codigo, valor: x.consumoAnual })),
      p.corteA,
      p.corteB,
    ).map((r) => [r.codigo, r]),
  )
  const abcQtd = new Map(
    classificarABC(
      parciais.map((x) => ({ codigo: x.m.codigo, valor: x.xyz.media * janela.periodosPorAno })),
      p.corteA,
      p.corteB,
    ).map((r) => [r.codigo, r.classe]),
  )
  const abcEst = new Map(
    classificarABC(
      parciais.map((x) => ({
        codigo: x.m.codigo,
        valor: Math.max(0, x.m.estoqueAtual) * x.custo.custo,
      })),
      p.corteA,
      p.corteB,
    ).map((r) => [r.codigo, r.classe]),
  )

  // ---------------------------------------------------------------- ABC multicritério (16-B)
  let mcSaida: SaidaMC | null = null
  if (p.multicriterio.ativo) {
    const prep = prepararDadosMC(v.materiais, entrada.equipamentos ?? [], entrada.ondeUsado ?? [])
    const entradasMC: EntradaMC[] = parciais.map(({ m, xyz, consumoAnual }) => {
      const d = prep.porCodigo.get(m.codigo)
      return {
        codigo: m.codigo,
        classeValor: abc.get(m.codigo)!.classe,
        valorAnual: consumoAnual,
        leadTime: m.leadTimeDias ?? p.leadTimePadraoDias,
        cv: xyz.cv,
        criticidade: d?.criticidade ?? null,
        equipamentos: d?.equipamentos ?? null,
        fornecedores:
          m.numFornecedores !== undefined && Number.isFinite(m.numFornecedores)
            ? m.numFornecedores
            : null,
        substituto: m.possuiSubstituto ?? null,
        custoParada:
          m.custoParadaHora !== undefined && Number.isFinite(m.custoParadaHora)
            ? m.custoParadaHora
            : null,
        criterios: m.criterios ?? {},
        classeManual: m.classeManual ?? null,
        justificativa: m.justificativaClasse?.trim() || null,
      }
    })
    mcSaida = classificarMulticriterio(entradasMC, p.multicriterio)
    problemasExtra.push(...prep.avisos, ...mcSaida.avisos)
  }

  // ---------------------------------------------------------------- itens
  aoProgresso('Calculando previsão e parâmetros', 0.45)
  const pedidosPorCodigo = new Map<string, number>()
  for (const ped of v.pedidos)
    pedidosPorCodigo.set(ped.codigo, (pedidosPorCodigo.get(ped.codigo) ?? 0) + ped.quantidade)

  const itens: ItemResultado[] = parciais.map(({ m, serie, custo, xyz, consumoAnual }) => {
    const a = abc.get(m.codigo)!
    const mcItem = mcSaida?.porItem.get(m.codigo) ?? null
    // Com o multicritério ligado, a classe final substitui a de valor em todo o resto.
    const classe = mcItem?.classeFinal ?? a.classe
    const classeXYZ = xyz.classe
    const temClasse = classeXYZ === 'X' || classeXYZ === 'Y' || classeXYZ === 'Z'

    // Previsão
    const regra = metodoRegraFixa(classeXYZ, xyz.padrao, p.periodosMediaMovel)
    const bt = temClasse ? backtest(serie.demanda, xyz.padrao, p.alphaSBA) : null
    let metodo: NomeMetodo = regra.metodo
    let motivoMetodo = regra.motivo
    if (p.metodoPrevisao === 'automatico' && bt?.melhor && temClasse) {
      metodo = bt.melhor
      const erro = bt.metodos.find((x) => x.metodo === bt.melhor)
      motivoMetodo = `Modo automático: ${bt.melhor} teve o menor erro absoluto médio (MAE ${num(erro?.mae ?? 0, 2)}) no backtest dos últimos ${bt.periodos.length} períodos.`
    }
    const prev = preverCom(serie.demanda, metodo, p.alphaSBA)
    const F = Math.max(0, prev.valor)
    const erroEscolhido = bt?.metodos.find((x) => x.metodo === metodo) ?? null

    // Parâmetros
    const leadTimePadrao = m.leadTimeDias === undefined
    const leadTimeDias = m.leadTimeDias ?? p.leadTimePadraoDias
    const desvioLT =
      m.desvioLeadTimeDias !== undefined && m.desvioLeadTimeDias > 0 ? m.desvioLeadTimeDias : null
    const nivel = temClasse ? p.nivelServico[classe][classeXYZ] : null
    const loteMinimo = m.loteMinimo !== undefined && m.loteMinimo > 0 ? m.loteMinimo : 0
    const multiplo = m.multiploCompra !== undefined && m.multiploCompra > 0 ? m.multiploCompra : 1
    const pedidos = pedidosPorCodigo.get(m.codigo) ?? 0
    const esManual =
      m.estoqueSegurancaManual !== undefined && Number.isFinite(m.estoqueSegurancaManual)
        ? m.estoqueSegurancaManual
        : null

    const par = calcularParametros({
      F,
      sigma: xyz.desvio,
      esCalculavel: temClasse,
      leadTimeDias,
      desvioLeadTimeDias: desvioLT,
      diasPorPeriodo: janela.diasPorPeriodo,
      periodosPorAno: janela.periodosPorAno,
      nivelServico: nivel,
      custo: custo.custo,
      custoPedido: p.custoPedido,
      taxaManutencao: p.taxaManutencaoAnual,
      loteMinimo,
      multiplo,
      esManual,
      estoqueAtual: m.estoqueAtual,
      posicao: m.estoqueAtual + pedidos,
    })

    // Sem giro: dias desde a última saída (ou desde o início de vida, se nunca saiu).
    const refDia = serie.ultimaSaidaDia ?? serie.inicioVidaDia
    const diasSemSaida = refDia !== null ? dataBaseDia - refDia : null

    const rep = calcularReposicao({
      estoqueAtual: m.estoqueAtual,
      pedidosAbertos: pedidos,
      F,
      estoqueSeguranca: par.estoqueSeguranca,
      pontoPedido: par.pontoPedido,
      estoqueMaximo: par.estoqueMaximo,
      loteCompra: par.loteCompra,
      loteMinimo,
      multiplo,
      custo: custo.custo,
      leadTimeDias,
      coberturaDias: par.coberturaDias,
      diasSemSaida,
      diasSemGiro: p.diasSemGiro,
      classeABC: classe,
    })

    // Saldo e giro (6.9)
    const n = serie.demanda.length
    const consumoQtd = serie.demanda.reduce((s, x) => s + x, 0)
    const estoqueMedio =
      n > 0 ? serie.saldosFim.reduce((s, x) => s + x, 0) / n : Math.max(0, m.estoqueAtual)
    const giro =
      estoqueMedio > 0 && custo.custo > 0 && n > 0
        ? (consumoQtd * custo.custo * janela.periodosPorAno) / n / (estoqueMedio * custo.custo)
        : null
    const saldoInconsistente = serie.saldoInicial < -1e-9 || serie.saldosFim.some((s) => s < -1e-9)
    if (saldoInconsistente) {
      problemasExtra.push({
        regra: 'saldo_negativo',
        gravidade: 'aviso',
        aba: 'Movimentacoes',
        codigo: m.codigo,
        mensagem: `Item "${m.codigo}": o saldo reconstruído fica negativo em algum período. Provável movimento faltando ou estoque atual incorreto.`,
      })
    }
    if (custo.origem === 'sem_custo') {
      problemasExtra.push({
        regra: 'item_sem_custo',
        gravidade: 'aviso',
        aba: 'Materiais',
        linha: m.linha,
        codigo: m.codigo,
        mensagem: `Item "${m.codigo}" sem custo (nem no cadastro, nem nas entradas). Fica fora da ABC por valor.`,
      })
    }

    const revisaoManual: string[] = []
    if (!par.esManual) {
      if (classeXYZ === 'Novo') revisaoManual.push('Histórico insuficiente: ES não calculado')
      if (classeXYZ === 'N' && m.estoqueAtual > 0)
        revisaoManual.push('Sem demanda na janela: ES não calculado')
    }
    if (custo.origem === 'sem_custo') revisaoManual.push('Sem custo')

    const unidade = (m.unidade ?? '').trim() || 'UN'
    return {
      codigo: m.codigo,
      descricao: m.descricao ?? '',
      unidade,
      unidadeDiscreta: ehUnidadeDiscreta(unidade),
      categoria: m.categoria?.trim() || 'Sem categoria',
      fornecedor: m.fornecedor?.trim() || 'Sem fornecedor',
      tipoItem: m.tipoItem ?? 'Comprado',
      estoqueAtual: m.estoqueAtual,
      loteMinimo,
      multiploCompra: multiplo,
      leadTimeDias,
      leadTimePadrao,
      desvioLeadTimeDias: desvioLT,
      custo: custo.custo,
      origemCusto: custo.origem,
      inicioSerie: serie.inicioSerie,
      serie: serie.demanda,
      n,
      consumoQtd,
      consumoValor: consumoQtd * custo.custo,
      consumoAnualValor: consumoAnual,
      media: xyz.media,
      desvio: xyz.desvio,
      cv: xyz.cv,
      classeABC: classe,
      pctConsumo: a.pct,
      pctAcumulado: a.pctAcumulado,
      pctAcumuladoAnterior: a.pctAcumuladoAnterior,
      posicaoABC: a.posicao,
      classeABCQuantidade: abcQtd.get(m.codigo) ?? 'C',
      classeABCValorEstoque: abcEst.get(m.codigo) ?? 'C',
      classeABCValor: a.classe,
      multicriterio: mcItem,
      classeXYZ,
      adi: xyz.adi,
      cv2: xyz.cv2,
      padrao: xyz.padrao,
      classeCombinada: `${classe}${classeXYZ === 'Novo' ? '-Novo' : classeXYZ}`,
      historicoInsuficiente: xyz.historicoInsuficiente,
      metodo,
      motivoMetodo,
      alphaSES: metodo === 'SES' ? prev.alpha : null,
      previsao: F,
      backtest: bt,
      wmape: erroEscolhido?.wmape ?? null,
      vies: erroEscolhido?.vies ?? null,
      nivelServico: nivel,
      z: par.z,
      ltPeriodos: par.ltPeriodos,
      sigmaLT: par.sigmaLT,
      estoqueSeguranca: par.estoqueSeguranca,
      esManual: par.esManual,
      pontoPedido: par.pontoPedido,
      demandaAnual: par.demandaAnual,
      custoManutencao: par.custoManutencao,
      eoq: par.eoq,
      loteCompra: par.loteCompra,
      origemLote: par.origemLote,
      estoqueMaximo: par.estoqueMaximo,
      consumoDiario: par.consumoDiario,
      coberturaDias: par.coberturaDias,
      custoTotalEOQ: par.custoTotalEOQ,
      custoTotalLote: par.custoTotalLote,
      penalidadeArredondamento: par.penalidadeArredondamento,
      mediaLT: par.mediaLT,
      probRupturaCiclo: par.probRupturaCiclo,
      probFaltarAntesChegada: par.probFaltarAntesChegada,
      probIndicativa: xyz.padrao === 'Intermitente' || xyz.padrao === 'Irregular',
      perdaNormalG: par.perdaNormalG,
      faltaEsperadaCiclo: par.faltaEsperadaCiclo,
      fillRate: par.fillRate,
      pedidosAbertos: pedidos,
      posicao: rep.posicao,
      status: rep.status,
      diasSemSaida,
      sugestaoQtd: rep.sugestaoQtd,
      sugestaoValor: rep.sugestaoValor,
      dataChegada: adicionarDias(dataBase, leadTimeDias),
      riscoAntesChegada: rep.riscoAntesChegada,
      prioridade: rep.prioridade,
      motivo: rep.motivo,
      revisaoManual,
      saldosFimPeriodo: serie.saldosFim,
      saldoInicial: serie.saldoInicial,
      estoqueMedio,
      giro,
      saldoInconsistente,
      parecidos: [],
    }
  })

  // ---------------------------------------------------------------- similaridade
  aoProgresso('Comparando perfis de consumo', 0.6)
  const elegiveis = itens.filter(
    (i) => (i.padrao === 'Suave' || i.padrao === 'Errático') && i.n === L && L >= 3,
  )
  const parecidos = calcularParecidos(
    elegiveis.map((i) => ({
      codigo: i.codigo,
      categoria: i.categoria,
      perfil: perfilNormalizado(i.serie.slice(-12)),
    })),
  )
  for (const i of itens) i.parecidos = parecidos.get(i.codigo) ?? []

  // ---------------------------------------------------------------- MRP
  aoProgresso('Calculando o MRP', 0.75)
  let mrp: ResultadoMRP | null = null
  let erroMRP: string | null = null
  const entradasMRP: ItemMRPEntrada[] = itens.map((i) => ({
    codigo: i.codigo,
    estoqueAtual: i.estoqueAtual,
    estoqueSeguranca: i.estoqueSeguranca ?? 0,
    pontoPedido: i.pontoPedido,
    loteCompra: i.loteCompra,
    loteMinimo: i.loteMinimo,
    multiplo: i.multiploCompra,
    leadTimeDias: i.leadTimeDias,
    custo: i.custo,
    nbSemanalPrevisao: (i.previsao * 7) / janela.diasPorPeriodo,
  }))
  try {
    mrp = calcularMRP(entradasMRP, v.pedidos, v.bom, v.mps, {
      dataBase,
      horizonte: p.horizonteMRP,
      politica: p.politicaLote,
      periodoFixoSemanas: p.periodoFixoSemanas,
    })
  } catch (e) {
    if (e instanceof ErroBOMCircular) {
      erroMRP = e.message
      problemasExtra.push({
        regra: 'bom_circular',
        gravidade: 'aviso',
        aba: 'BOM',
        mensagem: e.message,
      })
    } else {
      erroMRP = `Não foi possível calcular o MRP: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  // ---------------------------------------------------------------- consolidação
  aoProgresso('Consolidando indicadores', 0.9)
  const qualidade = montarRelatorio(
    [...v.relatorio.problemas, ...problemasExtra],
    v.relatorio.totalLinhas,
    v.relatorio.totalLinhas - v.relatorio.linhasValidas,
  )

  const matriz: CelulaMatriz[] = []
  for (const abcC of ['A', 'B', 'C'] as const) {
    for (const xyzC of ['X', 'Y', 'Z'] as const) {
      const doGrupo = itens.filter((i) => i.classeABC === abcC && i.classeXYZ === xyzC)
      matriz.push({
        abc: abcC,
        xyz: xyzC,
        itens: doGrupo.length,
        valor: doGrupo.reduce((s, i) => s + i.consumoAnualValor, 0),
      })
    }
  }

  const consolidado: SerieConsolidada = {
    rotulos: janela.rotulos,
    entradasValor: new Array<number>(L).fill(0),
    saidasValor: new Array<number>(L).fill(0),
    saldoValor: new Array<number>(L).fill(0),
  }
  parciais.forEach(({ serie, custo }) => {
    for (let k = 0; k < L; k++) {
      consolidado.entradasValor[k] += serie.entradasJanela[k] * custo.custo
      consolidado.saidasValor[k] += serie.demandaJanela[k] * custo.custo
      consolidado.saldoValor[k] += Math.max(0, serie.saldosFimJanela[k]) * custo.custo
    }
  })

  const alertas = gerarAlertas(itens, mrp)
  const kpis = calcularKPIs(itens, qualidade, janela.diasPorPeriodo)

  aoProgresso('Pronto', 1)
  return {
    dataBase,
    parametros: p,
    janela,
    qualidade,
    itens,
    matriz,
    kpis,
    alertas,
    mrp,
    erroMRP,
    consolidado,
    multicriterio: mcSaida?.resumo ?? null,
    tempoMs: relogio() - t0,
  }
}

function gerarAlertas(itens: readonly ItemResultado[], mrp: ResultadoMRP | null): Alerta[] {
  const a: Alerta[] = []
  const unid = (i: ItemResultado, x: number) =>
    `${num(i.unidadeDiscreta ? Math.ceil(x - 1e-9) : x, i.unidadeDiscreta ? 0 : 2)} ${i.unidade}`
  for (const i of itens) {
    if (i.status === 'Ruptura')
      a.push({
        tipo: 'Ruptura',
        gravidade: 'alta',
        codigo: i.codigo,
        mensagem: `Estoque ${unid(i, i.estoqueAtual)} com consumo previsto de ${unid(i, i.previsao)} por período.`,
      })
    if (i.riscoAntesChegada)
      a.push({
        tipo: 'Risco antes da chegada',
        gravidade: 'alta',
        codigo: i.codigo,
        mensagem: `Cobertura de ${num(i.coberturaDias)} dias é menor que o lead time de ${num(i.leadTimeDias)} dias.`,
      })
    if (i.status === 'Crítico')
      a.push({
        tipo: 'Crítico',
        gravidade: 'media',
        codigo: i.codigo,
        mensagem: `Estoque ${unid(i, i.estoqueAtual)} abaixo do estoque de segurança (${unid(i, i.estoqueSeguranca ?? 0)}).`,
      })
    if (i.status === 'Excesso' && i.estoqueMaximo !== null)
      a.push({
        tipo: 'Excesso',
        gravidade: 'baixa',
        codigo: i.codigo,
        mensagem: `Estoque ${unid(i, i.estoqueAtual)} acima do máximo (${unid(i, i.estoqueMaximo)}): ${moeda((i.estoqueAtual - i.estoqueMaximo) * i.custo)} em excesso.`,
      })
    if (i.status === 'Sem giro')
      a.push({
        tipo: 'Sem giro',
        gravidade: 'media',
        codigo: i.codigo,
        mensagem:
          i.diasSemSaida !== null
            ? `Sem saída há ${num(i.diasSemSaida)} dias; ${moeda(Math.max(0, i.estoqueAtual) * i.custo)} parados.`
            : `Nenhuma saída registrada; ${moeda(Math.max(0, i.estoqueAtual) * i.custo)} parados.`,
      })
    if (i.saldoInconsistente)
      a.push({
        tipo: 'Saldo inconsistente',
        gravidade: 'media',
        codigo: i.codigo,
        mensagem:
          'Saldo reconstruído negativo em algum período: confira movimentos faltando ou o estoque atual.',
      })
    if (i.origemCusto === 'sem_custo')
      a.push({
        tipo: 'Sem custo',
        gravidade: 'media',
        codigo: i.codigo,
        mensagem: 'Sem custo no cadastro nem nas entradas: fora da ABC por valor.',
      })
    for (const r of i.revisaoManual.filter((x) => x !== 'Sem custo'))
      a.push({ tipo: 'Revisão manual', gravidade: 'baixa', codigo: i.codigo, mensagem: r })
  }
  for (const r of mrp?.registros ?? []) {
    if (r.temLiberacaoAtraso) {
      const q = r.semanas[0].libPlan
      a.push({
        tipo: 'Liberação em atraso',
        gravidade: 'alta',
        codigo: r.codigo,
        mensagem: `Pedido de ${num(q, 2)} deveria ter sido liberado antes da semana 1 (lead time de ${r.ltSemanas} semana${r.ltSemanas === 1 ? '' : 's'}).`,
      })
    }
  }
  const peso = { alta: 0, media: 1, baixa: 2 }
  return a.sort(
    (x, y) =>
      peso[x.gravidade] - peso[y.gravidade] ||
      x.tipo.localeCompare(y.tipo) ||
      x.codigo.localeCompare(y.codigo),
  )
}

/** Itens com sugestão de compra, ordenados por prioridade e valor. */
export function sugestoesOrdenadas(itens: readonly ItemResultado[]): ItemResultado[] {
  return itens
    .filter((i) => i.sugestaoQtd > 0 && i.prioridade)
    .sort(
      (a, b) =>
        ORDEM_PRIORIDADE[a.prioridade!] - ORDEM_PRIORIDADE[b.prioridade!] ||
        b.sugestaoValor - a.sugestaoValor,
    )
}
