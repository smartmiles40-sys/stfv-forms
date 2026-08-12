# STFV Forms — gerador de formulários

Ferramenta interna da **Se Tu For, Eu Vou! Viagens** para montar formulários de captação com
a identidade visual da marca, configurar o rastreamento (UTMs e click IDs) e **exportar o
código pronto** para colar no repositório da LP.

Substitui o formulário do Bitrix24 (`crm_form_*` em iframe) por um formulário nativo, que
carrega junto com a página, é indexável, não depende de login do Bitrix e manda o lead pelo
caminho que já existe: `/api/save-lead` → n8n → Bitrix (+ ledger no Supabase).

---

## Como usar

```bash
npm install
npm run dev      # abre em http://localhost:5173
```

1. **Escolha um preset** no canto superior direito (“+ Novo formulário…”):
   - *Expedição (3 etapas + vídeo)* — o formulário que já roda nas LPs: contato → vídeo com
     trava de tempo → perfil de viagem;
   - *Live (contato + confirmação)* — contato → “assistiu a live e está de acordo?” com três
     respostas; todas seguem pro WhatsApp, e a resposta escolhida vai junto na mensagem;
   - *Captura simples (1 etapa)* — nome, WhatsApp e e-mail;
   - *Começar do zero*.
2. **Campos** — monte etapas e campos. O preview ao lado é o formulário de verdade: valida,
   mascara e trava igual ao que vai pro ar; só não envia nada.
3. **Tracking e destino** — escolha quais UTMs e click IDs viajam com o lead, para onde ele
   vai e o que acontece depois do envio.
4. **Código gerado** — copie ou baixe o arquivo. Pronto.

O rascunho é salvo sozinho no navegador. Para levar um formulário para outro computador,
use **Exportar** / **Importar** (JSON).

---

## O que ele exporta

| Aba | Arquivo | Onde vai |
|---|---|---|
| React (.tsx) | `FormularioLead.tsx` | `src/components/` da LP. Use `<FormularioLead />` na seção do formulário. |
| HTML | `<slug>.html` | Página autocontida (CSS + JS puro, sem build). Serve para WordPress, site de terceiro ou só para testar. |
| Backend (.mjs) | `save-lead.mjs` | `api/save-lead.mjs` do projeto Vercel. É quem fala com o n8n e grava no ledger. |
| CSS | `formulario.css` | Só para site que ainda não tem as classes da marca. **As LPs de expedição já têm.** |
| JSON | `<slug>.stfv.json` | Backup / versionamento do formulário. |

### Fluxo do lead

```
Formulário  →  POST /api/save-lead  →  ┬→  webhook n8n  →  Bitrix24 (contato + deal)
                                        └→  Supabase site_leads  (ledger anti-perda)
```

Os dois canais correm em paralelo (`Promise.allSettled`): se o n8n cair, o lead ainda fica
gravado no ledger e a conciliação recupera depois.

---

## Detalhes que o gerador já resolve

- **First-touch por aba** — a atribuição é guardada no `sessionStorage`, então sobrevive a
  recarga e a navegação interna. Quem chegou primeiro manda; a URL só preenche o que está
  vazio. Sem isso, um pulo de página zera a UTM.
- **Click IDs** (`gclid`, `fbclid`, `gbraid`, `wbraid`, `utm_id`) — única âncora de
  atribuição quando a campanha não taggeia UTM: o autotagging do Google manda só `gclid`.
- **Fallback de `utm_content`** — marca a versão da LP (ex.: `v4`) quando a visita chega sem
  tag. É derivado, não persistido: se o lead voltar por um link taggeado, o valor real vence.
- **Normalização** — WhatsApp sai em E.164 (`+5511987654321`) e e-mail em minúsculo, direto
  do formulário. Importa no modo *webhook direto*, onde não há backend para corrigir depois.
- **Eventos de dataLayer** — `form_step_view`, `form_step_complete`, `form_step_back`,
  `form_validation_error`, `form_video_unlocked` e o evento de conversão configurável
  (padrão `expedicao_lead`), com `eventCallback` + rede de segurança de 2s para o caso de o
  GTM não responder.
- **Saída conforme a resposta** — em *Tracking e destino* você define regras do tipo
  “se `assistiu_live` = `Não`, mande pro Instagram”. A primeira regra que bate leva o lead;
  nenhuma batendo, vale a URL de destino padrão. O envio pro CRM acontece **antes** e não
  depende da regra — quem cai na saída “não” também é lead. Quando o destino já é o
  WhatsApp, a mensagem vai na URL (`?text=`); quando é uma página de obrigado nossa, ela vai
  pelo `sessionStorage` como antes.
- **Etapa de vídeo com trava** — o botão só libera depois de N segundos na etapa, com barra
  de progresso. A contagem é por *deadline*, então voltar e avançar não reinicia o relógio.
- **Se o envio falhar, o lead ainda chega no destino** — num formulário que redireciona, o
  erro de rede não segura ninguém: o lead é reenviado por `navigator.sendBeacon` (que
  sobrevive à saída da página) e a navegação acontece assim mesmo. Quem chega no seu WhatsApp
  você já tem — o número está na conversa; quem fica parado numa mensagem de erro some. Em
  formulário que termina em mensagem não há destino, e aí o erro continua aparecendo.
- **Avisos antes de publicar** — campo sem nome, nome repetido (um sobrescreve o outro no
  payload), campo de escolha sem opções, ausência de `nome`/`whatsapp` (o backend rejeita),
  `form_name` vazio, etapa de vídeo sem embed. E, nas saídas condicionais: regra apontando
  pra campo que não existe, regra em campo que não é de escolha única, **rótulo de opção
  renomeado que deixou a regra órfã**, regra sem URL, mensagem de WhatsApp vazia e
  `{placeholder}` sem campo correspondente. O casamento da regra é por texto exato — sem
  esses avisos, renomear uma opção manda todo mundo pro destino padrão em silêncio.

---

## Verificação

```bash
npm run verificar
```

Gera os presets, compila os `.tsx` resultantes com TypeScript estrito (as mesmas flags das
LPs, incluindo `noUnusedLocals`) e roda `node --check` no backend gerado. Se isso passa, o
código exportado compila no repositório da LP.

Além de compilar, o script confere duas coisas que ninguém vê quebrar: que o **caminho de
falha** do envio leva o lead ao destino em todo formulário que redireciona, e que cada
**aviso** realmente acende — para isso ele sabota o formulário de seis jeitos (opção
renomeada, campo inexistente, regra sem URL, múltipla escolha, mensagem vazia, placeholder
órfão) e exige o aviso correspondente. Também exige que os presets saiam **limpos**: falso
positivo é o que ensina a ignorar a caixa amarela.

Cada caso cobre um caminho diferente do gerador — *expedição* a etapa de vídeo, *live* o
redirect direto pro WhatsApp, *live-bifurcada* a saída condicional, *simples* a mensagem no
lugar do redirect, *vazio* a etapa sem campos. `live-bifurcada` não é um preset: é uma
fixture do `scripts/gerar-amostra.ts`, porque nenhum preset usa saída condicional hoje e
esse caminho ficaria sem ninguém compilando. Ao criar um caminho novo no gerador,
acrescente um caso que passe por ele — um `if` sem caso correspondente não é verificado.

---

## Formulários hospedados aqui

Além de exportar código, este projeto **hospeda formulários**. Um formulário em `public/f/`
é servido em `/f/<slug>.html` e posta em `/api/save-lead` **do mesmo domínio** — ou seja, o
backend existe na mesma origem, sem configuração nenhuma.

Isso resolve o modo de falha mais provável do formulário exportado: colado numa página que
não tem a função `save-lead` publicada, **todos** os envios batem em 404. Aqui, não tem como.

```bash
npm run publicar -- caminho/do/<slug>.stfv.json
```

O fluxo inteiro: monte no painel → aba **Código gerado** → **JSON** → rode o comando acima →
commit + push. O script se recusa a publicar formulário com aviso aceso — depois do deploy, o
único sintoma de uma regra órfã é o lead indo pro lugar errado, calado.

Depois de publicar um slug novo, faltam duas coisas que o deploy não faz sozinho:

1. registrar o slug em `FORMS`, no `api/save-lead.mjs` (é a allowlist de campos);
2. criar a env var `WEBHOOK_<SLUG>` na Vercel com o webhook do n8n.

Sem a env var o lead **não se perde** — vai pro ledger do Supabase e pros logs da função —
mas também não chega no Bitrix. Configure antes de divulgar o link.

---

## Deploy

Padrão de deploy isolado da agência: um repositório, um project na Vercel.

1. Vercel → **Add New Project** → importe `smartmiles40-sys/stfv-forms`.
2. Não mexa em build settings: o `vercel.json` já define `buildCommand`, `outputDirectory`,
   o roteamento e os headers.
3. **Settings → Environment Variables**, conforme o que você for usar:

| Variável | Para quê | Sem ela |
|---|---|---|
| `WEBHOOK_<SLUG>` | webhook do n8n daquele formulário | lead não chega no Bitrix |
| `SUPABASE_LEADS_URL` | ledger anti-perda ([[setur-rede-leads]]) | lead fica só nos logs |
| `SUPABASE_LEADS_KEY` | `service_role` do mesmo projeto | idem |

Depois disso, push na `main` publica sozinho.

### Roteamento

O `vercel.json` faz três coisas que não são óbvias:

- o catch-all do painel exclui `/api/` e `/f/` (`/((?!api/|f/).*)`) — sem isso o SPA engoliria
  a função e os formulários;
- `X-Robots-Tag: noindex` em tudo: o painel é ferramenta interna e os formulários são
  divulgados por link, não por busca;
- `Cache-Control: no-store` em `/f/` — formulário em cache mostra pergunta velha **e regra de
  saída velha**, que é o jeito mais silencioso de mandar a live inteira pro lugar errado.
