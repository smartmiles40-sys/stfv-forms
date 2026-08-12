// Publica um formulário DENTRO deste projeto, em public/f/<slug>.html.
//
// Fluxo completo:
//   1. monte o formulário no painel;
//   2. aba Código gerado → JSON → salve o `<slug>.stfv.json`;
//   3. npm run publicar -- caminho/do/<slug>.stfv.json
//   4. commit + push (a Vercel publica sozinha).
//
// Um form publicado aqui posta em /api/save-lead deste MESMO projeto, então o
// backend existe na mesma origem — que é justamente o que falta quando o form é
// colado numa página solta e todos os envios batem em 404.
//
// Falta ainda registrar o slug em api/save-lead.mjs (FORMS) e criar a env var
// WEBHOOK_<SLUG> na Vercel — o script avisa sobre os dois.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { gerarHtml } from '../src/generators/htmlPuro'
import { avisosDoSpec } from '../src/lib/avisos'
import type { FormSpec } from '../src/types'

const caminho = process.argv[2]
if (!caminho) {
  console.error('uso: npm run publicar -- caminho/do/form.stfv.json')
  process.exit(1)
}

let spec: FormSpec
try {
  spec = JSON.parse(readFileSync(caminho, 'utf8')) as FormSpec
} catch (e) {
  console.error(`nao consegui ler ${basename(caminho)}: ${(e as Error).message}`)
  process.exit(1)
}

const slug = String(spec.slug || '').trim()
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`slug invalido: "${slug}" — use so minusculas, numeros e hifen.`)
  process.exit(1)
}

// Publicar um form com aviso aceso e como subir com o pneu murcho: funciona ate
// a hora que importa. Aqui eles BLOQUEIAM, porque depois do deploy o unico
// sintoma de uma regra orfa e o lead indo pro lugar errado, calado.
const avisos = avisosDoSpec(spec)
if (avisos.length) {
  console.error(`\n${avisos.length} aviso(s) impedem a publicacao de "${slug}":\n`)
  for (const a of avisos) console.error(`  · ${a}`)
  console.error('\nCorrija no painel e exporte o JSON de novo.')
  process.exit(1)
}

if (spec.destino.url !== '/api/save-lead') {
  console.error(
    `destino do lead e "${spec.destino.url}" — um form hospedado aqui tem que\n` +
      'postar em /api/save-lead (mesma origem). Ajuste em Tracking e destino.',
  )
  process.exit(1)
}

mkdirSync('public/f', { recursive: true })
writeFileSync(`public/f/${slug}.html`, gerarHtml(spec), 'utf8')

console.log(`publicado: public/f/${slug}.html`)
console.log(`  URL:     /f/${slug}.html`)
console.log('')
console.log('Falta fazer (o deploy nao faz por voce):')
console.log(`  1. registrar o slug "${slug}" em FORMS no api/save-lead.mjs;`)
console.log(`  2. criar a env var WEBHOOK_${slug.toUpperCase().replace(/-/g, '_')} na Vercel`)
console.log('     com o webhook do n8n — sem ela o lead fica so no ledger e nos logs;')
console.log('  3. commit + push.')
