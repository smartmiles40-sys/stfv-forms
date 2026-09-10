//  /api/resgatar-pendentes — quem preencheu o formulário e NÃO agendou entra no
//  CRM depois de algumas horas.
//
//  POR QUE EXISTE. Desde 08/09 o negócio no Bitrix só nasce quando a pessoa
//  agenda (decisão do Bruno: "pra não ter a possibilidade da pessoa sair antes da
//  hora"). Isso deixou um limbo: quem preenche nome/e-mail/WhatsApp e fecha a aba
//  ficava só em `stfv_leads_pendentes`, sem SDR, sem follow-up, sem existir pro
//  comercial. Medido em 10/09: 6 de 25 desde que a regra entrou.
//
//  A ESPERA é o ponto. Ela existe pra não atropelar quem só demorou pra escolher
//  o horário: quem agenda em minutos nunca é resgatado. E quem for resgatado e
//  voltar pra agendar depois NÃO ganha um segundo card — o `bitrix_id` fica
//  guardado na linha e o agendamento move ESSE card (ver save-lead).
//
//  Roda por cron (vercel.json) de hora em hora. Também pode ser chamada a mão com
//  a PUBLICAR_SENHA, e aí aceita `?dry=1` pra só LISTAR o que resgataria.
//
//  Env:
//    CRON_SECRET            (opcional) o que a Vercel manda no Authorization
//    RESGATE_APOS_HORAS     (opcional) padrão 3
//    RESGATE_TETO           (opcional) padrão 25 por rodada

import { criarLead, FUNIL_PADRAO } from './_bitrix.mjs'
import { portaoDaSenha, senhaConfere } from './_portao.mjs'
import { idsDoRodizio, proximaSdr } from './_rodizio.mjs'

const TABELA = 'stfv_leads_pendentes'

function sb(caminho, init = {}) {
  const SB_URL = process.env.SUPABASE_FORMS_URL
  const SB_KEY = process.env.SUPABASE_FORMS_KEY
  return fetch(`${SB_URL.replace(/\/$/, '')}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  // Duas portas: o cron da Vercel e a mão humana com a senha do painel.
  //
  // A Vercel só manda `Authorization: Bearer <CRON_SECRET>` quando essa env var
  // EXISTE. Enquanto não existir, aceitamos o user-agent do cron — que é
  // falsificável, sim, e é uma escolha consciente: o pior que alguém consegue
  // fazendo isso é adiantar o resgate de leads que já são nossos, e a alternativa
  // (401 de hora em hora) seria uma rotina morta que ninguém notaria. Com a env
  // var configurada, o user-agent deixa de valer.
  const cronSecret = process.env.CRON_SECRET
  const autorizacao = String(req.headers.authorization || '')
  const agente = String(req.headers['user-agent'] || '')
  const ehCron = cronSecret
    ? senhaConfere(autorizacao, `Bearer ${cronSecret}`)
    : /vercel-cron/i.test(agente)
  if (!cronSecret && ehCron) {
    console.warn('[resgate] rodando sem CRON_SECRET — configure a env var pra fechar esta porta')
  }
  if (!ehCron) {
    const portao = await portaoDaSenha(req)
    if (portao) {
      res.status(portao.status).json(portao.corpo)
      return
    }
  }

  const SB_URL = process.env.SUPABASE_FORMS_URL
  const SB_KEY = process.env.SUPABASE_FORMS_KEY
  const base = process.env.BITRIX_WEBHOOK_URL
  if (!SB_URL || !SB_KEY || !base) {
    res.status(503).json({ ok: false, erro: 'nao_configurado' })
    return
  }

  const horas = Number(process.env.RESGATE_APOS_HORAS || 3)
  const teto = Number(process.env.RESGATE_TETO || 25)
  const dry = req.query?.dry === '1' || req.query?.dry === 'true'
  const corte = new Date(Date.now() - horas * 3600_000).toISOString()

  let pendentes = []
  try {
    const resp = await sb(
      `${TABELA}?select=lead_id,slug,nome,whatsapp,email,criado_em,lead` +
      `&motivo=eq.aguardando_agendamento&recuperado=is.false&bitrix_id=is.null` +
      `&criado_em=lt.${encodeURIComponent(corte)}` +
      `&order=criado_em.asc&limit=${teto}`,
    )
    if (!resp.ok) throw new Error(`supabase ${resp.status}`)
    pendentes = await resp.json()
  } catch (e) {
    console.error('[resgate] não deu pra ler a lista:', e?.message)
    res.status(502).json({ ok: false, erro: 'leitura_falhou' })
    return
  }

  if (dry) {
    res.status(200).json({
      ok: true, dry: true, esperando_horas: horas, quantos: pendentes.length,
      leads: pendentes.map((p) => ({ lead_id: p.lead_id, nome: p.nome, slug: p.slug, criado_em: p.criado_em })),
    })
    return
  }

  const feitos = []
  const falhas = []
  const pulados = []
  for (const linha of pendentes) {
    // JÁ AGENDOU COM ESSE TELEFONE? Então esta linha é fantasma.
    //
    // Quem preenche o formulário DUAS vezes (duas lives, ou uma desistência e um
    // retorno) deixa a primeira linha parada: o `recuperado` é marcado por
    // `lead_id`, que é o envio, não a pessoa. Medido em 10/09: 3 das 8 linhas do
    // limbo eram assim, e sem esta conferência o resgate abriria card na
    // Pré-Vendas pra gente que já tem reunião marcada.
    try {
      const jaFoi = await sb(
        `${TABELA}?select=lead_id&whatsapp=eq.${encodeURIComponent(linha.whatsapp)}` +
        '&recuperado=is.true&limit=1',
      )
      if (jaFoi.ok) {
        const linhas = await jaFoi.json()
        if (Array.isArray(linhas) && linhas.length) {
          await sb(`${TABELA}?lead_id=eq.${encodeURIComponent(linha.lead_id)}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ recuperado: true, motivo: 'agendou em outro envio' }),
          })
          pulados.push({ lead_id: linha.lead_id, motivo: 'esse telefone já agendou' })
          continue
        }
      }
    } catch (e) {
      // Não deu pra conferir: NÃO resgata. Card duplicado é pior do que esperar
      // a próxima hora.
      console.warn('[resgate] não deu pra conferir se já agendou:', e?.message)
      pulados.push({ lead_id: linha.lead_id, motivo: 'não deu pra conferir' })
      continue
    }

    // O `lead` guardado na fase 1 é o payload inteiro (com UTMs e a resposta da
    // live). Reaproveitar é o que faz o card resgatado nascer igual aos outros —
    // remontar um lead "resumido" aqui perderia a origem do tráfego pago.
    const lead = { ...(linha.lead ?? {}), lead_id: linha.lead_id, slug: linha.slug }

    const r = await criarLead(base, lead, {
      // Pré-Vendas, a coluna de sempre: esta pessoa NÃO tem reunião. Mandar pro
      // comercial seria mentir sobre o estágio dela.
      categoryId: process.env.BITRIX_CATEGORY_ID || FUNIL_PADRAO.categoryId,
      stageId: process.env.BITRIX_STAGE_ID || FUNIL_PADRAO.stageId,
      sourceId: lead.source_id || process.env.BITRIX_SOURCE_ID || 'WEB',
      camposExtras: Object.keys(lead).filter(
        (c) => !['nome', 'email', 'whatsapp', 'source_id', 'fonte', 'lead_id', 'slug'].includes(c) &&
          !c.startsWith('reuniao_') && !c.startsWith('utm_') &&
          typeof lead[c] === 'string' && lead[c],
      ),
      tituloNegocio: (l) => `${l.nome || 'Lead'} — ${l.form_name || l.slug || 'formulário'} (não agendou)`,
      // O MESMO rodízio do lead que agenda. Sem responsável explícito o card
      // nasce no dono do webhook, e o resgate viraria um monte de lead na mão de
      // uma pessoa só — o oposto do que ele existe pra resolver.
      responsavelId: await proximaSdr(),
      sdrIds: idsDoRodizio(),
    })

    if (!r.ok) {
      falhas.push({ lead_id: linha.lead_id, erro: `${r.etapa}: ${r.erro}` })
      continue
    }

    // Marca a linha ANTES de seguir: se a próxima falhar, esta não é resgatada
    // de novo na rodada seguinte (card duplicado é o único estrago possível aqui).
    try {
      await sb(`${TABELA}?lead_id=eq.${encodeURIComponent(linha.lead_id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ bitrix_id: String(r.negocioId), motivo: 'resgatado' }),
      })
    } catch (e) {
      console.error('[resgate] card', r.negocioId, 'criado mas a linha NÃO foi marcada:', e?.message)
    }
    feitos.push({ lead_id: linha.lead_id, negocio: r.negocioId })
  }

  console.log('[resgate]', feitos.length, 'resgatados,', pulados.length, 'pulados,', falhas.length, 'falhas,', 'corte', horas + 'h')
  res.status(200).json({ ok: true, resgatados: feitos, pulados, falhas, esperando_horas: horas })
}
