// Temporario: monta o spec da live e publica, TUDO dentro do Node.
//
// Nao passar o JSON pelo PowerShell: o 5.1 captura a saida de comando nativo
// na codepage do console e destroi UTF-8 no caminho — foi assim que "Você"
// virou "Voc?" no formulario publicado.
import { presetLive } from './src/defaults'
import type { FormSpec } from './src/types'

const base = presetLive()
const spec: FormSpec = {
  ...base,
  nome: 'Live — captacao',
  slug: 'live',
  destino: {
    ...base.destino,
    // Mensagem que ja vai escrita na conversa do WhatsApp quando o lead chega.
    whatsappMensagem: 'Assisti a live e quero seguir os próximos passos',
  },
}

const senha = process.env.STFV_SENHA
if (!senha) {
  console.error('faltou STFV_SENHA')
  process.exit(1)
}

// Confere aqui, antes de mandar, que os acentos estao inteiros.
const pergunta = spec.etapas[1].campos[0].label
console.log('pergunta:', pergunta)
console.log('mensagem wa:', spec.destino.whatsappMensagem)
const acentosOk =
  /você|Você/i.test(pergunta) && /próximos/.test(spec.destino.whatsappMensagem)
console.log('acentos ok?', acentosOk ? 'SIM' : 'NAO — abortando')
if (!acentosOk) process.exit(1)

const resp = await fetch('https://stfv-forms-geral.vercel.app/api/publicar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-stfv-senha': senha },
  body: JSON.stringify({ spec }),
})
const dados = await resp.json()
console.log('status:', resp.status)
console.log(JSON.stringify(dados))
