//  /api/bitrix-status — confere a configuração do Bitrix antes da live.
//
//  Existe porque "o webhook responde" NÃO prova que funciona: webhook de entrada
//  criado sem escopo CRM responde profile.json normalmente e falha em todo
//  crm.*. Aqui olhamos o escopo de verdade e listamos as etapas do funil, pra
//  conferir que a etapa configurada é a coluna que você acha que é.
//
//  Protegido pela mesma PUBLICAR_SENHA: o retorno diz qual portal é e quais
//  etapas existem, e isso não é coisa pra ficar aberta.

import { verificarBitrix, FUNIL_PADRAO, conferirCamposDaReuniao } from './_bitrix.mjs'
import { portaoDaSenha } from './_portao.mjs'

export default async function handler(req, res) {
  // Aceita a senha por header ou por `?senha=` — este e o unico que se abre no
  // navegador, e e esse o jeito de conferir os campos em 30 segundos.
  const portao = await portaoDaSenha(req, { teto: 30 })
  if (portao) {
    res.status(portao.status).json(portao.corpo)
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

  // Os campos que o aviso da reunião lê. Sem isto, a única forma de saber se um
  // `UF_CRM_*` ainda é o campo que a gente pensa (eles MUDAM se o campo for
  // recriado no Bitrix) seria mandar um lead de verdade pro CRM e abrir o card.
  const reuniao = await conferirCamposDaReuniao(base, {
    nomes: String(req.query?.nomes ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  })

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
    reuniao,
  })
}
