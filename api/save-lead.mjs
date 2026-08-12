//  /api/save-lead — backend COMPARTILHADO dos formulários hospedados aqui.
//
//  Diferença pro save-lead.mjs que o gerador exporta: aquele é de UM formulário,
//  pra colar no repositório de UMA LP. Este atende todos os formulários que
//  moram em public/f/ deste projeto, roteando pelo `slug` que vem no payload.
//  Por isso ele é mantido à mão — o gerador não sabe quantos forms vivem aqui.
//
//  Não precisa de dependência nenhuma (fetch nativo do Node 18+).
//
//  Env vars (Vercel → Settings → Environment Variables):
//    WEBHOOK_<SLUG>       webhook do n8n daquele formulário (ex.: WEBHOOK_LIVE)
//    WEBHOOK_URL          (opcional) força um webhook único pra todos — só debug
//    SUPABASE_LEADS_URL   (opcional) ledger anti-perda de lead
//    SUPABASE_LEADS_KEY   (opcional) service_role do mesmo projeto
//
//  Sem webhook configurado o lead NÃO se perde: ele continua indo pro ledger e
//  pros logs da função. Mas também não chega no Bitrix — configure antes da live.

/**
 * Um registro por formulário hospedado. `campos` é allowlist: só o que este
 * formulário manda entra no lead, o resto do body é descartado. Evita
 * mass-assignment e mantém webhook e logs limpos.
 */
const FORMS = {
  exemplo: {
    campos: ['expedicao', 'fonte', 'source_id', 'nome', 'email', 'whatsapp', 'assistiu_live'],
  },
}

const TRACK_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'gclid', 'fbclid', 'gbraid', 'wbraid',
]

/** Webhook do slug: env var própria primeiro, depois a global de debug. */
function webhookDoSlug(slug) {
  const chave = `WEBHOOK_${String(slug).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
  return process.env[chave] || process.env.WEBHOOK_URL || ''
}

/** Payload/CRM sempre recebem +55 + dígitos (ex.: +5542984265706). */
function normalizarWhatsapp(valor) {
  const digitos = String(valor || '').replace(/\D/g, '')
  const semDDI = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos
  return semDDI ? `+55${semDDI}` : ''
}

function dataHoraSaoPaulo() {
  const f = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  return f.format(new Date()).replace(',', '')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
  const str = (v, max) => String(v ?? '').slice(0, max)

  const slug = str(body.slug, 40)
  const conf = FORMS[slug]
  // Slug desconhecido não é motivo pra descartar o lead: ele segue pro ledger e
  // pros logs com slug_ok=false, e a conciliação resolve depois. Perder lead por
  // erro de configuração nosso é o pior desfecho possível.
  const campos = conf ? conf.campos : ['nome', 'email', 'whatsapp']

  const lead = {
    lead_id:
      str(body.lead_id, 80) ||
      `lead_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    form_name: str(body.form_name, 80),
    slug,
    timestamp: str(body.timestamp, 40),
    data_hora_cadastro: dataHoraSaoPaulo(),
    etapa: str(body.etapa, 30) || 'completo',
    formulario_completo: body.formulario_completo !== false,
  }
  for (const k of campos) lead[k] = str(body[k], 300)
  for (const k of TRACK_KEYS) lead[k] = str(body[k], 200)
  if ('whatsapp' in lead) lead.whatsapp = normalizarWhatsapp(body.whatsapp)
  if ('email' in lead) lead.email = str(body.email, 120).toLowerCase().trim()

  // Validação no servidor: o cliente pode ser burlado, o servidor não.
  if ('nome' in lead && String(lead.nome).trim().length < 2) {
    res.status(400).json({ ok: false, error: 'nome_invalido' })
    return
  }
  if ('whatsapp' in lead && lead.whatsapp.length < 13) { // +55 + ao menos 10 dígitos
    res.status(400).json({ ok: false, error: 'whatsapp_invalido' })
    return
  }

  // Rede de segurança: todo lead fica nos logs da função.
  console.log('[lead]', JSON.stringify(lead))

  const webhookUrl = webhookDoSlug(slug)
  const slugOk = Boolean(conf && webhookUrl)

  // ── Canal 1: webhook do n8n ───────────────────────────────────────────
  const enviarN8n = async () => {
    if (!webhookUrl) {
      console.warn(`[webhook] sem destino para slug="${slug}" — coberto pelo ledger`)
      return
    }
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 7000)
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
        signal: ctrl.signal,
      })
      if (!resp.ok) console.error('[webhook] status', resp.status)
    } finally {
      clearTimeout(timeout)
    }
  }

  // ── Canal 2: ledger no Supabase (independe do n8n) ────────────────────
  // Captura 100% dos leads — inclusive se o n8n estiver fora do ar. Falha aqui
  // NUNCA trava o usuário nem perde o lead: só vira log.
  const gravarLedger = async () => {
    const SB_URL = process.env.SUPABASE_LEADS_URL
    const SB_KEY = process.env.SUPABASE_LEADS_KEY
    if (!SB_URL || !SB_KEY) {
      console.warn('[ledger] SUPABASE_LEADS_URL/KEY ausentes — lead só no n8n/logs')
      return
    }
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 7000)
    try {
      const resp = await fetch(`${SB_URL.replace(/\/$/, '')}/rest/v1/site_leads`, {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          lead_id: lead.lead_id,
          site: 'stfv-forms',
          slug: lead.slug,
          slug_ok: slugOk,
          form_name: lead.form_name || '',
          nome: lead.nome || '',
          whatsapp: lead.whatsapp || '',
          email: lead.email || '',
          instagram: lead.instagram || '',
          expedicao: lead.expedicao || '',
          fonte: lead.fonte || '',
          source_id: lead.source_id || '',
          data_hora_cadastro: lead.data_hora_cadastro || '',
          raw: lead,
        }),
        signal: ctrl.signal,
      })
      // 409 = lead_id repetido (re-submit) = já capturado, não é erro.
      if (!resp.ok && resp.status !== 409) {
        const txt = await resp.text().catch(() => '')
        console.error('[ledger] status', resp.status, txt)
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  // Os dois canais correm em PARALELO: nenhum atrasa o outro.
  const [rN8n, rLedger] = await Promise.allSettled([enviarN8n(), gravarLedger()])
  if (rN8n.status === 'rejected') console.error('[webhook] falhou:', rN8n.reason?.message)
  if (rLedger.status === 'rejected') console.error('[ledger] falhou:', rLedger.reason?.message)

  res.status(200).json({ ok: true })
}
