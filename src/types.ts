// ============================================================================
// Schema do formulario. Este arquivo e o contrato do gerador: o builder edita
// um FormSpec, o preview renderiza um FormSpec e os geradores traduzem um
// FormSpec em codigo. Mudou aqui, mude nos tres.
// ============================================================================

/** Tipos de campo. Cada um define validacao, mascara e markup proprios. */
export type TipoCampo =
  | 'texto'
  | 'email'
  | 'whatsapp'
  | 'instagram'
  | 'textarea'
  | 'radio'
  | 'select'
  | 'checkbox'
  | 'consentimento'
  | 'data'
  | 'numero'
  | 'oculto'

export type Opcao = {
  /** Texto que o lead ve E que vai pro CRM (regra do padrao: label completo). */
  label: string
  /** Valor normalizado usado no dataLayer/tracking. */
  slug: string
}

export type Campo = {
  id: string
  tipo: TipoCampo
  /** Chave no payload do lead (ex.: `nome`, `investimento`). */
  name: string
  label: string
  placeholder: string
  obrigatorio: boolean
  /** Texto pequeno abaixo do campo. */
  ajuda: string
  /** Mensagem de erro quando a validacao falha. */
  erro: string
  /** radio | select | checkbox */
  opcoes: Opcao[]
  /** oculto: valor fixo enviado no payload */
  valorFixo: string
  /** Layout: campo ocupa a linha toda ou metade dela (>= sm). */
  largura: 'cheia' | 'metade'
}

export type EtapaVideo = {
  /** HTML do player (VTurb, YouTube iframe, o que for). */
  embedHtml: string
  /** Segundos que o lead precisa ficar na etapa antes de liberar o avanco. */
  travaSegundos: number
  textoBloqueado: string
  textoLiberado: string
}

export type Etapa = {
  id: string
  /** Aparece no topo da etapa: "Etapa 1 de 3 · <titulo>". */
  titulo: string
  tipo: 'campos' | 'video'
  campos: Campo[]
  video: EtapaVideo
  /** Rotulo do botao que avanca (a ultima etapa usa este texto no submit). */
  textoBotao: string
}

export type Tracking = {
  /** Quais utm_* capturar da URL. */
  utms: string[]
  /** Click ids (gclid, fbclid...): unica ancora quando a campanha nao taggeia. */
  clickIds: string[]
  /**
   * First-touch por aba (sessionStorage): a atribuicao sobrevive a recarga e a
   * navegacao interna. Quem chegou primeiro manda; a URL so preenche vazio.
   */
  firstTouch: boolean
  /** Valor de utm_content quando a visita nao veio taggeada (ex.: 'v4'). Derivado, nao persistido. */
  fallbackUtmContent: string
  /** Emitir eventos no dataLayer (GTM). */
  dataLayer: boolean
  /** Evento de conversao disparado no envio (ex.: 'expedicao_lead'). */
  eventoConversao: string
  /** Campos ocultos com as UTMs no HTML (contrato com GTM). */
  inputsOcultos: boolean
}

export type CampoFixo = { id: string; name: string; valor: string }

/**
 * Saida condicional: manda o lead pra um destino diferente conforme o que ele
 * respondeu. A PRIMEIRA regra que bate ganha; se nenhuma bater, vale o
 * `redirectUrl`. Serve pra separar lead quente de lead frio na saida (ex.:
 * "assistiu a live?" -> sim vai pro WhatsApp, nao volta pro Instagram) sem
 * precisar de pagina intermediaria.
 *
 * O lead e gravado no CRM nos DOIS casos — o roteamento e so pra onde ele vai
 * depois; quem respondeu "nao" continua sendo lead.
 */
export type RegraSaida = {
  id: string
  /** `name` do campo consultado (ex.: 'assistiu_live'). */
  campo: string
  /** Label exato da opcao — e o label que vai pro CRM, nao o slug. */
  valor: string
  /** Pra onde o lead vai quando a regra bate. */
  url: string
  /** Deixa a mensagem do wa.me pronta antes de sair (so no destino WhatsApp). */
  whatsapp: boolean
}

export type Destino = {
  /**
   * endpoint  = POST pro /api/save-lead do proprio site (recomendado: o backend
   *             normaliza, roteia por slug e grava no ledger).
   * webhook   = POST direto no webhook do n8n (sem backend no meio).
   */
  modo: 'endpoint' | 'webhook'
  url: string
  /** Vai no payload e e o que o save-lead usa pra rotear: "expedicao-<slug>-<ano>". */
  formName: string
  /** Slug explicito do lead (roteamento do webhook). */
  slug: string
  /** Pares name/valor mandados sempre (expedicao, fonte, source_id...). */
  camposFixos: CampoFixo[]
  /**
   * redirect     = manda a pessoa pra outra pagina (wa.me, /obrigado.html...)
   * mensagem     = fica na propria pagina, com o titulo/texto de sucesso
   * agendamento  = fica na pagina e mostra a AGENDA embutida, pra pessoa marcar
   *                a reuniao na hora (Bruno, 08/09/2026 — o numero unico do
   *                time estava sendo derrubado pelo volume das lives, e mandar
   *                todo mundo pra uma conversa que ninguem responde perde a
   *                reuniao que ja estava ganha)
   */
  aposEnvio: 'redirect' | 'mensagem' | 'agendamento'
  /**
   * A pagina do autoagendamento (modo 'agendamento'). Recebe `?embed=1` e a
   * expedicao; nome, e-mail e WhatsApp vao por postMessage, nunca pela URL —
   * endereco de iframe fica no historico do navegador e em log pelo caminho.
   */
  agendamentoUrl: string
  /**
   * Como o passo da agenda se chama no indicador ("Etapa 3 de 3 · ...").
   *
   * A agenda CONTA como etapa (Bruno, 08/09/2026): a pessoa precisa saber desde
   * a primeira tela que sao tres passos, senao ela acha que terminou no segundo
   * e fecha a aba justamente na hora de marcar.
   */
  agendamentoRotulo: string
  /** Destino padrao — vale quando nenhuma regra de saida bate. */
  redirectUrl: string
  /** Saidas condicionais por resposta. Vazio = redirect unico. So no modo 'redirect'. */
  regrasSaida: RegraSaida[]
  mensagemTitulo: string
  mensagemTexto: string
  /** Deixa a mensagem pronta no sessionStorage pra pagina de obrigado abrir o wa.me. */
  whatsappHandoff: boolean
  whatsappMensagem: string
  /** Texto do erro de envio. */
  erroEnvio: string
}

export type Aparencia = {
  /** Bolinhas numeradas no topo. */
  indicadorEtapas: boolean
  /** "Etapa 1 de 3 · <titulo>" acima dos campos. */
  rotuloEtapa: boolean
  /** Cartao branco com sombra em volta do form. */
  cartao: boolean
}

export type FormSpec = {
  id: string
  /** Nome interno, so pra voce achar na lista. */
  nome: string
  /** Prefixo dos ids de sessionStorage; normalmente o slug da LP. */
  slug: string
  atualizadoEm: string
  etapas: Etapa[]
  tracking: Tracking
  destino: Destino
  aparencia: Aparencia
}

/** Chaves de tracking suportadas (as mesmas do save-lead.mjs em producao). */
export const UTMS_DISPONIVEIS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const

export const CLICK_IDS_DISPONIVEIS = ['utm_id', 'gclid', 'fbclid', 'gbraid', 'wbraid'] as const

export const ROTULOS_TIPO: Record<TipoCampo, string> = {
  texto: 'Texto',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  textarea: 'Texto longo',
  radio: 'Escolha única',
  select: 'Lista suspensa',
  checkbox: 'Múltipla escolha',
  consentimento: 'Consentimento (LGPD)',
  data: 'Data',
  numero: 'Número',
  oculto: 'Campo oculto',
}

/** Tipos que usam a lista de opcoes. */
export const TIPOS_COM_OPCOES: TipoCampo[] = ['radio', 'select', 'checkbox']
