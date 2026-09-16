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

// ---------------------------------------------------------------------------
// /api/forms — a lista da pagina inicial.
//
// Ela revela quais formularios existem, e o spec traz numero de WhatsApp e
// regras de saida. Tem que exigir senha e fechar quando nao configurada, igual
// ao /api/publicar.
// ---------------------------------------------------------------------------
const { default: listarForms } = await import('../api/forms.mjs')

const get = (query = {}, senha = 'senha-certa') => ({
  method: 'GET',
  headers: { 'x-stfv-senha': senha },
  query,
})

await teste('/api/forms recusa POST', async () => {
  envLimpo()
  const r = resFalso()
  await listarForms({ method: 'POST', headers: {}, query: {} }, r)
  assert.equal(r._status, 405)
})

await teste('/api/forms sem senha configurada FECHA', async () => {
  envLimpo()
  delete process.env.PUBLICAR_SENHA
  const r = resFalso()
  await listarForms(get({}, ''), r)
  assert.equal(r._status, 503)
})

await teste('/api/forms com senha errada da 401', async () => {
  envLimpo()
  const r = resFalso()
  await listarForms(get({}, 'chute'), r)
  assert.equal(r._status, 401)
})

await teste('/api/forms nao devolve a coluna html na listagem', async () => {
  // 28 KB por formulario que ninguem usa pra montar a lista.
  envLimpo()
  let urlPedida = ''
  globalThis.fetch = async (url) => {
    urlPedida = String(url)
    return { ok: true, status: 200, json: async () => [] }
  }
  const r = resFalso()
  await listarForms(get(), r)
  assert.equal(r._status, 200)
  assert.ok(!/select=[^&]*html/.test(urlPedida), `pediu html a toa: ${urlPedida}`)
  assert.ok(/order=atualizado_em\.desc/.test(urlPedida), 'mais recente primeiro')
})

// ---------------------------------------------------------------------------
// /api/save-lead — o caminho do lead ate o Bitrix.
//
// O erro que este bloco existe pra impedir: mandar o negocio pra etapa errada.
// Neste portal os IDs padrao foram reaproveitados fora de ordem — C25:NEW e
// "Ajuste", nao "Novo lead". Um negocio criado em C25:NEW nao da erro nenhum:
// so cai numa coluna que ninguem olha, e o lead da live morre ali.
// ---------------------------------------------------------------------------
const { default: saveLead } = await import('../api/save-lead.mjs')
const { verificarBitrix } = await import('../api/_bitrix.mjs')

const BITRIX = 'https://portal.bitrix24.com.br/rest/1/token'

/** Stub do Bitrix: registra as chamadas e responde conforme o roteiro. */
function stubBitrix(roteiro = {}) {
  const chamadas = []
  globalThis.fetch = async (url, opts) => {
    const metodo = String(url).split('/').pop().replace('.json', '')
    const corpo = JSON.parse(opts.body || '{}')
    chamadas.push({ metodo, corpo, url: String(url) })
    if (metodo in roteiro) return roteiro[metodo]
    // Supabase (tabela de pendentes) cai aqui.
    if (String(url).includes('/rest/v1/')) return { ok: true, status: 201, text: async () => '' }
    return { ok: true, status: 200, json: async () => ({ result: 999 }) }
  }
  return chamadas
}

const jsonOk = (result) => ({ ok: true, status: 200, json: async () => ({ result }) })
const jsonErro = (error, descricao) => ({
  ok: true, status: 200,
  json: async () => ({ error, error_description: descricao }),
})

const leadBom = () => ({
  method: 'POST',
  headers: {},
  body: {
    lead_id: 'lead_teste_1',
    slug: 'exemplo',
    form_name: 'exemplo-2026',
    nome: 'Bruno Oliveira',
    email: 'BRUNO@Exemplo.com ',
    whatsapp: '(11) 98765-4321',
    assistiu_live: 'Sim, eu assisti tudo',
    utm_source: 'instagram',
  },
})

await teste('lead vai pro Bitrix na etapa CERTA, nao em C25:NEW', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  delete process.env.BITRIX_CATEGORY_ID
  delete process.env.BITRIX_STAGE_ID
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const r = resFalso()
  await saveLead(leadBom(), r)
  assert.equal(r._status, 200, JSON.stringify(r._json))
  const deal = chamadas.find((c) => c.metodo === 'crm.deal.add')
  assert.ok(deal, 'nao criou negocio')
  assert.equal(deal.corpo.fields.CATEGORY_ID, '25')
  assert.equal(deal.corpo.fields.STAGE_ID, 'C25:PREPAYMENT_INVOIC')
  assert.notEqual(deal.corpo.fields.STAGE_ID, 'C25:NEW', 'C25:NEW e "Ajuste", nao Novo lead')
  assert.equal(deal.corpo.fields.CONTACT_ID, 77, 'negocio tem que apontar pro contato criado')
})

await teste('WhatsApp e e-mail chegam normalizados no contato', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const r = resFalso()
  await saveLead(leadBom(), r)
  const contato = chamadas.find((c) => c.metodo === 'crm.contact.add')
  assert.equal(contato.corpo.fields.PHONE[0].VALUE, '+5511987654321')
  assert.equal(contato.corpo.fields.EMAIL[0].VALUE, 'bruno@exemplo.com')
})

await teste('resposta da live vira observacao, mas a fonte NAO', async () => {
  // A fonte tem campo proprio (SOURCE_ID). Repetir no comentario suja e faz
  // parecer que a origem mora la — confusao real que ja aconteceu.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const req = leadBom()
  req.body.source_id = 'LIVE_EGITO'
  req.body.fonte = '[Egito] - Live'
  await saveLead(req, resFalso())
  const deal = chamadas.find((c) => c.metodo === 'crm.deal.add')
  const obs = deal.corpo.fields.COMMENTS
  assert.ok(obs.includes('assistiu_live'), 'a resposta da live tem que ficar na observacao')
  assert.ok(obs.includes('utm_source=instagram'))
  assert.ok(!obs.includes('LIVE_EGITO'), 'source_id nao pode aparecer no comentario')
  assert.ok(!/^fonte:/m.test(obs), 'fonte nao pode aparecer no comentario')
  assert.equal(deal.corpo.fields.SOURCE_ID, 'LIVE_EGITO', 'ela mora no campo Fonte')
})

await teste('Bitrix recusando, o lead e GUARDADO em vez de sumir', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  process.env.SUPABASE_FORMS_URL = 'https://exemplo.supabase.co'
  process.env.SUPABASE_FORMS_KEY = 'chave'
  const chamadas = stubBitrix({
    'crm.contact.add': jsonErro('insufficient_scope', 'sem escopo CRM'),
  })
  const r = resFalso()
  await saveLead(leadBom(), r)
  const guardou = chamadas.find((c) => c.url.includes('stfv_leads_pendentes'))
  assert.ok(guardou, 'lead recusado tem que ir pra tabela de pendentes')
  assert.ok(/insufficient_scope/.test(guardou.corpo.motivo), 'motivo devia registrar o erro')
  assert.equal(r._status, 200, 'guardado com sucesso = 200')
})

await teste('sem Bitrix E sem onde guardar, devolve erro (nao finge sucesso)', async () => {
  delete process.env.BITRIX_WEBHOOK_URL
  delete process.env.SUPABASE_FORMS_URL
  delete process.env.SUPABASE_FORMS_KEY
  stubBitrix()
  const r = resFalso()
  await saveLead(leadBom(), r)
  assert.equal(r._status, 502)
  assert.equal(r._json.ok, false)
})

await teste('nome curto demais e recusado no servidor', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  stubBitrix()
  const r = resFalso()
  const req = leadBom()
  req.body.nome = 'B'
  await saveLead(req, r)
  assert.equal(r._status, 400)
  assert.equal(r._json.error, 'nome_invalido')
})

await teste('a FONTE do formulario chega no negocio (nao o generico WEB)', async () => {
  // O portal usa codigos proprios por origem e o dashboard agrupa por eles.
  // Mandar 'WEB' nao da erro: o lead so some no meio de "Site".
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  delete process.env.BITRIX_SOURCE_ID
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const req = leadBom()
  req.body.source_id = 'LIVE_ITALIA'
  const r = resFalso()
  await saveLead(req, r)
  const deal = chamadas.find((c) => c.metodo === 'crm.deal.add')
  assert.equal(deal.corpo.fields.SOURCE_ID, 'LIVE_ITALIA')
  const contato = chamadas.find((c) => c.metodo === 'crm.contact.add')
  assert.equal(contato.corpo.fields.SOURCE_ID, 'LIVE_ITALIA', 'contato e negocio na mesma fonte')
})

await teste('slug NAO registrado ainda deixa a fonte passar', async () => {
  // A allowlist por slug ja engoliu o source_id uma vez. Slug novo tem que
  // continuar levando a origem, senao o lead cai no generico "Site" calado.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  delete process.env.BITRIX_SOURCE_ID
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const req = leadBom()
  req.body.slug = 'slug-que-ninguem-registrou'
  req.body.source_id = 'LIVE_EGITO'
  await saveLead(req, resFalso())
  const deal = chamadas.find((c) => c.metodo === 'crm.deal.add')
  assert.equal(deal.corpo.fields.SOURCE_ID, 'LIVE_EGITO')
})

await teste('sem fonte no formulario, usa a env var antes do generico', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  process.env.BITRIX_SOURCE_ID = 'LIVE_PERU'
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  await saveLead(leadBom(), resFalso())
  const deal = chamadas.find((c) => c.metodo === 'crm.deal.add')
  assert.equal(deal.corpo.fields.SOURCE_ID, 'LIVE_PERU')
  delete process.env.BITRIX_SOURCE_ID
})

await teste('sem BITRIX_SDR_IDS, nao manda responsavel (fica no dono do webhook)', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  delete process.env.BITRIX_SDR_IDS
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const r = resFalso()
  await saveLead(leadBom(), r)
  const deal = chamadas.find((c) => c.metodo === 'crm.deal.add')
  assert.ok(!('ASSIGNED_BY_ID' in deal.corpo.fields))
})

await teste('rodizio distribui entre as SDRs, e contato e negocio vao pra mesma', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  process.env.BITRIX_SDR_IDS = '20781, 17191 ,2329'
  process.env.SUPABASE_FORMS_URL = 'https://exemplo.supabase.co'
  process.env.SUPABASE_FORMS_KEY = 'chave'

  // Sequence do Postgres emulada: 1, 2, 3, 4...
  let n = 0
  const recebidos = []
  globalThis.fetch = async (url, opts) => {
    const alvo = String(url)
    if (alvo.includes('rpc/stfv_proximo_sdr')) {
      n += 1
      return { ok: true, status: 200, json: async () => n }
    }
    const metodo = alvo.split('/').pop().replace('.json', '')
    const corpo = JSON.parse(opts.body || '{}')
    if (metodo === 'crm.deal.add') {
      recebidos.push({
        deal: corpo.fields.ASSIGNED_BY_ID,
        contato: globalThis.__ultimoContatoAssign,
      })
      return { ok: true, status: 200, json: async () => ({ result: 88 }) }
    }
    if (metodo === 'crm.contact.add') {
      globalThis.__ultimoContatoAssign = corpo.fields.ASSIGNED_BY_ID
      return { ok: true, status: 200, json: async () => ({ result: 77 }) }
    }
    return { ok: true, status: 201, text: async () => '' }
  }

  for (let i = 0; i < 9; i++) await saveLead(leadBom(), resFalso())

  const contagem = {}
  for (const rec of recebidos) {
    contagem[rec.deal] = (contagem[rec.deal] ?? 0) + 1
    assert.equal(rec.contato, rec.deal, 'contato e negocio tem que ir pra mesma SDR')
  }
  assert.deepEqual(
    Object.keys(contagem).sort(),
    ['17191', '2329', '20781'].sort(),
    `as 3 SDRs deviam receber; recebeu ${JSON.stringify(contagem)}`,
  )
  for (const [sdr, qtd] of Object.entries(contagem)) {
    assert.equal(qtd, 3, `${sdr} devia receber 3 de 9, recebeu ${qtd}`)
  }
})

await teste('rodizio fora do ar nao trava o lead', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  process.env.BITRIX_SDR_IDS = '20781,17191'
  process.env.SUPABASE_FORMS_URL = 'https://exemplo.supabase.co'
  process.env.SUPABASE_FORMS_KEY = 'chave'
  const chamadas = stubBitrix({
    'crm.contact.add': jsonOk(77),
    'crm.deal.add': jsonOk(88),
  })
  // A chamada do rodizio explode; o lead tem que passar assim mesmo.
  const fetchBase = globalThis.fetch
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('rpc/stfv_proximo_sdr')) throw new Error('supabase fora')
    return fetchBase(url, opts)
  }
  const r = resFalso()
  await saveLead(leadBom(), r)
  assert.equal(r._status, 200)
  const deal = chamadas.find((c) => c.metodo === 'crm.deal.add')
  assert.ok(['20781', '17191'].includes(deal.corpo.fields.ASSIGNED_BY_ID))
})

// ---------------------------------------------------------------------------
// Os CAMPOS da reuniao no negocio.
//
// O erro que este bloco existe pra impedir: mandar a reuniao so no comentario.
// O aviso que o Bitrix manda pro time le CAMPOS do negocio, entao reuniao no
// comentario = aviso com "Data:", "Especialista:" e "SDR:" em branco. E campo
// vazio no CRM nao da erro nenhum: ninguem descobre.
// ---------------------------------------------------------------------------
const DATAHORA_MEET = 'UF_CRM_1773943863374'
const LINK_MEET = 'UF_CRM_1773947738988'
const PRODUTO = 'UF_CRM_1773954690276'
const RESP_REUNIAO = 'UF_CRM_1767801443498'
const SDR_AGENDOU = 'UF_CRM_1758563297739'

const leadAgendado = () => {
  const req = leadBom()
  req.body.slug = 'amalfitana'
  req.body.source_id = 'LIVE_ITALIA'
  req.body.expedicao = 'Costa Amalfitana'
  req.body.agendado = true
  req.body.reuniao_quando = 'quinta-feira, 11 de setembro as 18h'
  req.body.reuniao_quando_iso = '2026-09-11T21:00:00.000Z'
  req.body.reuniao_especialista = 'Talita Carvalho'
  req.body.reuniao_sdr = 'Mariana'
  req.body.reuniao_link = 'https://meet.google.com/abc-defg-hij'
  return req
}

await teste('quem agenda leva os 5 campos da reuniao NO MESMO deal.add', async () => {
  // No mesmo add, nao num update depois: e a chegada na coluna de reuniao que
  // dispara o aviso do Bitrix, e um update logo depois perderia essa corrida.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  delete process.env.BITRIX_SDR_IDS
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const r = resFalso()
  await saveLead(leadAgendado(), r)
  assert.equal(r._status, 200, JSON.stringify(r._json))
  const deal = chamadas.find((c) => c.metodo === 'crm.deal.add')
  const f = deal.corpo.fields
  assert.equal(f[DATAHORA_MEET], '2026-09-11T18:00:00-03:00', 'data no fuso de casa')
  assert.equal(f[LINK_MEET], 'https://meet.google.com/abc-defg-hij')
  assert.equal(f[PRODUTO], 'Costa Amalfitana')
  assert.equal(f[RESP_REUNIAO], 851, 'Talita Carvalho na lista de responsaveis')
  assert.equal(f[SDR_AGENDOU], 921, '"Mariana" casa com "Mariana Rodrigues - SDR"')
  assert.equal(f.CATEGORY_ID, '0', 'agendado nasce no comercial')
  assert.equal(f.STAGE_ID, 'EXECUTING')
  assert.equal(chamadas.filter((c) => c.metodo === 'crm.deal.update').length, 0, 'nada de update depois')
})

await teste('a reuniao NAO se repete no comentario (cada dado tem seu campo)', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  await saveLead(leadAgendado(), resFalso())
  const obs = chamadas.find((c) => c.metodo === 'crm.deal.add').corpo.fields.COMMENTS
  assert.ok(!/reuniao_quando|reuniao_especialista|reuniao_link|reuniao_sdr/.test(obs), obs)
  assert.ok(obs.includes('assistiu_live'), 'o resto da observacao continua')
})

await teste('sem o ISO, a data vira RECADO no comentario em vez de sumir', async () => {
  // Formulario antigo (publicado antes desta mudanca) manda so o texto. O card
  // tem que dizer que a data ficou de fora, senao o aviso sai em branco calado.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const req = leadAgendado()
  delete req.body.reuniao_quando_iso
  await saveLead(req, resFalso())
  const f = chamadas.find((c) => c.metodo === 'crm.deal.add').corpo.fields
  assert.ok(!(DATAHORA_MEET in f), 'sem ISO nao inventa data')
  assert.ok(f.COMMENTS.includes('11 de setembro'), f.COMMENTS)
  assert.ok(f.COMMENTS.includes('O aviso da reunião vai sair sem'), f.COMMENTS)
})

await teste('nome fora da lista do Bitrix nao credita a pessoa errada', async () => {
  // 'Victor' sozinho e ambiguo: a lista tem Victor Hugo (SDR) e Victor
  // Maldonado (closer). Melhor campo vazio + recado do que credito errado.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({
    'crm.contact.add': jsonOk(77),
    'crm.deal.add': jsonOk(88),
    'crm.deal.userfield.list': jsonOk([]),
  })
  const req = leadAgendado()
  req.body.reuniao_sdr = 'Victor'
  await saveLead(req, resFalso())
  const f = chamadas.find((c) => c.metodo === 'crm.deal.add').corpo.fields
  assert.ok(!(SDR_AGENDOU in f), 'nao pode escolher um Victor no chute')
  assert.ok(f.COMMENTS.includes('SDR: Victor'), f.COMMENTS)
})

await teste('nome novo no time e buscado no portal, nao ignorado', async () => {
  // Contratou SDR novo e ninguem mexeu no codigo: a lista de verdade vem do
  // Bitrix. Sem isto o campo ficaria vazio pra sempre, sem sintoma.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({
    'crm.contact.add': jsonOk(77),
    'crm.deal.add': jsonOk(88),
    'crm.deal.userfield.list': jsonOk([
      { FIELD_NAME: SDR_AGENDOU, USER_TYPE_ID: 'enumeration', LIST: [{ ID: '9001', VALUE: 'Fulana Nova - SDR' }] },
    ]),
  })
  const req = leadAgendado()
  req.body.reuniao_sdr = 'Fulana Nova'
  await saveLead(req, resFalso())
  const f = chamadas.find((c) => c.metodo === 'crm.deal.add').corpo.fields
  assert.equal(f[SDR_AGENDOU], 9001)
})

await teste('lead que NAO agendou nao leva campo de reuniao nenhum', async () => {
  // Slug sem `soComAgendamento` (o link velho) segue indo pro Bitrix sem
  // reuniao: preencher esses campos ali seria mentir no card.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  await saveLead(leadBom(), resFalso())
  const f = chamadas.find((c) => c.metodo === 'crm.deal.add').corpo.fields
  for (const campo of [DATAHORA_MEET, LINK_MEET, PRODUTO, RESP_REUNIAO, SDR_AGENDOU]) {
    assert.ok(!(campo in f), `${campo} nao devia estar preenchido`)
  }
  assert.ok(!f.COMMENTS.includes('O aviso da reunião'), 'nem recado de reuniao')
})

await teste('armadilha preenchida: descarta sem criar nada, e sem denunciar', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const req = leadAgendado()
  req.body.site = 'http://spam.example'
  const r = resFalso()
  await saveLead(req, r)
  assert.equal(r._status, 200, 'responde como se tivesse dado certo')
  assert.equal(chamadas.filter((c) => c.metodo.startsWith('crm.')).length, 0, 'nao toca no CRM')
})

await teste('contato que JA existe e reaproveitado, nao duplicado', async () => {
  // Quem assiste duas lives e agenda nas duas era duas pessoas no CRM.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({
    'crm.duplicate.findbycomm': jsonOk({ CONTACT: [4242] }),
    'crm.contact.add': jsonOk(77),
    'crm.deal.add': jsonOk(88),
  })
  await saveLead(leadAgendado(), resFalso())
  assert.equal(chamadas.filter((c) => c.metodo === 'crm.contact.add').length, 0, 'nao cria contato')
  const deal = chamadas.find((c) => c.metodo === 'crm.deal.add')
  assert.equal(deal.corpo.fields.CONTACT_ID, '4242')
  assert.ok(deal.corpo.fields.COMMENTS.includes('4242'), 'o card diz que reaproveitou')
})

await teste('busca de duplicado fora do ar: cria o contato, nao perde o lead', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({
    'crm.duplicate.findbycomm': jsonErro('QUERY_LIMIT_EXCEEDED', 'muitas chamadas'),
    'crm.contact.add': jsonOk(77),
    'crm.deal.add': jsonOk(88),
  })
  const r = resFalso()
  await saveLead(leadAgendado(), r)
  assert.equal(r._status, 200)
  assert.ok(chamadas.find((c) => c.metodo === 'crm.contact.add'), 'falha aberta: cria')
})

await teste('ligacao com SDR: Pre-Vendas/Novo Lead, no nome dela, sem campo de reuniao', async () => {
  // Formulario pos-live (16/09): quem nao assistiu marca 5 min com o SDR. Os
  // campos de reuniao sao o gatilho do aviso pro especialista — aqui NAO podem ir.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  process.env.BITRIX_SDR_IDS = '20781,17191,2329'
  delete process.env.BITRIX_CATEGORY_ID
  delete process.env.BITRIX_STAGE_ID
  delete process.env.SUPABASE_FORMS_URL
  delete process.env.SUPABASE_FORMS_KEY
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const fetchBase = globalThis.fetch
  globalThis.fetch = async (url, opts) => {
    if (String(url).endsWith('user.get.json')) {
      const pedido = JSON.parse(opts.body || '{}').ID
      const gente = { 17191: { ID: '17191', NAME: 'Mariana', LAST_NAME: 'Rodrigues' } }
      return { ok: true, status: 200, json: async () => ({ result: [gente[pedido]].filter(Boolean) }) }
    }
    return fetchBase(url, opts)
  }
  const req = leadAgendado()
  req.body.agenda_com = 'sdr'
  req.body.reuniao_especialista = ''
  req.body.reuniao_link = ''
  req.body.reuniao_quando = 'sexta-feira, 18/09 às 11:00'
  const r = resFalso()
  await saveLead(req, r)
  assert.equal(r._status, 200)
  const deal = chamadas.find((c) => c.metodo === 'crm.deal.add')
  const f = deal.corpo.fields
  assert.equal(String(f.CATEGORY_ID), '25', 'funil Pre-Vendas')
  assert.equal(f.STAGE_ID, 'C25:PREPAYMENT_INVOIC', 'coluna Novo Lead')
  assert.equal(f.ASSIGNED_BY_ID, '17191', 'no nome da SDR que vai ligar')
  assert.equal(f.SOURCE_ID, 'LIVE_ITALIA', 'fonte da live preservada')
  for (const campo of [DATAHORA_MEET, LINK_MEET, RESP_REUNIAO, SDR_AGENDOU]) {
    assert.ok(!(campo in f), `${campo} nao pode ir numa ligacao com SDR`)
  }
  assert.ok(f.COMMENTS.includes('LIGAÇÃO MARCADA') && f.COMMENTS.includes('18/09'), 'o card diz a ligacao e o horario')
  delete process.env.BITRIX_SDR_IDS
})

await teste('o card fica no nome do SDR do QS, nao no do rodizio', async () => {
  // Eram dois rodizios: o responsavel do card saia de um, o dono do lead no QS
  // de outro. No mesmo card, "Quem fez o agendamento?" dizia uma pessoa e o
  // responsavel era outra — e e o responsavel que recebe tarefa no Bitrix.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  process.env.BITRIX_SDR_IDS = '20781,17191,2329'
  delete process.env.SUPABASE_FORMS_URL
  delete process.env.SUPABASE_FORMS_KEY
  const GENTE = {
    20781: { ID: '20781', NAME: 'Victor', LAST_NAME: 'Hugo' },
    17191: { ID: '17191', NAME: 'Mariana', LAST_NAME: 'Rodrigues' },
    2329: { ID: '2329', NAME: 'Yanca', LAST_NAME: 'Manuella Ruivo' },
  }
  const chamadas = stubBitrix({
    'crm.contact.add': jsonOk(77),
    'crm.deal.add': jsonOk(88),
  })
  // `user.get` responde pelo ID pedido, como o Bitrix faz.
  const fetchBase = globalThis.fetch
  globalThis.fetch = async (url, opts) => {
    if (String(url).endsWith('user.get.json')) {
      const pedido = JSON.parse(opts.body || '{}').ID
      return { ok: true, status: 200, json: async () => ({ result: [GENTE[pedido]].filter(Boolean) }) }
    }
    return fetchBase(url, opts)
  }
  const req = leadAgendado()
  req.body.reuniao_sdr = 'Mariana'
  await saveLead(req, resFalso())
  const deal = chamadas.find((c) => c.metodo === 'crm.deal.add')
  const contato = chamadas.find((c) => c.metodo === 'crm.contact.add')
  assert.equal(deal.corpo.fields.ASSIGNED_BY_ID, '17191', 'o card e da Mariana')
  assert.equal(contato.corpo.fields.ASSIGNED_BY_ID, '17191', 'contato e negocio na mesma pessoa')
  delete process.env.BITRIX_SDR_IDS
})

await teste('o QS aprende o numero do card, pelo cracha', async () => {
  // Sem isto, `qs_leads.bitrix_id` fica nulo e desfecho/no-show/SAL nunca voltam
  // pro card: o /api/bitrix-sync do QS responde skipped_no_bitrix_id, calado.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const req = leadAgendado()
  req.body.reuniao_vinculo = 'v1.corpo.assinatura'
  await saveLead(req, resFalso())
  const aviso = chamadas.find((c) => c.url.includes('/api/lead-bitrix'))
  assert.ok(aviso, 'tem que avisar o QS')
  assert.equal(aviso.corpo.vinculo, 'v1.corpo.assinatura')
  assert.equal(aviso.corpo.bitrix_id, '88')
  assert.ok(!('lead_id' in aviso.corpo), 'id de lead NUNCA sai do navegador pra ca')
})

await teste('formulario antigo (sem cracha) nao chama o QS', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const req = leadAgendado()
  delete req.body.reuniao_vinculo
  const r = resFalso()
  await saveLead(req, r)
  assert.equal(r._status, 200, 'e nao atrapalha o lead')
  assert.ok(!chamadas.find((c) => c.url.includes('/api/lead-bitrix')))
})

await teste('QS fora do ar nao derruba o lead que ja agendou', async () => {
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const fetchBase = globalThis.fetch
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/api/lead-bitrix')) throw new Error('qs fora')
    return fetchBase(url, opts)
  }
  const req = leadAgendado()
  req.body.reuniao_vinculo = 'v1.corpo.assinatura'
  const r = resFalso()
  await saveLead(req, r)
  assert.equal(r._status, 200)
  assert.equal(r._json.negocio, 88, 'o card criado continua sendo a resposta')
  assert.ok(chamadas.find((c) => c.metodo === 'crm.deal.add'))
})

await teste('slug NUNCA registrado ainda leva a resposta da live e a reuniao', async () => {
  // A allowlist por slug engolia `assistiu_live` e os `reuniao_*` em silencio.
  process.env.BITRIX_WEBHOOK_URL = BITRIX
  const chamadas = stubBitrix({ 'crm.contact.add': jsonOk(77), 'crm.deal.add': jsonOk(88) })
  const req = leadAgendado()
  req.body.slug = 'live-que-ninguem-registrou'
  await saveLead(req, resFalso())
  const f = chamadas.find((c) => c.metodo === 'crm.deal.add').corpo.fields
  assert.ok(f.COMMENTS.includes('assistiu_live'), 'a resposta da live nao pode ser descartada')
  assert.equal(f[DATAHORA_MEET], '2026-09-11T18:00:00-03:00', 'e a reuniao tambem vai')
})

await teste('webhook sem escopo CRM e detectado pelo diagnostico', async () => {
  // A pegadinha: profile.json responde normal e todo crm.* falha.
  stubBitrix({ profile: jsonOk({ NAME: 'Bruno' }), scope: jsonOk(['']) })
  const diag = await verificarBitrix(BITRIX)
  assert.equal(diag.ok, false)
  assert.equal(diag.erro, 'sem_escopo_crm')
})

await teste('webhook com escopo CRM passa no diagnostico', async () => {
  stubBitrix({
    profile: jsonOk({ NAME: 'Bruno', LAST_NAME: 'Oliveira' }),
    scope: jsonOk(['crm', 'user']),
    'crm.dealcategory.stage.list': jsonOk([
      { STATUS_ID: 'C25:PREPAYMENT_INVOIC', NAME: 'Novo Lead - Aguardando resposta' },
      { STATUS_ID: 'C25:NEW', NAME: 'Ajuste' },
    ]),
  })
  const diag = await verificarBitrix(BITRIX)
  assert.equal(diag.ok, true)
  assert.ok(diag.etapas.some((e) => e.id === 'C25:PREPAYMENT_INVOIC'))
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
console.log('OK: /api/publicar e /api/save-lead recusam o que tem que recusar')
