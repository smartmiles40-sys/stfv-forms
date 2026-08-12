import type { FormSpec } from '../types'
import {
  cabecalho,
  camposFixosObjeto,
  json,
  mapaDeSlugs,
  serializarEtapas,
  trackKeys,
} from './comum'

// ============================================================================
// Gera um componente React (.tsx) autocontido, no padrao do FormularioLead das
// LPs. Estrategia: um runtime curto e generico no topo + a configuracao do
// formulario logo abaixo em forma de dados. Assim o arquivo continua editavel a
// mao (mudar um rotulo nao exige voltar no gerador) e nao vira JSX espaguete.
//
// O codigo sai montado por LINHAS (array de strings) de proposito: template
// literal aninhado obrigaria a escapar todo backtick e ${...} do codigo gerado.
// ============================================================================

export function gerarReactTsx(spec: FormSpec): string {
  const temVideo = spec.etapas.some((e) => e.tipo === 'video')
  const temTrack = trackKeys(spec).length > 0
  const usaDataLayer = spec.tracking.dataLayer
  const redireciona = spec.destino.aposEnvio === 'redirect'
  // Saida condicional so faz sentido quando o form redireciona.
  const regras = redireciona
    ? (spec.destino.regrasSaida ?? []).filter((r) => r.campo && r.valor)
    : []
  // O helper do WhatsApp sai se QUALQUER saida usar: a padrao ou uma das regras.
  const wa = spec.destino.whatsappHandoff || regras.some((r) => r.whatsapp)
  const L: string[] = []
  const p = (...linhas: string[]) => L.push(...linhas)

  p(...cabecalho(spec, [
    'Depende das classes de formulario do index.css da LP (.input, .input-label,',
    '.btn-primary, .btn-outline, .radio-group, .radio-item, .field-error,',
    '.input-error, .card). Se a LP nao tiver, exporte a aba "CSS" do gerador.',
  ]))
  p('')

  // ---- imports ----
  // Sai so o que o formulario realmente usa: as LPs compilam com noUnusedLocals,
  // entao um import a mais quebraria o build da Vercel.
  const hooks = ['useCallback']
  if (temTrack || temVideo) hooks.push('useEffect')
  if (temVideo) hooks.push('useRef')
  hooks.push('useState')
  p(`import { ${hooks.join(', ')}, type FormEvent } from 'react'`)
  if (temVideo) p("import { ArrowDown, Check, Lock } from 'lucide-react'")
  p('')

  // ---- tipos ----
  p('type Opcao = { label: string; slug: string }')
  p('type CampoCfg = {')
  p('  tipo: string')
  p('  name: string')
  p('  label: string')
  p('  placeholder?: string')
  p('  obrigatorio: boolean')
  p('  ajuda?: string')
  p('  erro?: string')
  p("  largura?: 'metade'")
  p('  valorFixo?: string')
  p('  opcoes?: Opcao[]')
  p('}')
  p('type EtapaCfg = {')
  p('  titulo: string')
  p("  tipo: 'campos' | 'video'")
  p('  textoBotao: string')
  p('  campos: CampoCfg[]')
  p('  video?: { embedHtml: string; travaSegundos: number; textoBloqueado: string; textoLiberado: string }')
  p('}')
  p('')

  // ---- configuracao ----
  p('// ==== Configuracao do formulario =========================================')
  p('')
  p(`const SLUG = ${JSON.stringify(spec.destino.slug)}`)
  p(`const FORM_NAME = ${JSON.stringify(spec.destino.formName)}`)
  p(`const ENDPOINT = ${JSON.stringify(spec.destino.url)}`)
  p(`const CAMPOS_FIXOS: Record<string, string> = ${json(camposFixosObjeto(spec))}`)
  p(`const ETAPAS: EtapaCfg[] = ${json(serializarEtapas(spec))}`)
  if (temTrack) {
    p(`const TRACK_KEYS = ${json(trackKeys(spec), 0)} as const`)
    if (spec.tracking.fallbackUtmContent) {
      p(`const FALLBACK_UTM_CONTENT = ${JSON.stringify(spec.tracking.fallbackUtmContent)}`)
    }
  }
  if (usaDataLayer) {
    p(`const EVENTO_CONVERSAO = ${JSON.stringify(spec.tracking.eventoConversao)}`)
    p(`const SLUGS_DE_RESPOSTA: Record<string, Record<string, string>> = ${json(mapaDeSlugs(spec))}`)
  }
  if (redireciona) p(`const REDIRECT_URL = ${JSON.stringify(spec.destino.redirectUrl)}`)
  if (regras.length) {
    p('// Saida condicional: a primeira regra que bate leva o lead. O envio pro CRM')
    p('// acontece ANTES e nao depende disto — quem cai na regra "nao" tambem e lead.')
    p('type RegraSaida = { campo: string; valor: string; url: string; whatsapp: boolean }')
    p(
      `const REGRAS_SAIDA: RegraSaida[] = ${json(
        regras.map((r) => ({ campo: r.campo, valor: r.valor, url: r.url, whatsapp: r.whatsapp })),
      )}`,
    )
  }
  p(`const ERRO_ENVIO = ${JSON.stringify(spec.destino.erroEnvio)}`)
  if (wa) p(`const WHATSAPP_MSG = ${JSON.stringify(spec.destino.whatsappMensagem)}`)
  p('')
  p('const LEAD_ID_KEY = `${SLUG}_lead_id`')
  if (temTrack && spec.tracking.firstTouch) p('const TRACK_STORAGE_KEY = `${SLUG}_track`')
  if (wa) {
    p('// A pagina de obrigado e HTML puro e nao conhece a LP: o form deixa a mensagem')
    p('// pronta no sessionStorage e ela so monta o wa.me. Chaves FIXAS, sem slug.')
    p("const WHATSAPP_MSG_KEY = 'stfv_wa_msg'")
    p("const WHATSAPP_REDIRECT_KEY = 'stfv_wa_redirecionado'")
  }
  p('')

  // ---- helpers ----
  p('// ==== Helpers ============================================================')
  p('')
  p('/** Mascara de exibicao: (DD) NNNNN-NNNN */')
  p('function mascaraWhatsapp(valor: string) {')
  p("  const d = valor.replace(/\\D/g, '').slice(0, 11)")
  p('  if (d.length <= 2) return d')
  p('  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`')
  p('  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`')
  p('  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`')
  p('}')
  p('')
  p('/** Normaliza o @ do Instagram. */')
  p('function mascaraInstagram(valor: string) {')
  p("  const h = valor.replace(/\\s/g, '').replace(/@/g, '').replace(/[^a-zA-Z0-9._]/g, '').slice(0, 30)")
  p("  return h ? `@${h}` : ''")
  p('}')
  p('')
  p('const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/')
  p('')
  p('/** Mesma regra do preview do gerador. */')
  p('function validarCampo(campo: CampoCfg, valor: string | string[]): string {')
  p("  const vazio = Array.isArray(valor) ? valor.length === 0 : !String(valor ?? '').trim()")
  p("  if (campo.tipo === 'oculto') return ''")
  p("  if (vazio) return campo.obrigatorio ? campo.erro || 'Campo obrigatório' : ''")
  p("  const v = Array.isArray(valor) ? '' : String(valor)")
  p("  if (campo.tipo === 'texto') return v.trim().length < 3 ? campo.erro || 'Preencha este campo' : ''")
  p("  if (campo.tipo === 'email') return EMAIL_RE.test(v.trim()) ? '' : campo.erro || 'Digite um e-mail válido'")
  p("  if (campo.tipo === 'whatsapp') {")
  p("    const d = v.replace(/\\D/g, '')")
  p("    return d.length === 11 && d[2] === '9'")
  p("      ? ''")
  p("      : campo.erro || 'Digite um celular válido com DDD (11 dígitos). Ex.: (11) 98765-4321'")
  p('  }')
  p("  if (campo.tipo === 'instagram')")
  p("    return v.replace('@', '').length >= 2 ? '' : campo.erro || 'Digite seu @ do Instagram'")
  p("  return ''")
  p('}')
  p('')
  p('function gerarLeadId() {')
  p("  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()")
  p('  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`')
  p('}')
  p('')

  if (usaDataLayer) {
    p('function pushDataLayer(event: string, data?: Record<string, unknown>) {')
    p('  const w = window as unknown as { dataLayer?: Record<string, unknown>[] }')
    p('  w.dataLayer = w.dataLayer || []')
    p('  w.dataLayer.push({ event, form_name: FORM_NAME, ...data })')
    p('}')
    p('')
  }

  if (temTrack) {
    p('type Track = Record<string, string>')
    p('')
    p('const TRACK_VAZIO: Track = TRACK_KEYS.reduce(')
    p("  (acc, k) => ({ ...acc, [k]: '' }),")
    p('  {} as Track,')
    p(')')
    p('')
    if (spec.tracking.firstTouch) {
      p('/** First-touch por aba: a atribuicao sobrevive a recarga e a navegacao interna. */')
      p('function lerTrackSalvo(): Track {')
      p('  try {')
      p('    const bruto = sessionStorage.getItem(TRACK_STORAGE_KEY)')
      p('    return bruto ? { ...TRACK_VAZIO, ...JSON.parse(bruto) } : { ...TRACK_VAZIO }')
      p('  } catch {')
      p('    return { ...TRACK_VAZIO } // aba privada')
      p('  }')
      p('}')
      p('')
    }
  }

  if (wa) {
    p('/** Monta a mensagem do lead, deixa pronta pra pagina de obrigado e devolve o texto. */')
    p('function montarMensagemWhatsapp(valores: Record<string, string | string[]>) {')
    p('  const msg = WHATSAPP_MSG.replace(/\\{(\\w+)\\}/g, (_m, chave) => {')
    p('    const v = valores[chave]')
    p("    return String(Array.isArray(v) ? v.join(', ') : (v ?? '')).trim()")
    p('  })')
    p('  try {')
    p('    sessionStorage.setItem(WHATSAPP_MSG_KEY, msg)')
    p('    // envio novo = pode redirecionar de novo')
    p('    sessionStorage.removeItem(WHATSAPP_REDIRECT_KEY)')
    p('  } catch {')
    p('    /* aba privada: a pagina de obrigado usa a mensagem padrao */')
    p('  }')
    p('  return msg')
    p('}')
    p('')
    if (redireciona) {
      p('/**')
      p(' * Quando o destino JA e o WhatsApp, a mensagem tem que ir na URL: o')
      p(' * sessionStorage so e lido se existir uma pagina de obrigado nossa no meio.')
      p(' */')
      p('function comMensagemWhatsapp(url: string, valores: Record<string, string | string[]>) {')
      p('  const msg = montarMensagemWhatsapp(valores)')
      p('  if (!/wa\\.me|api\\.whatsapp\\.com/.test(url)) return url')
      p("  return `${url}${url.includes('?') ? '&' : '?'}text=${encodeURIComponent(msg)}`")
      p('}')
      p('')
    }
  }

  if (regras.length) {
    p('/** Pra onde este lead vai, dada a resposta dele. */')
    p('function destinoDoLead(respostas: Record<string, string>): { url: string; whatsapp: boolean } {')
    p('  for (const regra of REGRAS_SAIDA) {')
    p('    if (respostas[regra.campo] === regra.valor) return { url: regra.url, whatsapp: regra.whatsapp }')
    p('  }')
    p(`  return { url: REDIRECT_URL, whatsapp: ${spec.destino.whatsappHandoff} }`)
    p('}')
    p('')
  }

  // ---- componente ----
  p('// ==== Componente =========================================================')
  p('')
  p('export default function FormularioLead() {')
  p('  const [indice, setIndice] = useState(0)')
  p("  const [valores, setValores] = useState<Record<string, string | string[]>>({})")
  p('  const [erros, setErros] = useState<Record<string, string>>({})')
  p('  const [enviando, setEnviando] = useState(false)')
  p('  const [erroEnvio, setErroEnvio] = useState(false)')
  if (!redireciona) p('  const [enviado, setEnviado] = useState(false)')
  if (temVideo) {
    p('  const [liberados, setLiberados] = useState<Record<number, boolean>>({})')
    p('  const [progresso, setProgresso] = useState(0)')
    p('  const deadlines = useRef<Record<number, number>>({})')
  }
  if (temTrack) p('  const [track, setTrack] = useState<Track>(TRACK_VAZIO)')
  p('')
  p('  const etapa = ETAPAS[indice]')
  p('  const ultima = indice === ETAPAS.length - 1')
  if (temVideo) {
    p("  const liberada = etapa.tipo !== 'video' || liberados[indice] === true")
  } else {
    p('  const liberada = true')
  }
  p('')

  if (temTrack) {
    p('  // Captura a atribuicao no mount.')
    p('  useEffect(() => {')
    p('    const params = new URLSearchParams(window.location.search)')
    if (spec.tracking.firstTouch) {
      p('    const proximo = lerTrackSalvo()')
      p('    TRACK_KEYS.forEach((k) => {')
      p('      const v = params.get(k)')
      p('      if (v && !proximo[k]) proximo[k] = v.slice(0, 200)')
      p('    })')
      p('    try {')
      p('      sessionStorage.setItem(TRACK_STORAGE_KEY, JSON.stringify(proximo))')
      p('    } catch {')
      p('      /* aba privada: segue so em memoria */')
      p('    }')
    } else {
      p('    const proximo: Track = { ...TRACK_VAZIO }')
      p('    TRACK_KEYS.forEach((k) => {')
      p("      proximo[k] = (params.get(k) || '').slice(0, 200)")
      p('    })')
    }
    if (spec.tracking.fallbackUtmContent) {
      p('    // Marcador de versao DERIVADO (nao persistido): se o lead voltar numa visita')
      p('    // taggeada, o utm_content real entra no lugar.')
      p('    setTrack({ ...proximo, utm_content: proximo.utm_content || FALLBACK_UTM_CONTENT })')
    } else {
      p('    setTrack(proximo)')
    }
    p('  }, [])')
    p('')
  }

  if (temVideo) {
    p('  // Trava da etapa de video: baseada num deadline, entao voltar/avancar entre')
    p('  // etapas nao reinicia a contagem; ao liberar, fica liberado.')
    p('  useEffect(() => {')
    p("    if (etapa.tipo !== 'video' || liberados[indice]) return")
    p('    const total = Math.max(1, etapa.video?.travaSegundos ?? 60) * 1000')
    p('    if (deadlines.current[indice] == null) deadlines.current[indice] = Date.now() + total')
    p('    const tick = () => {')
    p('      const ms = (deadlines.current[indice] ?? 0) - Date.now()')
    p('      setProgresso(Math.min(100, Math.max(0, ((total - ms) / total) * 100)))')
    p('      if (ms <= 0) {')
    p('        setLiberados((prev) => ({ ...prev, [indice]: true }))')
    if (usaDataLayer) {
      p("        pushDataLayer('form_video_unlocked', { step: indice + 1 })")
    }
    p('      }')
    p('    }')
    p('    tick()')
    p('    const id = setInterval(tick, 250)')
    p('    return () => clearInterval(id)')
    p('  }, [etapa, indice, liberados])')
    p('')
  }

  p('  const setValor = useCallback((name: string, valor: string | string[]) => {')
  p('    setValores((prev) => ({ ...prev, [name]: valor }))')
  p("    setErros((prev) => (prev[name] ? { ...prev, [name]: '' } : prev))")
  p('  }, [])')
  p('')
  p('  const validarEtapa = useCallback(() => {')
  p('    const novos: Record<string, string> = {}')
  p('    for (const campo of etapa.campos) {')
  p("      const msg = validarCampo(campo, valores[campo.name] ?? (campo.tipo === 'checkbox' ? [] : ''))")
  p('      if (msg) novos[campo.name] = msg')
  p('    }')
  p('    setErros((prev) => ({ ...prev, ...novos }))')
  if (usaDataLayer) {
    p('    Object.keys(novos).forEach((field) =>')
    p("      pushDataLayer('form_validation_error', { step: indice + 1, field }),")
    p('    )')
  }
  p('    return Object.keys(novos).length === 0')
  if (usaDataLayer) {
    p('  }, [etapa, valores, indice])')
  } else {
    p('  }, [etapa, valores])')
  }
  p('')
  p('  const avancar = useCallback(() => {')
  p('    if (!liberada) return')
  p('    if (!validarEtapa()) return')
  p('    // lead_id nasce na primeira etapa valida e persiste ate o envio.')
  p('    if (!sessionStorage.getItem(LEAD_ID_KEY)) sessionStorage.setItem(LEAD_ID_KEY, gerarLeadId())')
  if (usaDataLayer) {
    p("    pushDataLayer('form_step_complete', { step: indice + 1, lead_id: sessionStorage.getItem(LEAD_ID_KEY) })")
  }
  p('    setIndice((i) => Math.min(i + 1, ETAPAS.length - 1))')
  if (usaDataLayer) p("    pushDataLayer('form_step_view', { step: indice + 2 })")
  p("    document.getElementById('formulario')?.scrollIntoView({ behavior: 'smooth' })")
  p('  }, [liberada, validarEtapa, indice])')
  p('')
  p('  const voltar = useCallback(() => {')
  if (usaDataLayer) {
    p("    pushDataLayer('form_step_back', { from_step: indice + 1, to_step: indice })")
  }
  p('    setIndice((i) => Math.max(0, i - 1))')
  p('  }, [indice])')
  p('')

  // ---- envio ----
  p('  const enviar = useCallback(')
  p('    async (e: FormEvent) => {')
  p('      e.preventDefault()')
  p('      if (!liberada) return')
  p('      setErroEnvio(false)')
  p('      if (!validarEtapa()) return')
  p('')
  p('      const leadId = sessionStorage.getItem(LEAD_ID_KEY) || gerarLeadId()')
  p('      sessionStorage.setItem(LEAD_ID_KEY, leadId)')
  p('')
  p('      // Achata o estado: checkbox vira "a, b"; o resto vai como texto.')
  p('      // WhatsApp sai em E.164 (+55…) e e-mail em minusculo — o CRM e o ledger')
  p('      // esperam assim, e no modo webhook direto nao ha backend pra normalizar.')
  p('      const respostas: Record<string, string> = {}')
  p('      for (const et of ETAPAS)')
  p('        for (const campo of et.campos) {')
  p("          if (campo.tipo === 'oculto') {")
  p("            respostas[campo.name] = campo.valorFixo ?? ''")
  p('            continue')
  p('          }')
  p('          const v = valores[campo.name]')
  p("          const texto = Array.isArray(v) ? v.join(', ') : String(v ?? '')")
  p("          respostas[campo.name] =")
  p("            campo.tipo === 'whatsapp'")
  p("              ? (texto ? `+55${texto.replace(/\\D/g, '')}` : '')")
  p("              : campo.tipo === 'email'")
  p('                ? texto.trim().toLowerCase()')
  p('                : texto')
  p('        }')
  p('')
  p('      const payload = {')
  p('        lead_id: leadId,')
  p('        ...CAMPOS_FIXOS,')
  p('        ...respostas,')
  if (temTrack) p('        ...track,')
  p('        form_name: FORM_NAME,')
  p('        slug: SLUG,')
  p('        timestamp: new Date().toISOString(),')
  p("        etapa: 'completo',")
  p('        formulario_completo: true,')
  p('      }')
  p('')
  // Navegacao num lugar so: ela e usada no sucesso E na falha, e duplicar o
  // bloco e como um caminho deixa de ser atualizado junto com o outro.
  p('      // Pra onde este lead vai depois do envio.')
  p('      const irParaDestino = () => {')
  if (regras.length) {
    p('        const saida = destinoDoLead(respostas)')
    if (wa) {
      p('        window.location.href = saida.whatsapp')
      p('          ? comMensagemWhatsapp(saida.url, valores)')
      p('          : saida.url')
    } else {
      p('        window.location.href = saida.url')
    }
  } else if (redireciona) {
    if (wa) {
      p('        window.location.href = comMensagemWhatsapp(REDIRECT_URL, valores)')
    } else {
      p('        window.location.href = REDIRECT_URL')
    }
  } else {
    if (wa) p('        montarMensagemWhatsapp(valores)')
    p('        setEnviado(true)')
  }
  p('      }')
  p('')

  if (redireciona) {
    p('      // Ultima tentativa de salvar o lead quando o POST falhou. O sendBeacon')
    p('      // sobrevive a saida da pagina, entao da pra tentar E navegar em seguida.')
    p('      const salvarNoEscuro = () => {')
    p('        try {')
    p('          navigator.sendBeacon(')
    p('            ENDPOINT,')
    p("            new Blob([JSON.stringify(payload)], { type: 'application/json' }),")
    p('          )')
    p('        } catch {')
    p('          /* sem rede: o lead vai pro destino do mesmo jeito */')
    p('        }')
    p('      }')
    p('')
  }

  p('      setEnviando(true)')
  p('      try {')
  p('        const resp = await fetch(ENDPOINT, {')
  p("          method: 'POST',")
  p("          headers: { 'Content-Type': 'application/json' },")
  p('          body: JSON.stringify(payload),')
  p('        })')
  p('        if (!resp.ok) throw new Error(`envio ${resp.status}`)')
  p('')

  if (usaDataLayer) {
    p('        const eventId =')
    p("          typeof crypto !== 'undefined' && crypto.randomUUID")
    p('            ? crypto.randomUUID()')
    p('            : `${Date.now()}-${Math.random()}`')
    p('        // Respostas tambem em slug, pro GTM nao depender do texto do rotulo.')
    p('        const resp_slugs: Record<string, string> = {}')
    p('        for (const [name, mapa] of Object.entries(SLUGS_DE_RESPOSTA))')
    p("          resp_slugs[name] = mapa[respostas[name]] ?? ''")
    p('')
  }

  p('        let navegou = false')
  p('        const concluir = () => {')
  p('          if (navegou) return')
  p('          navegou = true')
  p('          sessionStorage.removeItem(LEAD_ID_KEY)')
  p('          irParaDestino()')
  p('        }')
  p('')

  if (usaDataLayer) {
    p('        const w = window as unknown as { dataLayer?: Record<string, unknown>[] }')
    p('        w.dataLayer = w.dataLayer || []')
    p('        w.dataLayer.push({')
    p('          event: EVENTO_CONVERSAO,')
    p('          form_name: FORM_NAME,')
    p('          destino: SLUG,')
    p('          event_id: eventId,')
    p('          lead: {')
    p("            nome: respostas.nome ?? '',")
    p("            email: respostas.email ?? '', // ja normalizado acima (minusculo)")
    p("            whatsapp: respostas.whatsapp ?? '', // ja em E.164")
    p("            instagram: respostas.instagram ?? '',")
    p('          },')
    p('          resp: resp_slugs,')
    if (temTrack) p('          ...track,')
    p('          eventCallback: concluir,')
    p('          eventTimeout: 2000,')
    p('        })')
    p('        // Rede de seguranca: se o GTM nao chamar o callback, conclui mesmo assim.')
    p('        setTimeout(concluir, 2000)')
  } else {
    p('        concluir()')
  }

  p('      } catch (err) {')
  p('        if (import.meta.env.DEV) {')
  p("          // Em dev o /api nao existe (funcao roda so na Vercel) — segue o fluxo.")
  p("          console.warn('[dev] envio indisponivel, simulando sucesso:', err)")
  p('          irParaDestino()')
  p('          return')
  p('        }')
  if (redireciona) {
    p('        // O envio falhou, mas segurar o lead aqui e o pior dos dois males:')
    p('        // quem chega no destino a gente ja tem (o numero esta na conversa),')
    p('        // quem fica parado numa mensagem de erro some. Tenta salvar no')
    p('        // escuro e manda embora.')
    p('        salvarNoEscuro()')
    p('        sessionStorage.removeItem(LEAD_ID_KEY)')
    p('        irParaDestino()')
    p('        return')
  } else {
    p('        setErroEnvio(true)')
  }
  p('      } finally {')
  p('        setEnviando(false)')
  p('      }')
  p('    },')
  p(`    [liberada, validarEtapa, valores${temTrack ? ', track' : ''}],`)
  p('  )')
  p('')

  // ---- render ----
  // So sai quando o indicador de etapas existe: um helper sem uso quebraria o
  // build da LP (tsconfig com noUnusedLocals).
  const temIndicador = spec.aparencia.indicadorEtapas && spec.etapas.length > 1
  if (temIndicador) {
    p('  const stepClass = (ativo: boolean, passado: boolean) =>')
    p("    `w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${")
    p('      ativo')
    p("        ? 'bg-lime text-dark-teal'")
    p('        : passado')
    p("          ? 'bg-dark-teal text-off-white'")
    p("          : 'bg-dark-teal/10 text-dark-teal/50'")
    p('    }`')
    p('')
  }

  if (!redireciona) {
    p('  if (enviado) {')
    p('    return (')
    p('      <div id="form-success" className="card rounded-2xl bg-white text-center py-10">')
    p(`        <p className="font-serif text-2xl font-bold text-dark-teal mb-2">${escaparJsx(spec.destino.mensagemTitulo)}</p>`)
    p(`        <p className="text-dark-teal/70">${escaparJsx(spec.destino.mensagemTexto)}</p>`)
    p('      </div>')
    p('    )')
    p('  }')
    p('')
  }

  p('  return (')
  p('    <form')
  p('      id="expedition-form"')
  p(`      className="${spec.aparencia.cartao ? 'card ' : ''}rounded-2xl bg-white text-left"`)
  p('      noValidate')
  p('      onSubmit={enviar}')
  p('    >')

  if (spec.tracking.inputsOcultos && temTrack) {
    p('      {/* Contrato com o GTM/backend: lead_id + tracking em campos ocultos */}')
    p('      <input type="hidden" name="lead_id" id="lead_id" value={sessionStorage.getItem(LEAD_ID_KEY) ?? \'\'} readOnly />')
    p('      {TRACK_KEYS.map((k) => (')
    p("        <input key={k} type=\"hidden\" name={k} id={k} value={track[k] ?? ''} readOnly />")
    p('      ))}')
    p('')
  }

  if (temIndicador) {
    p('      {/* Indicador de etapas */}')
    p('      <div className="flex items-center justify-center gap-3 mb-8" aria-hidden>')
    p('        {ETAPAS.map((_, i) => (')
    p('          <div key={i} className="flex items-center gap-3">')
    p('            {i > 0 && <span className="w-10 h-[2px] bg-dark-teal/20" />}')
    p('            <span id={`step${i + 1}-indicator`} className={stepClass(i === indice, i < indice)}>')
    p('              {i + 1}')
    p('            </span>')
    p('          </div>')
    p('        ))}')
    p('      </div>')
    p('')
  }

  if (spec.aparencia.rotuloEtapa) {
    p('      <p className="input-label !mb-6 text-center text-dark-teal/60">')
    if (spec.etapas.length > 1) {
      p('        {`Etapa ${indice + 1} de ${ETAPAS.length} · ${etapa.titulo}`}')
    } else {
      p('        {etapa.titulo}')
    }
    p('      </p>')
    p('')
  }

  p('      <div id={`form-step-${indice + 1}`} className="form-step">')

  if (temVideo) {
    p("        {etapa.tipo === 'video' ? (")
    p('          <>')
    p('            <div')
    p('              className="mb-6"')
    p("              dangerouslySetInnerHTML={{ __html: etapa.video?.embedHtml ?? '' }}")
    p('            />')
    p('            {!liberada ? (')
    p('              <div className="flex items-center justify-center gap-2 rounded-xl bg-soft-green/60 border border-dark-teal/10 px-4 py-3 text-dark-teal/75 text-sm">')
    p('                <Lock className="h-4 w-4 flex-shrink-0" aria-hidden />')
    p('                <span>{etapa.video?.textoBloqueado}</span>')
    p('              </div>')
    p('            ) : (')
    p('              <div className="flex items-center justify-center gap-2 rounded-xl bg-lime/25 border border-lime px-4 py-3 text-dark-teal text-sm font-semibold">')
    p('                <Check className="h-4 w-4 flex-shrink-0" strokeWidth={3} aria-hidden />')
    p('                <span>{etapa.video?.textoLiberado}</span>')
    p('                <ArrowDown className="h-4 w-4 animate-bounce" aria-hidden />')
    p('              </div>')
    p('            )}')
    p('          </>')
    p('        ) : (')
    p('          <CamposDaEtapa etapa={etapa} valores={valores} erros={erros} setValor={setValor} />')
    p('        )}')
  } else {
    p('        <CamposDaEtapa etapa={etapa} valores={valores} erros={erros} setValor={setValor} />')
  }

  p('      </div>')
  p('')
  p('      {erroEnvio && <p className="field-error text-center mt-6">{ERRO_ENVIO}</p>}')
  p('')
  p('      <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8">')
  p('        {indice > 0 && (')
  p('          <button type="button" id="btn-prev-step" className="btn-outline sm:w-1/3" onClick={voltar}>')
  p('            Voltar')
  p('          </button>')
  p('        )}')
  p('        {ultima ? (')
  p('          <button type="submit" id="btn-submit" className="btn-primary sm:flex-1" disabled={enviando || !liberada}>')
  p("            {enviando ? 'Enviando…' : etapa.textoBotao}")
  p('          </button>')

  if (temVideo) {
    p('        ) : !liberada ? (')
    p('          // Botao-barra: enche durante a trava do video')
    p('          <button')
    p('            type="button"')
    p('            id="btn-next-step"')
    p('            disabled')
    p('            className="sm:flex-1 relative overflow-hidden rounded-full bg-dark-teal/10 px-8 py-4 cursor-default"')
    p('            role="progressbar"')
    p('            aria-valuemin={0}')
    p('            aria-valuemax={100}')
    p('            aria-valuenow={Math.round(progresso)}')
    p('            aria-label="Carregando as próximas perguntas"')
    p('          >')
    p('            <span')
    p('              className="absolute inset-y-0 left-0 bg-lime transition-[width] duration-200 ease-linear"')
    p('              style={{ width: `${progresso}%` }}')
    p('              aria-hidden')
    p('            />')
    p('            <span className="relative z-10 flex items-center justify-center gap-2 text-sm font-semibold text-dark-teal/70">')
    p('              <span className="h-2 w-2 rounded-full bg-dark-teal/50 animate-pulse" aria-hidden />')
    p('              Carregando as próximas perguntas…')
    p('            </span>')
    p('          </button>')
  }

  p('        ) : (')
  p('          <button type="button" id="btn-next-step" className="btn-primary sm:flex-1" onClick={avancar}>')
  p('            {etapa.textoBotao}')
  p('          </button>')
  p('        )}')
  p('      </div>')
  p('    </form>')
  p('  )')
  p('}')
  p('')

  // ---- subcomponentes ----
  p(...subcomponentes())

  return L.join('\n')
}

/** Escapa chaves do JSX em texto literal. */
function escaparJsx(texto: string): string {
  return String(texto ?? '').replace(/[{}]/g, (c) => `{'${c}'}`)
}

/** Render dos campos — igual pra todos os formularios, sai fixo no arquivo. */
function subcomponentes(): string[] {
  return [
    '// ==== Render dos campos ==================================================',
    '',
    'function CamposDaEtapa({',
    '  etapa,',
    '  valores,',
    '  erros,',
    '  setValor,',
    '}: {',
    '  etapa: EtapaCfg',
    '  valores: Record<string, string | string[]>',
    '  erros: Record<string, string>',
    '  setValor: (name: string, valor: string | string[]) => void',
    '}) {',
    '  return (',
    '    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">',
    "      {etapa.campos.map((campo) =>",
    "        campo.tipo === 'oculto' ? null : (",
    '          <div',
    '            key={campo.name}',
    "            className={campo.largura === 'metade' ? 'sm:col-span-1' : 'sm:col-span-2'}",
    '          >',
    '            <CampoRender',
    '              campo={campo}',
    "              valor={valores[campo.name] ?? (campo.tipo === 'checkbox' ? [] : '')}",
    "              erro={erros[campo.name] ?? ''}",
    '              onChange={(v) => setValor(campo.name, v)}',
    '            />',
    '          </div>',
    '        ),',
    '      )}',
    '    </div>',
    '  )',
    '}',
    '',
    'function CampoRender({',
    '  campo,',
    '  valor,',
    '  erro,',
    '  onChange,',
    '}: {',
    '  campo: CampoCfg',
    '  valor: string | string[]',
    '  erro: string',
    '  onChange: (v: string | string[]) => void',
    '}) {',
    "  const texto = Array.isArray(valor) ? '' : valor",
    '  const lista = Array.isArray(valor) ? valor : []',
    "  const cls = `input ${erro ? 'input-error' : ''}`",
    '',
    '  const rodape = (',
    '    <>',
    '      {campo.ajuda && !erro && <p className="mt-1.5 text-xs text-dark-teal/50">{campo.ajuda}</p>}',
    '      {erro && <p className="field-error">{erro}</p>}',
    '    </>',
    '  )',
    '',
    "  if (campo.tipo === 'radio' || campo.tipo === 'checkbox') {",
    '    return (',
    '      <fieldset>',
    "        <legend className={`input-label ${erro ? 'radio-error-legend' : ''}`}>{campo.label}</legend>",
    '        <div className="radio-group">',
    '          {(campo.opcoes ?? []).map((o) => (',
    '            <label key={o.slug} className="radio-item">',
    '              <input',
    "                type={campo.tipo === 'radio' ? 'radio' : 'checkbox'}",
    '                name={campo.name}',
    '                value={o.label}',
    '                className="w-4 h-4 accent-lime"',
    "                checked={campo.tipo === 'radio' ? texto === o.label : lista.includes(o.label)}",
    '                onChange={() =>',
    "                  campo.tipo === 'radio'",
    '                    ? onChange(o.label)',
    '                    : onChange(',
    '                        lista.includes(o.label)',
    '                          ? lista.filter((x) => x !== o.label)',
    '                          : [...lista, o.label],',
    '                      )',
    '                }',
    '              />',
    '              <span>{o.label}</span>',
    '            </label>',
    '          ))}',
    '        </div>',
    '        {rodape}',
    '      </fieldset>',
    '    )',
    '  }',
    '',
    "  if (campo.tipo === 'consentimento') {",
    '    return (',
    '      <div>',
    '        <label className="radio-item">',
    '          <input',
    '            type="checkbox"',
    '            name={campo.name}',
    '            className="w-4 h-4 accent-lime"',
    "            checked={texto === 'sim'}",
    "            onChange={(e) => onChange(e.target.checked ? 'sim' : '')}",
    '          />',
    '          <span className="text-sm">{campo.label}</span>',
    '        </label>',
    '        {rodape}',
    '      </div>',
    '    )',
    '  }',
    '',
    '  const rotulo = (',
    '    <label htmlFor={campo.name} className="input-label">',
    '      {campo.label}',
    '      {!campo.obrigatorio && <span className="ml-1 font-normal text-dark-teal/40">(opcional)</span>}',
    '    </label>',
    '  )',
    '',
    "  if (campo.tipo === 'select') {",
    '    return (',
    '      <div>',
    '        {rotulo}',
    '        <select',
    '          id={campo.name}',
    '          name={campo.name}',
    '          className={cls}',
    '          value={texto}',
    '          onChange={(e) => onChange(e.target.value)}',
    '        >',
    "          <option value=\"\">{campo.placeholder || 'Selecione…'}</option>",
    '          {(campo.opcoes ?? []).map((o) => (',
    '            <option key={o.slug} value={o.label}>',
    '              {o.label}',
    '            </option>',
    '          ))}',
    '        </select>',
    '        {rodape}',
    '      </div>',
    '    )',
    '  }',
    '',
    "  if (campo.tipo === 'textarea') {",
    '    return (',
    '      <div>',
    '        {rotulo}',
    '        <textarea',
    '          id={campo.name}',
    '          name={campo.name}',
    '          className={cls}',
    '          rows={4}',
    '          placeholder={campo.placeholder}',
    '          value={texto}',
    '          onChange={(e) => onChange(e.target.value)}',
    '        />',
    '        {rodape}',
    '      </div>',
    '    )',
    '  }',
    '',
    '  const tipoHtml =',
    "    campo.tipo === 'email'",
    "      ? 'email'",
    "      : campo.tipo === 'whatsapp'",
    "        ? 'tel'",
    "        : campo.tipo === 'data'",
    "          ? 'date'",
    "          : campo.tipo === 'numero'",
    "            ? 'number'",
    "            : 'text'",
    '',
    '  const aoDigitar = (v: string) =>',
    "    campo.tipo === 'whatsapp'",
    '      ? mascaraWhatsapp(v)',
    "      : campo.tipo === 'instagram'",
    '        ? mascaraInstagram(v)',
    '        : v',
    '',
    '  return (',
    '    <div>',
    '      {rotulo}',
    '      <input',
    '        type={tipoHtml}',
    '        id={campo.name}',
    '        name={campo.name}',
    '        className={cls}',
    '        placeholder={campo.placeholder}',
    '        required={campo.obrigatorio}',
    "        maxLength={campo.tipo === 'whatsapp' ? 15 : undefined}",
    "        inputMode={campo.tipo === 'whatsapp' ? 'numeric' : undefined}",
    "        autoCapitalize={campo.tipo === 'instagram' ? 'none' : undefined}",
    '        value={texto}',
    '        onChange={(e) => onChange(aoDigitar(e.target.value))}',
    '      />',
    '      {rodape}',
    '    </div>',
    '  )',
    '}',
    '',
  ]
}
