// Gerador da cena isométrica (armazém). Uso: node iso.mjs <saida.svg> [hero|og]
import { writeFileSync } from 'node:fs'

const modo = process.argv[3] || 'hero'
const C = Math.cos(Math.PI / 6)

let OX, OY, S, W, H
if (modo === 'hero') {
  W = 1600
  H = 900
  S = 31
  OX = 1060
  OY = 370
} else {
  W = 540
  H = 540
  S = 25
  OX = 285
  OY = 285
}

const P = (x, y, z) => [OX + (x - y) * C * S, OY + (x + y) * 0.5 * S - z * S]
const PREC = modo === 'hero' ? 2 : 10
const n = (v) => {
  const r = Math.round(v * PREC) / PREC
  return String(r)
}
const pts = (a) => 'M' + a.map((p) => n(p[0]) + ' ' + n(p[1])).join('L') + 'Z'
const line = (a) => 'M' + a.map((p) => n(p[0]) + ' ' + n(p[1])).join('L')

// semente determinística
let seed = 7
const rnd = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

const itens = []
function cubo(x0, y0, z0, w, d, h, k = 'c', decor = null) {
  itens.push({ x0, y0, z0, x1: x0 + w, y1: y0 + d, z1: z0 + h, k, decor })
}

function desenha(it) {
  const { x0, y0, z0, x1, y1, z1, k } = it
  const top = pts([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)])
  const dir = pts([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)])
  const esq = pts([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)])
  let s = `<g class="${k}"><path class="s" d="${esq}"/><path class="r" d="${dir}"/><path class="t" d="${top}"/>`
  if (it.decor) s += it.decor(it)
  return s + '</g>'
}

// ---- decorações
// caixa: fita no topo + etiqueta com "código de barras" na face frontal-esquerda
const decorCaixa = (it) => {
  const { x0, y0, x1, y1, z0, z1 } = it
  const xm = (x0 + x1) / 2
  let d = line([P(xm, y0, z1), P(xm, y1, z1), P(xm, y1, z1 - (z1 - z0) * 0.35)])
  // etiqueta
  const ex0 = x0 + (x1 - x0) * 0.6,
    ex1 = x0 + (x1 - x0) * 0.88
  const ez0 = z0 + (z1 - z0) * 0.2,
    ez1 = z0 + (z1 - z0) * 0.5
  let s = `<path class="f" d="${d}"/><path class="e" d="${pts([P(ex0, y1, ez0), P(ex1, y1, ez0), P(ex1, y1, ez1), P(ex0, y1, ez1)])}"/>`
  if (modo === 'hero') {
    let b = ''
    for (let i = 1; i < 6; i++) {
      const xb = ex0 + (ex1 - ex0) * (i / 6)
      b += line([P(xb, y1, ez0 + 0.06), P(xb, y1, ez1 - 0.06)])
    }
    s += `<path class="b" d="${b}"/>`
  }
  return s
}
// bloco de caixas (nx x ny) desenhado como um único cubo com divisões
const decorBloco =
  (nx, ny, barras = false) =>
  (it) => {
    const { x0, y0, x1, y1, z0, z1 } = it
    const cw = (x1 - x0) / nx,
      cd = (y1 - y0) / ny,
      h = z1 - z0
    let d = ''
    for (let i = 1; i < nx; i++) {
      const x = x0 + i * cw
      d += line([P(x, y0, z1), P(x, y1, z1), P(x, y1, z0)])
    }
    for (let j = 1; j < ny; j++) {
      const y = y0 + j * cd
      d += line([P(x0, y, z1), P(x1, y, z1), P(x1, y, z0)])
    }
    let fita = ''
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * cw
      fita += line([P(x, y0, z1), P(x, y1, z1), P(x, y1, z1 - h * 0.3)])
    }
    let et = '',
      b = ''
    for (let i = 0; i < nx; i++) {
      const ex0 = x0 + i * cw + cw * 0.58,
        ex1 = x0 + i * cw + cw * 0.88,
        ez0 = z0 + h * 0.18,
        ez1 = z0 + h * 0.48
      et += pts([P(ex0, y1, ez0), P(ex1, y1, ez0), P(ex1, y1, ez1), P(ex0, y1, ez1)])
      if (barras)
        for (let k = 1; k < 5; k++) {
          const xb = ex0 + ((ex1 - ex0) * k) / 5
          b += line([P(xb, y1, ez0 + h * 0.06), P(xb, y1, ez1 - h * 0.06)])
        }
    }
    let out = `<path class="f" d="${d}"/><path class="g" d="${fita}"/><path class="e" d="${et}"/>`
    if (b) out += `<path class="b" d="${b}"/>`
    return out
  }
// palete: aberturas para os garfos nas faces visíveis
const decorPalete = (it) => {
  const { x0, y0, x1, y1, z0, z1 } = it
  const h = z1 - z0,
    za = z0 + h * 0.18,
    zb = z0 + h * 0.62
  const L = x1 - x0,
    D = y1 - y0
  let d = ''
  for (const [a, b] of [
    [0.12, 0.42],
    [0.58, 0.88],
  ]) {
    d += pts([
      P(x0 + L * a, y1, za),
      P(x0 + L * b, y1, za),
      P(x0 + L * b, y1, zb),
      P(x0 + L * a, y1, zb),
    ])
    d += pts([
      P(x1, y0 + D * a, za),
      P(x1, y0 + D * b, za),
      P(x1, y0 + D * b, zb),
      P(x1, y0 + D * a, zb),
    ])
  }
  return `<path class="v" d="${d}"/>`
}
// contêiner: corrugação nas faces laterais + portas na face x1
const decorConteiner = (it) => {
  const { x0, y0, x1, y1, z0, z1 } = it
  let d = ''
  const passo = 0.6
  for (let x = x0 + passo; x < x1 - 0.1; x += passo)
    d += line([P(x, y1, z0 + 0.15), P(x, y1, z1 - 0.15)])
  // portas (face x1): divisão central + barras de travamento
  const ym = (y0 + y1) / 2
  d += line([P(x1, ym, z0 + 0.1), P(x1, ym, z1 - 0.1)])
  for (const f of [0.25, 0.4, 0.6, 0.75]) {
    const y = y0 + (y1 - y0) * f
    d += line([P(x1, y, z0 + 0.2), P(x1, y, z1 - 0.2)])
  }
  // friso superior e inferior
  d += line([P(x0, y1, z1 - 0.2), P(x1, y1, z1 - 0.2), P(x1, y0, z1 - 0.2)])
  d += line([P(x0, y1, z0 + 0.2), P(x1, y1, z0 + 0.2), P(x1, y0, z0 + 0.2)])
  return `<path class="f" d="${d}"/>`
}

// ---- porta-paletes
function rack(x0, y0, baias, bw = 5.4, prof = 2.2, niveis = [0, 3, 6], alto = 8.6, cheio = 0.8) {
  const up = 0.16
  for (let i = 0; i <= baias; i++) {
    const x = x0 + i * bw
    cubo(x, y0, 0, up, up, alto, 'u')
    cubo(x, y0 + prof - up, 0, up, up, alto, 'u')
  }
  const vigas = [...niveis.filter((z) => z > 0), alto - 0.05]
  for (let i = 0; i < baias; i++) {
    const xa = x0 + i * bw + up,
      xb = x0 + (i + 1) * bw
    for (const z of vigas) {
      cubo(xa, y0 + prof - 0.12, z - 0.3, xb - xa, 0.12, 0.3, 'o')
    }
    for (const z of niveis) {
      for (let j = 0; j < 2; j++) {
        if (rnd() > cheio) continue
        const pw = 2.3,
          px = xa + 0.25 + j * (pw + 0.3)
        const py = y0 + 0.1,
          pd = prof - 0.2
        cubo(px, py, z, pw, pd, 0.35, 'p', decorPalete)
        bloco(px, py, z + 0.35, pw, pd)
      }
    }
  }
}
function bloco(px, py, z, pw, pd) {
  const h1 = 0.8 + Math.round(rnd() * 3) * 0.1
  const bar = rnd() < 0.3
  const tipo = rnd()
  if (tipo < 0.15) {
    // caixas altas
    cubo(px + 0.03, py + 0.03, z, pw - 0.06, pd - 0.06, 1.7, 'c', decorBloco(2, 1, bar))
    return
  }
  cubo(px + 0.03, py + 0.03, z, pw - 0.06, pd - 0.06, h1, 'c', decorBloco(2, 2, bar))
  const t2 = rnd()
  if (t2 < 0.35)
    cubo(px + 0.03, py + 0.03, z + h1, pw - 0.06, pd - 0.06, 0.8, 'c', decorBloco(2, 2, false))
  else if (t2 < 0.65)
    cubo(
      px + 0.03,
      py + 0.03,
      z + h1,
      (pw - 0.06) / 2,
      pd - 0.06,
      0.8,
      'c',
      decorBloco(1, 2, false),
    )
}

// ---- empilhadeira (garfos apontando para +x)
function empilhadeira(x0, y0, zc = 1.2) {
  const L = 3.4,
    Wd = 1.9
  // contrapeso + chassi
  cubo(x0, y0 + 0.2, 0.3, 0.9, Wd - 0.4, 1.4, 'k')
  const yr = y0 + Wd - 0.2
  const roda = (cx) => {
    const a = [],
      b = []
    for (let i = 0; i < 20; i++) {
      const t = (i / 20) * Math.PI * 2
      a.push(P(cx + 0.45 * Math.cos(t), yr, 0.45 + 0.45 * Math.sin(t)))
      b.push(P(cx + 0.17 * Math.cos(t), yr, 0.45 + 0.17 * Math.sin(t)))
    }
    return pts(a) + pts(b)
  }
  cubo(
    x0 + 0.9,
    y0 + 0.2,
    0.3,
    L - 0.9,
    Wd - 0.4,
    0.8,
    'k',
    () => `<path class="w" d="${roda(x0 + 0.7) + roda(x0 + 2.75)}"/>`,
  )
  // banco
  cubo(x0 + 1.0, y0 + 0.55, 1.1, 0.14, Wd - 1.1, 0.85, 'k')
  cubo(x0 + 1.14, y0 + 0.55, 1.1, 0.55, Wd - 1.1, 0.22, 'k')
  cubo(x0 + 2.35, y0 + 0.7, 1.1, 0.12, 0.12, 0.6, 'k')
  cubo(x0 + 2.2, y0 + 0.55, 1.7, 0.4, 0.45, 0.06, 'k')
  // proteção do operador (4 colunas + teto)
  const zt = 3.3
  for (const [a, b] of [
    [0.9, 0.25],
    [0.9, Wd - 0.37],
    [2.9, 0.25],
    [2.9, Wd - 0.37],
  ])
    cubo(x0 + a, y0 + b, 1.1, 0.12, 0.12, zt - 1.1, 'k')
  cubo(x0 + 0.85, y0 + 0.2, zt, 2.2, Wd - 0.4, 0.12, 'k')
  // torre (mastro)
  cubo(x0 + L, y0 + 0.3, 0.2, 0.22, 0.2, 4.2, 'u')
  cubo(x0 + L, y0 + Wd - 0.5, 0.2, 0.22, 0.2, 4.2, 'u')
  cubo(x0 + L, y0 + 0.5, 3.9, 0.22, Wd - 1.0, 0.18, 'u')
  // carro + garfos
  cubo(x0 + L + 0.22, y0 + 0.3, zc - 0.1, 0.1, Wd - 0.6, 1.0, 'k')
  cubo(x0 + L + 0.32, y0 + 0.45, zc - 0.1, 2.3, 0.22, 0.1, 'k')
  cubo(x0 + L + 0.32, y0 + Wd - 0.67, zc - 0.1, 2.3, 0.22, 0.1, 'k')
  // palete com caixas nos garfos
  const px = x0 + L + 0.4,
    py = y0 + 0.0,
    pd = Wd,
    pw = 2.2
  cubo(px, py, zc, pw, pd, 0.32, 'p', decorPalete)
  cubo(px + 0.03, py + 0.03, zc + 0.32, pw - 0.06, pd - 0.06, 0.85, 'c', decorBloco(2, 2, true))
  cubo(
    px + 0.03,
    py + 0.03,
    zc + 1.17,
    (pw - 0.06) / 2,
    pd - 0.06,
    0.75,
    'c',
    decorBloco(1, 2, false),
  )
}

// ---- cena
function paleteSolto(x, y, z = 0, carga = true) {
  cubo(x, y, z, 2.3, 2.0, 0.35, 'p', decorPalete)
  if (carga) cubo(x + 0.03, y + 0.03, z + 0.35, 2.24, 1.94, 0.9, 'c', decorBloco(2, 2, true))
}
if (modo === 'hero') {
  rack(0, -2, 3)
  rack(0, 5.2, 3)
  empilhadeira(6.5, 10.2, 1.0)
  paletteArea()
  cubo(19, -7, 0, 2.4, 12, 2.6, 'n', decorConteiner)
} else {
  seed = 11
  rack(0, 0, 2, 5.4, 2.2, [0, 3, 6], 8.6, 0.9)
  empilhadeira(0.6, 5.3, 1.6)
}
function paletteArea() {
  paleteSolto(14.5, 9.4)
  paleteSolto(14.5, 11.8, 0, false)
  paleteSolto(14.5, 11.8, 0.35, false)
  paleteSolto(14.5, 11.8, 0.7, true)
}

// ---- ordenação por profundidade (topológica)
function bbox(it) {
  const c = []
  for (const x of [it.x0, it.x1])
    for (const y of [it.y0, it.y1]) for (const z of [it.z0, it.z1]) c.push(P(x, y, z))
  return [
    Math.min(...c.map((p) => p[0])),
    Math.max(...c.map((p) => p[0])),
    Math.min(...c.map((p) => p[1])),
    Math.max(...c.map((p) => p[1])),
  ]
}
function atras(a, b) {
  const e = 1e-6
  if (a.x1 <= b.x0 + e) return true
  if (b.x1 <= a.x0 + e) return false
  if (a.y1 <= b.y0 + e) return true
  if (b.y1 <= a.y0 + e) return false
  if (a.z1 <= b.z0 + e) return true
  if (b.z1 <= a.z0 + e) return false
  return a.x0 + a.y0 + a.z0 < b.x0 + b.y0 + b.z0
}
const N = itens.length
const bb = itens.map(bbox)
const adj = Array.from({ length: N }, () => [])
const grau = new Array(N).fill(0)
for (let i = 0; i < N; i++)
  for (let j = i + 1; j < N; j++) {
    const A = bb[i],
      B = bb[j]
    if (A[1] <= B[0] || B[1] <= A[0] || A[3] <= B[2] || B[3] <= A[2]) continue
    if (atras(itens[i], itens[j])) {
      adj[i].push(j)
      grau[j]++
    } else {
      adj[j].push(i)
      grau[i]++
    }
  }
const chave = (i) => itens[i].x0 + itens[i].y0 + itens[i].z0
const ordem = []
const pronto = []
for (let i = 0; i < N; i++) if (grau[i] === 0) pronto.push(i)
const usado = new Array(N).fill(false)
while (ordem.length < N) {
  if (pronto.length === 0) {
    // ciclo: escolhe o de menor chave
    let m = -1
    for (let i = 0; i < N; i++) if (!usado[i] && (m < 0 || chave(i) < chave(m))) m = i
    pronto.push(m)
    grau[m] = 0
  }
  pronto.sort((a, b) => chave(b) - chave(a))
  const i = pronto.pop()
  if (usado[i]) continue
  usado[i] = true
  ordem.push(i)
  for (const j of adj[i]) if (--grau[j] === 0 && !usado[j]) pronto.push(j)
}

// ---- piso (grade isométrica)
let grade = ''
const g = 3
for (let k = -40; k <= 40; k += g) {
  grade += line([P(k, -40, 0), P(k, 40, 0)])
  grade += line([P(-40, k, 0), P(40, k, 0)])
}
// faixas de segurança no piso (corredor)
let piso = ''
if (modo === 'hero') {
  piso += line([P(-1, 0.6, 0), P(18, 0.6, 0)]) + line([P(-1, 4.8, 0), P(18, 4.8, 0)])
}

const corpo = ordem.map((i) => desenha(itens[i])).join('')

const estilo =
  '.t{fill:#1E3A5F}.s,.r{fill:#0B1F3A}' +
  '.o .s,.o .r{fill:#F59E0B;fill-opacity:.22}.o .t{fill:#F59E0B;fill-opacity:.5}.o path{stroke:#F59E0B;stroke-opacity:.7}' +
  '.k .t{fill:#F59E0B;fill-opacity:.35}.k path{stroke:#F59E0B}' +
  '.w{fill:#0B1F3A;stroke:#6B7280;stroke-width:1.6;fill-rule:evenodd}' +
  '.n .t{fill:#1E3A5F}.n path{stroke:#2F5D8A}' +
  '.f,.g,.b,.v{fill:none;stroke-width:1}.g{stroke-opacity:.6}.b{stroke:#6B7280}.e{fill:#1E3A5F;stroke-width:1}.v{fill:#0B1F3A}'

let svg
if (modo === 'hero') {
  svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><title>Armazém com porta-paletes, empilhadeira e contêiner</title>` +
    `<defs><linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1F3A"/><stop offset=".55" stop-color="#0B1F3A"/><stop offset="1" stop-color="#1E3A5F"/></linearGradient>` +
    `<radialGradient id="brilho" cx="1150" cy="420" r="640" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2F5D8A" stop-opacity=".35"/><stop offset="1" stop-color="#2F5D8A" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="esmaece" x1="0" x2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#fff" stop-opacity="1"/></linearGradient>` +
    `<mask id="m"><rect width="${W}" height="${H}" fill="url(#esmaece)"/></mask>` +
    `<style>${estilo}</style></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#fundo)"/><rect width="${W}" height="${H}" fill="url(#brilho)"/>` +
    `<path d="${grade}" fill="none" stroke="#1E3A5F" stroke-width="1" mask="url(#m)"/>` +
    `<path d="${piso}" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="14 10" stroke-opacity=".45"/>` +
    `<g stroke="#2F5D8A" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${corpo}</g></svg>`
} else {
  svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs><style>${estilo}</style>` +
    `<radialGradient id="gm" cx="${OX}" cy="${OY + 90}" r="270" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<mask id="m"><rect width="${W}" height="${H}" fill="url(#gm)"/></mask></defs>` +
    `<path d="${grade}" fill="none" stroke="#1E3A5F" stroke-width="1" mask="url(#m)"/>` +
    `<g stroke="#2F5D8A" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">${corpo}</g></svg>`
}
writeFileSync(process.argv[2], svg)
console.log(modo, N, 'itens', svg.length, 'bytes')
