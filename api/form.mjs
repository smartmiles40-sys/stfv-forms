//  /f/<slug> — serve um formulário publicado (via rewrite no vercel.json).
//
//  Só lê a coluna `html`, que foi gerada no servidor pelo /api/publicar. Este
//  arquivo nunca produz HTML a partir de entrada do usuário.

const TABELA = 'stfv_forms_publicados'

function paginaSimples(titulo, texto, status) {
  return `<!doctype html>
<html lang="pt-BR">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#09282B; color:#F7F5EF; font:16px/1.6 system-ui, sans-serif; padding:2rem; }
  div { max-width:28rem; text-align:center; }
  h1 { font-size:1.25rem; margin:0 0 .5rem; }
  p { margin:0; opacity:.7; font-size:.9rem; }
</style>
<div><h1>${titulo}</h1><p>${texto}</p></div>
</html>`.trim() + `<!-- ${status} -->`
}

export default async function handler(req, res) {
  const slug = String(req.query?.slug ?? '').trim()

  const SB_URL = process.env.SUPABASE_FORMS_URL
  const SB_KEY = process.env.SUPABASE_FORMS_KEY

  // Formulário nunca pode ficar em cache: cache serve pergunta velha E regra de
  // saída velha, que é o jeito mais silencioso de mandar todo mundo pro lugar
  // errado. Vale também pros erros, senão um 404 momentâneo gruda no CDN.
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')

  if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
    res.status(404).send(paginaSimples('Formulário não encontrado', 'Confira o link.', 'slug invalido'))
    return
  }

  if (!SB_URL || !SB_KEY) {
    console.error('[form] faltam SUPABASE_FORMS_URL / SUPABASE_FORMS_KEY')
    res.status(503).send(paginaSimples('Fora do ar', 'Tente de novo em instantes.', 'sem env'))
    return
  }

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 8000)
  try {
    const url =
      `${SB_URL.replace(/\/$/, '')}/rest/v1/${TABELA}` +
      `?slug=eq.${encodeURIComponent(slug)}&select=html&limit=1`
    const resp = await fetch(url, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      console.error('[form] supabase', resp.status)
      res.status(502).send(paginaSimples('Fora do ar', 'Tente de novo em instantes.', 'supabase erro'))
      return
    }
    const linhas = await resp.json()
    const html = Array.isArray(linhas) && linhas[0]?.html
    if (!html) {
      res.status(404).send(paginaSimples('Formulário não encontrado', 'Confira o link.', 'sem linha'))
      return
    }
    res.status(200).send(html)
  } catch (e) {
    console.error('[form] falhou:', e?.message)
    res.status(502).send(paginaSimples('Fora do ar', 'Tente de novo em instantes.', 'excecao'))
  } finally {
    clearTimeout(timeout)
  }
}
