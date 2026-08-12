// ============================================================================
// Avisos antes de publicar: coisas que passam despercebidas no painel e so
// aparecem la na frente, com o lead ja perdido.
//
// Vive fora do componente de proposito — e uma funcao pura de FormSpec, entao
// o `npm run verificar` consegue exercitar cada aviso sem subir React.
// ============================================================================

import type { FormSpec } from '../types'
import { ROTULOS_TIPO, TIPOS_COM_OPCOES } from '../types'

export function avisosDoSpec(spec: FormSpec): string[] {
  const lista: string[] = []
  const campos = spec.etapas.flatMap((e) => e.campos)
  const nomes = campos.map((c) => c.name)

  const semNome = campos.filter((c) => !c.name.trim()).length
  if (semNome) lista.push(`${semNome} campo(s) sem nome — não chegam ao CRM.`)

  const repetidos = [...new Set(nomes.filter((n, i) => n && nomes.indexOf(n) !== i))]
  if (repetidos.length)
    lista.push(`Nome repetido: ${repetidos.join(', ')} — um sobrescreve o outro no payload.`)

  if (!nomes.includes('nome') || !nomes.includes('whatsapp'))
    lista.push('Sem campo "nome" ou "whatsapp" — o backend rejeita o lead na validação.')

  const semOpcoes = campos.filter((c) => TIPOS_COM_OPCOES.includes(c.tipo) && c.opcoes.length === 0)
  if (semOpcoes.length) lista.push(`${semOpcoes.length} campo(s) de escolha sem opções.`)

  if (!spec.destino.url.trim()) lista.push('Destino do lead vazio.')
  if (!spec.destino.formName.trim()) lista.push('form_name vazio — o n8n roteia por ele.')

  const videoSemEmbed = spec.etapas.filter((e) => e.tipo === 'video' && !e.video.embedHtml.trim())
  if (videoSemEmbed.length) lista.push('Etapa de vídeo sem embed.')

  lista.push(...avisosDeSaida(spec, campos, nomes))

  return lista
}

/**
 * O casamento de uma regra de saida e por LABEL EXATO. Renomear a opcao no
 * painel nao quebra nada visivelmente: a regra so para de bater e todo mundo
 * passa a cair no destino padrao, calado. Numa live isso manda a plateia
 * inteira pro lugar errado sem um erro sequer — por isso cada regra e conferida
 * contra o campo e a opcao que ela diz consultar.
 */
function avisosDeSaida(
  spec: FormSpec,
  campos: FormSpec['etapas'][number]['campos'],
  nomes: string[],
): string[] {
  if (spec.destino.aposEnvio !== 'redirect') return []
  const lista: string[] = []

  spec.destino.regrasSaida.forEach((regra, i) => {
    const n = i + 1
    if (!regra.campo.trim() || !regra.valor.trim()) {
      lista.push(`Saída ${n} incompleta — sem campo ou sem resposta; ela nunca vai bater.`)
      return
    }
    const campo = campos.find((c) => c.name === regra.campo)
    if (!campo) {
      lista.push(
        `Saída ${n} consulta o campo "${regra.campo}", que não existe — todos caem no destino padrão.`,
      )
      return
    }
    if (!TIPOS_COM_OPCOES.includes(campo.tipo)) {
      lista.push(
        `Saída ${n} consulta "${regra.campo}", que é ${ROTULOS_TIPO[campo.tipo].toLowerCase()} — só campo de escolha tem resposta exata pra comparar.`,
      )
      return
    }
    if (campo.tipo === 'checkbox') {
      lista.push(
        `Saída ${n} consulta "${regra.campo}", que é múltipla escolha — marcando mais de uma o valor vira "a, b" e a regra não bate.`,
      )
      return
    }
    if (!campo.opcoes.some((o) => o.label === regra.valor)) {
      lista.push(
        `Saída ${n} espera a resposta "${regra.valor}", que não é mais uma opção de "${regra.campo}" — a regra está órfã e todos caem no destino padrão.`,
      )
      return
    }
    if (!regra.url.trim()) lista.push(`Saída ${n} sem URL de destino.`)
  })

  const usaWhatsapp = spec.destino.whatsappHandoff || spec.destino.regrasSaida.some((r) => r.whatsapp)
  if (usaWhatsapp && !spec.destino.whatsappMensagem.trim())
    lista.push('Saída pro WhatsApp sem mensagem — o lead abre a conversa em branco.')

  // {placeholder} sem campo correspondente sai vazio na conversa do WhatsApp.
  const orfaos = [...spec.destino.whatsappMensagem.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .filter((chave) => !nomes.includes(chave))
  if (orfaos.length)
    lista.push(
      `Mensagem do WhatsApp usa {${[...new Set(orfaos)].join('}, {')}} — não existe campo com esse nome, sai vazio.`,
    )

  return lista
}
