import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import type { Campo, Etapa, FormSpec, TipoCampo } from '../types'
import { ROTULOS_TIPO, TIPOS_COM_OPCOES } from '../types'
import { campoNovo, etapaNova } from '../defaults'
import { nomeDeCampo, placeholderPadrao, slugify, uid } from '../lib/util'

// ============================================================================
// Painel de estrutura: etapas e campos. Toda mudanca cai direto no spec, entao
// o preview ao lado reage na hora.
// ============================================================================

type Props = {
  spec: FormSpec
  onChange: (spec: FormSpec) => void
  etapaAtiva: number
  setEtapaAtiva: (i: number) => void
}

export default function PainelCampos({ spec, onChange, etapaAtiva, setEtapaAtiva }: Props) {
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const setEtapas = (etapas: Etapa[]) => onChange({ ...spec, etapas })

  const patchEtapa = (i: number, patch: Partial<Etapa>) =>
    setEtapas(spec.etapas.map((e, j) => (i === j ? { ...e, ...patch } : e)))

  const addEtapa = (tipo: 'campos' | 'video') => {
    const nova = etapaNova({
      tipo,
      titulo: tipo === 'video' ? 'Assista ao vídeo' : `Etapa ${spec.etapas.length + 1}`,
    })
    setEtapas([...spec.etapas, nova])
    setEtapaAtiva(spec.etapas.length)
  }

  const removerEtapa = (i: number) => {
    if (spec.etapas.length === 1) return
    setEtapas(spec.etapas.filter((_, j) => j !== i))
    setEtapaAtiva(Math.max(0, Math.min(etapaAtiva, spec.etapas.length - 2)))
  }

  const moverEtapa = (i: number, delta: number) => {
    const alvo = i + delta
    if (alvo < 0 || alvo >= spec.etapas.length) return
    const copia = [...spec.etapas]
    ;[copia[i], copia[alvo]] = [copia[alvo], copia[i]]
    setEtapas(copia)
    setEtapaAtiva(alvo)
  }

  const etapa = spec.etapas[etapaAtiva]

  const setCampos = (campos: Campo[]) => patchEtapa(etapaAtiva, { campos })

  const patchCampo = (id: string, patch: Partial<Campo>) =>
    setCampos(etapa.campos.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const addCampo = (tipo: TipoCampo) => {
    const n = etapa.campos.length + 1
    const novo = campoNovo(tipo, {
      name: `campo_${n}`,
      label: `Pergunta ${n}`,
      opcoes: TIPOS_COM_OPCOES.includes(tipo)
        ? [
            { label: 'Opção 1', slug: 'opcao-1' },
            { label: 'Opção 2', slug: 'opcao-2' },
          ]
        : [],
    })
    setCampos([...etapa.campos, novo])
    setAbertoId(novo.id)
  }

  const moverCampo = (i: number, delta: number) => {
    const alvo = i + delta
    if (alvo < 0 || alvo >= etapa.campos.length) return
    const copia = [...etapa.campos]
    ;[copia[i], copia[alvo]] = [copia[alvo], copia[i]]
    setCampos(copia)
  }

  const duplicarCampo = (campo: Campo) => {
    const copia = { ...campo, id: uid('campo'), name: `${campo.name}_copia` }
    setCampos([...etapa.campos, copia])
    setAbertoId(copia.id)
  }

  // Dois campos com o mesmo `name` se sobrescrevem no payload — o CRM recebe um só.
  const nomesRepetidos = new Set(
    spec.etapas
      .flatMap((e) => e.campos)
      .map((c) => c.name)
      .filter((n, i, arr) => n && arr.indexOf(n) !== i),
  )

  return (
    <div className="space-y-4">
      {/* ---- Etapas ---- */}
      <div className="painel">
        <div className="painel-titulo justify-between">
          <span>Etapas</span>
          <div className="flex gap-1">
            <button type="button" className="btn-ghost" onClick={() => addEtapa('campos')}>
              <Plus className="h-3.5 w-3.5" /> Etapa
            </button>
            <button type="button" className="btn-ghost" onClick={() => addEtapa('video')}>
              <Video className="h-3.5 w-3.5" /> Vídeo
            </button>
          </div>
        </div>
        <div className="p-2 space-y-1">
          {spec.etapas.map((e, i) => (
            <div
              key={e.id}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                i === etapaAtiva ? 'bg-lime/25' : 'hover:bg-dark-teal/5'
              }`}
            >
              <button
                type="button"
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => setEtapaAtiva(i)}
              >
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-dark-teal text-[10px] font-bold text-off-white">
                  {i + 1}
                </span>
                <span className="truncate text-sm font-medium">{e.titulo}</span>
                {e.tipo === 'video' && (
                  <Video className="h-3.5 w-3.5 flex-shrink-0 text-dark-teal/40" />
                )}
                <span className="ml-auto text-[11px] text-dark-teal/40">
                  {e.tipo === 'video' ? `${e.video.travaSegundos}s` : `${e.campos.length} campos`}
                </span>
              </button>
              <button type="button" className="btn-ghost !px-1" onClick={() => moverEtapa(i, -1)} disabled={i === 0}>
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="btn-ghost !px-1"
                onClick={() => moverEtapa(i, 1)}
                disabled={i === spec.etapas.length - 1}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="btn-ghost !px-1 hover:!text-red-600"
                onClick={() => removerEtapa(i)}
                disabled={spec.etapas.length === 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Etapa selecionada ---- */}
      {etapa && (
        <div className="painel">
          <div className="painel-titulo">Etapa {etapaAtiva + 1}</div>
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="campo-builder">Título da etapa</label>
                <input
                  className="input-builder"
                  value={etapa.titulo}
                  onChange={(e) => patchEtapa(etapaAtiva, { titulo: e.target.value })}
                />
              </div>
              <div>
                <label className="campo-builder">Texto do botão</label>
                <input
                  className="input-builder"
                  value={etapa.textoBotao}
                  onChange={(e) => patchEtapa(etapaAtiva, { textoBotao: e.target.value })}
                />
              </div>
            </div>

            {etapa.tipo === 'video' && (
              <div className="space-y-3 rounded-xl bg-soft-green/50 p-3">
                <div>
                  <label className="campo-builder">Embed do vídeo (HTML)</label>
                  <textarea
                    className="input-builder font-mono text-[11px]"
                    rows={3}
                    placeholder='<iframe src="..."></iframe> ou o script do VTurb'
                    value={etapa.video.embedHtml}
                    onChange={(e) =>
                      patchEtapa(etapaAtiva, { video: { ...etapa.video, embedHtml: e.target.value } })
                    }
                  />
                </div>
                <div>
                  <label className="campo-builder">
                    Trava: segundos até liberar o botão ({etapa.video.travaSegundos}s)
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={300}
                    step={5}
                    className="w-full accent-lime"
                    value={etapa.video.travaSegundos}
                    onChange={(e) =>
                      patchEtapa(etapaAtiva, {
                        video: { ...etapa.video, travaSegundos: Number(e.target.value) },
                      })
                    }
                  />
                  <p className="mt-1 text-[11px] text-dark-teal/45">
                    O lead só avança depois desse tempo na etapa. A contagem não reinicia se ele
                    voltar.
                  </p>
                </div>
                <div>
                  <label className="campo-builder">Aviso enquanto bloqueado</label>
                  <input
                    className="input-builder"
                    value={etapa.video.textoBloqueado}
                    onChange={(e) =>
                      patchEtapa(etapaAtiva, {
                        video: { ...etapa.video, textoBloqueado: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="campo-builder">Aviso quando liberar</label>
                  <input
                    className="input-builder"
                    value={etapa.video.textoLiberado}
                    onChange={(e) =>
                      patchEtapa(etapaAtiva, {
                        video: { ...etapa.video, textoLiberado: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Campos da etapa ---- */}
      {etapa && etapa.tipo === 'campos' && (
        <div className="painel">
          <div className="painel-titulo justify-between">
            <span>Campos</span>
            <span className="text-[11px] font-normal text-dark-teal/40">
              {etapa.campos.length} nesta etapa
            </span>
          </div>

          <div className="space-y-2 p-3">
            {etapa.campos.map((campo, i) => (
              <div key={campo.id} className="rounded-xl border border-dark-teal/10">
                <div className="flex items-center gap-1.5 px-2 py-2">
                  <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-dark-teal/20" />
                  <button
                    type="button"
                    className="flex-1 truncate text-left text-sm"
                    onClick={() => setAbertoId(abertoId === campo.id ? null : campo.id)}
                  >
                    <span className="font-medium">{campo.label || '(sem rótulo)'}</span>
                    <span className="ml-2 text-[11px] text-dark-teal/40">
                      {ROTULOS_TIPO[campo.tipo]} · {campo.name || '—'}
                    </span>
                    {nomesRepetidos.has(campo.name) && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                        nome repetido
                      </span>
                    )}
                  </button>
                  <button type="button" className="btn-ghost !px-1" onClick={() => moverCampo(i, -1)} disabled={i === 0}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !px-1"
                    onClick={() => moverCampo(i, 1)}
                    disabled={i === etapa.campos.length - 1}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="btn-ghost !px-1" onClick={() => duplicarCampo(campo)}>
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !px-1 hover:!text-red-600"
                    onClick={() => setCampos(etapa.campos.filter((c) => c.id !== campo.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {abertoId === campo.id && (
                  <EditorCampo campo={campo} onChange={(patch) => patchCampo(campo.id, patch)} />
                )}
              </div>
            ))}

            {etapa.campos.length === 0 && (
              <p className="py-6 text-center text-xs text-dark-teal/40">
                Nenhum campo ainda. Escolha um tipo abaixo.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-dark-teal/10 p-3">
            {(Object.keys(ROTULOS_TIPO) as TipoCampo[]).map((tipo) => (
              <button key={tipo} type="button" className="chip" onClick={() => addCampo(tipo)}>
                <Plus className="h-3 w-3" />
                {ROTULOS_TIPO[tipo]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function EditorCampo({
  campo,
  onChange,
}: {
  campo: Campo
  onChange: (patch: Partial<Campo>) => void
}) {
  const temOpcoes = TIPOS_COM_OPCOES.includes(campo.tipo)

  const setOpcao = (i: number, patch: Partial<{ label: string; slug: string }>) =>
    onChange({ opcoes: campo.opcoes.map((o, j) => (i === j ? { ...o, ...patch } : o)) })

  return (
    <div className="space-y-3 border-t border-dark-teal/10 bg-off-white/60 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="campo-builder">Rótulo / pergunta</label>
          <input
            className="input-builder"
            value={campo.label}
            onChange={(e) => {
              const label = e.target.value
              // Enquanto o nome estiver "automático", ele acompanha o rótulo.
              const auto = !campo.name || campo.name === nomeDeCampo(campo.label)
              onChange(auto ? { label, name: nomeDeCampo(label) } : { label })
            }}
          />
        </div>

        <div>
          <label className="campo-builder">Tipo</label>
          <select
            className="input-builder"
            value={campo.tipo}
            onChange={(e) => {
              const tipo = e.target.value as TipoCampo
              onChange({
                tipo,
                placeholder: placeholderPadrao(tipo),
                opcoes:
                  TIPOS_COM_OPCOES.includes(tipo) && campo.opcoes.length === 0
                    ? [{ label: 'Opção 1', slug: 'opcao-1' }]
                    : campo.opcoes,
              })
            }}
          >
            {(Object.keys(ROTULOS_TIPO) as TipoCampo[]).map((t) => (
              <option key={t} value={t}>
                {ROTULOS_TIPO[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="campo-builder">Nome no CRM (chave do payload)</label>
          <input
            className="input-builder font-mono text-xs"
            value={campo.name}
            onChange={(e) => onChange({ name: nomeDeCampo(e.target.value) })}
          />
        </div>

        {campo.tipo === 'oculto' ? (
          <div className="col-span-2">
            <label className="campo-builder">Valor fixo enviado</label>
            <input
              className="input-builder"
              value={campo.valorFixo}
              onChange={(e) => onChange({ valorFixo: e.target.value })}
            />
          </div>
        ) : (
          <>
            <div>
              <label className="campo-builder">Placeholder</label>
              <input
                className="input-builder"
                value={campo.placeholder}
                onChange={(e) => onChange({ placeholder: e.target.value })}
              />
            </div>
            <div>
              <label className="campo-builder">Largura</label>
              <select
                className="input-builder"
                value={campo.largura}
                onChange={(e) => onChange({ largura: e.target.value as 'cheia' | 'metade' })}
              >
                <option value="cheia">Linha inteira</option>
                <option value="metade">Metade da linha</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="campo-builder">Texto de ajuda (opcional)</label>
              <input
                className="input-builder"
                value={campo.ajuda}
                onChange={(e) => onChange({ ajuda: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="campo-builder">Mensagem de erro</label>
              <input
                className="input-builder"
                placeholder="Deixe vazio para usar a mensagem padrão do tipo"
                value={campo.erro}
                onChange={(e) => onChange({ erro: e.target.value })}
              />
            </div>
          </>
        )}
      </div>

      {campo.tipo !== 'oculto' && (
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-dark-teal/70">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-lime"
            checked={campo.obrigatorio}
            onChange={(e) => onChange({ obrigatorio: e.target.checked })}
          />
          Obrigatório
        </label>
      )}

      {temOpcoes && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="campo-builder !mb-0">Opções</label>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                onChange({
                  opcoes: [
                    ...campo.opcoes,
                    { label: `Opção ${campo.opcoes.length + 1}`, slug: `opcao-${campo.opcoes.length + 1}` },
                  ],
                })
              }
            >
              <Plus className="h-3 w-3" /> Opção
            </button>
          </div>
          <div className="space-y-1.5">
            {campo.opcoes.map((o, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  className="input-builder flex-1"
                  placeholder="Texto que o lead vê (vai assim pro CRM)"
                  value={o.label}
                  onChange={(e) => {
                    const label = e.target.value
                    const auto = !o.slug || o.slug === slugify(o.label)
                    setOpcao(i, auto ? { label, slug: slugify(label) } : { label })
                  }}
                />
                <input
                  className="input-builder w-28 font-mono text-[11px]"
                  placeholder="slug"
                  value={o.slug}
                  onChange={(e) => setOpcao(i, { slug: slugify(e.target.value) })}
                />
                <button
                  type="button"
                  className="btn-ghost !px-1 hover:!text-red-600"
                  onClick={() => onChange({ opcoes: campo.opcoes.filter((_, j) => j !== i) })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-dark-teal/45">
            O <strong>texto</strong> vai inteiro pro CRM; o <strong>slug</strong> é o que o GTM
            recebe no dataLayer.
          </p>
        </div>
      )}
    </div>
  )
}
