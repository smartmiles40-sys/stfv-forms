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
import { avisosDoSpec } from '../src/lib/avisos'
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

// ---------------------------------------------------------------------------
// Avisos: um alerta que ninguem exercita e um alerta em que nao da pra confiar.
// Cada caso abaixo sabota o spec de um jeito que o painel NAO mostra na tela —
// o formulario continua bonito e funcional, so manda o lead pro lugar errado.
// ---------------------------------------------------------------------------
let falhas = 0
function conferir(nome: string, spec: FormSpec, esperado: RegExp | null, qtdExata?: number) {
  const achados = avisosDoSpec(spec)
  const bateu = esperado
    ? achados.some((a) => esperado.test(a)) && (qtdExata === undefined || achados.length === qtdExata)
    : achados.length === 0
  if (bateu) {
    console.log(`aviso ok: ${nome}`)
  } else {
    falhas++
    console.error(`AVISO FALHOU: ${nome}`)
    console.error(`  esperado: ${esperado ?? '(nenhum aviso)'}`)
    console.error(`  recebido: ${achados.length ? achados.join(' | ') : '(nenhum)'}`)
  }
}

/** Aplica uma mudanca no primeiro campo de escolha da live bifurcada. */
function sabotar(mud: (spec: FormSpec) => void): FormSpec {
  const spec = JSON.parse(JSON.stringify(liveBifurcada())) as FormSpec
  mud(spec)
  return spec
}

// Os presets que vao pro ar tem que sair limpos da caixa — sem falso positivo,
// que e o que faz o usuario aprender a ignorar a caixa amarela.
conferir('preset live nao acusa nada', presetLive(), null)
conferir('preset live-bifurcada nao acusa nada', liveBifurcada(), null)
conferir('preset simples nao acusa nada', presetSimples(), null)
// A expedicao e a excecao legitima: o embed do VSL e colado depois, entao o
// preset nasce com esse aviso aceso de proposito. Qualquer OUTRO aviso ali e bug.
conferir('preset expedicao so acusa o embed faltando', presetExpedicao(), /vídeo sem embed/, 1)

// A pegadinha principal: renomear a opcao deixa a regra orfa, calada.
conferir(
  'opcao renomeada deixa a regra orfa',
  sabotar((s) => {
    s.etapas[1].campos[0].opcoes[0].label = 'Sim, assisti tudinho'
  }),
  /órfã/,
)

conferir(
  'regra apontando pra campo inexistente',
  sabotar((s) => {
    s.destino.regrasSaida[0].campo = 'campo_que_nao_existe'
  }),
  /não existe/,
)

conferir(
  'regra sem URL de destino',
  sabotar((s) => {
    s.destino.regrasSaida[0].url = ''
  }),
  /sem URL/,
)

conferir(
  'regra em campo de multipla escolha',
  sabotar((s) => {
    s.etapas[1].campos[0].tipo = 'checkbox'
  }),
  /múltipla escolha/,
)

conferir(
  'saida pro WhatsApp sem mensagem',
  sabotar((s) => {
    s.destino.whatsappMensagem = ''
  }),
  /sem mensagem/,
)

conferir(
  'placeholder da mensagem sem campo correspondente',
  sabotar((s) => {
    s.destino.whatsappMensagem = 'Olá, sou {nome} e meu orçamento é {orcamento_inexistente}.'
  }),
  /orcamento_inexistente/,
)

if (falhas) {
  console.error(`\n${falhas} verificacao(oes) de aviso falharam.`)
  process.exit(1)
}
