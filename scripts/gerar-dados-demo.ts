// Gera as planilhas de demonstração em public/exemplos/ (seção 12).
// Uso: npm run demo   (equivale a: npx tsx scripts/gerar-dados-demo.ts)

import ExcelJS from 'exceljs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gerarDemoIndustria, gerarDemoMontagem } from './demo/dados.ts'
import { escreverDemo } from './demo/escrever.ts'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pasta = resolve(raiz, 'public', 'exemplos')
mkdirSync(pasta, { recursive: true })

const industria = gerarDemoIndustria()
const bufInd = await escreverDemo(
  ExcelJS,
  industria,
  '~150 itens de MRO, embalagens, matéria-prima, componentes, EPI e químicos; 18 meses de movimentações (mai/2025 a out/2026).',
)
writeFileSync(resolve(pasta, 'demo-industria.xlsx'), Buffer.from(bufInd))
console.info(
  `demo-industria.xlsx: ${industria.materiais.length} itens, ${industria.movimentacoes.length} movimentações, ${industria.pedidos.length} pedidos em aberto`,
)

const montagem = gerarDemoMontagem()
const bufMont = await escreverDemo(
  ExcelJS,
  montagem,
  'Montagem de carrinhos: BOM de 3 níveis (2 produtos acabados, 15 componentes) e MPS de 12 semanas.',
)
writeFileSync(resolve(pasta, 'demo-montagem.xlsx'), Buffer.from(bufMont))
console.info(
  `demo-montagem.xlsx: ${montagem.materiais.length} itens, ${montagem.bom.length} linhas de BOM, ${montagem.mps.length} linhas de MPS`,
)
