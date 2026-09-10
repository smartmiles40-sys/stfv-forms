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

import { criarLead, atualizarNegocioDaReuniao, FUNIL_PADRAO } from './_bitrix.mjs'
import { chaveIp, dentroDoTeto } from './_portao.mjs'
import { idsDoRodizio, proximaSdr } from './_rodizio.mjs'

const TABELA_PENDENTES = 'stfv_leads_pendentes'

/**
 * Um registro por formulário hospedado. `campos` é allowlist: só o que este
 * formulário manda entra no lead, o resto do body é descartado. Evita
 * mass-assignment e mantém o negócio do Bitrix limpo.
 */
// `reuniao_*` so chegam na SEGUNDA chamada (a de quem agendou) e viram CAMPOS
// do negocio: o card ja nasce dizendo a reuniao, o especialista, o SDR e o link
// da sala, sem depender de nenhuma sincronizacao posterior.
//
// `reuniao_quando` (texto de gente, "quinta-feira, 11 de setembro as 18h") e
// `reuniao_quando_iso` (o mesmo instante em ISO) sao os DOIS de proposito: o
// campo de data do Bitrix nao aceita o texto, e o texto e o que serve de recado
// quando o ISO nao vem. `reuniao_sdr` e o nome de quem leva o credito no QS.
const CAMPOS_LIVE = [
  'expedicao', 'fonte', 'source_id', 'nome', 'email', 'whatsapp', 'assistiu_live',
  'reuniao_quando', 'reuniao_quando_iso', 'reuniao_especialista', 'reuniao_sdr',
  'reuniao_link', 'reuniao_vinculo',
]

/**
 * Um formulario por live (setembro/2026): forms.setuforeuvouviagens.com.br/<slug>.
 * `live` continua aqui pelo link antigo, que ainda circula em grupo de WhatsApp.
 *
 * Live nova: registre o slug AQUI. Desde 10/09 esquecer nao apaga mais dado
 * nenhum (os campos de live entraram no CAMPOS_MINIMOS), mas o slug de fora da
 * lista NAO tem `soComAgendamento` — o negocio dele nasce na Pre-Vendas na hora
 * do envio, em vez de nascer no comercial quando a pessoa agenda.
 */
const FORMS = {
  amalfitana: { campos: CAMPOS_LIVE, soComAgendamento: true },
  tailandia: { campos: CAMPOS_LIVE, soComAgendamento: true },
  turquia: { campos: CAMPOS_LIVE, soComAgendamento: true },
  islandia: { campos: CAMPOS_LIVE, soComAgendamento: true },
  japao: { campos: CAMPOS_LIVE, soComAgendamento: true },
  egito: { campos: CAMPOS_LIVE, soComAgendamento: true },
  peru: { campos: CAMPOS_LIVE, soComAgendamento: true },
  live: { campos: CAMPOS_LIVE },
  exemplo: { campos: CAMPOS_LIVE },
}

/**
 * `soComAgendamento` (Bruno, 08/09/2026): o negocio no Bitrix so nasce quando a
 * pessoa TERMINA o funil — ou seja, quando ela escolhe o horario na etapa 3.
 * Quem preenche os dados e vai embora antes NAO vira card.
 *
 * QUEM NAO AGENDA NAO E JOGADO FORA. Fica em `stfv_leads_pendentes` com
 * motivo 'aguardando_agendamento', que e uma lista consultavel:
 *
 *   select criado_em, nome, whatsapp, email, slug from stfv_leads_pendentes
 *    where motivo = 'aguardando_agendamento' and not recuperado
 *    order by criado_em desc;
 *
 * Isso importa porque, medido em 60 dias, so 18% dos leads de live chegam a ter
 * agendamento (7 de 39). Os outros 82% deixam de entrar no CRM — e com eles sai
 * tambem o follow-up das SDRs, que e de onde vinha boa parte desses 18%. Se o
 * numero de reunioes cair, e AQUI que se olha primeiro.
 */

/**
 * Onde o negocio nasce quando a reuniao JA esta marcada: funil 0
 * ("Comercial 1 - Se tu for eu vou"), coluna EXECUTING ("Reuniao de Vendas").
 *
 * Nasce direto no lugar certo em vez de nascer na Pre-Vendas e ser movido: o
 * card nunca passa por uma coluna onde nao deveria estar, nem por um segundo
 * que seja.
 *
 * `categoryId` e STRING e o funil e o ZERO — cuidado com `||` em cima disso,
 * que trocaria 0 pelo padrao 25 sem avisar.
 */
const FUNIL_AGENDADO = {
  categoryId: process.env.BITRIX_CATEGORY_AGENDADO ?? '0',
  stageId: process.env.BITRIX_STAGE_AGENDADO ?? 'EXECUTING',
}

/**
 * Campos que passam mesmo quando o slug não está registrado acima. `source_id`
 * está aqui de propósito: sem ele, publicar um formulário com slug novo faria a
 * FONTE ser descartada em silêncio e o lead cairia no genérico "Site" — o
 * mesmo erro, de novo, sem sintoma nenhum.
 */
// `assistiu_live` e os `reuniao_*` entraram aqui em 10/09: a allowlist por slug
// engolia os dois em silencio quando a live era nova e ninguem lembrava de
// registrar o slug acima. O sintoma era mudo — o negocio nascia sem a resposta
// que separa quem assistiu de quem nao assistiu, e sem os campos da reuniao.
// Nenhum deles e perigoso de aceitar por padrao: todos viram texto no card.
const CAMPOS_MINIMOS = [
  'nome', 'email', 'whatsapp', 'source_id', 'fonte', 'expedicao', 'assistiu_live',
  'reuniao_quando', 'reuniao_quando_iso', 'reuniao_especialista', 'reuniao_sdr',
  'reuniao_link', 'reuniao_vinculo',
]

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

/**
 * AVISA O QS QUAL E O NUMERO DO CARD.
 *
 * O card de quem agenda por um formulario de live nasce AQUI, e ate 10/09 o QS
 * nunca ficava sabendo o numero dele: `qs_leads.bitrix_id` ficava nulo. Medido
 * em 09/09, 17 das 18 reunioes vindas do formulario estavam assim — e sem esse
 * numero TODO o resto do funil morre em silencio (`/api/bitrix-sync` do QS
 * responde `skipped_no_bitrix_id`): desfecho, no-show, reuniao realizada, SAL,
 * produto e movimento de coluna nunca voltam pro card.
 *
 * `vinculo` e um cracha assinado pelo servidor do QS no agendamento. Nao mandamos
 * id de lead: id vindo do navegador seria porta pra sobrescrever lead alheio, e
 * esse defeito ja aconteceu por la. Quem assina e o QS; nos so carregamos.
 *
 * Best-effort com log alto: o card ja existe e a reuniao ja esta marcada. Falhar
 * aqui devolve o mundo ao estado de ontem, que era o estado normal — mas o log
 * tem o numero do card, que e por onde se conserta depois.
 */
async function avisarQsDoCard(vinculo, negocioId) {
  if (!vinculo || !negocioId) return false
  const base = (process.env.QS_BASE_URL || 'https://qs-turis.vercel.app').replace(/\/$/, '')
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 6000)
  try {
    const resp = await fetch(`${base}/api/lead-bitrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vinculo, bitrix_id: String(negocioId) }),
      signal: ctrl.signal,
    })
    const dados = await resp.json().catch(() => null)
    if (!resp.ok || !dados?.ok) {
      console.error('[qs] negocio', negocioId, 'NAO grudou no lead do QS:', resp.status,
        JSON.stringify(dados)?.slice(0, 200))
      return false
    }
    console.log('[qs] negocio', negocioId, 'grudado no lead', dados.lead_id,
      dados.moveu_de ? `(saiu do card ${dados.moveu_de.id})` : '')
    return true
  } catch (e) {
    console.error('[qs] negocio', negocioId, 'NAO grudou no lead do QS:', e?.message)
    return false
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * A linha que este lead deixou na fase 1. Serve pra UMA pergunta: o resgate ja
 * abriu card pra ele? Se abriu, o agendamento ATUALIZA esse card em vez de abrir
 * um segundo — ver o comentario de `bitrix_id` na migration.
 */
async function pendenteDoLead(leadId) {
  const SB_URL = process.env.SUPABASE_FORMS_URL
  const SB_KEY = process.env.SUPABASE_FORMS_KEY
  if (!SB_URL || !SB_KEY || !leadId) return null
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 4000)
  try {
    const resp = await fetch(
      `${SB_URL.replace(/\/$/, '')}/rest/v1/${TABELA_PENDENTES}` +
      `?select=lead_id,bitrix_id&lead_id=eq.${encodeURIComponent(leadId)}&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, signal: ctrl.signal },
    )
    if (!resp.ok) return null
    const linhas = await resp.json()
    return Array.isArray(linhas) && linhas[0] ? linhas[0] : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * A pessoa agendou: a linha que estava esperando deixa de ser pendencia.
 *
 * Best-effort. Falhar aqui deixa uma linha marcada como pendente que ja virou
 * negocio — ruim de ler, mas nao perde nada. O contrario (apagar antes de ter
 * certeza) perderia o lead.
 */
async function marcarRecuperado(leadId) {
  const SB_URL = process.env.SUPABASE_FORMS_URL
  const SB_KEY = process.env.SUPABASE_FORMS_KEY
  if (!SB_URL || !SB_KEY || !leadId) return
  try {
    await fetch(
      `${SB_URL.replace(/\/$/, '')}/rest/v1/${TABELA_PENDENTES}?lead_id=eq.${encodeURIComponent(leadId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ recuperado: true, motivo: 'agendou' }),
      },
    )
  } catch (e) {
    console.warn('[pendente] nao deu pra marcar como recuperado:', e?.message)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
  const str = (v, max) => String(v ?? '').slice(0, max)

  // ── CAMPO-ARMADILHA ───────────────────────────────────────────────────────
  // O formulario tem um campo escondido chamado `site`: gente nao ve, robo de
  // formulario preenche. Responde como se tivesse dado certo — dizer "peguei
  // voce" so ensina qual campo entregou o robo — e nao grava nada.
  if (str(body.site, 200).trim()) {
    console.log('[lead] armadilha: descartado sem gravar')
    res.status(200).json({ ok: true })
    return
  }

  // ── TETO POR IP ───────────────────────────────────────────────────────────
  // 60 por hora, generoso de proposito: numa live muita gente entra pelo 4G, e
  // operadora de celular coloca centenas de pessoas atras do MESMO IP (CGNAT).
  // Um teto apertado ali recusaria lead pago. Isto e contra script em rajada.
  const teto = Number(process.env.LEAD_TETO_HORA || 60)
  if (!(await dentroDoTeto(`lead:${chaveIp(req)}`, teto))) {
    console.warn('[lead] teto por IP estourado')
    res.status(429).json({ ok: false, error: 'muitas_tentativas' })
    return
  }

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

  // ── FASE 1: ainda nao agendou ────────────────────────────────────────────
  // Guarda e devolve ok. Nada de Bitrix: o card so nasce quando a pessoa
  // terminar o funil. Ver o comentario de `soComAgendamento` la em cima.
  const agendou = body.agendado === true || body.agendado === 'true'
  if (conf?.soComAgendamento && !agendou) {
    const guardado = await guardarPendente(lead, 'aguardando_agendamento')
    // 200 mesmo sem conseguir guardar: segurar a pessoa numa tela de erro aqui
    // seria perder o agendamento que ela ainda vai fazer, que e o que importa.
    // O lead continua no log da funcao de qualquer jeito.
    res.status(200).json({ ok: true, aguardando_agendamento: true, guardado })
    return
  }

  const base = process.env.BITRIX_WEBHOOK_URL
  if (!base) {
    console.error('[bitrix] BITRIX_WEBHOOK_URL ausente — lead não foi pro CRM')
    const guardado = await guardarPendente(lead, 'BITRIX_WEBHOOK_URL ausente')
    res.status(guardado ? 200 : 502).json({ ok: guardado, error: 'bitrix_nao_configurado' })
    return
  }

  // O resgate já abriu card pra este lead? Então este agendamento MOVE aquele
  // card, não abre outro. Sem isto, quem preencheu, foi resgatado e voltou pra
  // agendar terminaria com dois cards da mesma pessoa no funil.
  const reuniaoDoLead = {
    quando: lead.reuniao_quando || '',
    quando_iso: lead.reuniao_quando_iso || '',
    especialista: lead.reuniao_especialista || '',
    sdr: lead.reuniao_sdr || '',
    link: lead.reuniao_link || '',
    produto: lead.expedicao || '',
    email: lead.email || '',
  }

  const jaResgatado = agendou ? await pendenteDoLead(lead.lead_id) : null
  if (jaResgatado?.bitrix_id) {
    const upd = await atualizarNegocioDaReuniao(base, jaResgatado.bitrix_id, {
      funil: FUNIL_AGENDADO,
      reuniao: reuniaoDoLead,
      comentario: `Reunião marcada no formulário em ${dataHoraSaoPaulo()}. `
        + 'Este card foi aberto antes, pelo resgate de quem não tinha agendado.',
    })
    if (upd.ok) {
      console.log('[bitrix] negocio', upd.negocioId, 'ATUALIZADO (resgatado antes, agendou agora)')
      await marcarRecuperado(lead.lead_id)
      await avisarQsDoCard(lead.reuniao_vinculo, upd.negocioId)
      res.status(200).json({ ok: true, negocio: upd.negocioId, atualizado: true })
      return
    }
    // Não deu pra atualizar: segue pro caminho normal e abre o card. Dois cards
    // é ruim; reunião marcada que não aparece no CRM é pior.
    console.error('[bitrix] update do card resgatado falhou, vou criar outro:', upd.erro, upd.descricao ?? '')
  }

  const responsavelId = await proximaSdr()
  const resultado = await criarLead(base, lead, {
    // Agendado nasce no comercial, na coluna de reuniao; o resto segue na
    // Pre-Vendas, como sempre.
    categoryId: agendou ? FUNIL_AGENDADO.categoryId : (process.env.BITRIX_CATEGORY_ID || FUNIL_PADRAO.categoryId),
    stageId: agendou ? FUNIL_AGENDADO.stageId : (process.env.BITRIX_STAGE_ID || FUNIL_PADRAO.stageId),
    responsavelId,
    // A fonte vem do PRÓPRIO formulário (campo fixo `source_id`), não de env
    // var: assim cada formulário publicado declara a sua origem e uma live
    // nova não precisa de redeploy. A env var é só a rede de segurança.
    sourceId: lead.source_id || process.env.BITRIX_SOURCE_ID || 'WEB',
    // Observações levam só o que NÃO tem campo próprio no Bitrix. `source_id` e
    // `fonte` viram o campo Fonte do negócio; repeti-los no comentário só suja
    // e faz parecer que a origem mora lá — foi exatamente essa a confusão. Os
    // `reuniao_*` saíram daqui pelo mesmo motivo: agora cada um tem o seu campo,
    // e o que NÃO couber em campo volta escrito no comentário (ver `pulados`).
    camposExtras: campos.filter(
      (c) => !['nome', 'email', 'whatsapp', 'source_id', 'fonte'].includes(c) &&
        !c.startsWith('reuniao_'),
    ),
    // Os campos que o aviso do Bitrix lê. `produto` é a expedição da live: é o
    // que o formulário sabe sobre o assunto da conversa, e é o que o
    // especialista precisa ver antes de entrar na sala.
    reuniao: agendou ? reuniaoDoLead : null,
    // Pra casar o SDR do QS com o usuario do Bitrix e deixar o card no NOME
    // dele. So estes ids entram: ninguem novo passa a receber lead por aqui.
    sdrIds: idsDoRodizio(),
  })

  if (resultado.ok) {
    console.log('[bitrix] negocio', resultado.negocioId, 'para SDR', responsavelId ?? '(padrao)',
      agendou ? '(ja agendado -> funil ' + FUNIL_AGENDADO.categoryId + '/' + FUNIL_AGENDADO.stageId + ')' : '')
    // Campo da reuniao que ficou vazio nao da erro em lugar nenhum: o aviso do
    // Bitrix sai com a linha em branco e ninguem descobre. Fica no log com o
    // numero do card, que e por onde se acha o caso depois.
    if (resultado.reuniaoPulados?.length) {
      console.warn('[bitrix] negocio', resultado.negocioId, 'sem:', resultado.reuniaoPulados.join(' · '))
    }
    // A linha da fase 1 deixa de ser pendencia — a pessoa terminou o funil.
    if (agendou) await marcarRecuperado(lead.lead_id)
    // E o QS aprende o numero do card. AWAIT de proposito: a funcao serverless
    // congela quando a resposta sai, entao disparar sem esperar mataria a
    // chamada no meio de vez em quando — e o defeito seria intermitente.
    if (agendou) await avisarQsDoCard(lead.reuniao_vinculo, resultado.negocioId)
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
