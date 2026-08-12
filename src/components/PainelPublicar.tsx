import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Copy, ExternalLink, Link2, Loader2 } from 'lucide-react'
import type { FormSpec } from '../types'
import { avisosDoSpec } from '../lib/avisos'

// ============================================================================
// Publicar: manda a CONFIG do formulario pro servidor e recebe o link.
//
// O HTML nao sai daqui — quem gera e o /api/publicar. Se o navegador pudesse
// mandar HTML pronto, quem tivesse a senha hospedaria qualquer pagina no nosso
// dominio. Mandando so a config, o servidor so consegue produzir formulario.
// ============================================================================

const CHAVE_SENHA = 'stfv_publicar_senha'

type Estado =
  | { fase: 'parado' }
  | { fase: 'publicando' }
  | { fase: 'ok'; url: string }
  | { fase: 'erro'; mensagem: string; avisos?: string[] }

/** Traduz o codigo de erro da funcao pra uma frase que diz o que fazer. */
function mensagemDoErro(status: number, erro: string, detalhe?: string): string {
  if (detalhe) return detalhe
  switch (erro) {
    case 'senha_invalida':
      return 'Senha incorreta.'
    case 'nao_configurado':
      return 'O servidor ainda não tem as variáveis de ambiente da publicação (PUBLICAR_SENHA e as do Supabase).'
    case 'falha_ao_gravar':
      return 'O servidor não conseguiu gravar o formulário. Tente de novo em instantes.'
    case 'spec_grande_demais':
      return 'Este formulário está grande demais para publicar.'
    default:
      return `Não consegui publicar (erro ${status}).`
  }
}

export default function PainelPublicar({ spec }: { spec: FormSpec }) {
  const [senha, setSenha] = useState(() => sessionStorage.getItem(CHAVE_SENHA) ?? '')
  const [estado, setEstado] = useState<Estado>({ fase: 'parado' })
  const [copiado, setCopiado] = useState(false)

  // O servidor confere isto de novo. Aqui e so pra nao gastar uma ida ate la e
  // pra o problema aparecer perto de onde se conserta.
  const avisos = useMemo(() => avisosDoSpec(spec), [spec])
  const slug = String(spec.slug ?? '').trim()
  const slugOk = /^[a-z0-9-]{2,40}$/.test(slug)
  const destinoOk = spec.destino.url === '/api/save-lead'
  const podePublicar = avisos.length === 0 && slugOk && destinoOk && senha.length > 0

  const publicar = async () => {
    setEstado({ fase: 'publicando' })
    sessionStorage.setItem(CHAVE_SENHA, senha)
    try {
      const resp = await fetch('/api/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-stfv-senha': senha },
        body: JSON.stringify({ spec }),
      })
      const dados = await resp.json().catch(() => ({}))
      if (!resp.ok || !dados.ok) {
        setEstado({
          fase: 'erro',
          mensagem: mensagemDoErro(resp.status, dados.erro ?? '', dados.detalhe),
          avisos: dados.avisos,
        })
        return
      }
      setEstado({ fase: 'ok', url: dados.url })
    } catch {
      // Em dev o /api nao existe: a funcao so roda na Vercel.
      setEstado({
        fase: 'erro',
        mensagem: import.meta.env.DEV
          ? 'Publicar só funciona no site publicado — em desenvolvimento a função /api não existe. Use o painel hospedado.'
          : 'Não consegui falar com o servidor. Verifique sua conexão.',
      })
    }
  }

  const copiarLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1600)
    } catch {
      /* clipboard bloqueado: da pra selecionar o texto do link */
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-xl">
        <h2 className="text-base font-bold text-dark-teal">Publicar e pegar o link</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-dark-teal/60">
          Gera uma página com este formulário e devolve o endereço pra você mandar pro pessoal.
          Publicar de novo com o mesmo endereço <strong>atualiza</strong> o formulário — o link
          não muda.
        </p>

        <div className="mt-5 rounded-xl border border-dark-teal/10 bg-soft-green/30 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-dark-teal/60">
              Endereço
            </span>
            <span className="text-[11px] text-dark-teal/45">muda em Tracking e destino</span>
          </div>
          <code className="mt-1 block font-mono text-sm font-bold text-dark-teal">
            /f/{slug || '???'}
          </code>
          {!slugOk && (
            <p className="mt-2 text-[12px] leading-snug text-amber-800">
              O endereço precisa ter de 2 a 40 caracteres, só minúsculas, números e hífen.
            </p>
          )}
        </div>

        {!destinoOk && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[12px] leading-snug text-amber-900">
            O destino do lead está como <code className="font-mono">{spec.destino.url}</code>. Um
            formulário publicado aqui precisa enviar para{' '}
            <code className="font-mono">/api/save-lead</code>, que é o backend deste mesmo
            endereço.
          </p>
        )}

        {avisos.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Resolva antes de publicar
            </p>
            <ul className="space-y-1">
              {avisos.map((a, i) => (
                <li key={i} className="text-[12px] leading-snug text-amber-900">
                  · {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="mt-5 block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-dark-teal/60">
            Senha de publicação
          </span>
          <input
            type="password"
            className="input-builder mt-1"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

        <button
          type="button"
          className="btn-acao-lime mt-4 w-full justify-center py-2.5"
          disabled={!podePublicar || estado.fase === 'publicando'}
          onClick={publicar}
        >
          {estado.fase === 'publicando' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Publicando…
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4" />
              Publicar
            </>
          )}
        </button>

        {estado.fase === 'erro' && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-[13px] leading-snug text-red-900">{estado.mensagem}</p>
            {estado.avisos?.length ? (
              <ul className="mt-2 space-y-1">
                {estado.avisos.map((a, i) => (
                  <li key={i} className="text-[12px] leading-snug text-red-900/80">
                    · {a}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        {estado.fase === 'ok' && (
          <div className="mt-4 rounded-xl border border-lime bg-lime/15 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-dark-teal/70">
              No ar
            </p>
            <a
              href={estado.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all font-mono text-sm font-bold text-dark-teal underline decoration-dark-teal/30 underline-offset-2"
            >
              {estado.url}
            </a>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn-acao"
                onClick={() => copiarLink(estado.url)}
              >
                {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiado ? 'Copiado' : 'Copiar link'}
              </button>
              <a href={estado.url} target="_blank" rel="noreferrer" className="btn-acao">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir
              </a>
            </div>
            <p className="mt-3 text-[12px] leading-snug text-dark-teal/60">
              Abra o link e preencha uma vez antes de divulgar: é o teste que prova que o lead
              chega no destino certo.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
