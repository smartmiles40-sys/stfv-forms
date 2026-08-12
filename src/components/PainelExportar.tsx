import { useMemo, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import type { FormSpec } from '../types'
import { gerarReactTsx } from '../generators/reactTsx'
import { gerarHtml } from '../generators/htmlPuro'
import { gerarApiSaveLead } from '../generators/apiSaveLead'
import { cssPuro, cssTailwind } from '../generators/cssIdentidade'
import { baixarArquivo } from '../lib/util'

// ============================================================================
// Saidas do gerador. Cada aba e um arquivo pronto pra colar num repo.
// ============================================================================

type Aba = 'tsx' | 'html' | 'api' | 'css' | 'json'

const ABAS: { chave: Aba; rotulo: string; arquivo: (s: FormSpec) => string; nota: string }[] = [
  {
    chave: 'tsx',
    rotulo: 'React (.tsx)',
    arquivo: () => 'FormularioLead.tsx',
    nota: 'Componente pro repo da LP. Salve em src/components/ e use <FormularioLead /> na seção do formulário.',
  },
  {
    chave: 'html',
    rotulo: 'HTML',
    arquivo: (s) => `${s.destino.slug || 'formulario'}.html`,
    nota: 'Página autocontida: CSS da marca + JS puro, sem build e sem dependência. Abra no navegador pra testar, ou cole o trecho marcado em qualquer site.',
  },
  {
    chave: 'api',
    rotulo: 'Backend (.mjs)',
    arquivo: () => 'save-lead.mjs',
    nota: 'Serverless function da Vercel. Salve em api/save-lead.mjs — é ela que fala com o n8n e grava no ledger.',
  },
  {
    chave: 'css',
    rotulo: 'CSS',
    arquivo: () => 'formulario.css',
    nota: 'Só precisa em site que ainda não tenha as classes de formulário da marca. As LPs de expedição já têm.',
  },
  {
    chave: 'json',
    rotulo: 'JSON',
    arquivo: (s) => `${s.destino.slug || 'form'}.stfv.json`,
    nota: 'Backup do formulário. Serve pra levar pra outro computador ou versionar junto da LP.',
  },
]

export default function PainelExportar({ spec }: { spec: FormSpec }) {
  const [aba, setAba] = useState<Aba>('tsx')
  const [copiado, setCopiado] = useState(false)
  const [cssModo, setCssModo] = useState<'puro' | 'tailwind'>('tailwind')

  const codigo = useMemo(() => {
    switch (aba) {
      case 'tsx':
        return gerarReactTsx(spec)
      case 'html':
        return gerarHtml(spec)
      case 'api':
        return gerarApiSaveLead(spec)
      case 'css':
        return cssModo === 'tailwind' ? cssTailwind() : cssPuro()
      case 'json':
        return JSON.stringify(spec, null, 2)
    }
  }, [aba, spec, cssModo])

  const meta = ABAS.find((a) => a.chave === aba)!
  const nomeArquivo = aba === 'css' && cssModo === 'tailwind' ? 'index.css (trecho)' : meta.arquivo(spec)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1600)
    } catch {
      /* clipboard bloqueado: o usuário ainda pode selecionar e copiar à mão */
    }
  }

  const linhas = codigo.split('\n').length

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-dark-teal/10 px-3 py-2">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            className={`aba ${aba === a.chave ? 'aba-on' : ''}`}
            onClick={() => setAba(a.chave)}
          >
            {a.rotulo}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1.5">
          {aba === 'css' && (
            <select
              className="input-builder !w-auto !py-1 text-[11px]"
              value={cssModo}
              onChange={(e) => setCssModo(e.target.value as 'puro' | 'tailwind')}
            >
              <option value="tailwind">Tailwind (@layer)</option>
              <option value="puro">CSS puro</option>
            </select>
          )}
          <button type="button" className="btn-acao" onClick={copiar}>
            {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          <button
            type="button"
            className="btn-acao-lime"
            onClick={() => baixarArquivo(nomeArquivo.replace(' (trecho)', ''), codigo)}
          >
            <Download className="h-3.5 w-3.5" />
            Baixar
          </button>
        </div>
      </div>

      <div className="flex items-baseline gap-2 bg-soft-green/40 px-4 py-2">
        <code className="font-mono text-[11px] font-bold text-dark-teal">{nomeArquivo}</code>
        <span className="text-[11px] text-dark-teal/50">{linhas} linhas</span>
        <span className="ml-auto max-w-[60%] text-right text-[11px] leading-snug text-dark-teal/55">
          {meta.nota}
        </span>
      </div>

      <pre className="codigo flex-1 overflow-auto bg-dark-teal p-4 text-off-white/90">
        <code>{codigo}</code>
      </pre>
    </div>
  )
}
