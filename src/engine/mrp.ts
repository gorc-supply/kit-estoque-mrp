// MRP em períodos semanais (seção 6.10) e conferência matricial da BOM (6.12f).

import { dataDeSerial, diaSerial, indicePeriodo, inicioPeriodo, rotuloPeriodo } from './datas'
import { ajustarLote } from './estatistica'
import type {
  ItemBOM,
  ItemMPS,
  LinhaMRP,
  MatricialBOM,
  PedidoAberto,
  PoliticaLote,
  RegistroMRP,
  ResultadoMRP,
} from './tipos'

export interface ItemMRPEntrada {
  codigo: string
  estoqueAtual: number
  estoqueSeguranca: number
  pontoPedido: number | null
  loteCompra: number | null
  loteMinimo: number
  multiplo: number
  leadTimeDias: number
  custo: number
  /** Necessidade bruta semanal baseada na previsão (planejamento por consumo). */
  nbSemanalPrevisao: number
}

export interface OpcoesMRP {
  dataBase: Date
  horizonte: number
  politica: PoliticaLote
  periodoFixoSemanas: number
}

export class ErroBOMCircular extends Error {
  readonly ciclo: string[]
  constructor(ciclo: string[]) {
    super(
      `A estrutura de produto (BOM) é circular: ${ciclo.join(' → ')}. Corrija a aba BOM para o MRP poder explodir as necessidades.`,
    )
    this.ciclo = ciclo
  }
}

/**
 * Código de nível mais baixo (low-level code): maior profundidade em que o item aparece.
 * Lança ErroBOMCircular se houver ciclo.
 */
export function calcularNiveis(
  bom: readonly ItemBOM[],
  codigos: Iterable<string>,
): Map<string, number> {
  const filhos = new Map<string, string[]>()
  for (const l of bom) {
    const lista = filhos.get(l.codigoPai) ?? []
    lista.push(l.codigoFilho)
    filhos.set(l.codigoPai, lista)
  }

  // Detecção de ciclo (DFS com cores).
  const cor = new Map<string, 0 | 1 | 2>()
  const pilha: string[] = []
  const visitar = (c: string) => {
    cor.set(c, 1)
    pilha.push(c)
    for (const f of filhos.get(c) ?? []) {
      const cf = cor.get(f) ?? 0
      if (cf === 1) {
        const inicio = pilha.indexOf(f)
        throw new ErroBOMCircular([...pilha.slice(inicio), f])
      }
      if (cf === 0) visitar(f)
    }
    pilha.pop()
    cor.set(c, 2)
  }
  const todos = new Set<string>(codigos)
  for (const l of bom) {
    todos.add(l.codigoPai)
    todos.add(l.codigoFilho)
  }
  for (const c of todos) if ((cor.get(c) ?? 0) === 0) visitar(c)

  // Nível = maior profundidade (relaxação em ordem topológica, sem ciclos garantido).
  const nivel = new Map<string, number>()
  for (const c of todos) nivel.set(c, 0)
  let mudou = true
  let guarda = 0
  while (mudou && guarda++ < todos.size + 2) {
    mudou = false
    for (const l of bom) {
      const np = nivel.get(l.codigoPai) ?? 0
      if ((nivel.get(l.codigoFilho) ?? 0) < np + 1) {
        nivel.set(l.codigoFilho, np + 1)
        mudou = true
      }
    }
  }
  return nivel
}

/** Calcula o registro de MRP de um item, dadas as necessidades brutas semana a semana. */
export function registroItem(
  item: ItemMRPEntrada,
  nb: readonly number[],
  rp: readonly number[],
  opcoes: OpcoesMRP,
  semanasInicio: readonly Date[],
): Omit<RegistroMRP, 'nivel' | 'origemNB' | 'pedidosAtrasados'> {
  const H = opcoes.horizonte
  const ltSemanas = Math.max(0, Math.ceil(item.leadTimeDias / 7 - 1e-9))
  const es = Math.max(0, item.estoqueSeguranca)
  const recPlan = new Array<number>(H).fill(0)
  const libPlan = new Array<number>(H).fill(0)
  const libAtraso = new Array<boolean>(H).fill(false)
  const nl = new Array<number>(H).fill(0)
  const ep = new Array<number>(H).fill(0)

  let anterior = item.estoqueAtual
  for (let t = 0; t < H; t++) {
    const semRec = anterior + rp[t] - nb[t]
    if (semRec < es - 1e-9) {
      nl[t] = es - semRec
      let q: number
      if (opcoes.politica === 'lote_a_lote') {
        q = ajustarLote(nl[t], item.loteMinimo, item.multiplo)
      } else if (opcoes.politica === 'lote_economico') {
        q = ajustarLote(Math.max(nl[t], item.loteCompra ?? 0), item.loteMinimo, item.multiplo)
      } else {
        // Período fixo: cobre as necessidades das próximas n semanas mantendo o ES.
        const n = Math.max(1, Math.round(opcoes.periodoFixoSemanas))
        let saldo = anterior
        let necessario = 0
        for (let k = t; k < Math.min(H, t + n); k++) {
          saldo += rp[k] - nb[k]
          necessario = Math.max(necessario, es - saldo)
        }
        q = ajustarLote(necessario, item.loteMinimo, item.multiplo)
      }
      recPlan[t] = q
      const tLib = t - ltSemanas
      if (tLib < 0) {
        libPlan[0] += q
        libAtraso[0] = true
      } else {
        libPlan[tLib] += q
      }
    }
    ep[t] = semRec + recPlan[t]
    anterior = ep[t]
  }

  const semanas: LinhaMRP[] = []
  for (let t = 0; t < H; t++) {
    semanas.push({
      semana: t + 1,
      inicio: semanasInicio[t],
      nb: nb[t],
      rp: rp[t],
      ep: ep[t],
      nl: nl[t],
      recPlan: recPlan[t],
      libPlan: libPlan[t],
      libAtraso: libAtraso[t],
    })
  }
  return {
    codigo: item.codigo,
    ltSemanas,
    estoqueSeguranca: es,
    pontoPedido: item.pontoPedido,
    loteCompra: item.loteCompra,
    semanas,
    temLiberacaoAtraso: libAtraso.some(Boolean),
  }
}

/**
 * MRP completo. Sem BOM/MPS: NB = previsão semanal. Com BOM e MPS: itens do MPS recebem
 * a demanda independente; componentes recebem as liberações dos pais × qtd × (1 + perda),
 * processando por código de nível mais baixo.
 */
export function calcularMRP(
  itens: readonly ItemMRPEntrada[],
  pedidos: readonly PedidoAberto[],
  bom: readonly ItemBOM[],
  mps: readonly ItemMPS[],
  opcoes: OpcoesMRP,
): ResultadoMRP {
  const H = Math.max(1, Math.round(opcoes.horizonte))
  const op = { ...opcoes, horizonte: H }
  const semana1 = indicePeriodo(diaSerial(opcoes.dataBase), 'semanal')
  const semanas = Array.from({ length: H }, (_, t) => ({
    semana: t + 1,
    inicio: dataDeSerial(inicioPeriodo(semana1 + t, 'semanal')),
    rotulo: rotuloPeriodo(semana1 + t, 'semanal'),
  }))
  const semanasInicio = semanas.map((s) => s.inicio)
  const posicaoSemana = (d: Date) => indicePeriodo(diaSerial(d), 'semanal') - semana1

  const porCodigo = new Map(itens.map((i) => [i.codigo, i]))

  // Recebimentos programados (atrasados vão para a semana 1).
  const rp = new Map<string, number[]>()
  const atrasados = new Map<string, number>()
  for (const p of pedidos) {
    if (!p.dataPrevista || !porCodigo.has(p.codigo)) continue
    let t = posicaoSemana(p.dataPrevista)
    if (t < 0) {
      atrasados.set(p.codigo, (atrasados.get(p.codigo) ?? 0) + p.quantidade)
      t = 0
    }
    if (t >= H) continue
    const v = rp.get(p.codigo) ?? new Array<number>(H).fill(0)
    v[t] += p.quantidade
    rp.set(p.codigo, v)
  }
  const rpDe = (c: string) => rp.get(c) ?? new Array<number>(H).fill(0)

  const comBOM = bom.length > 0 && mps.length > 0
  const registros: RegistroMRP[] = []

  if (!comBOM) {
    for (const item of itens) {
      if (item.nbSemanalPrevisao <= 0 && !rp.has(item.codigo)) continue
      const nb = new Array<number>(H).fill(item.nbSemanalPrevisao)
      registros.push({
        ...registroItem(item, nb, rpDe(item.codigo), op, semanasInicio),
        nivel: 0,
        origemNB: 'previsao',
        pedidosAtrasados: atrasados.get(item.codigo) ?? 0,
      })
    }
    return {
      comBOM,
      horizonte: H,
      semanas,
      registros,
      consolidado: consolidar(registros, porCodigo, H),
      matricial: null,
    }
  }

  const niveis = calcularNiveis(bom, porCodigo.keys())
  const naEstrutura = new Set<string>()
  for (const l of bom) {
    naEstrutura.add(l.codigoPai)
    naEstrutura.add(l.codigoFilho)
  }
  const mpsPorItem = new Map<string, number[]>()
  for (const m of mps) {
    if (!m.semanaInicio) continue
    const t = Math.max(0, posicaoSemana(m.semanaInicio))
    if (t >= H) continue
    naEstrutura.add(m.codigo)
    const v = mpsPorItem.get(m.codigo) ?? new Array<number>(H).fill(0)
    v[t] += m.quantidade
    mpsPorItem.set(m.codigo, v)
  }

  const dependente = new Map<string, number[]>()
  const filhosDe = new Map<string, ItemBOM[]>()
  for (const l of bom) {
    const lista = filhosDe.get(l.codigoPai) ?? []
    lista.push(l)
    filhosDe.set(l.codigoPai, lista)
  }

  const ordem = [...naEstrutura].sort(
    (a, b) => (niveis.get(a) ?? 0) - (niveis.get(b) ?? 0) || (a < b ? -1 : 1),
  )
  for (const codigo of ordem) {
    const item: ItemMRPEntrada = porCodigo.get(codigo) ?? {
      codigo,
      estoqueAtual: 0,
      estoqueSeguranca: 0,
      pontoPedido: null,
      loteCompra: null,
      loteMinimo: 0,
      multiplo: 1,
      leadTimeDias: 0,
      custo: 0,
      nbSemanalPrevisao: 0,
    }
    const independente = mpsPorItem.get(codigo)
    const dep = dependente.get(codigo)
    const nb = new Array<number>(H).fill(0)
    for (let t = 0; t < H; t++) nb[t] = (independente?.[t] ?? 0) + (dep?.[t] ?? 0)
    const origemNB: RegistroMRP['origemNB'] =
      independente && dep ? 'mps+dependente' : independente ? 'mps' : 'dependente'

    const reg = registroItem(item, nb, rpDe(codigo), op, semanasInicio)
    registros.push({
      ...reg,
      nivel: niveis.get(codigo) ?? 0,
      origemNB,
      pedidosAtrasados: atrasados.get(codigo) ?? 0,
    })

    // Explode as liberações planejadas para os filhos.
    for (const l of filhosDe.get(codigo) ?? []) {
      const v = dependente.get(l.codigoFilho) ?? new Array<number>(H).fill(0)
      const fator = l.quantidadePor * (1 + l.perdaPct)
      for (let t = 0; t < H; t++) v[t] += reg.semanas[t].libPlan * fator
      dependente.set(l.codigoFilho, v)
    }
  }

  // Itens fora da estrutura seguem o planejamento por consumo.
  for (const item of itens) {
    if (naEstrutura.has(item.codigo)) continue
    if (item.nbSemanalPrevisao <= 0 && !rp.has(item.codigo)) continue
    const nb = new Array<number>(H).fill(item.nbSemanalPrevisao)
    registros.push({
      ...registroItem(item, nb, rpDe(item.codigo), op, semanasInicio),
      nivel: 0,
      origemNB: 'previsao',
      pedidosAtrasados: atrasados.get(item.codigo) ?? 0,
    })
  }

  const matricial = conferenciaMatricial(bom, mpsPorItem, registros, niveis)
  return {
    comBOM,
    horizonte: H,
    semanas,
    registros,
    consolidado: consolidar(registros, porCodigo, H),
    matricial,
  }
}

function consolidar(
  registros: readonly RegistroMRP[],
  porCodigo: Map<string, ItemMRPEntrada>,
  H: number,
): ResultadoMRP['consolidado'] {
  const saida = Array.from({ length: H }, (_, t) => ({ semana: t + 1, quantidade: 0, valor: 0 }))
  for (const r of registros) {
    const custo = porCodigo.get(r.codigo)?.custo ?? 0
    for (let t = 0; t < H; t++) {
      saida[t].quantidade += r.semanas[t].libPlan
      saida[t].valor += r.semanas[t].libPlan * custo
    }
  }
  return saida
}

// ---------------------------------------------------------------------------
// 6.12f — A BOM como matriz de requisitos totais

/** Multiplica matriz (n×n) por vetor. */
function multiplicar(M: number[][], v: number[]): number[] {
  return M.map((linha) => linha.reduce((s, x, j) => s + x * v[j], 0))
}

/**
 * Requisito total r = (I − B)⁻¹ d, pela série de Neumann (I + B + B² + …),
 * que termina porque a BOM é acíclica (B é nilpotente).
 */
export function requisitoTotal(B: number[][], d: number[]): number[] {
  const r = [...d]
  let termo = [...d]
  for (let k = 0; k < B.length + 1; k++) {
    termo = multiplicar(B, termo)
    if (termo.every((x) => Math.abs(x) < 1e-12)) break
    for (let i = 0; i < r.length; i++) r[i] += termo[i]
  }
  return r
}

export function matrizUsoDireto(bom: readonly ItemBOM[], codigos: readonly string[]): number[][] {
  const idx = new Map(codigos.map((c, i) => [c, i]))
  const B = codigos.map(() => new Array<number>(codigos.length).fill(0))
  for (const l of bom) {
    const i = idx.get(l.codigoFilho)
    const j = idx.get(l.codigoPai)
    if (i === undefined || j === undefined) continue
    B[i][j] += l.quantidadePor * (1 + l.perdaPct)
  }
  return B
}

function conferenciaMatricial(
  bom: readonly ItemBOM[],
  mpsPorItem: Map<string, number[]>,
  registros: readonly RegistroMRP[],
  niveis: Map<string, number>,
): MatricialBOM {
  const set = new Set<string>()
  for (const l of bom) {
    set.add(l.codigoPai)
    set.add(l.codigoFilho)
  }
  for (const c of mpsPorItem.keys()) set.add(c)
  const codigos = [...set].sort(
    (a, b) => (niveis.get(a) ?? 0) - (niveis.get(b) ?? 0) || (a < b ? -1 : 1),
  )
  const B = matrizUsoDireto(bom, codigos)
  const d = codigos.map((c) => (mpsPorItem.get(c) ?? []).reduce((s, x) => s + x, 0))
  const r = requisitoTotal(B, d)
  const regPorCodigo = new Map(registros.map((r) => [r.codigo, r]))
  const nbTotal = codigos.map((c) =>
    (regPorCodigo.get(c)?.semanas ?? []).reduce((s, l) => s + l.nb, 0),
  )
  return { codigos, matrizB: B, demandaIndependente: d, requisitoTotal: r, nbTotalMRP: nbTotal }
}
