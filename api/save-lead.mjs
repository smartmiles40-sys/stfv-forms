//  /api/save-lead — backend COMPARTILHADO dos formulários hospedados aqui.
//
//  Caminho do lead: formulário → esta função → Bitrix24 (contato + negócio).
//  Sem n8n no meio: o n8n era um intermediário, e numa live cada peça a mais é
//  mais uma coisa que pode cair.
//
//  Se o Bitrix recusar, o lead NÃO se perde: vai pra tabela stfv_leads_pendentes
//  e pros logs da função, pra ser recuperado depois. E o formulário redireciona
//  o lead pro destino de qualquer jeito — quem chega no WhatsApp já está
//  capturado pelo próprio número.
//
//  Env vars (Vercel → Settings → Environment Variables):
//    BITRIX_WEBHOOK_URL    obrigatória — https://<portal>.bitrix24.com.br/rest/<id>/<token>/
//    BITRIX_CATEGORY_ID    (opcional) funil; padrão 25
//    BITRIX_STAGE_ID       (opcional) etapa; padrão C25:PREPAYMENT_INVOIC
//    SUPABASE_FORMS_URL    (opcional) guarda lead que o Bitrix recusou
//    SUPABASE_FORMS_KEY    (opcional) service_role do mesmo projeto

import { criarLead, FUNIL_PADRAO } from './_bitrix.mjs'

const TABELA_PENDENTES = 'stfv_leads_pendentes'

/**
 * Um registro por formulário hospedado. `campos` é allowlist: só o que este
 * formulário manda entra no lead, o resto do body é descartado. Evita
 * mass-assignment e mantém o negócio do Bitrix limpo.
 */
const CAMPOS_LIVE = ['expedicao', 'fonte', 'source_id', 'nome', 'email', 'whatsapp', 'assistiu_live']

/**
 * Um formulario por live (setembro/2026): forms.setuforeuvouviagens.com.br/<slug>.
 * `live` continua aqui pelo link antigo, que ainda circula em grupo de WhatsApp.
 * Live nova: acrescente o slug AQUI tambem -- fora desta lista o `assistiu_live`
 * seria descartado em silencio (CAMPOS_MINIMOS nao o inclui) e o negocio nasceria
 * sem a resposta que separa quem assistiu de quem nao assistiu.
 */
const FORMS = {
  amalfitana: { campos: CAMPOS_LIVE },
  tailandia: { campos: CAMPOS_LIVE },
  turquia: { campos: CAMPOS_LIVE },
  islandia: { campos: CAMPOS_LIVE },
  japao: { campos: CAMPOS_LIVE },
  egito: { campos: CAMPOS_LIVE },
  peru: { campos: CAMPOS_LIVE },
  live: { campos: CAMPOS_LIVE },
  exemplo: { campos: CAMPOS_LIVE },
}

/**
 * Campos que passam mesmo quando o slug não está registrado acima. `source_id`
 * está aqui de propósito: sem ele, publicar um formulário com slug novo faria a
 * FONTE ser descartada em silêncio e o lead cairia no genérico "Site" — o
 * mesmo erro, de novo, sem sintoma nenhum.
 */
const CAMPOS_MINIMOS = ['nome', 'email', 'whatsapp', 'source_id', 'fonte', 'expedicao']

const TRACK_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'gclid', 'fbclid', 'gbraid', 'wbraid',
]

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

/**
 * Próxima SDR do rodízio.
 *
 * A ordem vem de uma sequence no Postgres porque numa live os envios chegam em
 * rajada e várias funções rodam ao mesmo tempo: `nextval` é atômico, então duas
 * pessoas nunca recebem o mesmo número. Um contador em memória não serviria —
 * cada invocação serverless começa do zero.
 *
 * Se o sorteio falhar, cai em aleatório em vez de travar: distribuir mal é
 * muito melhor do que não registrar o lead.
 */
async function proximaSdr() {
  const ids = String(process.env.BITRIX_SDR_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!ids.length) return null
  if (ids.length === 1) return ids[0]

  const SB_URL = process.env.SUPABASE_FORMS_URL
  const SB_KEY = process.env.SUPABASE_FORMS_KEY
  if (SB_URL && SB_KEY) {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 4000)
    try {
      const resp = await fetch(`${SB_URL.replace(/\/$/, '')}/rest/v1/rpc/stfv_proximo_sdr`, {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal: ctrl.signal,
      })
      if (resp.ok) {
        const n = Number(await resp.json())
        if (Number.isFinite(n)) return ids[n % ids.length]
      } else {
        console.warn('[rodizio] rpc', resp.status, '— caindo pro aleatorio')
      }
    } catch (e) {
      console.warn('[rodizio] indisponivel:', e?.message, '— caindo pro aleatorio')
    } finally {
      clearTimeout(timeout)
    }
  }
  return ids[Math.floor(Math.random() * ids.length)]
}

/**
 * Rede de segurança: lead que o Bitrix recusou fica gravado pra recuperação.
 * Chave é o lead_id, então reenvio do mesmo lead atualiza em vez de duplicar.
 * Devolve true se conseguiu guardar.
 */
async function guardarPendente(lead, motivo) {
  const SB_URL = process.env.SUPABASE_FORMS_URL
  const SB_KEY = process.env.SUPABASE_FORMS_KEY
  if (!SB_URL || !SB_KEY) return false

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 7000)
  try {
    const resp = await fetch(
      `${SB_URL.replace(/\/$/, '')}/rest/v1/${TABELA_PENDENTES}?on_conflict=lead_id`,
      {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          lead_id: lead.lead_id,
          slug: lead.slug || '',
          nome: lead.nome || '',
          whatsapp: lead.whatsapp || '',
          email: lead.email || '',
          motivo: String(motivo).slice(0, 300),
          lead,
        }),
        signal: ctrl.signal,
      },
    )
    if (!resp.ok) {
      console.error('[pendente] supabase', resp.status, await resp.text().catch(() => ''))
      return false
    }
    return true
  } catch (e) {
    console.error('[pendente] falhou:', e?.message)
    return false
  } finally {
    clearTimeout(timeout)
  }
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
  // Slug desconhecido não é motivo pra descartar o lead: ele segue com os campos
  // básicos. Perder lead por erro de configuração nosso é o pior desfecho.
  const campos = conf ? conf.campos : CAMPOS_MINIMOS

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

  // Rede de segurança: todo lead fica nos logs da função, aconteça o que
  // acontecer depois.
  console.log('[lead]', JSON.stringify(lead))

  const base = process.env.BITRIX_WEBHOOK_URL
  if (!base) {
    console.error('[bitrix] BITRIX_WEBHOOK_URL ausente — lead não foi pro CRM')
    const guardado = await guardarPendente(lead, 'BITRIX_WEBHOOK_URL ausente')
    res.status(guardado ? 200 : 502).json({ ok: guardado, error: 'bitrix_nao_configurado' })
    return
  }

  const responsavelId = await proximaSdr()
  const resultado = await criarLead(base, lead, {
    categoryId: process.env.BITRIX_CATEGORY_ID || FUNIL_PADRAO.categoryId,
    stageId: process.env.BITRIX_STAGE_ID || FUNIL_PADRAO.stageId,
    responsavelId,
    // A fonte vem do PRÓPRIO formulário (campo fixo `source_id`), não de env
    // var: assim cada formulário publicado declara a sua origem e uma live
    // nova não precisa de redeploy. A env var é só a rede de segurança.
    sourceId: lead.source_id || process.env.BITRIX_SOURCE_ID || 'WEB',
    // Observações levam só o que NÃO tem campo próprio no Bitrix. `source_id` e
    // `fonte` viram o campo Fonte do negócio; repeti-los no comentário só suja
    // e faz parecer que a origem mora lá — foi exatamente essa a confusão.
    camposExtras: campos.filter(
      (c) => !['nome', 'email', 'whatsapp', 'source_id', 'fonte'].includes(c),
    ),
  })

  if (resultado.ok) {
    console.log('[bitrix] negocio', resultado.negocioId, 'para SDR', responsavelId ?? '(padrao)')
    res.status(200).json({ ok: true, negocio: resultado.negocioId })
    return
  }

  const motivo = `${resultado.etapa}: ${resultado.erro} ${resultado.descricao ?? ''}`.trim()
  console.error('[bitrix] falhou —', motivo)

  // 200 só quando o lead está guardado em algum lugar recuperável. Se nem isso
  // deu, devolvemos erro: aí o formulário reenvia por sendBeacon e redireciona
  // o lead assim mesmo, que é o desfecho menos ruim.
  const guardado = await guardarPendente(lead, motivo)
  res.status(guardado ? 200 : 502).json({ ok: guardado, error: 'bitrix_recusou' })
}
