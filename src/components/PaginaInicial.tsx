import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  FilePlus2,
  Globe,
  Loader2,
  PencilLine,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import type { FormSpec } from '../types'
import { PRESETS } from '../defaults'

// ============================================================================
// Pagina inicial: o que existe hoje, num lugar so.
//
// Duas listas de propósito, porque sao coisas diferentes e confundi-las custa
// caro: PUBLICADO esta no ar e tem link vivo; RASCUNHO existe so neste
// navegador e ninguem consegue acessar. O mesmo formulario pode estar nos dois.
// ============================================================================

const CHAVE_SENHA = 'stfv_publicar_senha'

export type FormPublicado = {
  slug: string
  nome: string
  publicado_em: string
  atualizado_em: string
}

type Estado =
  | { fase: 'sem-senha' }
  | { fase: 'carregando' }
  | { fase: 'ok'; forms: FormPublicado[] }
  | { fase: 'erro'; mensagem: string }

function quando(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function PaginaInicial({
  rascunhos,
  onAbrirRascunho,
  onApagarRascunho,
  onNovo,
  onEditarPublicado,
}: {
  rascunhos: FormSpec[]
  onAbrirRascunho: (id: string) => void
  onApagarRascunho: (id: string) => void
  onNovo: (criar: () => FormSpec) => void
  onEditarPublicado: (spec: FormSpec) => void
}) {
  const [senha, setSenha] = useState(() => sessionStorage.getItem(CHAVE_SENHA) ?? '')
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })
  const [copiado, setCopiado] = useState('')
  const [abrindo, setAbrindo] = useState('')

  const carregar = useCallback(async (chave: string) => {
    if (!chave) {
      setEstado({ fase: 'sem-senha' })
      return
    }
    setEstado({ fase: 'carregando' })
    try {
      const resp = await fetch('/api/forms', { headers: { 'x-stfv-senha': chave } })
      if (resp.status === 401) {
        setEstado({ fase: 'erro', mensagem: 'Senha incorreta.' })
        return
      }
      if (resp.status === 503) {
        setEstado({
          fase: 'erro',
          mensagem: 'O servidor ainda não tem as variáveis de ambiente da publicação.',
        })
        return
      }
      const dados = await resp.json()
      if (!resp.ok || !dados.ok) {
        setEstado({ fase: 'erro', mensagem: `Não consegui carregar (erro ${resp.status}).` })
        return
      }
      sessionStorage.setItem(CHAVE_SENHA, chave)
      setEstado({ fase: 'ok', forms: dados.forms ?? [] })
    } catch {
      setEstado({
        fase: 'erro',
        mensagem: import.meta.env.DEV
          ? 'A lista só funciona no site publicado — em desenvolvimento a função /api não existe.'
          : 'Não consegui falar com o servidor.',
      })
    }
  }, [])

  useEffect(() => {
    carregar(senha)
    // Só na montagem: depois é o botão que recarrega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copiar = async (url: string, slug: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(slug)
      setTimeout(() => setCopiado(''), 1600)
    } catch {
      /* clipboard bloqueado: da pra selecionar o link */
    }
  }

  /** Traz o spec do servidor e abre no editor. */
  const editar = async (slug: string) => {
    setAbrindo(slug)
    try {
      const resp = await fetch(`/api/forms?slug=${encodeURIComponent(slug)}`, {
        headers: { 'x-stfv-senha': senha },
      })
      const dados = await resp.json()
      if (!resp.ok || !dados.ok) {
        alert('Não consegui abrir este formulário.')
        return
      }
      onEditarPublicado(dados.form.spec as FormSpec)
    } catch {
      alert('Não consegui falar com o servidor.')
    } finally {
      setAbrindo('')
    }
  }

  const publicados = estado.fase === 'ok' ? estado.forms : []
  const slugsPublicados = new Set(publicados.map((f) => f.slug))

  return (
    <div className="flex-1 overflow-auto bg-off-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-bold text-dark-teal">Seus formulários</h1>
        <p className="mt-1 text-sm text-dark-teal/60">
          O que está no ar e o que ainda é rascunho neste computador.
        </p>

        {/* ==== Publicados ==== */}
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-dark-teal/50" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-dark-teal/70">
              No ar
            </h2>
            {estado.fase === 'ok' && (
              <span className="rounded-full bg-dark-teal/8 px-2 py-0.5 text-[11px] font-bold text-dark-teal/60">
                {publicados.length}
              </span>
            )}
            <button
              type="button"
              className="btn-ghost ml-auto"
              onClick={() => carregar(senha)}
              disabled={estado.fase === 'carregando'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${estado.fase === 'carregando' ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {estado.fase === 'sem-senha' && (
            <div className="rounded-xl border border-dark-teal/10 bg-white p-5">
              <p className="text-[13px] text-dark-teal/70">
                Digite a senha de publicação para ver os formulários que estão no ar.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  className="input-builder"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && carregar(senha)}
                  placeholder="••••••••"
                />
                <button type="button" className="btn-acao-lime" onClick={() => carregar(senha)}>
                  Ver
                </button>
              </div>
            </div>
          )}

          {estado.fase === 'carregando' && (
            <div className="flex items-center gap-2 rounded-xl border border-dark-teal/10 bg-white p-5 text-[13px] text-dark-teal/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          )}

          {estado.fase === 'erro' && (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4">
              <p className="flex items-start gap-2 text-[13px] leading-snug text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {estado.mensagem}
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  className="input-builder"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && carregar(senha)}
                  placeholder="Senha de publicação"
                />
                <button type="button" className="btn-acao" onClick={() => carregar(senha)}>
                  Tentar de novo
                </button>
              </div>
            </div>
          )}

          {estado.fase === 'ok' && publicados.length === 0 && (
            <p className="rounded-xl border border-dashed border-dark-teal/20 bg-white p-6 text-center text-[13px] text-dark-teal/50">
              Nenhum formulário publicado ainda. Monte um e use a aba <strong>Publicar</strong>.
            </p>
          )}

          <div className="space-y-2">
            {publicados.map((f) => {
              const url = `${window.location.origin}/f/${f.slug}`
              return (
                <div
                  key={f.slug}
                  className="rounded-xl border border-dark-teal/10 bg-white p-4 transition-colors hover:border-dark-teal/25"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-bold text-dark-teal">{f.nome || f.slug}</span>
                    <span className="rounded bg-lime/25 px-1.5 py-0.5 font-mono text-[11px] font-bold text-dark-teal">
                      /f/{f.slug}
                    </span>
                    <span className="ml-auto text-[11px] text-dark-teal/45">
                      atualizado {quando(f.atualizado_em)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn-acao" onClick={() => copiar(url, f.slug)}>
                      {copiado === f.slug ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiado === f.slug ? 'Copiado' : 'Copiar link'}
                    </button>
                    <a href={url} target="_blank" rel="noreferrer" className="btn-acao">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir
                    </a>
                    <button
                      type="button"
                      className="btn-acao"
                      onClick={() => editar(f.slug)}
                      disabled={abrindo === f.slug}
                    >
                      {abrindo === f.slug ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PencilLine className="h-3.5 w-3.5" />
                      )}
                      Editar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ==== Rascunhos locais ==== */}
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <PencilLine className="h-4 w-4 text-dark-teal/50" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-dark-teal/70">
              Rascunhos neste computador
            </h2>
            <span className="rounded-full bg-dark-teal/8 px-2 py-0.5 text-[11px] font-bold text-dark-teal/60">
              {rascunhos.length}
            </span>
          </div>
          <p className="mb-3 text-[12px] leading-snug text-dark-teal/55">
            Ficam salvos só neste navegador — ninguém acessa por link enquanto você não publicar.
          </p>

          <div className="space-y-2">
            {rascunhos.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-dark-teal/10 bg-white p-3"
              >
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => onAbrirRascunho(r.id)}
                >
                  <span className="text-sm font-bold text-dark-teal">{r.nome}</span>
                  <span className="ml-2 font-mono text-[11px] text-dark-teal/45">
                    /f/{r.slug}
                  </span>
                  {slugsPublicados.has(r.slug) && (
                    <span className="ml-2 rounded bg-lime/25 px-1.5 py-0.5 text-[10px] font-bold text-dark-teal">
                      já publicado
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="btn-acao"
                  onClick={() => onAbrirRascunho(r.id)}
                >
                  Abrir
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-dark-teal/40 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="Apagar rascunho"
                  onClick={() => {
                    if (confirm(`Apagar o rascunho "${r.nome}"? O que já está no ar continua no ar.`))
                      onApagarRascunho(r.id)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ==== Novo ==== */}
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <FilePlus2 className="h-4 w-4 text-dark-teal/50" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-dark-teal/70">
              Começar um novo
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESETS.map((p) => (
              <button
                key={p.chave}
                type="button"
                className="rounded-xl border border-dark-teal/10 bg-white p-4 text-left transition-colors hover:border-lime hover:bg-lime/5"
                onClick={() => onNovo(p.criar)}
              >
                <span className="block text-sm font-bold text-dark-teal">{p.rotulo}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
