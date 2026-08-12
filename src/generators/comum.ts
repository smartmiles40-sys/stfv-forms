import type { Campo, Etapa, FormSpec } from '../types'
import { placeholderPadrao } from '../lib/util'

// ============================================================================
// Peças compartilhadas pelos geradores (TSX e HTML). O objetivo aqui e que o
// codigo exportado seja LEGIVEL: um runtime curto no topo e a configuracao do
// formulario em forma de dados logo abaixo, pra voce conseguir editar um rotulo
// direto no repo da LP sem voltar no gerador.
// ============================================================================

/** Campos que o formulario realmente envia (o oculto entra com valor fixo). */
export function camposDoSpec(spec: FormSpec): Campo[] {
  return spec.etapas.flatMap((e) => e.campos)
}

/** Chaves de tracking na ordem em que vao pro payload. */
export function trackKeys(spec: FormSpec): string[] {
  return [...spec.tracking.utms, ...spec.tracking.clickIds]
}

/** Versao enxuta da etapa, sem os ids internos do builder. */
type EtapaSerializada = {
  titulo: string
  tipo: 'campos' | 'video'
  textoBotao: string
  campos: {
    tipo: string
    name: string
    label: string
    placeholder?: string
    obrigatorio: boolean
    ajuda?: string
    erro?: string
    largura?: 'metade'
    valorFixo?: string
    opcoes?: { label: string; slug: string }[]
  }[]
  video?: {
    embedHtml: string
    travaSegundos: number
    textoBloqueado: string
    textoLiberado: string
  }
}

export function serializarEtapas(spec: FormSpec): EtapaSerializada[] {
  return spec.etapas.map((e: Etapa) => {
    const base: EtapaSerializada = {
      titulo: e.titulo,
      tipo: e.tipo,
      textoBotao: e.textoBotao,
      campos: e.campos.map((c) => {
        const campo: EtapaSerializada['campos'][number] = {
          tipo: c.tipo,
          name: c.name,
          label: c.label,
          obrigatorio: c.obrigatorio,
        }
        const ph = c.placeholder || placeholderPadrao(c.tipo)
        if (ph) campo.placeholder = ph
        if (c.ajuda) campo.ajuda = c.ajuda
        if (c.erro) campo.erro = c.erro
        if (c.largura === 'metade') campo.largura = 'metade'
        if (c.tipo === 'oculto' && c.valorFixo) campo.valorFixo = c.valorFixo
        if (c.opcoes.length) campo.opcoes = c.opcoes.map((o) => ({ label: o.label, slug: o.slug }))
        return campo
      }),
    }
    if (e.tipo === 'video') base.video = { ...e.video }
    return base
  })
}

/** Mapa name -> { label -> slug }, usado pelo dataLayer do codigo gerado. */
export function mapaDeSlugs(spec: FormSpec): Record<string, Record<string, string>> {
  const mapa: Record<string, Record<string, string>> = {}
  for (const c of camposDoSpec(spec)) {
    if (!c.opcoes.length) continue
    mapa[c.name] = Object.fromEntries(c.opcoes.map((o) => [o.label, o.slug]))
  }
  return mapa
}

export function camposFixosObjeto(spec: FormSpec): Record<string, string> {
  return Object.fromEntries(
    spec.destino.camposFixos.filter((f) => f.name.trim()).map((f) => [f.name.trim(), f.valor]),
  )
}

export function json(valor: unknown, indent = 2): string {
  return JSON.stringify(valor, null, indent)
}

/** Cabecalho de comentario do arquivo gerado. */
export function cabecalho(spec: FormSpec, extra: string[] = []): string[] {
  const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return [
    '/**',
    ` * ${spec.nome}`,
    ' *',
    ' * Gerado pelo STFV Forms (gerador de formularios da Se Tu For, Eu Vou! Viagens)',
    ` * em ${data}. Nao e um arquivo "magico": pode editar a vontade depois de colar.`,
    ' *',
    ` * Destino do lead: ${spec.destino.modo === 'endpoint' ? 'POST ' + spec.destino.url + ' (o backend roteia pro n8n e grava no ledger)' : 'POST direto no webhook do n8n'}`,
    ` * form_name: ${spec.destino.formName}   |   slug: ${spec.destino.slug}`,
    ...extra.map((l) => ` * ${l}`),
    ' */',
  ]
}
