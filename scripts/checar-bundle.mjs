// O api/_gerador.mjs e um artefato COMMITADO: a Vercel monta as funcoes a
// partir do repositorio, nao da saida do build. Se ele ficar velho, o painel
// mostra um preview e o formulario publicado sai outro — divergencia que nao da
// erro em lugar nenhum. Este script compara o bundle commitado com o que o
// fonte produz agora.
import { readFileSync, rmSync } from 'node:fs'

const commitado = 'api/_gerador.mjs'
const recemFeito = process.argv[2]

const a = readFileSync(commitado, 'utf8')
const b = readFileSync(recemFeito, 'utf8')
rmSync(recemFeito, { force: true })

if (a !== b) {
  console.error(
    `\n${commitado} esta desatualizado em relacao a src/generators/.\n` +
      'Rode `npm run bundle:api` e commite o resultado.\n',
  )
  process.exit(1)
}
console.log('OK: api/_gerador.mjs bate com o fonte')
