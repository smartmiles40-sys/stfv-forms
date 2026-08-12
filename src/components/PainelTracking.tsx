import { CornerDownRight, Plus, Trash2 } from 'lucide-react'
import type { FormSpec } from '../types'
import { CLICK_IDS_DISPONIVEIS, UTMS_DISPONIVEIS } from '../types'
import { todosOsCampos, uid } from '../lib/util'

// ============================================================================
// Painel de tracking e destino. Aqui mora a parte que o Bitrix Forms nao dava:
// escolher exatamente qual atribuicao viaja junto com o lead.
// ============================================================================

type Props = { spec: FormSpec; onChange: (spec: FormSpec) => void }

export default function PainelTracking({ spec, onChange }: Props) {
  const t = spec.tracking
  const d = spec.destino
  const setT = (patch: Partial<FormSpec['tracking']>) =>
    onChange({ ...spec, tracking: { ...t, ...patch } })
  const setD = (patch: Partial<FormSpec['destino']>) =>
    onChange({ ...spec, destino: { ...d, ...patch } })

  const alternar = (lista: string[], chave: string) =>
    lista.includes(chave) ? lista.filter((k) => k !== chave) : [...lista, chave]

  // So campo de escolha serve de gatilho: a regra compara com o label da opcao.
  const camposDeEscolha = todosOsCampos(spec).filter(
    (c) => c.name && (c.tipo === 'radio' || c.tipo === 'select'),
  )
  const regras = d.regrasSaida ?? []
  const setRegras = (novas: FormSpec['destino']['regrasSaida']) => setD({ regrasSaida: novas })

  return (
    <div className="space-y-4">
      {/* ---- Tracking ---- */}
      <div className="painel">
        <div className="painel-titulo">Rastreamento (UTMs)</div>
        <div className="space-y-4 p-4">
          <div>
            <label className="campo-builder">Parâmetros UTM capturados da URL</label>
            <div className="flex flex-wrap gap-1.5">
              {UTMS_DISPONIVEIS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`chip font-mono ${t.utms.includes(k) ? 'chip-on' : ''}`}
                  onClick={() => setT({ utms: alternar(t.utms, k) })}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="campo-builder">Click IDs</label>
            <div className="flex flex-wrap gap-1.5">
              {CLICK_IDS_DISPONIVEIS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`chip font-mono ${t.clickIds.includes(k) ? 'chip-on' : ''}`}
                  onClick={() => setT({ clickIds: alternar(t.clickIds, k) })}
                >
                  {k}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-dark-teal/45">
              Única âncora de atribuição quando a campanha não taggeia UTM — o autotagging do Google
              manda só <code className="font-mono">gclid</code>.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 accent-lime"
              checked={t.firstTouch}
              onChange={(e) => setT({ firstTouch: e.target.checked })}
            />
            <span>
              <strong>First-touch por aba</strong>
              <span className="mt-0.5 block text-dark-teal/50">
                Guarda a atribuição no sessionStorage: quem chegou primeiro manda, e a origem
                sobrevive a recarga e navegação interna. Sem isso, um pulo de página zera a UTM.
              </span>
            </span>
          </label>

          <div>
            <label className="campo-builder">
              Valor de <code className="font-mono">utm_content</code> quando a visita não vem
              taggeada
            </label>
            <input
              className="input-builder font-mono"
              placeholder="ex.: v4, bio, stfv (vazio = não preenche)"
              value={t.fallbackUtmContent}
              onChange={(e) => setT({ fallbackUtmContent: e.target.value })}
            />
            <p className="mt-1.5 text-[11px] text-dark-teal/45">
              Derivado, não gravado: se o lead voltar por um link taggeado, o valor real vence.
            </p>
          </div>
        </div>
      </div>

      {/* ---- GTM ---- */}
      <div className="painel">
        <div className="painel-titulo">Google Tag Manager</div>
        <div className="space-y-3 p-4">
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 accent-lime"
              checked={t.dataLayer}
              onChange={(e) => setT({ dataLayer: e.target.checked })}
            />
            <span>
              <strong>Emitir eventos no dataLayer</strong>
              <span className="mt-0.5 block text-dark-teal/50">
                form_step_view · form_step_complete · form_step_back · form_validation_error ·
                form_video_unlocked
              </span>
            </span>
          </label>

          {t.dataLayer && (
            <>
              <div>
                <label className="campo-builder">Evento de conversão (envio concluído)</label>
                <input
                  className="input-builder font-mono"
                  value={t.eventoConversao}
                  onChange={(e) => setT({ eventoConversao: e.target.value })}
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 accent-lime"
                  checked={t.inputsOcultos}
                  onChange={(e) => setT({ inputsOcultos: e.target.checked })}
                />
                <span>
                  <strong>Campos ocultos com lead_id e UTMs no HTML</strong>
                  <span className="mt-0.5 block text-dark-teal/50">
                    Contrato com o GTM: triggers que leem o formulário dependem desses inputs.
                  </span>
                </span>
              </label>
            </>
          )}
        </div>
      </div>

      {/* ---- Destino ---- */}
      <div className="painel">
        <div className="painel-titulo">Para onde vai o lead</div>
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-xl border p-3 text-left transition-colors ${
                d.modo === 'endpoint'
                  ? 'border-lime-dark bg-lime/15'
                  : 'border-dark-teal/15 hover:border-dark-teal/30'
              }`}
              onClick={() => setD({ modo: 'endpoint', url: '/api/save-lead' })}
            >
              <span className="block text-xs font-bold">Endpoint do site</span>
              <span className="mt-1 block text-[11px] leading-snug text-dark-teal/55">
                POST em /api/save-lead. O backend valida, roteia pro n8n e grava no ledger.
              </span>
            </button>
            <button
              type="button"
              className={`rounded-xl border p-3 text-left transition-colors ${
                d.modo === 'webhook'
                  ? 'border-lime-dark bg-lime/15'
                  : 'border-dark-teal/15 hover:border-dark-teal/30'
              }`}
              onClick={() => setD({ modo: 'webhook' })}
            >
              <span className="block text-xs font-bold">Webhook direto</span>
              <span className="mt-1 block text-[11px] leading-snug text-dark-teal/55">
                POST direto no n8n. Sem backend — a URL fica visível no código do site.
              </span>
            </button>
          </div>

          <div>
            <label className="campo-builder">
              {d.modo === 'endpoint' ? 'Caminho do endpoint' : 'URL do webhook n8n'}
            </label>
            <input
              className="input-builder font-mono text-xs"
              value={d.url}
              onChange={(e) => setD({ url: e.target.value })}
              placeholder={
                d.modo === 'endpoint' ? '/api/save-lead' : 'https://n8n…/webhook/<id>'
              }
            />
            {d.modo === 'webhook' && (
              <p className="mt-1.5 text-[11px] text-red-600/80">
                Atenção: a URL do webhook fica exposta no bundle do site e o navegador precisa que o
                n8n aceite CORS. Prefira o endpoint quando o site for da agência.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="campo-builder">form_name</label>
              <input
                className="input-builder font-mono text-xs"
                value={d.formName}
                onChange={(e) => setD({ formName: e.target.value })}
              />
            </div>
            <div>
              <label className="campo-builder">slug (roteia o webhook)</label>
              <input
                className="input-builder font-mono text-xs"
                value={d.slug}
                onChange={(e) => setD({ slug: e.target.value })}
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="campo-builder !mb-0">Campos fixos enviados sempre</label>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  setD({ camposFixos: [...d.camposFixos, { id: uid('fixo'), name: '', valor: '' }] })
                }
              >
                <Plus className="h-3 w-3" /> Campo
              </button>
            </div>
            <div className="space-y-1.5">
              {d.camposFixos.map((f) => (
                <div key={f.id} className="flex items-center gap-1.5">
                  <input
                    className="input-builder w-32 font-mono text-[11px]"
                    placeholder="nome"
                    value={f.name}
                    onChange={(e) =>
                      setD({
                        camposFixos: d.camposFixos.map((x) =>
                          x.id === f.id ? { ...x, name: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <input
                    className="input-builder flex-1"
                    placeholder="valor"
                    value={f.valor}
                    onChange={(e) =>
                      setD({
                        camposFixos: d.camposFixos.map((x) =>
                          x.id === f.id ? { ...x, valor: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn-ghost !px-1 hover:!text-red-600"
                    onClick={() => setD({ camposFixos: d.camposFixos.filter((x) => x.id !== f.id) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-dark-teal/45">
              É aqui que entram <code className="font-mono">expedicao</code>,{' '}
              <code className="font-mono">fonte</code> e <code className="font-mono">source_id</code>{' '}
              — o Bitrix resolve a origem pelo source_id, e o ledger grava a fonte como texto.
            </p>
          </div>
        </div>
      </div>

      {/* ---- Pós-envio ---- */}
      <div className="painel">
        <div className="painel-titulo">Depois do envio</div>
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-xl border p-3 text-left transition-colors ${
                d.aposEnvio === 'redirect'
                  ? 'border-lime-dark bg-lime/15'
                  : 'border-dark-teal/15 hover:border-dark-teal/30'
              }`}
              onClick={() => setD({ aposEnvio: 'redirect' })}
            >
              <span className="block text-xs font-bold">Redirecionar</span>
              <span className="mt-1 block text-[11px] text-dark-teal/55">
                Manda pra uma página de obrigado.
              </span>
            </button>
            <button
              type="button"
              className={`rounded-xl border p-3 text-left transition-colors ${
                d.aposEnvio === 'mensagem'
                  ? 'border-lime-dark bg-lime/15'
                  : 'border-dark-teal/15 hover:border-dark-teal/30'
              }`}
              onClick={() => setD({ aposEnvio: 'mensagem' })}
            >
              <span className="block text-xs font-bold">Mensagem na página</span>
              <span className="mt-1 block text-[11px] text-dark-teal/55">
                Troca o formulário por um agradecimento.
              </span>
            </button>
          </div>

          {d.aposEnvio === 'redirect' ? (
            <div className="space-y-3">
              <div>
                <label className="campo-builder">
                  URL de destino {regras.length > 0 && <span className="font-normal">(padrão)</span>}
                </label>
                <input
                  className="input-builder font-mono text-xs"
                  value={d.redirectUrl}
                  onChange={(e) => setD({ redirectUrl: e.target.value })}
                />
                {regras.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-dark-teal/45">
                    Vale quando nenhuma regra abaixo bate.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-dark-teal/15 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="campo-builder !mb-0">Saída conforme a resposta</label>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={camposDeEscolha.length === 0}
                    onClick={() =>
                      setRegras([
                        ...regras,
                        {
                          id: uid('regra'),
                          campo: camposDeEscolha[0]?.name ?? '',
                          valor: camposDeEscolha[0]?.opcoes[0]?.label ?? '',
                          url: '',
                          whatsapp: false,
                        },
                      ])
                    }
                  >
                    <Plus className="h-3 w-3" /> Regra
                  </button>
                </div>

                {camposDeEscolha.length === 0 ? (
                  <p className="text-[11px] text-dark-teal/45">
                    Precisa de um campo de escolha (radio ou lista) para servir de gatilho. Crie um
                    na aba Campos.
                  </p>
                ) : regras.length === 0 ? (
                  <p className="text-[11px] text-dark-teal/45">
                    Sem regras: todo mundo cai na URL de destino acima.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {regras.map((regra) => {
                      const campo = camposDeEscolha.find((c) => c.name === regra.campo)
                      return (
                        <div
                          key={regra.id}
                          className="rounded-lg bg-off-white p-2 text-[11px] space-y-1.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-dark-teal/50">Se</span>
                            <select
                              className="input-builder flex-1 font-mono text-[11px]"
                              value={regra.campo}
                              onChange={(e) => {
                                const novo = camposDeEscolha.find((c) => c.name === e.target.value)
                                setRegras(
                                  regras.map((x) =>
                                    x.id === regra.id
                                      ? {
                                          ...x,
                                          campo: e.target.value,
                                          valor: novo?.opcoes[0]?.label ?? '',
                                        }
                                      : x,
                                  ),
                                )
                              }}
                            >
                              {camposDeEscolha.map((c) => (
                                <option key={c.id} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <span className="text-dark-teal/50">=</span>
                            <select
                              className="input-builder flex-1 text-[11px]"
                              value={regra.valor}
                              onChange={(e) =>
                                setRegras(
                                  regras.map((x) =>
                                    x.id === regra.id ? { ...x, valor: e.target.value } : x,
                                  ),
                                )
                              }
                            >
                              {(campo?.opcoes ?? []).map((o, i) => (
                                <option key={`${o.slug}-${i}`} value={o.label}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn-ghost !px-1 hover:!text-red-600"
                              onClick={() => setRegras(regras.filter((x) => x.id !== regra.id))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CornerDownRight
                              className="h-3.5 w-3.5 flex-shrink-0 text-dark-teal/40"
                              aria-hidden
                            />
                            <input
                              className="input-builder flex-1 font-mono text-[11px]"
                              placeholder="https://wa.me/55… ou https://instagram.com/…"
                              value={regra.url}
                              onChange={(e) =>
                                setRegras(
                                  regras.map((x) =>
                                    x.id === regra.id ? { ...x, url: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                            <label
                              className="flex flex-shrink-0 cursor-pointer items-center gap-1"
                              title="Preenche a mensagem do wa.me antes de sair"
                            >
                              <input
                                type="checkbox"
                                className="h-3 w-3 accent-lime"
                                checked={regra.whatsapp}
                                onChange={(e) =>
                                  setRegras(
                                    regras.map((x) =>
                                      x.id === regra.id ? { ...x, whatsapp: e.target.checked } : x,
                                    ),
                                  )
                                }
                              />
                              wa
                            </label>
                          </div>
                        </div>
                      )
                    })}
                    <p className="text-[11px] text-dark-teal/45">
                      A primeira regra que bate leva o lead. O envio pro CRM acontece antes e não
                      depende disso — quem cai na saída "não" também é lead.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="campo-builder">Título</label>
                <input
                  className="input-builder"
                  value={d.mensagemTitulo}
                  onChange={(e) => setD({ mensagemTitulo: e.target.value })}
                />
              </div>
              <div>
                <label className="campo-builder">Texto</label>
                <input
                  className="input-builder"
                  value={d.mensagemTexto}
                  onChange={(e) => setD({ mensagemTexto: e.target.value })}
                />
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 accent-lime"
              checked={d.whatsappHandoff}
              onChange={(e) => setD({ whatsappHandoff: e.target.checked })}
            />
            <span>
              <strong>Preparar a passagem pro WhatsApp</strong>
              <span className="mt-0.5 block text-dark-teal/50">
                Deixa a mensagem pronta no sessionStorage (chave{' '}
                <code className="font-mono">stfv_wa_msg</code>) pra página de obrigado montar o
                wa.me.
              </span>
            </span>
          </label>

          {d.whatsappHandoff && (
            <div>
              <label className="campo-builder">Mensagem</label>
              <textarea
                className="input-builder"
                rows={3}
                value={d.whatsappMensagem}
                onChange={(e) => setD({ whatsappMensagem: e.target.value })}
              />
              <p className="mt-1.5 text-[11px] text-dark-teal/45">
                Use <code className="font-mono">{'{nome}'}</code> — ou o nome de qualquer campo entre
                chaves — para inserir a resposta do lead.
              </p>
            </div>
          )}

          <div>
            <label className="campo-builder">Mensagem de erro no envio</label>
            <input
              className="input-builder"
              value={d.erroEnvio}
              onChange={(e) => setD({ erroEnvio: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* ---- Aparência ---- */}
      <div className="painel">
        <div className="painel-titulo">Aparência</div>
        <div className="space-y-2 p-4">
          {(
            [
              ['indicadorEtapas', 'Bolinhas numeradas de etapa'],
              ['rotuloEtapa', 'Rótulo "Etapa X de Y · título"'],
              ['cartao', 'Cartão branco com sombra'],
            ] as const
          ).map(([chave, rotulo]) => (
            <label key={chave} className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-lime"
                checked={spec.aparencia[chave]}
                onChange={(e) =>
                  onChange({ ...spec, aparencia: { ...spec.aparencia, [chave]: e.target.checked } })
                }
              />
              {rotulo}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
