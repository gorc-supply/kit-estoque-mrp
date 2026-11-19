// Resumo do processamento das planilhas de demonstração (ferramenta de desenvolvimento).
// Uso: npx tsx scripts/inspecionar-demo.ts

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { processar } from '../src/engine/index.ts'
import type { ItemResultado } from '../src/engine/tipos.ts'
import { lerEntrada } from '../src/io/ler-planilha.ts'

for (const f of ['demo-industria.xlsx', 'demo-montagem.xlsx']) {
  const b = readFileSync(resolve('public', 'exemplos', f))
  const dados = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
  const t0 = performance.now()
  const e = lerEntrada([{ nome: f, dados }])
  const t1 = performance.now()
  const r = processar(e)
  const cont = (k: (i: ItemResultado) => string) => {
    const m: Record<string, number> = {}
    for (const i of r.itens) m[k(i)] = (m[k(i)] ?? 0) + 1
    return m
  }
  console.info(`\n== ${f}: leitura ${Math.round(t1 - t0)} ms, cálculo ${Math.round(r.tempoMs)} ms`)
  console.info(
    'data-base',
    r.dataBase.toISOString().slice(0, 10),
    '| janela',
    r.janela.rotulos[0],
    '→',
    r.janela.rotulos.at(-1),
  )
  console.info(
    'ABC',
    cont((i) => i.classeABC),
    '| XYZ',
    cont((i) => i.classeXYZ),
  )
  console.info(
    'padrão',
    cont((i) => String(i.padrao)),
  )
  console.info(
    'status',
    cont((i) => i.status),
  )
  console.info(
    'qualidade',
    r.qualidade.contagemPorRegra,
    '| válidas',
    (r.qualidade.percentualValidas * 100).toFixed(2) + '%',
  )
  console.info('kpis', r.kpis)
  console.info('mrp', {
    comBOM: r.mrp?.comBOM,
    registros: r.mrp?.registros.length,
    erro: r.erroMRP,
  })
  const m = r.mrp?.matricial
  if (m)
    console.info(
      'r vs NB',
      m.codigos
        .map((c, i) => `${c}: ${m.requisitoTotal[i].toFixed(1)}/${m.nbTotalMRP[i].toFixed(1)}`)
        .join('  '),
    )
}
