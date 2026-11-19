// Monta o HTML autocontido da og-image. Uso: node og.mjs <cena.svg> <favicon.svg> <saida.html>...
import { readFileSync, writeFileSync } from 'node:fs'

const [, , cenaArq, iconeArq, ...saidas] = process.argv
const cena = readFileSync(cenaArq, 'utf8').replace(
  '<svg ',
  '<svg class="og-cena" aria-hidden="true" ',
)
const icone = readFileSync(iconeArq, 'utf8')
  .replace(/<title>[^<]*<\/title>/, '')
  .replace('<svg ', '<svg class="og-icone" aria-hidden="true" ')

// Curva ABC (Pareto) sintética: 10 itens, participação decrescente
const part = [34, 22, 12, 9, 7, 5, 4, 3, 2.5, 1.5]
const cor = (i) => (i < 2 ? '#1D4ED8' : i < 5 ? '#60A5FA' : '#94A3B8')
const cw = 224,
  ch = 96,
  bw = 16,
  gap = 6.4
let barras = '',
  acum = 0,
  pontos = []
part.forEach((p, i) => {
  const x = 6 + i * (bw + gap),
    h = (p / 34) * ch * 0.62
  barras += `<rect x="${x.toFixed(1)}" y="${(ch - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="2" fill="${cor(i)}"/>`
  acum += p
  pontos.push([x + bw / 2, ch - (acum / 100) * ch * 0.96])
})
const curva = 'M' + pontos.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L')
const nos = pontos
  .map((q) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="2.6" fill="#F59E0B"/>`)
  .join('')
const grafico =
  `<svg class="og-pareto" viewBox="0 0 ${cw} ${ch}" width="${cw}" height="${ch}" aria-hidden="true">` +
  `<path d="M0 ${ch - 0.5}H${cw}" stroke="#2F5D8A"/>${barras}` +
  `<path d="${curva}" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linejoin="round"/>${nos}</svg>`

const html = `<!doctype html>
<!--
  Fonte da imagem public/og-image.png (1200x627, prévia de link no LinkedIn).
  Arquivo autocontido: nenhuma fonte, imagem ou script externo.
  Para regenerar (PowerShell, a partir da raiz do repositório):
    Start-Process -Wait "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" -ArgumentList '--headless=new','--disable-gpu','--hide-scrollbars','--window-size=1200,627',"--screenshot=$PWD\\public\\og-image.png","file:///$($PWD -replace '\\\\','/')/scripts/og-image.html"
  O PNG do Chrome sai com ~390 KB; a versão publicada foi reduzida para 256 cores (Pillow:
    Image.open(p).convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT, kmeans=3).save(p, optimize=True))
  A ilustração do armazém é uma versão compacta de src/assets/bg/hero-armazem.svg.
-->
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Kit Estoque MRP — og-image</title>
<style>
  html, body { margin: 0; width: 1200px; height: 627px; overflow: hidden; }
  body {
    position: relative;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: #E5E7EB;
    background:
      radial-gradient(circle at 900px 300px, rgba(47, 93, 138, 0.45), rgba(47, 93, 138, 0) 460px),
      linear-gradient(135deg, #0B1F3A 0%, #0B1F3A 45%, #1E3A5F 100%);
  }
  .og-texto { position: absolute; left: 72px; top: 92px; width: 600px; }
  .og-marca { display: flex; align-items: center; gap: 20px; }
  .og-icone { width: 76px; height: 76px; flex: none; }
  .og-titulo { margin: 0; font-size: 64px; line-height: 1.05; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px; }
  .og-acento { width: 88px; height: 6px; border-radius: 3px; background: #F59E0B; margin: 34px 0 26px; }
  .og-sub { margin: 0; font-size: 33px; line-height: 1.28; font-weight: 400; color: #E5E7EB; }
  .og-selo {
    display: inline-flex; align-items: center; gap: 12px; margin-top: 40px;
    padding: 11px 20px 11px 16px; border-radius: 999px;
    background: rgba(30, 58, 95, 0.75); border: 1.5px solid #2F5D8A;
    font-size: 22px; font-weight: 600; color: #E5E7EB;
  }
  .og-selo svg { width: 24px; height: 24px; flex: none; }
  .og-selo .og-ponto { color: #F59E0B; }
  .og-cena { position: absolute; right: -40px; top: 22px; width: 560px; height: 560px; }
  .og-cartao {
    position: absolute; right: 36px; bottom: 44px; width: 252px; padding: 14px 14px 12px;
    border-radius: 14px; background: rgba(11, 31, 58, 0.9); border: 1.5px solid #2F5D8A;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  }
  .og-cartao-topo { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
  .og-cartao-topo strong { font-size: 17px; color: #FFFFFF; }
  .og-legenda { display: flex; gap: 10px; font-size: 13px; font-weight: 700; }
  .og-legenda i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
  .og-faixa {
    position: absolute; left: 0; right: 0; bottom: 0; height: 12px;
    background: repeating-linear-gradient(135deg, #F59E0B 0 9px, #0B1F3A 9px 18px);
  }
</style>
</head>
<body>
  ${cena}
  <div class="og-texto">
    <div class="og-marca">${icone}<h1 class="og-titulo">Kit Estoque MRP</h1></div>
    <div class="og-acento"></div>
    <p class="og-sub">Curva ABC-XYZ, reposição, compras e MRP a partir da sua planilha</p>
    <div class="og-selo">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10.5" width="16" height="11" rx="2.5" fill="#F59E0B"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#F59E0B" stroke-width="2.4"/><circle cx="12" cy="16" r="1.8" fill="#0B1F3A"/></svg>
      <span>Grátis <span class="og-ponto">·</span> Seus dados não saem do seu computador</span>
    </div>
  </div>
  <div class="og-cartao">
    <div class="og-cartao-topo"><strong>Curva ABC</strong>
      <span class="og-legenda"><span><i style="background:#1D4ED8"></i>A</span><span><i style="background:#60A5FA"></i>B</span><span><i style="background:#94A3B8"></i>C</span></span>
    </div>
    ${grafico}
  </div>
  <div class="og-faixa"></div>
</body>
</html>
`
for (const s of saidas) writeFileSync(s, html)
console.log('ok', html.length)
