//  O PORTÃO: senha em tempo constante e teto por IP.
//
//  Estava tudo espalhado. `senhaConfere` era o MESMO código copiado em três
//  rotas, e não havia teto nenhum: dava pra chutar a PUBLICAR_SENHA a noite
//  inteira, e quem acertasse republicaria qualquer um dos formulários no ar.
//  Também não havia teto pro `/api/save-lead` — um script sozinho enchia o
//  Bitrix de card e queimava o rodízio das SDRs.
//
//  O IP NUNCA é gravado em claro: o que vai pro banco é um hash com sal. Contar
//  chamadas não exige guardar dado pessoal (LGPD).
//
//  FALHA ABERTA, sempre. Banco fora do ar não pode virar "formulário fora do
//  ar": sem resposta do teto, a chamada passa. O teto existe contra abuso em
//  volume, não como trava de segurança — a trava é a senha.

import { createHash, timingSafeEqual } from 'node:crypto'

/** Compara sem vazar o tamanho pelo tempo. */
export function senhaConfere(recebida, esperada) {
  const a = Buffer.from(String(recebida ?? ''))
  const b = Buffer.from(String(esperada ?? ''))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Hash do IP de quem chamou, ou '' quando não há IP legível. */
export function chaveIp(req) {
  const xff = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
  const ip = xff || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || ''
  if (!ip) return ''
  const sal = process.env.RATE_SALT || process.env.SUPABASE_FORMS_KEY || 'stfv-forms'
  return createHash('sha256').update(`${sal}:${ip}`).digest('hex').slice(0, 32)
}

/**
 * Conta esta chamada e diz se ainda está dentro do teto (por hora).
 * `true` também quando não deu pra contar — ver "FALHA ABERTA" acima.
 */
export async function dentroDoTeto(chave, teto) {
  const SB_URL = process.env.SUPABASE_FORMS_URL
  const SB_KEY = process.env.SUPABASE_FORMS_KEY
  if (!chave || !SB_URL || !SB_KEY) return true

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 2500)
  try {
    const resp = await fetch(`${SB_URL.replace(/\/$/, '')}/rest/v1/rpc/stfv_rate_bump`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_chave: chave, p_teto: teto }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      console.warn('[teto] rpc', resp.status, '— deixando passar')
      return true
    }
    return (await resp.json()) !== false
  } catch (e) {
    console.warn('[teto] indisponível:', e?.message, '— deixando passar')
    return true
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * O portão das rotas com senha. Devolve `null` quando pode seguir, ou
 * `{ status, corpo }` pra devolver como resposta.
 *
 * SÓ O ERRO CONTA, e essa ordem é o ponto. A primeira versão contava toda
 * tentativa, inclusive as certas — e o painel faz duas chamadas por
 * carregamento, então quem estivesse trabalhando normalmente se trancaria em
 * quinze recarregadas. Contando só o erro, o teto pode ser BAIXO (10 por hora,
 * que é pouco pra quem chuta e infinito pra quem sabe a senha) e ninguém se
 * tranca com a senha certa na mão.
 */
export async function portaoDaSenha(req, { teto = 10 } = {}) {
  const SENHA = process.env.PUBLICAR_SENHA
  if (!SENHA) return { status: 503, corpo: { ok: false, erro: 'nao_configurado' } }

  const recebida = req.headers?.['x-stfv-senha'] ?? req.query?.senha
  if (senhaConfere(recebida, SENHA)) return null

  const dentro = await dentroDoTeto(`senha:${chaveIp(req)}`, teto)
  return dentro
    ? { status: 401, corpo: { ok: false, erro: 'senha_invalida' } }
    : { status: 429, corpo: { ok: false, erro: 'muitas_tentativas' } }
}
