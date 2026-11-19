// Uso: node render.mjs <arquivo.svg|.html> <saida.png> <largura> <altura> [modo]
// modo: "raw" (abre o arquivo direto), "duo" (svg em fundo branco e marinho lado a lado),
//       "tile" (svg como background repetido), "faixa" (faixa repetida)
import { spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const [, , entrada, saida, w, h, modo = 'raw'] = process.argv
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
let alvo = resolve(entrada)
if (modo !== 'raw') {
  const url = pathToFileURL(resolve(entrada)).href
  let corpo = ''
  if (modo === 'duo') {
    corpo =
      `<div style="display:flex;height:100vh">` +
      `<div style="flex:1;background:#fff;display:grid;place-items:center"><img src="${url}" style="width:80%"></div>` +
      `<div style="flex:1;background:#0B1F3A;display:grid;place-items:center"><img src="${url}" style="width:80%"></div></div>`
  } else if (modo === 'tile') {
    corpo =
      `<div style="display:flex;height:100vh">` +
      `<div style="flex:1;background:#fff;position:relative"><div style="position:absolute;inset:0;background:url(${url});opacity:.35"></div></div>` +
      `<div style="flex:1;background:#0B1F3A;position:relative"><div style="position:absolute;inset:0;background:url(${url});opacity:.35"></div></div></div>`
  } else if (modo === 'faixa') {
    corpo =
      `<div style="padding:40px;background:#fff"><div style="height:8px;background:url(${url}) repeat-x;background-size:auto 8px"></div>` +
      `<div style="margin-top:30px;border-left:8px solid;border-image:url(${url}) 0 0 0 8 repeat;padding:20px;font:16px Segoe UI">Alerta crítico</div>` +
      `<div style="margin-top:30px;height:16px;background:url(${url}) repeat-x;background-size:auto 16px"></div></div>` +
      `<div style="padding:40px;background:#0B1F3A"><div style="height:8px;background:url(${url}) repeat-x;background-size:auto 8px"></div>` +
      `<div style="margin-top:30px;height:16px;background:url(${url}) repeat-x;background-size:auto 16px"></div></div>`
  }
  alvo = resolve(dirname(saida), 'wrap-' + Date.now() + '.html')
  writeFileSync(alvo, `<!doctype html><html><body style="margin:0">${corpo}</body></html>`)
}
const perfil = resolve(dirname(process.argv[1]), '..', 'chrome-og')
const r = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    `--user-data-dir=${perfil}`,
    `--window-size=${w},${h}`,
    `--screenshot=${resolve(saida)}`,
    pathToFileURL(alvo).href,
  ],
  { encoding: 'utf8' },
)
const buf = readFileSync(saida)
console.log('png', buf.readUInt32BE(16), 'x', buf.readUInt32BE(20), buf.length, 'bytes', r.status)
