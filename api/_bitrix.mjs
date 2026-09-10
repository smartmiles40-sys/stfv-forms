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

/**
 * Os campos do negócio que descrevem a REUNIÃO.
 *
 * POR QUE ISSO EXISTE AQUI. O Bitrix avisa o time por um modelo que lê CAMPOS
 * do negócio (`{{Data e hora do agendamento (Google Meet)}}` e companhia), não
 * o campo de observações. Enquanto a reunião só ia no comentário, o aviso saía
 * com "Data:", "Especialista:" e "SDR:" em branco — e a pessoa que ia atender
 * tinha que abrir o card pra descobrir o básico.
 *
 * E VÃO NA MESMA CHAMADA que cria o negócio, de propósito. O card nasce direto
 * na coluna "Reunião de Vendas", e é a entrada nessa coluna que dispara o aviso
 * do Bitrix: preencher os campos num segundo `crm.deal.update` logo depois
 * seria uma corrida contra o robô — que na maioria das vezes chegaria primeiro,
 * e o aviso sairia vazio do mesmo jeito.
 *
 * ⚠️ O `UF_CRM_*` é o id do campo NAQUELE portal, e ele MUDA se o campo for
 * apagado e recriado no Bitrix. A fonte de verdade é a tabela `bitrix_fields`
 * do Supabase do QS (o workflow n8n "QS ⇄ catálogo Bitrix" a atualiza todo dia
 * às 6h); estes ids são a cópia dela para cá — `/api/bitrix-status` mostra o
 * que o portal responde hoje, e é lá que se confere antes de desconfiar.
 */
const CAMPOS_REUNIAO = {
  datahora_meet: 'UF_CRM_1773943863374',    // datetime "Data e hora do agendamento (Google Meet)"
  link_meet: 'UF_CRM_1773947738988',        // url      "Link do google meet"
  produto: 'UF_CRM_1773954690276',          // string   "Produto (Descritivo da Reunião)"
  resp_reuniao: 'UF_CRM_1767801443498',     // enum     "Responsável pela reunião"
  sdr_agendou: 'UF_CRM_1758563297739',      // enum     "Quem fez o agendamento?"
  // Estes dois o caminho do QS (n8n) já preenchia e o do formulário não —
  // ficavam vazios só pra quem agendou pela live.
  email_cliente: 'UF_CRM_1762288786624',    // string   e-mail do cliente
  data_agendamento: 'UF_CRM_1767724031187', // date     quando o agendamento foi FEITO
}

/**
 * As duas listas de gente do Bitrix, como estavam em 09/09/2026.
 *
 * São listas de OPÇÕES: o campo não guarda o nome, guarda o id da opção. Ficam
 * escritas aqui porque o caminho de um lead que agenda numa live é o caminho
 * mais quente que temos — na hora da live chegam dezenas por minuto, e cada
 * chamada extra ao Bitrix aí é uma chance de estourar o limite de requisições
 * do portal por um dado que muda duas vezes por ano.
 *
 * Quando o nome que chega NÃO está nesta lista (contratou SDR novo e ninguém
 * mexeu no código), aí sim a lista de verdade é buscada no portal e guardada em
 * memória — ver `opcoesDoCampo`. É o remendo automático pro caso que sabemos
 * que vai acontecer.
 */
const OPCOES_CONHECIDAS = {
  resp_reuniao: [
    { id: 851, value: 'Talita Carvalho' },
    { id: 1277, value: 'Victor Maldonado' },
    { id: 1279, value: 'Bruno Matheus' },
    { id: 849, value: 'John Italo' },
  ],
  sdr_agendou: [
    { id: 1393, value: 'Victor Hugo - SDR' },
    { id: 1417, value: 'Yanca Manuella' },
    { id: 435, value: 'John Italo - Coordenador' },
    { id: 437, value: 'Talita Carvalho - Closer' },
    { id: 921, value: 'Mariana Rodrigues - SDR' },
    { id: 1389, value: 'Victor Maldonado - Closer' },
    { id: 1391, value: 'Bruno Matheus - Closer' },
  ],
}

/** Cache dos campos personalizados do portal (vale por lambda quente). */
const CACHE_TTL_MS = 10 * 60 * 1000
let cacheUserfields = { quando: 0, lista: null }

function normalizar(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // tira acento
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Casa o nome que veio do QS com o rótulo da opção no Bitrix.
 *
 * É a escada do nó "Montar reunião" do n8n (o caminho das reuniões que o SDR
 * marca dentro do QS): duas regras diferentes pro mesmo casamento fariam a mesma
 * pessoa aparecer de formas diferentes dependendo de quem agendou.
 *
 * NENHUM passo aceita empate — nem o do prefixo, e é aqui que esta versão é mais
 * exigente que a do n8n. A lista tem "Victor Hugo - SDR" e "Victor Maldonado -
 * Closer": lá, um "Victor" pelado casaria com o primeiro da lista e creditaria o
 * agendamento à pessoa errada, calado. Campo vazio (com o recado no comentário)
 * é melhor do que crédito errado.
 */
function acharOpcao(lista, nome) {
  const alvo = normalizar(nome)
  if (!alvo || !Array.isArray(lista) || !lista.length) return null

  // 1) igual
  let hit = lista.find((o) => normalizar(o.value) === alvo)
  if (hit) return hit.id

  // 2) o rótulo começa com o nome do QS ('Talita Carvalho' → 'Talita Carvalho - Closer')
  let candidatos = lista.filter((o) => normalizar(o.value).indexOf(alvo + ' ') === 0)
  if (candidatos.length === 1) return candidatos[0].id

  // 3) o nome do QS começa com o rótulo ('Yanca Manuella Ruivo' → 'Yanca Manuella')
  candidatos = lista.filter((o) => {
    const v = normalizar(o.value)
    return v.length > 3 && alvo.indexOf(v + ' ') === 0
  })
  if (candidatos.length === 1) return candidatos[0].id

  // 4) todas as palavras do nome do QS aparecem no rótulo, e num rótulo só
  const partes = alvo.split(' ').filter((x) => x.length > 2)
  if (partes.length > 1) {
    const todos = lista.filter((o) => {
      const v = normalizar(o.value)
      return partes.every((x) => v.indexOf(x) >= 0)
    })
    if (todos.length === 1) return todos[0].id
  }

  // 5) primeiro nome, só se for único
  const primeiro = alvo.split(' ')[0]
  const porPrimeiro = lista.filter((o) => normalizar(o.value).split(' ')[0] === primeiro)
  return porPrimeiro.length === 1 ? porPrimeiro[0].id : null
}

/** Os campos personalizados do portal, com as opções de cada lista. */
async function userfields(base) {
  const agora = Date.now()
  if (cacheUserfields.lista && agora - cacheUserfields.quando < CACHE_TTL_MS) {
    return cacheUserfields.lista
  }
  // Sem filtro de propósito: filtro por FIELD_NAME muda de sintaxe entre
  // versões do Bitrix e falhar aqui seria voltar sem opção nenhuma. Vem tudo
  // uma vez, fica em memória, e a busca é local.
  const r = await chamar(base, 'crm.deal.userfield.list', { order: { SORT: 'ASC' } })
  // Lista VAZIA não vira cache: resposta vazia é sintoma de webhook sem escopo
  // CRM, e guardar isso por 10 minutos transformaria um tropeço de um segundo em
  // dez minutos de campo em branco.
  const lista = r.ok && Array.isArray(r.result) && r.result.length ? r.result : null
  if (!lista) {
    console.warn('[bitrix] userfield.list nao deu lista:', r.erro || '', r.descricao || '')
    return null
  }
  cacheUserfields = { quando: agora, lista }
  return lista
}

/**
 * As opções de uma das listas: primeiro a cópia daqui, e só quando o nome não
 * casa com nenhuma é que pergunta ao portal.
 */
export async function opcoesDoCampo(base, alias, nome) {
  const conhecidas = OPCOES_CONHECIDAS[alias] || []
  if (acharOpcao(conhecidas, nome) != null) return conhecidas

  const campo = CAMPOS_REUNIAO[alias]
  const lista = campo ? await userfields(base) : null
  const achado = lista?.find((f) => f.FIELD_NAME === campo)
  const doPortal = (achado?.LIST || [])
    .map((i) => ({ id: Number(i.ID), value: String(i.VALUE ?? '') }))
    .filter((o) => Number.isFinite(o.id) && o.value)

  return doPortal.length ? doPortal : conhecidas
}

/** A data de hoje em São Paulo, YYYY-MM-DD. A função roda em UTC: às 21h de cá
 *  o `new Date().toISOString()` já está no dia seguinte. */
function hojeEmSaoPaulo() {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return p // en-CA já formata como 2026-09-10
}

/**
 * ISO (UTC) → o formato que o campo de data do Bitrix entende, no fuso de casa.
 * Sem isso a reunião aparece 3h adiantada no card. O Brasil não tem horário de
 * verão desde 2019, então -03:00 é fixo.
 */
function horaDeBrasilia(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const b = new Date(d.getTime() - 3 * 3600 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${b.getUTCFullYear()}-${p(b.getUTCMonth() + 1)}-${p(b.getUTCDate())}` +
    `T${p(b.getUTCHours())}:${p(b.getUTCMinutes())}:${p(b.getUTCSeconds())}-03:00`
}

/** Cache dos usuários do rodízio (vale por lambda quente). */
let cacheUsuarios = { quando: 0, lista: null }

/**
 * O CONTATO JÁ EXISTE NO PORTAL?
 *
 * Antes disto, `crm.contact.add` criava sempre. Quem assiste a duas lives e
 * agenda nas duas virava duas pessoas diferentes no CRM — medido em 09/09: dois
 * telefones repetidos em 30 dias, um deles real (amalfitana e tailândia). O
 * closer abria o card sem o histórico da outra conversa.
 *
 * Procura por telefone e depois por e-mail, que é como o Bitrix acha duplicado de
 * verdade (`crm.duplicate.findbycomm` usa o índice de comunicação, não o nome).
 *
 * O contato achado é REUSADO, nunca atualizado. Reescrever nome/telefone de um
 * contato que já existe é o laço que já apagou dado bom aqui — e nada se perde:
 * o e-mail desta conversa vai no campo da reunião de qualquer jeito.
 */
async function contatoExistente(base, lead) {
  const tentativas = []
  if (lead.whatsapp) tentativas.push(['PHONE', lead.whatsapp])
  if (lead.email) tentativas.push(['EMAIL', lead.email])

  for (const [tipo, valor] of tentativas) {
    const r = await chamar(base, 'crm.duplicate.findbycomm', {
      entity_type: 'CONTACT', type: tipo, values: [valor],
    })
    if (!r.ok) {
      // Falha aberta: sem resposta a gente CRIA, como fazia antes. Um contato
      // repetido é chato; um lead que não entra é caro.
      console.warn('[bitrix] findbycomm falhou:', r.erro || '', r.descricao || '')
      return null
    }
    const ids = Array.isArray(r.result?.CONTACT) ? r.result.CONTACT : []
    if (ids.length) return { id: String(ids[0]), por: tipo, quantos: ids.length }
  }
  return null
}

/**
 * O usuário do Bitrix que corresponde ao SDR do QS.
 *
 * Existe porque havia DOIS rodízios decidindo de quem é o lead: o responsável do
 * card saía do rodízio daqui (`BITRIX_SDR_IDS`, que são ids sem nome) e o dono do
 * lead no QS saía do rodízio do banco. No mesmo card, "Quem fez o agendamento?"
 * dizia uma pessoa e o responsável era outra — e é o responsável que recebe a
 * tarefa no Bitrix.
 *
 * A busca é pelo NOME, com a mesma escada das listas, e só entre os ids que já
 * estão na env var: ninguém entra no rodízio por causa desta função.
 */
export async function usuarioDoSdr(base, nome, ids) {
  if (!nome || !Array.isArray(ids) || !ids.length) return null
  const agora = Date.now()
  if (!cacheUsuarios.lista || agora - cacheUsuarios.quando >= CACHE_TTL_MS) {
    const achados = []
    for (const id of ids) {
      // Um por um de propósito: `user.get` com lista de ID muda de comportamento
      // entre versões do Bitrix, e são três ids, uma vez por lambda.
      const r = await chamar(base, 'user.get', { ID: id })
      const u = Array.isArray(r.result) ? r.result[0] : null
      // Sem id repetido: a MESMA pessoa duas vezes na lista faria a regra de
      // "nenhum empate" recusar um nome que na verdade nao tem ambiguidade.
      if (u?.ID && !achados.some((a) => a.id === String(u.ID))) {
        achados.push({ id: String(u.ID), value: `${u.NAME ?? ''} ${u.LAST_NAME ?? ''}`.trim() })
      }
    }
    if (!achados.length) return null   // não cacheia vazio
    cacheUsuarios = { quando: agora, lista: achados }
  }
  const achado = acharOpcao(cacheUsuarios.lista, nome)
  return achado != null ? String(achado) : null
}

/**
 * Monta os campos da reunião. Devolve `{fields, pulados}`: o que não deu pra
 * preencher volta em `pulados` e vai pro comentário do negócio, porque campo
 * vazio no CRM não conta história nenhuma — quem lê o card precisa saber que
 * falta, e o quê.
 */
export async function camposDaReuniao(base, reuniao) {
  const fields = {}
  const pulados = []
  if (!reuniao) return { fields, pulados }

  const quando = reuniao.quando_iso ? horaDeBrasilia(reuniao.quando_iso) : null
  if (quando) fields[CAMPOS_REUNIAO.datahora_meet] = quando
  else if (reuniao.quando) pulados.push(`Data (o agendador mandou "${reuniao.quando}", sem a data de máquina)`)

  if (reuniao.link) fields[CAMPOS_REUNIAO.link_meet] = reuniao.link
  else pulados.push('Link do Meet (a sala não foi criada — crie pela Agenda do QS)')

  if (reuniao.produto) fields[CAMPOS_REUNIAO.produto] = String(reuniao.produto).slice(0, 250)

  if (reuniao.email) fields[CAMPOS_REUNIAO.email_cliente] = String(reuniao.email).slice(0, 120)

  // A data em que o agendamento foi FEITO (hoje), não a da reunião. É o mesmo
  // `booking_date` que o caminho do QS manda, e ela vai em data pura: campo de
  // data com hora dentro é o jeito de o filtro do Bitrix varrer o dia errado.
  fields[CAMPOS_REUNIAO.data_agendamento] = hojeEmSaoPaulo()

  for (const [alias, nome, rotulo] of [
    ['resp_reuniao', reuniao.especialista, 'Especialista'],
    ['sdr_agendou', reuniao.sdr, 'SDR'],
  ]) {
    if (!nome) { pulados.push(`${rotulo} (o agendador não mandou o nome)`); continue }
    const opcoes = await opcoesDoCampo(base, alias, nome)
    const id = acharOpcao(opcoes, nome)
    if (id != null) fields[CAMPOS_REUNIAO[alias]] = id
    else pulados.push(`${rotulo}: ${nome} (não existe na lista do Bitrix)`)
  }

  return { fields, pulados }
}

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
function observacoes(lead, camposExtras, faltando = [], recado = null) {
  const linhas = []
  for (const chave of camposExtras) {
    const v = lead[chave]
    if (v) linhas.push(`${chave}: ${v}`)
  }
  // O que NÃO entrou nos campos da reunião. Vai escrito porque o aviso que o
  // Bitrix manda pro time lê os campos: o que faltou aqui sai em branco lá, e
  // quem abre o card é quem tem chance de consertar antes da reunião.
  if (faltando.length) {
    linhas.push('', '⚠️ O aviso da reunião vai sair sem: ' + faltando.join(' · '))
  }
  if (recado) linhas.push(recado)
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

  // O RESPONSÁVEL do card. Quando a reunião diz qual SDR é o dono do lead no QS,
  // é ELE — senão o card fica com uma pessoa e o "Quem fez o agendamento?" com
  // outra, e quem recebe a tarefa no Bitrix é o responsável.
  const doSdr = opcoes.reuniao?.sdr
    ? await usuarioDoSdr(base, opcoes.reuniao.sdr, opcoes.sdrIds ?? [])
    : null
  const responsavelId = doSdr || opcoes.responsavelId || null

  // Já existe? Reusa. Ver `contatoExistente`.
  const jaExiste = await contatoExistente(base, lead)
  const contato = jaExiste
    ? { ok: true, result: jaExiste.id }
    : await chamar(base, 'crm.contact.add', {
      fields: {
        NAME: nome,
        OPENED: 'Y',
        TYPE_ID: 'CLIENT',
        SOURCE_ID: sourceId,
        ...(responsavelId ? { ASSIGNED_BY_ID: responsavelId } : {}),
        ...(lead.whatsapp ? { PHONE: [{ VALUE: lead.whatsapp, VALUE_TYPE: 'MOBILE' }] } : {}),
        ...(lead.email ? { EMAIL: [{ VALUE: lead.email, VALUE_TYPE: 'WORK' }] } : {}),
      },
      params: { REGISTER_SONET_EVENT: 'N' },
    })
  if (!contato.ok) return { ok: false, etapa: 'contato', ...contato }

  const titulo = opcoes.tituloNegocio
    ? opcoes.tituloNegocio(lead)
    : `${nome || 'Lead'} — ${lead.form_name || lead.slug || 'formulário'}`

  // A reunião entra no MESMO `crm.deal.add`, não num update depois: é a chegada
  // do negócio na coluna de reunião que dispara o aviso do Bitrix pro time.
  const { fields: camposReuniao, pulados } = await camposDaReuniao(base, opcoes.reuniao)

  const negocio = await chamar(base, 'crm.deal.add', {
    fields: {
      TITLE: titulo.slice(0, 250),
      CONTACT_ID: contato.result,
      CATEGORY_ID: funil.categoryId,
      STAGE_ID: funil.stageId,
      OPENED: 'Y',
      SOURCE_ID: sourceId,
      ...camposReuniao,
      COMMENTS: observacoes(lead, opcoes.camposExtras ?? [], pulados,
        jaExiste ? `Contato ${jaExiste.id} reaproveitado (achado por ${jaExiste.por === 'PHONE' ? 'telefone' : 'e-mail'})` : null),
      // Sem responsavel explicito o negocio nasce no dono do webhook — ou
      // seja, todos os leads da live cairiam numa pessoa so, fora da fila das
      // SDRs. O contato tambem vai pro mesmo responsavel, senao contato e
      // negocio ficam com donos diferentes.
      ...(responsavelId ? { ASSIGNED_BY_ID: responsavelId } : {}),
    },
    params: { REGISTER_SONET_EVENT: 'N' },
  })
  if (!negocio.ok) {
    // Contato criado e negocio nao: o contato fica la, e melhor do que nada,
    // mas quem olha o funil nao ve o lead. Por isso isto e reportado como falha.
    return { ok: false, etapa: 'negocio', contatoId: contato.result, ...negocio }
  }

  return {
    ok: true,
    contatoId: contato.result,
    negocioId: negocio.result,
    reuniaoPulados: pulados,
    contatoReaproveitado: jaExiste ? jaExiste.id : null,
    responsavelId,
    responsavelVeioDoSdr: Boolean(doSdr),
  }
}

/**
 * O card JA EXISTE (foi aberto pelo resgate) e a pessoa acabou de agendar:
 * move de coluna e preenche a reunião, em vez de abrir um segundo card.
 *
 * A ORDEM aqui é o contrário da criação, e por um motivo: no `crm.deal.add` os
 * campos vão junto porque é a chegada na coluna que dispara o aviso do Bitrix.
 * Aqui o card já está no funil, então um `update` só — com etapa E campos na
 * mesma chamada — mantém a mesma garantia: quando o robô olhar, está tudo lá.
 */
export async function atualizarNegocioDaReuniao(base, negocioId, { funil, reuniao, comentario }) {
  const { fields: camposReuniao, pulados } = await camposDaReuniao(base, reuniao)
  const r = await chamar(base, 'crm.deal.update', {
    id: String(negocioId),
    fields: {
      CATEGORY_ID: funil.categoryId,
      STAGE_ID: funil.stageId,
      ...camposReuniao,
      ...(comentario ? { COMMENTS: comentario } : {}),
    },
    params: { REGISTER_SONET_EVENT: 'N' },
  })
  if (!r.ok) return { ok: false, etapa: 'negocio', ...r }
  return { ok: true, negocioId: String(negocioId), reuniaoPulados: pulados, atualizado: true }
}

/**
 * Diagnostico dos campos da reuniao: pro `/api/bitrix-status` mostrar, pra cada
 * um, o rotulo que o PORTAL diz que ele tem hoje.
 *
 * O `UF_CRM_*` e opaco e muda quando o campo e recriado no Bitrix. Sem olhar o
 * rotulo, a unica prova de que estamos escrevendo no campo certo seria mandar um
 * lead de verdade e abrir o card — e escrever no campo errado nao da erro: o
 * aviso sai vazio e o dado vai pra outro lugar.
 *
 * `nomes` (opcional) sao nomes de pessoas pra testar o casamento com as listas
 * de "Responsavel pela reuniao" e "Quem fez o agendamento?" sem tocar em lead
 * nenhum: `/api/bitrix-status?senha=...&nomes=Talita Carvalho,Mariana`.
 */
export async function conferirCamposDaReuniao(base, { nomes = [] } = {}) {
  const lista = await userfields(base)
  if (!lista) {
    return { ok: false, erro: 'nao_deu_pra_ler_os_campos', dica: 'O webhook precisa de escopo CRM.' }
  }

  const rotulo = (f) => {
    const r = f?.EDIT_FORM_LABEL || f?.LIST_COLUMN_LABEL || ''
    if (r && typeof r === 'object') return r.br || r.pt || r.en || Object.values(r)[0] || ''
    return String(r || '')
  }

  const campos = {}
  for (const [alias, fieldName] of Object.entries(CAMPOS_REUNIAO)) {
    const f = lista.find((x) => x.FIELD_NAME === fieldName)
    campos[alias] = f
      ? {
        campo: fieldName,
        rotuloNoBitrix: rotulo(f) || '(o portal não devolveu rótulo)',
        tipo: f.USER_TYPE_ID,
        opcoes: (f.LIST || []).map((i) => `${i.ID} = ${i.VALUE}`),
      }
      : { campo: fieldName, erro: '⚠️ esse campo NÃO existe mais no portal — foi recriado?' }
  }

  const casamento = {}
  for (const nome of nomes) {
    casamento[nome] = {}
    for (const alias of ['resp_reuniao', 'sdr_agendou']) {
      const opcoes = await opcoesDoCampo(base, alias, nome)
      const id = acharOpcao(opcoes, nome)
      const achada = opcoes.find((o) => o.id === id)
      casamento[nome][alias] = achada ? `${achada.id} = ${achada.value}` : '⚠️ nenhuma opção casou'
    }
  }

  return { ok: true, campos, ...(nomes.length ? { casamento } : {}) }
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
