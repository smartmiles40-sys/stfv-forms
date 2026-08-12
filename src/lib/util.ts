import type { Campo, Destino, FormSpec, TipoCampo } from '../types'

/** Id curto e estavel pra chaves de lista no builder. */
export function uid(prefixo = 'id'): string {
  return `${prefixo}_${Math.random().toString(36).slice(2, 9)}`
}

/** "Turquia & Grécia 2027" -> "turquia-grecia-2027" */
export function slugify(texto: string): string {
  return texto
    .normalize('NFD') // separa o acento da letra
    .replace(/[̀-ͯ]/g, '') // e remove o acento (marcas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Nome de campo valido em JS/JSON: sem acento, sem espaco, comeca com letra. */
export function nomeDeCampo(texto: string): string {
  const s = slugify(texto).replace(/-/g, '_')
  return /^[a-z]/.test(s) ? s : `campo_${s}`
}

/** Mascara de exibicao: (DD) NNNNN-NNNN ou (DD) NNNN-NNNN */
export function mascaraWhatsapp(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Normaliza o @ do Instagram: sem espacos, sem @ duplicado, so chars validos. */
export function mascaraInstagram(valor: string): string {
  const h = valor
    .replace(/\s/g, '')
    .replace(/@/g, '')
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, 30)
  return h ? `@${h}` : ''
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Validacao de um campo. E a MESMA regra que o codigo gerado aplica —
 * os geradores emitem esta funcao em JS puro, entao preview e producao
 * reprovam exatamente as mesmas entradas.
 */
export function validarCampo(campo: Campo, valor: string | string[]): string {
  const vazio = Array.isArray(valor) ? valor.length === 0 : !String(valor ?? '').trim()

  if (campo.tipo === 'oculto') return ''
  if (vazio) return campo.obrigatorio ? campo.erro || 'Campo obrigatório' : ''

  const v = Array.isArray(valor) ? '' : String(valor)

  switch (campo.tipo) {
    case 'texto':
      return v.trim().length < 3 ? campo.erro || 'Preencha este campo' : ''
    case 'email':
      return EMAIL_RE.test(v.trim()) ? '' : campo.erro || 'Digite um e-mail válido'
    case 'whatsapp': {
      const d = v.replace(/\D/g, '')
      // 11 digitos com 9 na terceira posicao = celular brasileiro com DDD
      return d.length === 11 && d[2] === '9'
        ? ''
        : campo.erro || 'Digite um celular válido com DDD (11 dígitos). Ex.: (11) 98765-4321'
    }
    case 'instagram':
      return v.replace('@', '').length >= 2 ? '' : campo.erro || 'Digite seu @ do Instagram'
    default:
      return ''
  }
}

/** Valor inicial de um campo no estado do formulario. */
export function valorInicial(tipo: TipoCampo): string | string[] {
  return tipo === 'checkbox' ? [] : ''
}

/** Placeholder padrao por tipo, usado quando o builder nao define um. */
export function placeholderPadrao(tipo: TipoCampo): string {
  switch (tipo) {
    case 'whatsapp':
      return '(11) 98765-4321'
    case 'instagram':
      return '@seuusuario'
    case 'email':
      return 'voce@email.com'
    default:
      return ''
  }
}

/**
 * Pra onde o lead vai depois do envio, dada a resposta dele. Primeira regra que
 * bate ganha; nenhuma batendo, cai no destino padrao. E a MESMA regra que os
 * geradores emitem — preview e producao decidem igual.
 */
export function resolverSaida(
  destino: Destino,
  valores: Record<string, string | string[]>,
): { url: string; whatsapp: boolean } {
  for (const regra of destino.regrasSaida ?? []) {
    if (!regra.campo || !regra.valor) continue
    const v = valores[regra.campo]
    const texto = Array.isArray(v) ? v.join(', ') : String(v ?? '')
    if (texto === regra.valor) return { url: regra.url, whatsapp: regra.whatsapp }
  }
  return { url: destino.redirectUrl, whatsapp: destino.whatsappHandoff }
}

/** Todos os campos do spec, achatados (util pra checar nomes duplicados). */
export function todosOsCampos(spec: FormSpec): Campo[] {
  return spec.etapas.flatMap((e) => e.campos)
}

/** Escapa aspas/quebras pra embutir uma string dentro do codigo gerado. */
export function aspas(texto: string): string {
  return JSON.stringify(String(texto ?? ''))
}

/** Baixa um arquivo de texto no navegador. */
export function baixarArquivo(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
