//  /api/publicar — publica um formulário e devolve o link.
//
//  Recebe do painel APENAS a configuração (o FormSpec, em JSON) e gera o HTML
//  aqui no servidor. Isso é deliberado: se aceitasse HTML pronto vindo do
//  navegador, quem tivesse a senha poderia hospedar qualquer página no nosso
//  domínio — e um domínio nosso servindo página de terceiro é matéria-prima de
//  golpe. Recebendo só a config, o servidor só consegue produzir formulário.
//
//  Env vars (Vercel → Settings → Environment Variables):
//    PUBLICAR_SENHA        obrigatória — sem ela a rota fica desligada
//    SUPABASE_FORMS_URL    obrigatória — projeto onde vive stfv_forms_publicados
//    SUPABASE_FORMS_KEY    obrigatória — service_role (a tabela tem RLS ligado)

import { timingSafeEqual } from 'node:crypto'
import { gerarHtml, avisosDoSpec } from './_gerador.mjs'

const TABELA = 'stfv_forms_publicados'
/** Um FormSpec real tem alguns KB. 1 MB já é abuso. */
const LIMITE_BYTES = 1_000_000

/** Comparação de senha em tempo constante. */
function senhaConfere(recebida, esperada) {
  const a = Buffer.from(String(recebida ?? ''))
  const b = Buffer.from(String(esperada ?? ''))
  // timingSafeEqual exige mesmo tamanho; o length já vaza por si só.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, erro: 'method_not_allowed' })
    return
  }

  const SENHA = process.env.PUBLICAR_SENHA
  const SB_URL = process.env.SUPABASE_FORMS_URL
  const SB_KEY = process.env.SUPABASE_FORMS_KEY

  // Sem senha configurada a rota fica FECHADA. O contrário — abrir quando a env
  // var falta — transformaria um esquecimento de configuração em porta aberta.
  if (!SENHA || !SB_URL || !SB_KEY) {
    console.error('[publicar] faltam env vars (PUBLICAR_SENHA / SUPABASE_FORMS_URL / KEY)')
    res.status(503).json({ ok: false, erro: 'nao_configurado' })
    return
  }

  if (!senhaConfere(req.headers['x-stfv-senha'], SENHA)) {
    res.status(401).json({ ok: false, erro: 'senha_invalida' })
    return
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
  const spec = body.spec

  if (!spec || typeof spec !== 'object') {
    res.status(400).json({ ok: false, erro: 'spec_ausente' })
    return
  }

  const bruto = JSON.stringify(spec)
  if (bruto.length > LIMITE_BYTES) {
    res.status(413).json({ ok: false, erro: 'spec_grande_demais' })
    return
  }

  const slug = String(spec.slug ?? '').trim()
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
    res.status(400).json({
      ok: false,
      erro: 'slug_invalido',
      detalhe: 'Use de 2 a 40 caracteres: minúsculas, números e hífen.',
    })
    return
  }

  // O formulário publicado aqui posta no /api/save-lead deste mesmo domínio.
  // Deixar apontar pra fora seria publicar um formulário nosso que manda lead
  // pra endereço de terceiro.
  if (spec?.destino?.url !== '/api/save-lead') {
    res.status(400).json({
      ok: false,
      erro: 'destino_invalido',
      detalhe: 'Um formulário hospedado aqui precisa enviar para /api/save-lead.',
    })
    return
  }

  // Os mesmos avisos do painel, de novo no servidor: o painel avisa, mas quem
  // garante é aqui. Publicar com regra de saída órfã manda a live inteira pro
  // destino errado sem sintoma nenhum.
  const avisos = avisosDoSpec(spec)
  if (avisos.length) {
    res.status(400).json({ ok: false, erro: 'avisos_pendentes', avisos })
    return
  }

  let html
  try {
    html = gerarHtml(spec)
  } catch (e) {
    console.error('[publicar] gerarHtml falhou:', e?.message)
    res.status(400).json({ ok: false, erro: 'spec_invalido' })
    return
  }

  const linha = {
    slug,
    nome: String(spec.nome ?? '').slice(0, 120),
    spec,
    html,
    atualizado_em: new Date().toISOString(),
  }

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 10000)
  try {
    const resp = await fetch(`${SB_URL.replace(/\/$/, '')}/rest/v1/${TABELA}?on_conflict=slug`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(linha),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error('[publicar] supabase', resp.status, txt)
      res.status(502).json({ ok: false, erro: 'falha_ao_gravar' })
      return
    }
  } catch (e) {
    console.error('[publicar] supabase inacessivel:', e?.message)
    res.status(502).json({ ok: false, erro: 'falha_ao_gravar' })
    return
  } finally {
    clearTimeout(timeout)
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host || ''
  const proto = req.headers['x-forwarded-proto'] || 'https'
  res.status(200).json({
    ok: true,
    slug,
    url: host ? `${proto}://${host}/f/${slug}` : `/f/${slug}`,
  })
}
