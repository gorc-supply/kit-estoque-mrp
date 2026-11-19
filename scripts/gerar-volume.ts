// Teste 21 (volume): gera uma planilha sintética com 2.000 itens e 100.000 movimentações
// e mede leitura + cálculo no Node. Uso: npx tsx scripts/gerar-volume.ts [saida.xlsx]

import ExcelJS from 'exceljs'
import { writeFileSync } from 'node:fs'
import { processar } from '../src/engine/index.ts'
import { lerEntrada } from '../src/io/ler-planilha.ts'
import { criarRng, type DadosDemo, type MovimentoDemo } from './demo/dados.ts'
import { escreverDemo } from './demo/escrever.ts'

const saida = process.argv[2] ?? 'volume-100k.xlsx'
const rng = criarRng(21)
const inicio = Date.UTC(2025, 4, 1)
const dados: DadosDemo = { materiais: [], movimentacoes: [], pedidos: [], bom: [], mps: [] }
for (let i = 0; i < 2000; i++) {
  dados.materiais.push({
    codigo: `IT${String(i).padStart(5, '0')}`,
    descricao: `Item sintético ${i}`,
    unidade: 'UN',
    estoque_atual: rng.inteiro(0, 500),
    custo_unitario: Math.round(rng.logUniforme(0.5, 2000) * 100) / 100,
    lead_time_dias: rng.inteiro(5, 60),
    desvio_lead_time_dias: null,
    lote_minimo: null,
    multiplo_compra: null,
    estoque_seguranca_manual: null,
    fornecedor: `Fornecedor ${i % 25}`,
    categoria: `Categoria ${i % 8}`,
    tipo_item: 'Comprado',
    data_cadastro: null,
  })
}
const movs: MovimentoDemo[] = []
for (let k = 0; k < 100_000; k++) {
  const m = dados.materiais[rng.inteiro(0, 1999)]
  const saidaTipo = rng.u() < 0.8
  movs.push({
    data: new Date(inicio + rng.inteiro(0, 548) * 86_400_000),
    codigo: m.codigo,
    tipo: saidaTipo ? 'Saída' : 'Entrada',
    quantidade: rng.inteiro(1, 20),
    valor_total: null,
    documento: `D${k}`,
  })
}
movs.sort((a, b) => (a.data as Date).getTime() - (b.data as Date).getTime())
dados.movimentacoes = movs

const t0 = performance.now()
const buf = await escreverDemo(
  ExcelJS,
  dados,
  'Teste de volume: 2.000 itens e 100.000 movimentações sintéticas.',
)
writeFileSync(saida, Buffer.from(buf))
const t1 = performance.now()
const entrada = lerEntrada([{ nome: saida, dados: buf }])
const t2 = performance.now()
const r = processar(entrada)
const t3 = performance.now()
console.info(
  `Arquivo: ${saida} (${(buf.byteLength / 1e6).toFixed(1)} MB, gerado em ${Math.round(t1 - t0)} ms)`,
)
console.info(
  `Leitura (SheetJS): ${Math.round(t2 - t1)} ms · cálculo: ${Math.round(t3 - t2)} ms · itens: ${r.itens.length}`,
)
