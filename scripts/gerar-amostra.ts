// Smoke test do gerador: produz os arquivos dos presets em .amostra/ pra que
// o TSX seja compilado pelo tsc e o .mjs/HTML passem pelo `node --check`.
// Rode com: npm run verificar
//
// Cada preset cobre um caminho DIFERENTE do gerador — e por isso que sao varios:
// expedicao = etapa de video + dataLayer, live = saida condicional,
// simples = mensagem em vez de redirect, vazio = etapa sem campos.
import { mkdirSync, writeFileSync } from 'node:fs'
import { presetExpedicao, presetLive, presetSimples, presetVazio } from '../src/defaults'
import { gerarReactTsx } from '../src/generators/reactTsx'
import { gerarHtml } from '../src/generators/htmlPuro'
import { gerarApiSaveLead } from '../src/generators/apiSaveLead'
import type { FormSpec } from '../src/types'

/**
 * Nenhum preset usa saida condicional hoje (a live manda todo mundo pro
 * WhatsApp), mas o gerador emite um caminho DIFERENTE quando ha regras. Sem
 * este caso, esse caminho sairia do alcance do tsc — que e justamente onde o
 * `noUnusedLocals` costuma morder.
 */
function liveBifurcada(): FormSpec {
  const base = presetLive()
  const campo = base.etapas[1].campos[0]
  return {
    ...base,
    destino: {
      ...base.destino,
      regrasSaida: [
        {
          id: 'regra_wa',
          campo: campo.name,
          valor: campo.opcoes[0].label,
          url: 'https://wa.me/5511951251935',
          whatsapp: true,
        },
        {
          id: 'regra_ig',
          campo: campo.name,
          valor: campo.opcoes[2].label,
          url: 'https://www.instagram.com/setuforeuvouviagens/',
          whatsapp: false,
        },
      ],
    },
  }
}

const casos: [string, FormSpec][] = [
  ['expedicao', presetExpedicao()],
  ['live', presetLive()],
  ['live-bifurcada', liveBifurcada()],
  ['simples', presetSimples()],
  ['vazio', presetVazio()],
]

mkdirSync('.amostra', { recursive: true })

for (const [nome, spec] of casos) {
  writeFileSync(`.amostra/${nome}.tsx`, gerarReactTsx(spec), 'utf8')
  writeFileSync(`.amostra/${nome}.html`, gerarHtml(spec), 'utf8')
  writeFileSync(`.amostra/${nome}.save-lead.mjs`, gerarApiSaveLead(spec), 'utf8')
  console.log(`gerado: ${nome}`)
}
