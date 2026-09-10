//  /api/forms — lista os formulários publicados (e devolve um deles p/ editar).
//
//  GET /api/forms            → [{ slug, nome, publicado_em, atualizado_em }]
//  GET /api/forms?slug=live  → { slug, nome, spec, ... }  (spec completo)
//
//  Protegido pela mesma PUBLICAR_SENHA: a lista revela quais formulários
//  existem e o spec traz número de WhatsApp e regras de saída. Nada disso é
//  para ficar aberto.

import { portaoDaSenha } from './_portao.mjs'

const TABELA = 'stfv_forms_publicados'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, erro: 'method_not_allowed' })
    return
  }

  const SENHA = process.env.PUBLICAR_SENHA
  const SB_URL = process.env.SUPABASE_FORMS_URL
  const SB_KEY = process.env.SUPABASE_FORMS_KEY

  // Falha fechada, igual ao /api/publicar: falta de configuração não pode
  // virar lista aberta.
  if (!SENHA || !SB_URL || !SB_KEY) {
    res.status(503).json({ ok: false, erro: 'nao_configurado' })
    return
  }
  const portao = await portaoDaSenha(req, { teto: 30 })
  if (portao) {
    res.status(portao.status).json(portao.corpo)
    return
  }

  const slug = String(req.query?.slug ?? '').trim()
  if (slug && !/^[a-z0-9-]{2,40}$/.test(slug)) {
    res.status(400).json({ ok: false, erro: 'slug_invalido' })
    return
  }

  // A coluna `html` fica de fora da listagem de propósito: são ~28 KB por
  // formulário e ninguém precisa dela para montar a lista.
  const colunas = slug ? 'slug,nome,spec,publicado_em,atualizado_em' : 'slug,nome,publicado_em,atualizado_em'
  const filtro = slug ? `&slug=eq.${encodeURIComponent(slug)}&limit=1` : '&order=atualizado_em.desc&limit=200'

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 8000)
  try {
    const resp = await fetch(
      `${SB_URL.replace(/\/$/, '')}/rest/v1/${TABELA}?select=${colunas}${filtro}`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, signal: ctrl.signal },
    )
    if (!resp.ok) {
      console.error('[forms] supabase', resp.status, await resp.text().catch(() => ''))
      res.status(502).json({ ok: false, erro: 'falha_ao_ler' })
      return
    }
    const linhas = await resp.json()

    // Sem cache: a lista muda a cada publicação.
    res.setHeader('Cache-Control', 'no-store')

    if (slug) {
      if (!linhas[0]) {
        res.status(404).json({ ok: false, erro: 'nao_encontrado' })
        return
      }
      res.status(200).json({ ok: true, form: linhas[0] })
      return
    }
    res.status(200).json({ ok: true, forms: linhas })
  } catch (e) {
    console.error('[forms] falhou:', e?.message)
    res.status(502).json({ ok: false, erro: 'falha_ao_ler' })
  } finally {
    clearTimeout(timeout)
  }
}
