//  O RODÍZIO DAS SDRs: de quem é o próximo lead.
//
//  Ficava dentro do save-lead, mas o resgate dos pendentes precisa do MESMO
//  rodízio: sem ele, todo lead resgatado nasceria no dono do webhook — uma
//  pessoa só recebendo tudo, que é exatamente o defeito que o rodízio existe pra
//  evitar. Duas cópias divergiriam na primeira mudança de time.

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
/** Os ids do rodizio, como estao na env var. Uma leitura, dois usos. */
export function idsDoRodizio() {
  return String(process.env.BITRIX_SDR_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function proximaSdr() {
  const ids = idsDoRodizio()
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

