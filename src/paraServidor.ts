// Ponte pro servidor: e daqui que sai o api/_gerador.mjs.
//
// As funcoes da Vercel sao .mjs e nao compilam TypeScript, entao o gerador e
// empacotado por esbuild neste ponto de entrada. O bundle e COMMITADO em
// api/_gerador.mjs (a Vercel monta as funcoes a partir do repositorio, nao da
// saida do build), e o `npm run verificar` reclama se ele estiver desatualizado.
//
// Prefixo `_` no nome: a Vercel nao transforma em rota arquivo que comeca com _.
export { gerarHtml } from './generators/htmlPuro'
export { avisosDoSpec } from './lib/avisos'
