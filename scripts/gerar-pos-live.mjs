// scripts/gerar-pos-live.mjs
// -----------------------------------------------------------------------------
// Os formularios POS-LIVE (Bruno, 16/09/2026): vao junto com a GRAVACAO pra quem
// nao assistiu a live (ou viu metade). A pessoa deixa nome e WhatsApp e marca uma
// LIGACAO RAPIDA (5 min) com o SDR dono dela — que qualifica antes de passar pro
// especialista. O formulario principal, o do chat do Meet, continua marcando
// direto com o closer.
//
// Um por live, em <slug>-gravada, com a MESMA fonte da live: o lead continua
// contando pra live dele no dashboard.
//
//   node scripts/gerar-pos-live.mjs      -> .rollback/form-<slug>-gravada.{spec.json,html}
//                                           + .rollback/publicar-pos-live.sql
// Usa o `api/_gerador.mjs` do working tree: rode `npm run bundle:api` antes.
// -----------------------------------------------------------------------------
import { writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gerarHtml, avisosDoSpec } from '../api/_gerador.mjs'

const AGENDA_SDR = 'https://qs-turis.vercel.app/agendar/?com=sdr'

const LIVES = [
  { slug: 'amalfitana', titulo: 'Costa Amalfitana', source: 'LIVE_ITALIA', fonte: '[Itália] - Live', expedicao: 'Costa Amalfitana', ano: 2026 },
  { slug: 'tailandia', titulo: 'Tailândia', source: 'LIVE_TAILANDIA', fonte: '[Tailândia] - Live', expedicao: 'Tailândia', ano: 2026 },
  { slug: 'turquia', titulo: 'Turquia e Grécia', source: 'LIVE_TURQUIA_GRECIA', fonte: '[Turquia e Grécia] - Live', expedicao: 'Turquia e Grécia', ano: 2026 },
  { slug: 'islandia', titulo: 'Islândia', source: 'LIVE_ISLANDIA', fonte: '[Islândia] - Live', expedicao: 'Islândia', ano: 2026 },
  { slug: 'japao', titulo: 'Japão e China', source: 'LIVE_JAPAO_CHINA', fonte: '[Japão e China] - Live', expedicao: 'Japão e China', ano: 2027 },
  { slug: 'egito', titulo: 'Egito', source: 'LIVE_EGITO', fonte: '[Egito] - Live', expedicao: 'Egito', ano: 2026 },
  { slug: 'peru', titulo: 'Peru', source: 'LIVE_PERU', fonte: '[Peru] - Live', expedicao: 'Peru', ano: 2026 },
]

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function spec(l) {
  const slug = `${l.slug}-gravada`
  return {
    id: `form_pos_live_${l.slug}`,
    nome: `Pós-live ${l.titulo} — ligação com SDR`,
    slug,
    etapas: [
      {
        id: 'etapa_dados',
        tipo: 'campos',
        titulo: 'Seus dados',
        textoBotao: 'Escolher horário',
        video: { embedHtml: '', textoLiberado: '', travaSegundos: 0, textoBloqueado: '' },
        campos: [
          { id: 'campo_nome', name: 'nome', tipo: 'texto', label: 'Nome completo', erro: 'Digite seu nome completo', ajuda: '', opcoes: [], largura: 'cheia', valorFixo: '', obrigatorio: true, placeholder: '' },
          { id: 'campo_whatsapp', name: 'whatsapp', tipo: 'whatsapp', label: 'WhatsApp com DDD', erro: '', ajuda: 'É por ele que a gente vai te ligar.', opcoes: [], largura: 'cheia', valorFixo: '', obrigatorio: true, placeholder: '(11) 98765-4321' },
          { id: 'campo_email', name: 'email', tipo: 'email', label: 'E-mail', erro: '', ajuda: '', opcoes: [], largura: 'cheia', valorFixo: '', obrigatorio: false, placeholder: 'voce@email.com' },
        ],
      },
    ],
    destino: {
      url: '/api/save-lead',
      modo: 'endpoint',
      slug,
      formName: `pos-live-${semAcento(l.titulo)}-${l.ano}`,
      aposEnvio: 'agendamento',
      agendamentoUrl: AGENDA_SDR,
      agendamentoRotulo: 'Horário da ligação',
      erroEnvio: 'Não conseguimos enviar agora. Tente de novo em instantes — ou chame a gente no WhatsApp.',
      camposFixos: [
        { id: 'cf_source', name: 'source_id', valor: l.source },
        { id: 'cf_fonte', name: 'fonte', valor: l.fonte },
        { id: 'cf_exped', name: 'expedicao', valor: l.expedicao },
      ],
      redirectUrl: 'https://wa.me/551148636051',
      regrasSaida: [],
      mensagemTitulo: 'Falta só o horário!',
      mensagemTexto: 'Escolha quando podemos te ligar. É uma ligação rápida, de 5 minutos, pelo WhatsApp.',
      whatsappHandoff: false,
      whatsappMensagem: '',
    },
    tracking: {
      utms: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'],
      clickIds: ['utm_id', 'gclid', 'fbclid', 'gbraid', 'wbraid'],
      dataLayer: true,
      firstTouch: true,
      inputsOcultos: true,
      eventoConversao: 'pos_live_lead',
      fallbackUtmContent: `pos-live-${l.slug}`,
    },
    aparencia: { cartao: true, rotuloEtapa: true, indicadorEtapas: true },
    atualizadoEm: new Date().toISOString(),
  }
}

mkdirSync('.rollback', { recursive: true })
const sql = []
let problemas = 0
for (const l of LIVES) {
  const s = spec(l)
  const avisos = avisosDoSpec(s)
  if (avisos.length) { problemas++; console.error(`AVISO ${s.slug}:`, avisos.join(' | ')) }
  const html = gerarHtml(s)
  if (!html.includes('com=sdr&embed=1')) { problemas++; console.error(`${s.slug}: nao abre a agenda do SDR`) }
  writeFileSync(`.rollback/form-${s.slug}.spec.json`, JSON.stringify(s, null, 2))
  writeFileSync(`.rollback/form-${s.slug}.html`, html)
  const md5 = createHash('md5').update(html, 'utf8').digest('hex')
  console.log(`${s.slug}  ${html.length} bytes  md5 ${md5}`)
  const dol = '$pl$'
  sql.push(
    `insert into stfv_forms_publicados (slug, spec, html) values ('${s.slug}', ${dol}${JSON.stringify(s)}${dol}::jsonb, ${dol}${html}${dol})\n` +
    `on conflict (slug) do update set spec = excluded.spec, html = excluded.html\nreturning slug, md5(html);`
  )
}
writeFileSync('.rollback/publicar-pos-live.sql', sql.join('\n\n') + '\n')
if (problemas) process.exit(1)
console.log('ok: 7 formularios pos-live gerados em .rollback/')
