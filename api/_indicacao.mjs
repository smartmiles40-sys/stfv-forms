//  INDICAÇÕES DA BLACK (Bruno, 19/11/2026) — formulário /f/indique.
//
//  UM link só pra base inteira (~1500 clientes). A própria cliente (INDICADORA)
//  digita o nome e o WhatsApp dela e de até 5 pessoas (os INDICADOS). Para CADA
//  indicado nasce um contato + negócio no Bitrix, no rodízio das SDRs, com a
//  indicadora escrita no card — é por ela que se descobre a quem mandar a mala
//  de mimos quando o indicado fechar.
//
//  Registro que não se perde: cada indicado também vira uma linha em
//  stfv_leads_pendentes (motivo começando com 'indicacao_black'), com a
//  indicadora no jsonb `lead`. É dali que sai o relatório de presentes:
//
//    select criado_em, nome, whatsapp, bitrix_id, recuperado,
//           lead->>'indicadora_nome' indicadora, lead->>'indicadora_whatsapp' tel_indicadora
//      from stfv_leads_pendentes where motivo like 'indicacao_black%' order by criado_em;
//
//  recuperado = true  → o card foi criado (bitrix_id preenchido)
//  recuperado = false → o Bitrix recusou; o motivo está na coluna, criar à mão.
//  O cron de resgate NÃO pega essas linhas (ele só olha 'aguardando_agendamento').
//
//  Indicados processados UM DE CADA VEZ: o Bitrix limita chamadas por segundo e
//  o disparo pra base concentra envios nos primeiros minutos. Limite de fila do
//  Bitrix (QUERY_LIMIT_EXCEEDED) ganha uma segunda tentativa depois de uma pausa.

import { criarLead, FUNIL_PADRAO } from './_bitrix.mjs'
import { idsDoRodizio, proximaSdr } from './_rodizio.mjs'

export const MAX_INDICADOS = 5
const TABELA = 'stfv_leads_pendentes'
const TRACK_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']

const str = (v, max) => String(v ?? '').slice(0, max).trim()

/** +55 + dígitos; '' se não for um celular/fixo brasileiro plausível. */
export function normalizarTel(valor) {
  const d = String(valor || '').replace(/\D/g, '')
  const semDDI = d.startsWith('55') && d.length > 11 ? d.slice(2) : d
  return semDDI.length === 10 || semDDI.length === 11 ? `+55${semDDI}` : ''
}

/**
 * Valida e limpa o corpo. Devolve { erro } ou
 * { indicadora:{nome,whatsapp}, indicados:[{nome,whatsapp}], descartados }.
 */
export function lerIndicacao(body) {
  const nome = str(body?.nome, 120)
  const whatsapp = normalizarTel(body?.whatsapp ?? body?.telefone)
  if (nome.length < 2) return { erro: 'Informe o seu nome.' }
  if (!whatsapp) return { erro: 'Seu WhatsApp parece incompleto (DDD + número).' }

  const vistos = new Set([whatsapp])
  const indicados = []
  let descartados = 0
  const brutos = Array.isArray(body?.indicados) ? body.indicados.slice(0, MAX_INDICADOS * 2) : []
  for (const r of brutos) {
    const n = str(r?.nome, 120)
    const t = normalizarTel(r?.whatsapp ?? r?.telefone)
    if (!n && !String(r?.whatsapp ?? r?.telefone ?? '').trim()) continue // linha em branco
    if (n.length < 2 || !t || vistos.has(t)) { descartados++; continue } // inválido, ela mesma ou repetido
    vistos.add(t)
    indicados.push({ nome: n, whatsapp: t })
    if (indicados.length >= MAX_INDICADOS) break
  }
  if (!indicados.length) return { erro: 'Informe pelo menos uma indicação com nome e WhatsApp válidos.' }
  return { indicadora: { nome, whatsapp }, indicados, descartados }
}

async function registrar(linha) {
  const SB_URL = process.env.SUPABASE_FORMS_URL
  const SB_KEY = process.env.SUPABASE_FORMS_KEY
  if (!SB_URL || !SB_KEY) return false
  try {
    const resp = await fetch(`${SB_URL.replace(/\/$/, '')}/rest/v1/${TABELA}?on_conflict=lead_id`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(linha),
    })
    if (!resp.ok) console.error('[indicacao] registro', resp.status, await resp.text().catch(() => ''))
    return resp.ok
  } catch (e) {
    console.error('[indicacao] registro falhou:', e?.message)
    return false
  }
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

/** Processa um envio já validado. Nunca lança por causa de um indicado só. */
export async function registrarIndicacao({ indicadora, indicados }, body, slug) {
  const base = process.env.BITRIX_WEBHOOK_URL
  const envio = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const primeiroNome = indicadora.nome.split(/\s+/)[0]
  const sourceId = str(body.source_id, 60) || 'RECOMMENDATION'
  const fonte = str(body.fonte, 120) || '[Indicação Black]'
  const track = {}
  for (const k of TRACK_KEYS) { const v = str(body[k], 200); if (v) track[k] = v }

  let criados = 0
  for (let k = 0; k < indicados.length; k++) {
    const i = indicados[k]
    const lead = {
      lead_id: `ind_${envio}_${k + 1}`,
      slug,
      form_name: str(body.form_name, 80) || 'indicacao-black-2026',
      nome: i.nome,
      whatsapp: i.whatsapp,
      source_id: sourceId,
      fonte,
      indicadora_nome: indicadora.nome,
      indicadora_whatsapp: indicadora.whatsapp,
      ...track,
    }
    const recado =
      `🎁 INDICAÇÃO BLACK — indicado(a) por ${indicadora.nome} (${indicadora.whatsapp}).\n` +
      `Na primeira mensagem, cite quem indicou: "A ${primeiroNome} indicou você…".\n` +
      'Se este card FECHAR VENDA, a indicadora ganha a mala com mimos — avise a gestão.'

    let r = { ok: false, etapa: 'config', erro: 'BITRIX_WEBHOOK_URL ausente' }
    if (base) {
      const opcoes = {
        categoryId: process.env.BITRIX_CATEGORY_ID || FUNIL_PADRAO.categoryId,
        stageId: process.env.BITRIX_STAGE_ID || FUNIL_PADRAO.stageId,
        responsavelId: await proximaSdr(),
        sdrIds: idsDoRodizio(),
        sourceId,
        camposExtras: [],
        recado,
        tituloNegocio: (l) => `${l.nome} — Indicação Black (por ${primeiroNome})`,
      }
      try {
        r = await criarLead(base, lead, opcoes)
        if (!r.ok && /QUERY_LIMIT|limit/i.test(`${r.erro} ${r.descricao ?? ''}`)) {
          await pausa(1500)
          r = await criarLead(base, lead, opcoes)
        }
      } catch (e) {
        r = { ok: false, etapa: 'excecao', erro: e?.message || String(e) }
      }
    }

    if (r.ok) {
      criados++
      console.log('[indicacao] negocio', r.negocioId, 'indicado', i.whatsapp, 'por', indicadora.whatsapp)
    } else {
      console.error('[indicacao] SEM CARD —', r.etapa, r.erro, r.descricao ?? '', JSON.stringify(lead))
    }
    await registrar({
      lead_id: lead.lead_id,
      slug,
      nome: i.nome,
      whatsapp: i.whatsapp,
      email: '',
      motivo: r.ok ? 'indicacao_black' : `indicacao_black_sem_card: ${r.etapa}: ${r.erro} ${r.descricao ?? ''}`.slice(0, 300),
      recuperado: !!r.ok,
      bitrix_id: r.ok ? String(r.negocioId) : null,
      lead,
    })
  }
  console.log(`[indicacao] envio ${envio}: ${indicados.length} indicados, ${criados} cards, indicadora ${indicadora.whatsapp}`)
  return { recebidos: indicados.length, criados }
}
