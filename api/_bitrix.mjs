//  Conversa com o Bitrix24 via webhook de entrada (REST com token na URL).
//
//  BITRIX_WEBHOOK_URL tem a forma:
//    https://<portal>.bitrix24.com.br/rest/<userId>/<token>/
//
//  ⚠️ O webhook precisa ter sido criado COM escopo CRM. Sem ele, `profile.json`
//  responde normalmente e todo `crm.*` volta insufficient_scope — falha que não
//  aparece em teste superficial. Use verificarBitrix() antes de confiar.

/** Primeira coluna REAL do funil comercial. Os IDs padrao foram reaproveitados
 *  fora de ordem neste portal: C25:NEW e "Ajuste", NAO "Novo lead". Errar aqui
 *  joga o lead numa coluna que ninguem olha — sem erro nenhum. */
export const FUNIL_PADRAO = { categoryId: '25', stageId: 'C25:PREPAYMENT_INVOIC' }

const TIMEOUT_MS = 8000

/** Chama um metodo REST. Devolve {ok, result} ou {ok:false, erro}. */
export async function chamar(base, metodo, params) {
  const url = `${String(base).replace(/\/$/, '')}/${metodo}.json`
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params ?? {}),
      signal: ctrl.signal,
    })
    const dados = await resp.json().catch(() => ({}))
    if (!resp.ok || dados.error) {
      return {
        ok: false,
        erro: dados.error || `http_${resp.status}`,
        descricao: dados.error_description || '',
      }
    }
    return { ok: true, result: dados.result }
  } catch (e) {
    return { ok: false, erro: 'rede', descricao: e?.message ?? '' }
  } finally {
    clearTimeout(timeout)
  }
}

/** Monta o texto que vai no campo de observacoes do negocio. */
function observacoes(lead, camposExtras) {
  const linhas = []
  for (const chave of camposExtras) {
    const v = lead[chave]
    if (v) linhas.push(`${chave}: ${v}`)
  }
  const track = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'utm_id', 'gclid', 'fbclid', 'gbraid', 'wbraid']
  const rastro = track.filter((k) => lead[k]).map((k) => `${k}=${lead[k]}`)
  if (rastro.length) linhas.push('', 'Origem: ' + rastro.join(' · '))
  if (lead.lead_id) linhas.push(`lead_id: ${lead.lead_id}`)
  return linhas.join('\n')
}

/**
 * Cria contato + negocio. Devolve {ok, contatoId, negocioId} ou {ok:false,...}.
 * O contato vem primeiro porque o negocio precisa do CONTACT_ID; se o contato
 * falhar, nao adianta criar negocio orfao.
 */
export async function criarLead(base, lead, opcoes = {}) {
  const funil = {
    categoryId: opcoes.categoryId ?? FUNIL_PADRAO.categoryId,
    stageId: opcoes.stageId ?? FUNIL_PADRAO.stageId,
  }

  // A FONTE do negocio. O portal usa codigos proprios por origem
  // (LIVE_ITALIA, 24 = [Tailandia] - Trafego, 46 = [Amazonia] - Organico...),
  // e o dashboard comercial agrupa por eles. Mandar o generico 'WEB' nao da
  // erro: o lead entra e some no meio de "Site", sem dar pra medir a live.
  const sourceId = opcoes.sourceId || 'WEB'

  const nome = String(lead.nome || '').trim()
  const contato = await chamar(base, 'crm.contact.add', {
    fields: {
      NAME: nome,
      OPENED: 'Y',
      TYPE_ID: 'CLIENT',
      SOURCE_ID: sourceId,
      ...(opcoes.responsavelId ? { ASSIGNED_BY_ID: opcoes.responsavelId } : {}),
      ...(lead.whatsapp ? { PHONE: [{ VALUE: lead.whatsapp, VALUE_TYPE: 'MOBILE' }] } : {}),
      ...(lead.email ? { EMAIL: [{ VALUE: lead.email, VALUE_TYPE: 'WORK' }] } : {}),
    },
    params: { REGISTER_SONET_EVENT: 'N' },
  })
  if (!contato.ok) return { ok: false, etapa: 'contato', ...contato }

  const titulo = opcoes.tituloNegocio
    ? opcoes.tituloNegocio(lead)
    : `${nome || 'Lead'} — ${lead.form_name || lead.slug || 'formulário'}`

  const negocio = await chamar(base, 'crm.deal.add', {
    fields: {
      TITLE: titulo.slice(0, 250),
      CONTACT_ID: contato.result,
      CATEGORY_ID: funil.categoryId,
      STAGE_ID: funil.stageId,
      OPENED: 'Y',
      SOURCE_ID: sourceId,
      COMMENTS: observacoes(lead, opcoes.camposExtras ?? []),
      // Sem responsavel explicito o negocio nasce no dono do webhook — ou
      // seja, todos os leads da live cairiam numa pessoa so, fora da fila das
      // SDRs. O contato tambem vai pro mesmo responsavel, senao contato e
      // negocio ficam com donos diferentes.
      ...(opcoes.responsavelId ? { ASSIGNED_BY_ID: opcoes.responsavelId } : {}),
    },
    params: { REGISTER_SONET_EVENT: 'N' },
  })
  if (!negocio.ok) {
    // Contato criado e negocio nao: o contato fica la, e melhor do que nada,
    // mas quem olha o funil nao ve o lead. Por isso isto e reportado como falha.
    return { ok: false, etapa: 'negocio', contatoId: contato.result, ...negocio }
  }

  return { ok: true, contatoId: contato.result, negocioId: negocio.result }
}

/**
 * Diagnostico de configuracao. A pegadinha que ja custou uma tarde: webhook sem
 * escopo CRM responde profile.json normalmente e falha em TODO crm.* — entao
 * checar "o webhook responde?" nao prova nada. Aqui olhamos o escopo.
 */
export async function verificarBitrix(base) {
  const perfil = await chamar(base, 'profile', {})
  if (!perfil.ok) return { ok: false, etapa: 'profile', ...perfil }

  const escopo = await chamar(base, 'scope', {})
  const lista = Array.isArray(escopo.result) ? escopo.result.filter(Boolean) : []
  const temCrm = lista.includes('crm')
  if (!temCrm) {
    return {
      ok: false,
      etapa: 'escopo',
      erro: 'sem_escopo_crm',
      descricao:
        'O webhook responde, mas não tem escopo CRM — todo crm.* vai falhar. ' +
        'Recrie o webhook de entrada no Bitrix marcando CRM.',
      escopo: lista,
    }
  }

  // Confere se a etapa configurada existe MESMO nesse funil.
  const etapas = await chamar(base, 'crm.dealcategory.stage.list', {
    id: FUNIL_PADRAO.categoryId,
  })
  return {
    ok: true,
    escopo: lista,
    usuario: perfil.result?.NAME ? `${perfil.result.NAME} ${perfil.result.LAST_NAME ?? ''}`.trim() : '',
    etapas: etapas.ok
      ? (etapas.result ?? []).map((e) => ({ id: e.STATUS_ID, nome: e.NAME }))
      : [],
  }
}
