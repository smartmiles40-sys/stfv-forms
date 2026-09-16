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

/**
 * O modo 'agendamento' (08/09/2026): em vez de mandar a pessoa embora, o
 * formulario mostra a agenda do QS embutida e ela marca a reuniao ali.
 *
 * Emite um `concluir` completamente diferente — sem redirect, sem WhatsApp — e
 * uma funcao a mais. Sem este caso, esse caminho inteiro ficaria fora do
 * `node --check`, e um erro de sintaxe so apareceria no formulario publicado.
 */
function liveAgendando(): FormSpec {
  const base = presetLive()
  return {
    ...base,
    destino: {
      ...base.destino,
      aposEnvio: 'agendamento',
      mensagemTitulo: 'Recebemos seus dados!',
      mensagemTexto:
        'Falta um passo: escolha o melhor dia e horário para conversar com um especialista.',
    },
  }
}

const casos: [string, FormSpec][] = [
  ['expedicao', presetExpedicao()],
  ['live', presetLive()],
  ['live-bifurcada', liveBifurcada()],
  ['live-agendando', liveAgendando()],
  ['simples', presetSimples()],
  ['vazio', presetVazio()],
]

mkdirSync('.amostra', { recursive: true })

for (const [nome, spec] of casos) {
  writeFileSync(`.amostra/${nome}.tsx`, gerarReactTsx(spec), 'utf8')
  writeFileSync(`.amostra/${nome}.html`, gerarHtml(spec), 'utf8')
  writeFileSync(`.amostra/${nome}.save-lead.mjs`, gerarApiSaveLead(spec), 'utf8')
  // O JSON alimenta o scripts/teste-api.mjs, que exercita a funcao de publicar.
  writeFileSync(`.amostra/${nome}.stfv.json`, JSON.stringify(spec), 'utf8')
  console.log(`gerado: ${nome}`)
}

// ---------------------------------------------------------------------------
// Caminho de FALHA do envio. Num form que redireciona (live), segurar o lead
// numa mensagem de erro perde a pessoa: quem chega no WhatsApp a gente ja tem,
// quem fica parado some. Entao a falha tenta salvar no escuro e navega mesmo
// assim. Num form que termina em mensagem nao ha pra onde ir — ali o erro fica.
// ---------------------------------------------------------------------------
let falhasFallback = 0
function exigir(nome: string, condicao: boolean) {
  if (condicao) {
    console.log(`falha ok: ${nome}`)
  } else {
    falhasFallback++
    console.error(`FALLBACK FALHOU: ${nome}`)
  }
}

for (const [nome, spec] of casos) {
  const tsx = gerarReactTsx(spec)
  const html = gerarHtml(spec)
  if (spec.destino.aposEnvio === 'redirect') {
    exigir(`${nome}: .tsx tenta salvar no escuro antes de navegar`, tsx.includes('salvarNoEscuro()'))
    exigir(`${nome}: .tsx navega mesmo com o envio falhando`, tsx.includes('sendBeacon'))
    exigir(`${nome}: .html navega mesmo com o envio falhando`, html.includes('navigator.sendBeacon'))
  } else {
    exigir(`${nome}: .tsx mantem a mensagem de erro (nao ha destino)`, tsx.includes('setErroEnvio(true)'))
    exigir(`${nome}: .tsx nao carrega sendBeacon a toa`, !tsx.includes('sendBeacon'))
  }
}

// ---------------------------------------------------------------------------
// Ligacao com o SDR (16/09): a mesma agenda com `?com=sdr`. O formulario de
// closer tem que sair IGUAL (sem nenhuma linha do modo SDR) — e o de SDR tem que
// mandar o lead pra Pre-Vendas com o evento proprio no GTM.
// ---------------------------------------------------------------------------
{
  const closer = gerarHtml(liveAgendando())
  const sdrSpec = liveAgendando()
  sdrSpec.destino = { ...sdrSpec.destino, agendamentoUrl: 'https://qs-turis.vercel.app/agendar/?com=sdr' }
  const sdr = gerarHtml(sdrSpec)
  exigir('sdr: iframe abre a agenda do SDR', sdr.includes("'/agendar/?com=sdr&embed=1&expedicao='"))
  exigir('sdr: fase 2 diz que e ligacao com SDR', sdr.includes("agenda_com: e.data.com || 'sdr'"))
  exigir('sdr: evento proprio no GTM', sdr.includes("pushDataLayer('ligacao_agendada'") && !sdr.includes("'reuniao_agendada'"))
  exigir('closer: nenhuma linha do modo SDR', !closer.includes('agenda_com') && !closer.includes('com=sdr') && closer.includes("'reuniao_agendada'"))
}

if (falhasFallback) {
  console.error(`\n${falhasFallback} verificacao(oes) do caminho de falha falharam.`)
  process.exit(1)
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
