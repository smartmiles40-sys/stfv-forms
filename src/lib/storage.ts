import type { FormSpec } from '../types'

// ============================================================================
// Persistencia no navegador. O gerador nao tem backend de proposito: o que ele
// produz e CODIGO, e o codigo mora no repo da LP. Aqui ficam so os rascunhos.
// Pra levar um form pra outro computador, use Exportar/Importar JSON.
// ============================================================================

const CHAVE = 'stfv_forms_v1'

type Guardado = { forms: FormSpec[]; ultimoId: string | null }

/**
 * Rascunho salvo antes de um campo novo existir volta sem ele. Preencher aqui
 * evita que o painel quebre num `.map` de algo `undefined`.
 */
function normalizar(spec: FormSpec): FormSpec {
  return { ...spec, destino: { ...spec.destino, regrasSaida: spec.destino?.regrasSaida ?? [] } }
}

function ler(): Guardado {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return { forms: [], ultimoId: null }
    const dados = JSON.parse(bruto) as Guardado
    return {
      forms: Array.isArray(dados.forms) ? dados.forms.map(normalizar) : [],
      ultimoId: dados.ultimoId ?? null,
    }
  } catch {
    return { forms: [], ultimoId: null }
  }
}

function gravar(dados: Guardado) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados))
  } catch {
    /* aba privada / cota estourada: segue so em memoria nesta sessao */
  }
}

export function listarForms(): FormSpec[] {
  return ler().forms.sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1))
}

export function lerUltimoId(): string | null {
  return ler().ultimoId
}

export function salvarForm(spec: FormSpec) {
  const dados = ler()
  const atualizado = { ...spec, atualizadoEm: new Date().toISOString() }
  const i = dados.forms.findIndex((f) => f.id === spec.id)
  if (i >= 0) dados.forms[i] = atualizado
  else dados.forms.push(atualizado)
  dados.ultimoId = spec.id
  gravar(dados)
}

export function apagarForm(id: string) {
  const dados = ler()
  dados.forms = dados.forms.filter((f) => f.id !== id)
  if (dados.ultimoId === id) dados.ultimoId = dados.forms[0]?.id ?? null
  gravar(dados)
}

export function marcarAberto(id: string) {
  const dados = ler()
  dados.ultimoId = id
  gravar(dados)
}
