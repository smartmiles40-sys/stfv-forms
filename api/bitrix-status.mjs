//  /api/bitrix-status — confere a configuração do Bitrix antes da live.
//
//  Existe porque "o webhook responde" NÃO prova que funciona: webhook de entrada
//  criado sem escopo CRM responde profile.json normalmente e falha em todo
//  crm.*. Aqui olhamos o escopo de verdade e listamos as etapas do funil, pra
//  conferir que a etapa configurada é a coluna que você acha que é.
//
//  Protegido pela mesma PUBLICAR_SENHA: o retorno diz qual portal é e quais
//  etapas existem, e isso não é coisa pra ficar aberta.

import { timingSafeEqual } from 'node:crypto'
import { verificarBitrix, FUNIL_PADRAO } from './_bitrix.mjs'

function senhaConfere(recebida, esperada) {
  const a = Buffer.from(String(recebida ?? ''))
  const b = Buffer.from(String(esperada ?? ''))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  const SENHA = process.env.PUBLICAR_SENHA
  if (!SENHA) {
    res.status(503).json({ ok: false, erro: 'nao_configurado' })
    return
  }
  if (!senhaConfere(req.headers['x-stfv-senha'] ?? req.query?.senha, SENHA)) {
    res.status(401).json({ ok: false, erro: 'senha_invalida' })
    return
  }

  const base = process.env.BITRIX_WEBHOOK_URL
  if (!base) {
    res.status(200).json({
      ok: false,
      erro: 'bitrix_nao_configurado',
      dica: 'Falta a env var BITRIX_WEBHOOK_URL na Vercel.',
    })
    return
  }

  const diag = await verificarBitrix(base)

  const categoryId = process.env.BITRIX_CATEGORY_ID || FUNIL_PADRAO.categoryId
  const stageId = process.env.BITRIX_STAGE_ID || FUNIL_PADRAO.stageId
  const etapaConfigurada = diag.etapas?.find((e) => e.id === stageId)

  res.status(200).json({
    ...diag,
    funil: { categoryId, stageId },
    // O ponto do diagnóstico: ver o NOME da coluna onde o lead vai cair. Neste
    // portal os IDs foram reaproveitados fora de ordem (C25:NEW é "Ajuste"),
    // então só o nome prova que é a coluna certa.
    etapaConfigurada: etapaConfigurada
      ? `${etapaConfigurada.nome} (${stageId})`
      : `⚠️ a etapa ${stageId} não existe no funil ${categoryId}`,
  })
}
