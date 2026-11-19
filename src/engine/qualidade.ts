// Validação dos dados de entrada (seção 7).
// Erros bloqueantes impedem o cálculo; avisos só informam (e, quando dito, a linha é ignorada).

import { dataDeSerial, diaSerial, formatarData } from './datas'
import { num } from './formatar'
import type {
  Entrada,
  ItemBOM,
  ItemMPS,
  Material,
  Movimento,
  PedidoAberto,
  ProblemaQualidade,
  RegraQualidade,
  RelatorioQualidade,
} from './tipos'

export interface EntradaValidada {
  relatorio: RelatorioQualidade
  dataBase: Date
  materiais: Material[]
  /** Movimentos válidos agrupados por código. */
  movimentosPorCodigo: Map<string, Movimento[]>
  pedidos: PedidoAberto[]
  bom: ItemBOM[]
  mps: ItemMPS[]
}

export const DESCRICAO_REGRA: Record<RegraQualidade, string> = {
  sem_materiais: 'Aba Materiais vazia',
  material_sem_codigo: 'Material sem código',
  codigo_duplicado: 'Código duplicado no cadastro',
  estoque_invalido: 'Estoque atual inválido',
  mov_sem_cadastro: 'Movimentação de código sem cadastro',
  data_invalida: 'Data inválida',
  data_futura: 'Data posterior à data-base',
  quantidade_invalida: 'Quantidade zero, negativa ou não numérica',
  tipo_desconhecido: 'Tipo de movimento desconhecido',
  tipo_ambiguo: 'Tipo de movimento ambíguo',
  item_sem_custo: 'Item sem custo',
  item_sem_lead_time: 'Item sem lead time',
  saldo_negativo: 'Saldo reconstruído negativo',
  linha_duplicada: 'Linha duplicada em movimentações',
  pedido_invalido: 'Pedido em aberto inválido',
  bom_invalida: 'Linha de BOM inválida',
  bom_circular: 'BOM circular',
  mps_invalido: 'Linha de MPS inválida',
  coluna_ausente: 'Coluna obrigatória ausente',
  leitura: 'Problema de leitura',
}

const BLOQUEANTES: ReadonlySet<RegraQualidade> = new Set([
  'sem_materiais',
  'material_sem_codigo',
  'codigo_duplicado',
  'estoque_invalido',
  'coluna_ausente',
])

export function ehBloqueante(p: ProblemaQualidade): boolean {
  return p.gravidade === 'erro' && BLOQUEANTES.has(p.regra)
}

export function montarRelatorio(
  problemas: ProblemaQualidade[],
  totalLinhas: number,
  linhasInvalidas: number,
): RelatorioQualidade {
  const contagemPorRegra: Partial<Record<RegraQualidade, number>> = {}
  for (const p of problemas) contagemPorRegra[p.regra] = (contagemPorRegra[p.regra] ?? 0) + 1
  const linhasValidas = Math.max(0, totalLinhas - linhasInvalidas)
  return {
    problemas,
    bloqueante: problemas.some(ehBloqueante),
    totalLinhas,
    linhasValidas,
    percentualValidas: totalLinhas > 0 ? linhasValidas / totalLinhas : 1,
    contagemPorRegra,
  }
}

const valido = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x)

export function validarEntrada(
  entrada: Entrada,
  dataBaseParam: Date | null,
  leadTimePadraoDias: number,
): EntradaValidada {
  const problemas: ProblemaQualidade[] = [...(entrada.problemasLeitura ?? [])]
  let invalidas = 0
  const add = (p: ProblemaQualidade) => problemas.push(p)

  // --- Materiais
  if (entrada.materiais.length === 0) {
    add({
      regra: 'sem_materiais',
      gravidade: 'erro',
      aba: 'Materiais',
      mensagem: 'A aba Materiais não tem nenhum item. Preencha ao menos uma linha.',
    })
  }
  const vistos = new Map<string, number | undefined>()
  const materiais: Material[] = []
  for (const m of entrada.materiais) {
    const codigo = (m.codigo ?? '').trim()
    if (!codigo) {
      invalidas++
      add({
        regra: 'material_sem_codigo',
        gravidade: 'erro',
        aba: 'Materiais',
        linha: m.linha,
        mensagem: `Linha ${m.linha ?? '?'} da aba Materiais está sem código. Preencha a coluna "codigo" ou apague a linha.`,
      })
      continue
    }
    if (vistos.has(codigo)) {
      invalidas++
      add({
        regra: 'codigo_duplicado',
        gravidade: 'erro',
        aba: 'Materiais',
        linha: m.linha,
        codigo,
        mensagem: `O código "${codigo}" aparece mais de uma vez (linhas ${vistos.get(codigo) ?? '?'} e ${m.linha ?? '?'}). Cada item deve ter um código único.`,
      })
      continue
    }
    vistos.set(codigo, m.linha)
    if (!Number.isFinite(m.estoqueAtual)) {
      invalidas++
      add({
        regra: 'estoque_invalido',
        gravidade: 'erro',
        aba: 'Materiais',
        linha: m.linha,
        codigo,
        mensagem: `Item "${codigo}" (linha ${m.linha ?? '?'}): estoque_atual vazio ou não numérico. Informe o saldo físico (pode ser 0).`,
      })
      continue
    }
    let leadTimeDias = m.leadTimeDias
    if (!valido(leadTimeDias) || leadTimeDias < 0) {
      add({
        regra: 'item_sem_lead_time',
        gravidade: 'aviso',
        aba: 'Materiais',
        linha: m.linha,
        codigo,
        mensagem: `Item "${codigo}" sem lead time: usado o padrão de ${leadTimePadraoDias} dias.`,
      })
      leadTimeDias = undefined
    }
    materiais.push({ ...m, codigo, leadTimeDias })
  }
  const cadastrados = new Set(materiais.map((m) => m.codigo))

  // --- Data-base: informada ou a data da última movimentação válida.
  let maxDia = -Infinity
  for (const mv of entrada.movimentacoes) {
    if (mv.data && Number.isFinite(mv.data.getTime()) && cadastrados.has(mv.codigo.trim())) {
      maxDia = Math.max(maxDia, diaSerial(mv.data))
    }
  }
  const dataBase =
    dataBaseParam ??
    (Number.isFinite(maxDia)
      ? dataDeSerial(maxDia)
      : dataDeSerial(Math.floor(Date.now() / 86_400_000)))
  const dataBaseDia = diaSerial(dataBase)

  // --- Movimentações
  const movimentosPorCodigo = new Map<string, Movimento[]>()
  const chaves = new Map<string, number | undefined>()
  for (const mv of entrada.movimentacoes) {
    const codigo = (mv.codigo ?? '').trim()
    const onde = `Linha ${mv.linha ?? '?'}`
    if (!cadastrados.has(codigo)) {
      invalidas++
      add({
        regra: 'mov_sem_cadastro',
        gravidade: 'aviso',
        aba: 'Movimentacoes',
        linha: mv.linha,
        codigo,
        mensagem: `${onde}: código "${codigo || '(vazio)'}" não existe na aba Materiais. Linha ignorada.`,
      })
      continue
    }
    if (!mv.data || !Number.isFinite(mv.data.getTime())) {
      invalidas++
      add({
        regra: 'data_invalida',
        gravidade: 'aviso',
        aba: 'Movimentacoes',
        linha: mv.linha,
        codigo,
        mensagem: `${onde}: data inválida. Use dd/mm/aaaa ou aaaa-mm-dd. Linha ignorada.`,
      })
      continue
    }
    if (diaSerial(mv.data) > dataBaseDia) {
      invalidas++
      add({
        regra: 'data_futura',
        gravidade: 'aviso',
        aba: 'Movimentacoes',
        linha: mv.linha,
        codigo,
        mensagem: `${onde}: data ${formatarData(mv.data)} é posterior à data-base (${formatarData(dataBase)}). Linha ignorada.`,
      })
      continue
    }
    if (!Number.isFinite(mv.quantidade) || mv.quantidade <= 0) {
      invalidas++
      add({
        regra: 'quantidade_invalida',
        gravidade: 'aviso',
        aba: 'Movimentacoes',
        linha: mv.linha,
        codigo,
        mensagem: `${onde}: quantidade ${Number.isFinite(mv.quantidade) ? num(mv.quantidade, 4) : 'não numérica'}. A quantidade deve ser positiva (o sinal vem do tipo). Linha ignorada.`,
      })
      continue
    }
    if (!mv.tipo) {
      invalidas++
      add({
        regra: 'tipo_desconhecido',
        gravidade: 'aviso',
        aba: 'Movimentacoes',
        linha: mv.linha,
        codigo,
        mensagem: `${onde}: tipo "${mv.tipoOriginal ?? ''}" não reconhecido. Use Entrada, Saída, Ajuste +, Ajuste -, Devolução ao estoque ou Devolução ao fornecedor. Linha ignorada.`,
      })
      continue
    }
    if (mv.tipoAmbiguo) {
      add({
        regra: 'tipo_ambiguo',
        gravidade: 'aviso',
        aba: 'Movimentacoes',
        linha: mv.linha,
        codigo,
        mensagem: `${onde}: ${mv.tipoAmbiguo}`,
      })
    }
    const chave = [
      codigo,
      diaSerial(mv.data),
      mv.tipo,
      mv.quantidade,
      mv.valorTotal ?? '',
      mv.documento ?? '',
    ].join('|')
    if (chaves.has(chave)) {
      add({
        regra: 'linha_duplicada',
        gravidade: 'aviso',
        aba: 'Movimentacoes',
        linha: mv.linha,
        codigo,
        mensagem: `${onde} é idêntica à linha ${chaves.get(chave) ?? '?'}. Confira se não foi lançada duas vezes (a linha foi mantida).`,
      })
    } else {
      chaves.set(chave, mv.linha)
    }
    const lista = movimentosPorCodigo.get(codigo) ?? []
    lista.push({ ...mv, codigo })
    movimentosPorCodigo.set(codigo, lista)
  }

  // --- Pedidos em aberto
  const pedidos: PedidoAberto[] = []
  for (const p of entrada.pedidosAbertos) {
    const codigo = (p.codigo ?? '').trim()
    let motivo = ''
    if (!cadastrados.has(codigo)) motivo = `código "${codigo || '(vazio)'}" sem cadastro`
    else if (!p.dataPrevista || !Number.isFinite(p.dataPrevista.getTime()))
      motivo = 'data prevista inválida'
    else if (!(p.quantidade > 0)) motivo = 'quantidade deve ser positiva'
    if (motivo) {
      invalidas++
      add({
        regra: 'pedido_invalido',
        gravidade: 'aviso',
        aba: 'PedidosAbertos',
        linha: p.linha,
        codigo,
        mensagem: `Linha ${p.linha ?? '?'}: ${motivo}. Linha ignorada.`,
      })
      continue
    }
    pedidos.push({ ...p, codigo })
  }

  // --- BOM
  const bom: ItemBOM[] = []
  for (const l of entrada.bom) {
    const pai = (l.codigoPai ?? '').trim()
    const filho = (l.codigoFilho ?? '').trim()
    let motivo = ''
    if (!pai || !filho) motivo = 'código pai ou filho vazio'
    else if (pai === filho) motivo = `o item "${pai}" não pode ser componente de si mesmo`
    else if (!(l.quantidadePor > 0)) motivo = 'quantidade_por deve ser positiva'
    else if (!(l.perdaPct >= 0)) motivo = 'perda_pct inválida'
    if (motivo) {
      invalidas++
      add({
        regra: 'bom_invalida',
        gravidade: 'aviso',
        aba: 'BOM',
        linha: l.linha,
        codigo: pai,
        mensagem: `Linha ${l.linha ?? '?'}: ${motivo}. Linha ignorada.`,
      })
      continue
    }
    bom.push({ ...l, codigoPai: pai, codigoFilho: filho })
  }

  // --- MPS
  const mps: ItemMPS[] = []
  for (const m of entrada.mps) {
    const codigo = (m.codigo ?? '').trim()
    let motivo = ''
    if (!codigo) motivo = 'código vazio'
    else if (!m.semanaInicio || !Number.isFinite(m.semanaInicio.getTime()))
      motivo = 'semana_inicio inválida'
    else if (!(m.quantidade > 0)) motivo = 'quantidade deve ser positiva'
    if (motivo) {
      invalidas++
      add({
        regra: 'mps_invalido',
        gravidade: 'aviso',
        aba: 'MPS',
        linha: m.linha,
        codigo,
        mensagem: `Linha ${m.linha ?? '?'}: ${motivo}. Linha ignorada.`,
      })
      continue
    }
    mps.push({ ...m, codigo })
  }

  const totalLinhas =
    entrada.materiais.length +
    entrada.movimentacoes.length +
    entrada.pedidosAbertos.length +
    entrada.bom.length +
    entrada.mps.length

  return {
    relatorio: montarRelatorio(problemas, totalLinhas, invalidas),
    dataBase,
    materiais,
    movimentosPorCodigo,
    pedidos,
    bom,
    mps,
  }
}
