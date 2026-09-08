import type { Campo, Etapa, FormSpec, Opcao, TipoCampo } from './types'
import { placeholderPadrao, uid } from './lib/util'

/**
 * A pagina do autoagendamento do QS (modo aposEnvio: 'agendamento').
 *
 * Mora aqui, e nao no codigo do gerador, porque e um ENDERECO — se um dia o QS
 * mudar de dominio, isto vira campo no painel e nao precisa de deploy do form.
 */
export const AGENDAMENTO_URL_PADRAO = 'https://qs-turis.vercel.app/agendar/'

// ============================================================================
// Presets. O "Expedição completo" e a transcricao fiel do FormularioLead.tsx
// que ja roda nas LPs (contato -> video com trava -> perfil de viagem), pra
// voce comecar de algo testado em vez de uma tela em branco.
// ============================================================================

export function campoNovo(tipo: TipoCampo = 'texto', patch: Partial<Campo> = {}): Campo {
  return {
    id: uid('campo'),
    tipo,
    name: '',
    label: '',
    placeholder: placeholderPadrao(tipo),
    obrigatorio: true,
    ajuda: '',
    erro: '',
    opcoes: [],
    valorFixo: '',
    largura: 'cheia',
    ...patch,
  }
}

export function etapaNova(patch: Partial<Etapa> = {}): Etapa {
  return {
    id: uid('etapa'),
    titulo: 'Nova etapa',
    tipo: 'campos',
    campos: [],
    video: {
      embedHtml: '',
      travaSegundos: 60,
      textoBloqueado: 'Assista ao vídeo — as últimas perguntas liberam quando a barrinha encher.',
      textoLiberado: 'Liberado! Falta só o seu perfil de viagem.',
    },
    textoBotao: 'Continuar',
    ...patch,
  }
}

function ops(...pares: [string, string][]): Opcao[] {
  return pares.map(([label, slug]) => ({ label, slug }))
}

/** Preset 1 — o formulario das LPs de expedicao, com a etapa de video. */
export function presetExpedicao(): FormSpec {
  return {
    id: uid('form'),
    nome: 'Expedição — 3 etapas com vídeo',
    slug: 'expedicao',
    atualizadoEm: new Date().toISOString(),
    etapas: [
      etapaNova({
        titulo: 'Dados de contato',
        textoBotao: 'Continuar',
        campos: [
          campoNovo('texto', {
            name: 'nome',
            label: 'Nome completo',
            erro: 'Digite seu nome completo',
          }),
          campoNovo('whatsapp', {
            name: 'whatsapp',
            label: 'WhatsApp com DDD',
            placeholder: '(11) 98765-4321',
          }),
          campoNovo('email', { name: 'email', label: 'E-mail' }),
          campoNovo('instagram', {
            name: 'instagram',
            label: 'Instagram',
            placeholder: '@seuusuario',
          }),
        ],
      }),
      etapaNova({
        titulo: 'Assista ao vídeo',
        tipo: 'video',
        textoBotao: 'Continuar',
      }),
      etapaNova({
        titulo: 'Seu perfil de viagem',
        textoBotao: 'Quero garantir minha vaga',
        campos: [
          campoNovo('radio', {
            name: 'data',
            label: 'A expedição acontece de 12 a 24 de outubro. Você tem disponibilidade?',
            opcoes: ops(
              ['Sim, consigo viajar nesse período', 'sim'],
              ['Ainda não tenho certeza', 'talvez'],
              ['Não, mas quero saber de próximas datas', 'nao'],
            ),
          }),
          campoNovo('radio', {
            name: 'companhia',
            label: 'Como você pretende viajar?',
            opcoes: ops(
              ['Sozinho(a)', 'sozinho'],
              ['Casal', 'casal'],
              ['Família', 'familia'],
              ['Com amigos', 'amigos'],
            ),
          }),
          campoNovo('radio', {
            name: 'perfil',
            label: 'Qual o seu perfil de viajante?',
            opcoes: ops(
              ['Será minha primeira viagem internacional', 'primeira'],
              ['Já viajei algumas vezes para fora do Brasil', 'algumas'],
              ['Sou viajante experiente', 'frequente'],
            ),
          }),
          campoNovo('radio', {
            name: 'investimento',
            label:
              'O investimento nessa expedição fica entre R$ 25.000 e R$ 32.000. Você está preparado(a) para investir nessa experiência completa?',
            opcoes: ops(
              ['Sim, estou preparado(a)', 'sim'],
              ['Quero entender os valores primeiro', 'talvez'],
              ['Não, está fora do meu momento agora', 'nao'],
            ),
          }),
          campoNovo('radio', {
            name: 'decisao',
            label: 'Quando você pretende tomar a decisão?',
            opcoes: ops(
              ['O quanto antes — quero garantir minha vaga', 'agora'],
              ['Nos próximos meses', 'proximos'],
              ['Ainda estou só pesquisando', 'explorando'],
            ),
          }),
        ],
      }),
    ],
    tracking: {
      utms: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'],
      clickIds: ['utm_id', 'gclid', 'fbclid', 'gbraid', 'wbraid'],
      firstTouch: true,
      fallbackUtmContent: 'v4',
      dataLayer: true,
      eventoConversao: 'expedicao_lead',
      inputsOcultos: true,
    },
    destino: {
      modo: 'endpoint',
      url: '/api/save-lead',
      formName: 'expedicao-destino-2027',
      slug: 'destino',
      camposFixos: [
        { id: uid('fixo'), name: 'expedicao', valor: 'Expedição Destino 2027' },
        { id: uid('fixo'), name: 'fonte', valor: '[Destino] - Tráfego' },
        { id: uid('fixo'), name: 'source_id', valor: '' },
      ],
      aposEnvio: 'redirect',
      agendamentoUrl: AGENDAMENTO_URL_PADRAO,
      redirectUrl: '/obrigado.html',
      regrasSaida: [],
      mensagemTitulo: 'Recebemos seus dados!',
      mensagemTexto: 'Nosso time entra em contato em breve pelo WhatsApp.',
      whatsappHandoff: true,
      whatsappMensagem:
        'Olá! Sou {nome} e acabei de preencher o formulário da Expedição Destino 2027. Quero seguir os próximos passos.',
      erroEnvio:
        'Não conseguimos enviar agora. Tente de novo em instantes — ou chame a gente no WhatsApp.',
    },
    aparencia: { indicadorEtapas: true, rotuloEtapa: true, cartao: true },
  }
}

/** Preset 2 — captura curta, uma etapa so. */
export function presetSimples(): FormSpec {
  const base = presetExpedicao()
  return {
    ...base,
    id: uid('form'),
    nome: 'Captura simples — 1 etapa',
    slug: 'captura',
    etapas: [
      etapaNova({
        titulo: 'Fale com a gente',
        textoBotao: 'Quero saber mais',
        campos: [
          campoNovo('texto', { name: 'nome', label: 'Nome completo', erro: 'Digite seu nome completo' }),
          campoNovo('whatsapp', { name: 'whatsapp', label: 'WhatsApp com DDD', placeholder: '(11) 98765-4321' }),
          campoNovo('email', { name: 'email', label: 'E-mail' }),
        ],
      }),
    ],
    destino: {
      ...base.destino,
      formName: 'captura-site-2027',
      slug: 'captura',
      aposEnvio: 'mensagem',
      whatsappHandoff: false,
      camposFixos: [{ id: uid('fixo'), name: 'fonte', valor: '[Site] - Orgânico' }],
    },
    aparencia: { indicadorEtapas: false, rotuloEtapa: false, cartao: true },
  }
}

/**
 * Preset 3 — captacao de live com saida bifurcada.
 *
 * Contato -> "assistiu a live e esta de acordo?". Quem responde SIM cai no
 * WhatsApp (lead quente, com a mensagem pronta); quem responde NAO volta pro
 * Instagram. Nos DOIS casos o lead ja foi gravado no CRM antes do redirect —
 * a bifurcacao e so pra onde ele vai, nao decide quem vira lead.
 *
 * O `source_id` fica vazio de proposito: e ele que diz ao Bitrix de qual
 * expedicao esse lead veio (LIVE_EGITO, LIVE_PERU...). Uma pagina por
 * expedicao = preencher aqui; uma pagina so pra todas = deixar vazio e mapear
 * `expedicao` -> source_id no n8n.
 */
export function presetLive(): FormSpec {
  const base = presetExpedicao()
  return {
    ...base,
    id: uid('form'),
    nome: 'Live — contato + confirmação',
    slug: 'live',
    etapas: [
      etapaNova({
        titulo: 'Seus dados',
        textoBotao: 'Continuar',
        campos: [
          campoNovo('texto', {
            name: 'nome',
            label: 'Nome completo',
            erro: 'Digite seu nome completo',
          }),
          campoNovo('email', { name: 'email', label: 'E-mail' }),
          campoNovo('whatsapp', {
            name: 'whatsapp',
            label: 'WhatsApp com DDD',
            placeholder: '(11) 98765-4321',
          }),
        ],
      }),
      etapaNova({
        titulo: 'Confirmação',
        textoBotao: 'Enviar',
        campos: [
          campoNovo('radio', {
            name: 'assistiu_live',
            label: 'Você assistiu a live e está de acordo?',
            opcoes: ops(
              ['Sim, eu assisti tudo e quero seguir os próximos passos', 'assistiu-tudo'],
              ['Peguei pela metade, e quero entender mais das expedições', 'pela-metade'],
              ['Não consegui assistir a live e quero entender o roteiro', 'nao-assistiu'],
            ),
          }),
        ],
      }),
    ],
    tracking: { ...base.tracking, eventoConversao: 'live_lead', fallbackUtmContent: 'live' },
    destino: {
      ...base.destino,
      formName: 'live-2026',
      slug: 'live',
      camposFixos: [
        { id: uid('fixo'), name: 'expedicao', valor: 'Live' },
        { id: uid('fixo'), name: 'fonte', valor: '[Destino] - Live' },
        { id: uid('fixo'), name: 'source_id', valor: '' },
      ],
      aposEnvio: 'redirect',
      redirectUrl: 'https://wa.me/5511951251935',
      whatsappHandoff: true,
      // As tres respostas vao pro mesmo lugar (decisao do Bruno), entao nao ha
      // o que bifurcar. A saida condicional continua existindo no gerador — e
      // so adicionar regra aqui se algum dia uma resposta tiver que ir pra outro
      // destino.
      regrasSaida: [],
      // {assistiu_live} entra com o texto que o lead marcou. E o que a SDR le
      // primeiro: sem isso as tres respostas chegam no WhatsApp identicas, e a
      // qualificacao so apareceria depois, no CRM.
      whatsappMensagem: 'Olá! Sou {nome}, vim da live. {assistiu_live}. Meu e-mail é {email}.',
    },
    aparencia: { indicadorEtapas: true, rotuloEtapa: true, cartao: true },
  }
}

/** Preset 4 — do zero. */
export function presetVazio(): FormSpec {
  const base = presetSimples()
  return {
    ...base,
    id: uid('form'),
    nome: 'Formulário novo',
    slug: 'novo-form',
    etapas: [etapaNova({ titulo: 'Etapa 1', campos: [] })],
    destino: { ...base.destino, formName: 'novo-form-2027', slug: 'novo-form', camposFixos: [] },
  }
}

export const PRESETS = [
  { chave: 'expedicao', rotulo: 'Expedição (3 etapas + vídeo)', criar: presetExpedicao },
  { chave: 'live', rotulo: 'Live (contato + saída Sim/Não)', criar: presetLive },
  { chave: 'simples', rotulo: 'Captura simples (1 etapa)', criar: presetSimples },
  { chave: 'vazio', rotulo: 'Começar do zero', criar: presetVazio },
] as const
