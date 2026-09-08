import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowDown, Check, Lock } from 'lucide-react'
import type { Campo, FormSpec } from '../types'
import {
  mascaraInstagram,
  mascaraWhatsapp,
  placeholderPadrao,
  resolverSaida,
  validarCampo,
  valorInicial,
} from '../lib/util'

// ============================================================================
// Motor do formulario. Interpreta um FormSpec e renderiza o form REAL — mesmas
// classes, mesmas validacoes, mesma trava de video, mesma navegacao entre
// etapas do codigo que os geradores exportam. O preview nao e uma maquete: e o
// formulario, so que sem enviar nada.
// ============================================================================

type Props = {
  spec: FormSpec
  /** Preview: valida e navega normalmente, mas nao faz POST nem redireciona. */
  simulado?: boolean
}

type Valores = Record<string, string | string[]>

export default function FormRenderer({ spec, simulado = true }: Props) {
  const etapas = spec.etapas
  const [indice, setIndice] = useState(0)
  const [valores, setValores] = useState<Valores>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState(false)
  const [enviado, setEnviado] = useState(false)

  // Trava da etapa de video: deadline por etapa, pra voltar/avancar nao reiniciar.
  const [liberados, setLiberados] = useState<Record<string, boolean>>({})
  const [progresso, setProgresso] = useState(0)
  const deadlines = useRef<Record<string, number>>({})

  const etapa = etapas[Math.min(indice, etapas.length - 1)]
  const ultima = indice === etapas.length - 1
  const liberada = etapa?.tipo !== 'video' || liberados[etapa.id] === true

  // Se o builder remove etapas enquanto o preview esta numa etapa avancada.
  useEffect(() => {
    if (indice > etapas.length - 1) setIndice(Math.max(0, etapas.length - 1))
  }, [etapas.length, indice])

  // Contagem regressiva da etapa de video.
  useEffect(() => {
    if (!etapa || etapa.tipo !== 'video' || liberados[etapa.id]) return
    const total = Math.max(1, etapa.video.travaSegundos) * 1000
    if (deadlines.current[etapa.id] == null) deadlines.current[etapa.id] = Date.now() + total
    const tick = () => {
      const ms = (deadlines.current[etapa.id] ?? 0) - Date.now()
      setProgresso(Math.min(100, Math.max(0, ((total - ms) / total) * 100)))
      if (ms <= 0) setLiberados((p) => ({ ...p, [etapa.id]: true }))
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [etapa, liberados])

  const setValor = useCallback((name: string, valor: string | string[]) => {
    setValores((p) => ({ ...p, [name]: valor }))
    setErros((p) => (p[name] ? { ...p, [name]: '' } : p))
  }, [])

  const validarEtapaAtual = useCallback(() => {
    if (!etapa) return true
    const novos: Record<string, string> = {}
    for (const campo of etapa.campos) {
      const msg = validarCampo(campo, valores[campo.name] ?? valorInicial(campo.tipo))
      if (msg) novos[campo.name] = msg
    }
    setErros((p) => ({ ...p, ...novos }))
    return Object.keys(novos).length === 0
  }, [etapa, valores])

  const avancar = useCallback(() => {
    if (!liberada) return
    if (!validarEtapaAtual()) return
    setIndice((i) => Math.min(i + 1, etapas.length - 1))
  }, [liberada, validarEtapaAtual, etapas.length])

  const voltar = useCallback(() => setIndice((i) => Math.max(0, i - 1)), [])

  const enviar = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!liberada) return
      setErroEnvio(false)
      if (!validarEtapaAtual()) return

      if (simulado) {
        setEnviado(true)
        return
      }
      setEnviando(true)
      try {
        const resp = await fetch(spec.destino.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(valores),
        })
        if (!resp.ok) throw new Error(String(resp.status))
        setEnviado(true)
      } catch {
        setErroEnvio(true)
      } finally {
        setEnviando(false)
      }
    },
    [liberada, validarEtapaAtual, simulado, spec.destino.url, valores],
  )

  const stepClass = (ativo: boolean, passado: boolean) =>
    `w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
      ativo
        ? 'bg-lime text-dark-teal'
        : passado
          ? 'bg-dark-teal text-off-white'
          : 'bg-dark-teal/10 text-dark-teal/50'
    }`

  const camposVisiveis = useMemo(
    () => (etapa?.campos ?? []).filter((c) => c.tipo !== 'oculto'),
    [etapa],
  )

  if (!etapa) {
    return (
      <div className="card rounded-2xl bg-white text-center text-sm text-dark-teal/50">
        Nenhuma etapa. Adicione uma no painel da esquerda.
      </div>
    )
  }

  // No modo 'agendamento' o preview mostra a moldura da agenda, nao a agenda de
  // verdade: embutir o QS aqui dependeria de o dominio do painel estar no
  // frame-ancestors dele, e em `npm run dev` (localhost) nunca esta — a caixa
  // apareceria vazia e pareceria defeito do formulario.
  if (enviado && spec.destino.aposEnvio === 'agendamento') {
    return (
      <div className={`${spec.aparencia.cartao ? 'card' : ''} rounded-2xl bg-white py-8`}>
        <div className="text-center">
          <p className="stfv-titulo text-2xl font-bold text-dark-teal mb-2">
            {spec.destino.mensagemTitulo}
          </p>
          <p className="text-dark-teal/70">{spec.destino.mensagemTexto}</p>
        </div>
        <div className="mt-6 rounded-xl border-2 border-dashed border-dark-teal/20 bg-dark-teal/[0.03] px-4 py-10 text-center">
          <p className="text-sm font-bold text-dark-teal/70">Agenda do QS</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-snug text-dark-teal/50">
            No ar, aqui entra a grade de dias e horários — com nome, e-mail e WhatsApp já
            preenchidos. Confira em {spec.destino.agendamentoUrl}
          </p>
        </div>
        <div className="text-center">
          <button type="button" className="btn-ghost mt-6" onClick={() => { setEnviado(false); setIndice(0); setValores({}) }}>
            Testar de novo
          </button>
        </div>
      </div>
    )
  }

  if (enviado && spec.destino.aposEnvio === 'mensagem') {
    return (
      <div className={`${spec.aparencia.cartao ? 'card' : ''} rounded-2xl bg-white text-center py-10`}>
        <p className="stfv-titulo text-2xl font-bold text-dark-teal mb-2">
          {spec.destino.mensagemTitulo}
        </p>
        <p className="text-dark-teal/70">{spec.destino.mensagemTexto}</p>
        <button type="button" className="btn-ghost mt-6" onClick={() => { setEnviado(false); setIndice(0); setValores({}) }}>
          Testar de novo
        </button>
      </div>
    )
  }

  if (enviado) {
    // Mostra o destino REAL desta resposta: com saida condicional, "enviado"
    // nao quer dizer um lugar so — e ai que o teste do preview vale.
    const saida = resolverSaida(spec.destino, valores)
    return (
      <div className={`${spec.aparencia.cartao ? 'card' : ''} rounded-2xl bg-white text-center py-10`}>
        <Check className="mx-auto h-10 w-10 text-lime-dark" strokeWidth={3} />
        <p className="stfv-titulo text-xl font-bold text-dark-teal mt-3">Enviado</p>
        <p className="text-sm text-dark-teal/60 mt-1">
          O lead foi gravado no CRM e seria levado para
        </p>
        <p className="mx-auto mt-2 max-w-md break-all rounded-lg bg-off-white px-3 py-2 font-mono text-xs text-dark-teal">
          {saida.url || '(destino vazio)'}
        </p>
        {saida.whatsapp && (
          <p className="mt-2 text-xs text-dark-teal/50">com a mensagem do WhatsApp já preenchida</p>
        )}
        <button type="button" className="btn-ghost mt-6" onClick={() => { setEnviado(false); setIndice(0); setValores({}) }}>
          Testar de novo
        </button>
      </div>
    )
  }

  return (
    <form
      id="expedition-form"
      className={`${spec.aparencia.cartao ? 'card' : ''} rounded-2xl bg-white text-left`}
      noValidate
      onSubmit={enviar}
    >
      {spec.aparencia.indicadorEtapas && etapas.length > 1 && (
        <div className="flex items-center justify-center gap-3 mb-8" aria-hidden>
          {etapas.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3">
              {i > 0 && <span className="w-10 h-[2px] bg-dark-teal/20" />}
              <span className={stepClass(i === indice, i < indice)}>{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      {spec.aparencia.rotuloEtapa && (
        <p className="input-label stfv-titulo !mb-6 text-center text-dark-teal/60">
          {etapas.length > 1 ? `Etapa ${indice + 1} de ${etapas.length} · ` : ''}
          {etapa.titulo}
        </p>
      )}

      {etapa.tipo === 'video' ? (
        <>
          <div className="mb-6">
            {etapa.video.embedHtml ? (
              <div dangerouslySetInnerHTML={{ __html: etapa.video.embedHtml }} />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-dark-teal/20 bg-off-white text-sm text-dark-teal/40">
                Cole o embed do vídeo no painel da esquerda
              </div>
            )}
          </div>
          {!liberada ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-soft-green/60 border border-dark-teal/10 px-4 py-3 text-dark-teal/75 text-sm">
              <Lock className="h-4 w-4 flex-shrink-0" aria-hidden />
              <span>{etapa.video.textoBloqueado}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-lime/25 border border-lime px-4 py-3 text-dark-teal text-sm font-semibold">
              <Check className="h-4 w-4 flex-shrink-0" strokeWidth={3} aria-hidden />
              <span>{etapa.video.textoLiberado}</span>
              <ArrowDown className="h-4 w-4 animate-bounce" aria-hidden />
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {camposVisiveis.map((campo) => (
            <div
              key={campo.id}
              className={campo.largura === 'metade' ? 'sm:col-span-1' : 'sm:col-span-2'}
            >
              <CampoRender
                campo={campo}
                valor={valores[campo.name] ?? valorInicial(campo.tipo)}
                erro={erros[campo.name] ?? ''}
                onChange={(v) => setValor(campo.name, v)}
              />
            </div>
          ))}
          {camposVisiveis.length === 0 && (
            <p className="sm:col-span-2 rounded-xl border border-dashed border-dark-teal/20 py-8 text-center text-sm text-dark-teal/40">
              Etapa sem campos.
            </p>
          )}
        </div>
      )}

      {erroEnvio && <p className="field-error text-center mt-6">{spec.destino.erroEnvio}</p>}

      <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8">
        {indice > 0 && (
          <button type="button" className="btn-outline sm:w-1/3" onClick={voltar}>
            Voltar
          </button>
        )}

        {ultima ? (
          <button type="submit" className="btn-primary sm:flex-1" disabled={enviando || !liberada}>
            {enviando ? 'Enviando…' : etapa.textoBotao}
          </button>
        ) : !liberada ? (
          // Botao-barra: enche durante a trava do video (mesma UI da LP)
          <button
            type="button"
            disabled
            className="sm:flex-1 relative overflow-hidden rounded-full bg-dark-teal/10 px-8 py-4 cursor-default"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progresso)}
          >
            <span
              className="absolute inset-y-0 left-0 bg-lime transition-[width] duration-200 ease-linear"
              style={{ width: `${progresso}%` }}
              aria-hidden
            />
            <span className="relative z-10 flex items-center justify-center gap-2 text-sm font-semibold text-dark-teal/70">
              <span className="h-2 w-2 rounded-full bg-dark-teal/50 animate-pulse" aria-hidden />
              Carregando as próximas perguntas…
            </span>
          </button>
        ) : (
          <button type="button" className="btn-primary sm:flex-1" onClick={avancar}>
            {etapa.textoBotao}
          </button>
        )}
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------

function CampoRender({
  campo,
  valor,
  erro,
  onChange,
}: {
  campo: Campo
  valor: string | string[]
  erro: string
  onChange: (v: string | string[]) => void
}) {
  const texto = Array.isArray(valor) ? '' : valor
  const lista = Array.isArray(valor) ? valor : []
  const ph = campo.placeholder || placeholderPadrao(campo.tipo)
  const cls = `input ${erro ? 'input-error' : ''}`

  const rotulo = (
    <label htmlFor={campo.name} className="input-label">
      {campo.label || <span className="text-dark-teal/30">(sem rótulo)</span>}
      {!campo.obrigatorio && <span className="ml-1 font-normal text-dark-teal/40">(opcional)</span>}
    </label>
  )

  const rodape = (
    <>
      {campo.ajuda && !erro && <p className="mt-1.5 text-xs text-dark-teal/50">{campo.ajuda}</p>}
      {erro && <p className="field-error">{erro}</p>}
    </>
  )

  switch (campo.tipo) {
    case 'radio':
    case 'checkbox':
      return (
        <fieldset>
          <legend className={`input-label ${erro ? 'radio-error-legend' : ''}`}>
            {campo.label || '(sem rótulo)'}
          </legend>
          <div className="radio-group">
            {campo.opcoes.map((o, i) => (
              <label key={`${o.slug}-${i}`} className="radio-item">
                <input
                  type={campo.tipo === 'radio' ? 'radio' : 'checkbox'}
                  name={campo.name}
                  value={o.label}
                  className="w-4 h-4 accent-lime"
                  checked={campo.tipo === 'radio' ? texto === o.label : lista.includes(o.label)}
                  onChange={() =>
                    campo.tipo === 'radio'
                      ? onChange(o.label)
                      : onChange(
                          lista.includes(o.label)
                            ? lista.filter((x) => x !== o.label)
                            : [...lista, o.label],
                        )
                  }
                />
                <span>{o.label}</span>
              </label>
            ))}
            {campo.opcoes.length === 0 && (
              <p className="text-xs text-dark-teal/40">Sem opções — adicione no painel.</p>
            )}
          </div>
          {rodape}
        </fieldset>
      )

    case 'select':
      return (
        <div>
          {rotulo}
          <select
            id={campo.name}
            name={campo.name}
            className={cls}
            value={texto}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{ph || 'Selecione…'}</option>
            {campo.opcoes.map((o, i) => (
              <option key={`${o.slug}-${i}`} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
          {rodape}
        </div>
      )

    case 'textarea':
      return (
        <div>
          {rotulo}
          <textarea
            id={campo.name}
            name={campo.name}
            className={cls}
            rows={4}
            placeholder={ph}
            value={texto}
            onChange={(e) => onChange(e.target.value)}
          />
          {rodape}
        </div>
      )

    case 'consentimento':
      return (
        <div>
          <label className="radio-item">
            <input
              type="checkbox"
              name={campo.name}
              className="w-4 h-4 accent-lime"
              checked={texto === 'sim'}
              onChange={(e) => onChange(e.target.checked ? 'sim' : '')}
            />
            <span className="text-sm">{campo.label}</span>
          </label>
          {rodape}
        </div>
      )

    case 'oculto':
      return null

    default: {
      const tipoHtml =
        campo.tipo === 'email'
          ? 'email'
          : campo.tipo === 'whatsapp'
            ? 'tel'
            : campo.tipo === 'data'
              ? 'date'
              : campo.tipo === 'numero'
                ? 'number'
                : 'text'
      const aoDigitar = (v: string) =>
        campo.tipo === 'whatsapp'
          ? mascaraWhatsapp(v)
          : campo.tipo === 'instagram'
            ? mascaraInstagram(v)
            : v
      return (
        <div>
          {rotulo}
          <input
            type={tipoHtml}
            id={campo.name}
            name={campo.name}
            className={cls}
            placeholder={ph}
            maxLength={campo.tipo === 'whatsapp' ? 15 : undefined}
            inputMode={campo.tipo === 'whatsapp' ? 'numeric' : undefined}
            autoCapitalize={campo.tipo === 'instagram' ? 'none' : undefined}
            value={texto}
            onChange={(e) => onChange(aoDigitar(e.target.value))}
          />
          {rodape}
        </div>
      )
    }
  }
}
