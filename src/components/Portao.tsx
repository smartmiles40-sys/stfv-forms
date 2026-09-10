import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'

// ============================================================================
// A PAREDE DO PAINEL.
//
// Pedido do Bruno (10/09): "se a pessoa tira o nome do Forms — exemplo: Peru —
// ela ja tem acesso a pagina principal de todos os forms". Era verdade: quem
// apagava o slug da URL caia no painel inteiro (editor, rascunhos, botao de
// publicar). A lista e os specs nunca vazaram — cada rota /api exige a senha, e
// devolve 401 —, mas a ferramenta ficava a mostra e dava pra ficar tentando
// senha a noite inteira.
//
// Agora nada do painel monta antes de o SERVIDOR confirmar a senha. A conferencia
// e o proprio /api/forms: ele responde 401 com senha errada, 429 depois de 30
// tentativas na mesma hora (o teto entrou junto) e 200 com a lista quando acerta.
// Nao existe "senha certa" decidida aqui dentro — decidir isso no navegador seria
// uma parede pintada, que qualquer um atravessa pelo DevTools.
//
// A chave fica no sessionStorage: fecha a aba, pede de novo. E e a MESMA chave
// que a pagina inicial usa, entao ela ja abre com a lista carregada.
// ============================================================================

export const CHAVE_SENHA = 'stfv_publicar_senha'

type Estado = 'conferindo' | 'pedindo' | 'erro' | 'excesso' | 'liberado' | 'sem-servidor'

export default function Portao({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>('conferindo')
  const [senha, setSenha] = useState('')

  const conferir = useCallback(async (chave: string, deBoot: boolean) => {
    if (!chave) {
      setEstado('pedindo')
      return
    }
    setEstado('conferindo')
    try {
      const resp = await fetch('/api/forms', { headers: { 'x-stfv-senha': chave } })
      if (resp.status === 429) {
        setEstado('excesso')
        return
      }
      if (!resp.ok) {
        sessionStorage.removeItem(CHAVE_SENHA)
        // No boot a senha veio do sessionStorage: dizer "senha incorreta" pra
        // quem nao digitou nada confunde. Pede de novo, sem acusar.
        setEstado(deBoot ? 'pedindo' : 'erro')
        return
      }
      sessionStorage.setItem(CHAVE_SENHA, chave)
      setEstado('liberado')
    } catch {
      // Sem servidor (npm run dev) a rota /api nao existe. Travar aqui deixaria o
      // painel impossivel de desenvolver localmente.
      setEstado(import.meta.env.DEV ? 'sem-servidor' : 'erro')
    }
  }, [])

  useEffect(() => {
    conferir(sessionStorage.getItem(CHAVE_SENHA) ?? '', true)
  }, [conferir])

  if (estado === 'liberado' || estado === 'sem-servidor') {
    return (
      <>
        {estado === 'sem-servidor' && (
          <div className="bg-amber-100 px-4 py-2 text-center text-[12px] text-amber-900">
            Sem servidor: a senha não foi conferida (isto só acontece em <code>npm run dev</code>).
          </div>
        )}
        {children}
      </>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-off-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-dark-teal/10 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-dark-teal">
          <Lock className="h-4 w-4" />
          <h1 className="text-[15px] font-semibold">STFV Forms</h1>
        </div>

        {estado === 'conferindo' ? (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-dark-teal/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Conferindo…
          </p>
        ) : estado === 'excesso' ? (
          <p className="mt-4 text-[13px] leading-snug text-amber-900">
            Muitas tentativas deste computador. Espere alguns minutos e tente de novo.
          </p>
        ) : (
          <>
            <p className="mt-3 text-[13px] leading-snug text-dark-teal/70">
              Área interna. Digite a senha de publicação para entrar.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                type="password"
                autoFocus
                className="input-builder"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && conferir(senha, false)}
                placeholder="••••••••"
              />
              <button type="button" className="btn-acao-lime" onClick={() => conferir(senha, false)}>
                Entrar
              </button>
            </div>
            {estado === 'erro' && (
              <p className="mt-3 text-[12px] text-red-700">Senha incorreta.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
