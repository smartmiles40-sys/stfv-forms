// Exercita o /api/publicar com req/res falsos e fetch stubado.
//
// Aqui mora a parte perigosa do projeto: uma rota que grava uma pagina servida
// no nosso dominio. As duas garantias que este teste protege sao:
//   1. falta de configuracao FECHA a rota (nunca abre);
//   2. HTML vindo do cliente e ignorado — quem gera a pagina e o servidor.
// Sem 2, quem tivesse a senha hospedaria pagina de golpe num dominio nosso.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import publicar from '../api/publicar.mjs'

const SPEC = JSON.parse(readFileSync('.amostra/live-bifurcada.stfv.json', 'utf8'))

function resFalso() {
  const r = { _status: 0, _json: null, _headers: {} }
  r.status = (s) => { r._status = s; return r }
  r.json = (j) => { r._json = j; return r }
  r.send = () => r
  r.setHeader = (k, v) => { r._headers[k] = v }
  return r
}

const envLimpo = () => {
  process.env.PUBLICAR_SENHA = 'senha-certa'
  process.env.SUPABASE_FORMS_URL = 'https://exemplo.supabase.co'
  process.env.SUPABASE_FORMS_KEY = 'chave'
}

let ultimoFetch = null
globalThis.fetch = async (url, opts) => {
  ultimoFetch = { url, opts }
  return { ok: true, status: 201, text: async () => '' }
}

const post = (body, senha = 'senha-certa', extra = {}) => ({
  method: 'POST',
  headers: { 'x-stfv-senha': senha, host: 'exemplo.vercel.app', ...extra },
  body,
})

const casos = []
const teste = async (nome, fn) => {
  try { await fn(); casos.push(['ok', nome]) }
  catch (e) { casos.push(['FALHOU', `${nome}\n      ${e.message}`]) }
}

await teste('GET e rejeitado', async () => {
  envLimpo()
  const r = resFalso()
  await publicar({ method: 'GET', headers: {} }, r)
  assert.equal(r._status, 405)
})

await teste('sem PUBLICAR_SENHA a rota fica FECHADA', async () => {
  envLimpo()
  delete process.env.PUBLICAR_SENHA
  const r = resFalso()
  await publicar(post({ spec: SPEC }, ''), r)
  assert.equal(r._status, 503)
})

await teste('senha errada da 401', async () => {
  envLimpo()
  const r = resFalso()
  await publicar(post({ spec: SPEC }, 'chute'), r)
  assert.equal(r._status, 401)
})

await teste('sem senha nenhuma da 401', async () => {
  envLimpo()
  const r = resFalso()
  await publicar({ method: 'POST', headers: {}, body: { spec: SPEC } }, r)
  assert.equal(r._status, 401)
})

await teste('slug invalido e recusado', async () => {
  envLimpo()
  const r = resFalso()
  await publicar(post({ spec: { ...SPEC, slug: 'Slug Com Espaco' } }), r)
  assert.equal(r._status, 400)
  assert.equal(r._json.erro, 'slug_invalido')
})

await teste('destino apontando pra fora e recusado', async () => {
  envLimpo()
  const r = resFalso()
  const spec = { ...SPEC, destino: { ...SPEC.destino, url: 'https://site-de-terceiro.com/coleta' } }
  await publicar(post({ spec }), r)
  assert.equal(r._status, 400)
  assert.equal(r._json.erro, 'destino_invalido')
})

await teste('spec com regra orfa nao publica', async () => {
  envLimpo()
  const r = resFalso()
  const spec = JSON.parse(JSON.stringify(SPEC))
  spec.destino.regrasSaida[0].valor = 'opcao que nao existe mais'
  await publicar(post({ spec }), r)
  assert.equal(r._status, 400)
  assert.equal(r._json.erro, 'avisos_pendentes')
  assert.ok(r._json.avisos.some((a) => /órfã/.test(a)))
})

await teste('HTML do cliente e IGNORADO — o servidor gera o seu', async () => {
  envLimpo()
  const r = resFalso()
  await publicar(post({ spec: SPEC, html: '<script>roubar()</script>' }), r)
  assert.equal(r._status, 200, JSON.stringify(r._json))
  const gravado = JSON.parse(ultimoFetch.opts.body)
  assert.ok(!gravado.html.includes('roubar()'), 'HTML do cliente vazou pro banco')
  assert.ok(/<!doctype html>/i.test(gravado.html))
})

await teste('publicacao boa faz upsert por slug e devolve a URL', async () => {
  envLimpo()
  const r = resFalso()
  await publicar(post({ spec: SPEC }), r)
  assert.equal(r._status, 200)
  assert.equal(r._json.url, `https://exemplo.vercel.app/f/${SPEC.slug}`)
  assert.ok(ultimoFetch.url.includes('on_conflict=slug'))
  assert.ok(ultimoFetch.opts.headers.Prefer.includes('merge-duplicates'))
})

let falhas = 0
for (const [st, nome] of casos) {
  if (st !== 'ok') falhas++
  console.log(`  api ${st === 'ok' ? 'ok  ' : 'FALHOU'}  ${nome}`)
}
if (falhas) {
  console.error(`\n${falhas} teste(s) da API falharam.`)
  process.exit(1)
}
console.log('OK: /api/publicar recusa o que tem que recusar')
