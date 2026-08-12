import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Code2,
  Eye,
  FileDown,
  FilePlus2,
  FileUp,
  Monitor,
  Save,
  Smartphone,
  Trash2,
} from 'lucide-react'
import type { FormSpec } from './types'
import { PRESETS, presetExpedicao } from './defaults'
import FormRenderer from './components/FormRenderer'
import PainelCampos from './components/PainelCampos'
import PainelTracking from './components/PainelTracking'
import PainelExportar from './components/PainelExportar'
import { apagarForm, listarForms, lerUltimoId, marcarAberto, salvarForm } from './lib/storage'
import { baixarArquivo, uid } from './lib/util'

// ============================================================================
// Gerador de formularios da Se Tu For, Eu Vou! Viagens.
//
// Tres colunas: estrutura/config a esquerda, preview no meio-direita, codigo
// gerado na mesma area (alternavel). O preview NAO e uma maquete: e o mesmo
// motor de formulario que o codigo exportado usa.
// ============================================================================

type Painel = 'estrutura' | 'tracking'
type Vista = 'preview' | 'codigo'

export default function App() {
  const [spec, setSpec] = useState<FormSpec>(() => {
    const salvos = listarForms()
    const ultimo = lerUltimoId()
    return salvos.find((f) => f.id === ultimo) ?? salvos[0] ?? presetExpedicao()
  })
  const [painel, setPainel] = useState<Painel>('estrutura')
  const [vista, setVista] = useState<Vista>('preview')
  const [etapaAtiva, setEtapaAtiva] = useState(0)
  const [largura, setLargura] = useState<'desktop' | 'mobile'>('desktop')
  const [salvo, setSalvo] = useState(false)
  const [lista, setLista] = useState<FormSpec[]>(() => listarForms())
  const inputArquivo = useRef<HTMLInputElement>(null)

  // Salvamento automatico: o rascunho nunca se perde ao fechar a aba.
  useEffect(() => {
    const id = setTimeout(() => {
      salvarForm(spec)
      setLista(listarForms())
    }, 600)
    return () => clearTimeout(id)
  }, [spec])

  const salvarAgora = useCallback(() => {
    salvarForm(spec)
    setLista(listarForms())
    setSalvo(true)
    setTimeout(() => setSalvo(false), 1600)
  }, [spec])

  const abrir = useCallback((id: string) => {
    const alvo = listarForms().find((f) => f.id === id)
    if (!alvo) return
    setSpec(alvo)
    marcarAberto(id)
    setEtapaAtiva(0)
  }, [])

  const novo = useCallback((criar: () => FormSpec) => {
    const s = criar()
    setSpec(s)
    salvarForm(s)
    setLista(listarForms())
    setEtapaAtiva(0)
  }, [])

  const importar = useCallback((arquivo: File) => {
    const leitor = new FileReader()
    leitor.onload = () => {
      try {
        const dados = JSON.parse(String(leitor.result)) as FormSpec
        if (!Array.isArray(dados.etapas)) throw new Error('formato')
        // Id novo: importar nunca sobrescreve um form existente.
        const s = { ...dados, id: uid('form'), nome: `${dados.nome} (importado)` }
        setSpec(s)
        salvarForm(s)
        setLista(listarForms())
      } catch {
        alert('Arquivo inválido. Use um JSON exportado por este gerador.')
      }
    }
    leitor.readAsText(arquivo)
  }, [])

  // Avisos: coisas que passam despercebidas e quebram o lead lá na frente.
  const avisos = useMemo(() => {
    const lista: string[] = []
    const campos = spec.etapas.flatMap((e) => e.campos)
    const nomes = campos.map((c) => c.name)

    const semNome = campos.filter((c) => !c.name.trim()).length
    if (semNome) lista.push(`${semNome} campo(s) sem nome — não chegam ao CRM.`)

    const repetidos = [...new Set(nomes.filter((n, i) => n && nomes.indexOf(n) !== i))]
    if (repetidos.length)
      lista.push(`Nome repetido: ${repetidos.join(', ')} — um sobrescreve o outro no payload.`)

    if (!nomes.includes('nome') || !nomes.includes('whatsapp'))
      lista.push('Sem campo "nome" ou "whatsapp" — o backend rejeita o lead na validação.')

    const semOpcoes = campos.filter(
      (c) => ['radio', 'select', 'checkbox'].includes(c.tipo) && c.opcoes.length === 0,
    )
    if (semOpcoes.length) lista.push(`${semOpcoes.length} campo(s) de escolha sem opções.`)

    if (!spec.destino.url.trim()) lista.push('Destino do lead vazio.')
    if (!spec.destino.formName.trim()) lista.push('form_name vazio — o n8n roteia por ele.')

    const videoSemEmbed = spec.etapas.filter((e) => e.tipo === 'video' && !e.video.embedHtml.trim())
    if (videoSemEmbed.length) lista.push('Etapa de vídeo sem embed.')

    return lista
  }, [spec])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-off-white">
      {/* ==== Barra superior ==== */}
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-dark-teal/10 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-dark-teal text-[11px] font-black text-lime">
            SF
          </span>
          <span className="text-sm font-bold">Gerador de Formulários</span>
        </div>

        <input
          className="input-builder ml-2 !w-56"
          value={spec.nome}
          onChange={(e) => setSpec({ ...spec, nome: e.target.value })}
          placeholder="Nome do formulário"
        />

        <select
          className="input-builder !w-44 text-xs"
          value={spec.id}
          onChange={(e) => abrir(e.target.value)}
        >
          {lista.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
          {!lista.some((f) => f.id === spec.id) && <option value={spec.id}>{spec.nome}</option>}
        </select>

        <div className="ml-auto flex items-center gap-1.5">
          <select
            className="input-builder !w-auto text-xs"
            value=""
            onChange={(e) => {
              const preset = PRESETS.find((p) => p.chave === e.target.value)
              if (preset) novo(preset.criar)
              e.target.value = ''
            }}
          >
            <option value="">+ Novo formulário…</option>
            {PRESETS.map((p) => (
              <option key={p.chave} value={p.chave}>
                {p.rotulo}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => inputArquivo.current?.click()}
            title="Importar JSON"
          >
            <FileUp className="h-3.5 w-3.5" /> Importar
          </button>
          <input
            ref={inputArquivo}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importar(f)
              e.target.value = ''
            }}
          />

          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              baixarArquivo(`${spec.destino.slug || 'form'}.stfv.json`, JSON.stringify(spec, null, 2))
            }
            title="Exportar JSON"
          >
            <FileDown className="h-3.5 w-3.5" /> Exportar
          </button>

          <button
            type="button"
            className="btn-ghost hover:!text-red-600"
            onClick={() => {
              if (lista.length <= 1) return
              if (!confirm(`Apagar "${spec.nome}"? Isso não pode ser desfeito.`)) return
              apagarForm(spec.id)
              const restantes = listarForms()
              setLista(restantes)
              setSpec(restantes[0] ?? presetExpedicao())
            }}
            disabled={lista.length <= 1}
            title="Apagar formulário"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <button type="button" className="btn-acao" onClick={salvarAgora}>
            {salvo ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {salvo ? 'Salvo' : 'Salvar'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ==== Coluna esquerda: configuração ==== */}
        <aside className="flex w-[400px] flex-shrink-0 flex-col border-r border-dark-teal/10 bg-off-white">
          <div className="flex gap-1 border-b border-dark-teal/10 bg-white px-3 py-2">
            <button
              type="button"
              className={`aba flex-1 ${painel === 'estrutura' ? 'aba-on' : ''}`}
              onClick={() => setPainel('estrutura')}
            >
              <FilePlus2 className="mr-1 inline h-3.5 w-3.5" />
              Campos
            </button>
            <button
              type="button"
              className={`aba flex-1 ${painel === 'tracking' ? 'aba-on' : ''}`}
              onClick={() => setPainel('tracking')}
            >
              <Code2 className="mr-1 inline h-3.5 w-3.5" />
              Tracking e destino
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {painel === 'estrutura' ? (
              <PainelCampos
                spec={spec}
                onChange={setSpec}
                etapaAtiva={etapaAtiva}
                setEtapaAtiva={setEtapaAtiva}
              />
            ) : (
              <PainelTracking spec={spec} onChange={setSpec} />
            )}
          </div>

          {avisos.length > 0 && (
            <div className="flex-shrink-0 border-t border-amber-300/60 bg-amber-50 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Antes de publicar
              </p>
              <ul className="space-y-1">
                {avisos.map((a, i) => (
                  <li key={i} className="text-[11px] leading-snug text-amber-900">
                    · {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* ==== Coluna direita: preview / código ==== */}
        <main className="flex min-w-0 flex-1 flex-col bg-white">
          <div className="flex flex-shrink-0 items-center gap-1 border-b border-dark-teal/10 px-3 py-2">
            <button
              type="button"
              className={`aba ${vista === 'preview' ? 'aba-on' : ''}`}
              onClick={() => setVista('preview')}
            >
              <Eye className="mr-1 inline h-3.5 w-3.5" />
              Preview
            </button>
            <button
              type="button"
              className={`aba ${vista === 'codigo' ? 'aba-on' : ''}`}
              onClick={() => setVista('codigo')}
            >
              <Code2 className="mr-1 inline h-3.5 w-3.5" />
              Código gerado
            </button>

            {vista === 'preview' && (
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  className={`btn-ghost ${largura === 'desktop' ? '!text-dark-teal' : ''}`}
                  onClick={() => setLargura('desktop')}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={`btn-ghost ${largura === 'mobile' ? '!text-dark-teal' : ''}`}
                  onClick={() => setLargura('mobile')}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {vista === 'preview' ? (
            <div className="flex-1 overflow-y-auto bg-soft-green/30 p-8">
              <div
                className={`mx-auto transition-[max-width] ${
                  largura === 'mobile' ? 'max-w-[380px]' : 'max-w-2xl'
                }`}
              >
                <FormRenderer key={spec.id} spec={spec} simulado />
                <p className="mt-4 text-center text-[11px] text-dark-teal/40">
                  Preview real: valida, mascara e trava igual ao formulário publicado. Só não envia
                  nada.
                </p>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              <PainelExportar spec={spec} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
