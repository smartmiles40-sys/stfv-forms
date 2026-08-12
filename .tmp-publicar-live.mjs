// src/lib/util.ts
function uid(prefixo = "id") {
  return `${prefixo}_${Math.random().toString(36).slice(2, 9)}`;
}
function placeholderPadrao(tipo) {
  switch (tipo) {
    case "whatsapp":
      return "(11) 98765-4321";
    case "instagram":
      return "@seuusuario";
    case "email":
      return "voce@email.com";
    default:
      return "";
  }
}

// src/defaults.ts
function campoNovo(tipo = "texto", patch = {}) {
  return {
    id: uid("campo"),
    tipo,
    name: "",
    label: "",
    placeholder: placeholderPadrao(tipo),
    obrigatorio: true,
    ajuda: "",
    erro: "",
    opcoes: [],
    valorFixo: "",
    largura: "cheia",
    ...patch
  };
}
function etapaNova(patch = {}) {
  return {
    id: uid("etapa"),
    titulo: "Nova etapa",
    tipo: "campos",
    campos: [],
    video: {
      embedHtml: "",
      travaSegundos: 60,
      textoBloqueado: "Assista ao v\xEDdeo \u2014 as \xFAltimas perguntas liberam quando a barrinha encher.",
      textoLiberado: "Liberado! Falta s\xF3 o seu perfil de viagem."
    },
    textoBotao: "Continuar",
    ...patch
  };
}
function ops(...pares) {
  return pares.map(([label, slug]) => ({ label, slug }));
}
function presetExpedicao() {
  return {
    id: uid("form"),
    nome: "Expedi\xE7\xE3o \u2014 3 etapas com v\xEDdeo",
    slug: "expedicao",
    atualizadoEm: (/* @__PURE__ */ new Date()).toISOString(),
    etapas: [
      etapaNova({
        titulo: "Dados de contato",
        textoBotao: "Continuar",
        campos: [
          campoNovo("texto", {
            name: "nome",
            label: "Nome completo",
            erro: "Digite seu nome completo"
          }),
          campoNovo("whatsapp", {
            name: "whatsapp",
            label: "WhatsApp com DDD",
            placeholder: "(11) 98765-4321"
          }),
          campoNovo("email", { name: "email", label: "E-mail" }),
          campoNovo("instagram", {
            name: "instagram",
            label: "Instagram",
            placeholder: "@seuusuario"
          })
        ]
      }),
      etapaNova({
        titulo: "Assista ao v\xEDdeo",
        tipo: "video",
        textoBotao: "Continuar"
      }),
      etapaNova({
        titulo: "Seu perfil de viagem",
        textoBotao: "Quero garantir minha vaga",
        campos: [
          campoNovo("radio", {
            name: "data",
            label: "A expedi\xE7\xE3o acontece de 12 a 24 de outubro. Voc\xEA tem disponibilidade?",
            opcoes: ops(
              ["Sim, consigo viajar nesse per\xEDodo", "sim"],
              ["Ainda n\xE3o tenho certeza", "talvez"],
              ["N\xE3o, mas quero saber de pr\xF3ximas datas", "nao"]
            )
          }),
          campoNovo("radio", {
            name: "companhia",
            label: "Como voc\xEA pretende viajar?",
            opcoes: ops(
              ["Sozinho(a)", "sozinho"],
              ["Casal", "casal"],
              ["Fam\xEDlia", "familia"],
              ["Com amigos", "amigos"]
            )
          }),
          campoNovo("radio", {
            name: "perfil",
            label: "Qual o seu perfil de viajante?",
            opcoes: ops(
              ["Ser\xE1 minha primeira viagem internacional", "primeira"],
              ["J\xE1 viajei algumas vezes para fora do Brasil", "algumas"],
              ["Sou viajante experiente", "frequente"]
            )
          }),
          campoNovo("radio", {
            name: "investimento",
            label: "O investimento nessa expedi\xE7\xE3o fica entre R$ 25.000 e R$ 32.000. Voc\xEA est\xE1 preparado(a) para investir nessa experi\xEAncia completa?",
            opcoes: ops(
              ["Sim, estou preparado(a)", "sim"],
              ["Quero entender os valores primeiro", "talvez"],
              ["N\xE3o, est\xE1 fora do meu momento agora", "nao"]
            )
          }),
          campoNovo("radio", {
            name: "decisao",
            label: "Quando voc\xEA pretende tomar a decis\xE3o?",
            opcoes: ops(
              ["O quanto antes \u2014 quero garantir minha vaga", "agora"],
              ["Nos pr\xF3ximos meses", "proximos"],
              ["Ainda estou s\xF3 pesquisando", "explorando"]
            )
          })
        ]
      })
    ],
    tracking: {
      utms: ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"],
      clickIds: ["utm_id", "gclid", "fbclid", "gbraid", "wbraid"],
      firstTouch: true,
      fallbackUtmContent: "v4",
      dataLayer: true,
      eventoConversao: "expedicao_lead",
      inputsOcultos: true
    },
    destino: {
      modo: "endpoint",
      url: "/api/save-lead",
      formName: "expedicao-destino-2027",
      slug: "destino",
      camposFixos: [
        { id: uid("fixo"), name: "expedicao", valor: "Expedi\xE7\xE3o Destino 2027" },
        { id: uid("fixo"), name: "fonte", valor: "[Destino] - Tr\xE1fego" },
        { id: uid("fixo"), name: "source_id", valor: "" }
      ],
      aposEnvio: "redirect",
      redirectUrl: "/obrigado.html",
      regrasSaida: [],
      mensagemTitulo: "Recebemos seus dados!",
      mensagemTexto: "Nosso time entra em contato em breve pelo WhatsApp.",
      whatsappHandoff: true,
      whatsappMensagem: "Ol\xE1! Sou {nome} e acabei de preencher o formul\xE1rio da Expedi\xE7\xE3o Destino 2027. Quero seguir os pr\xF3ximos passos.",
      erroEnvio: "N\xE3o conseguimos enviar agora. Tente de novo em instantes \u2014 ou chame a gente no WhatsApp."
    },
    aparencia: { indicadorEtapas: true, rotuloEtapa: true, cartao: true }
  };
}
function presetLive() {
  const base2 = presetExpedicao();
  return {
    ...base2,
    id: uid("form"),
    nome: "Live \u2014 contato + confirma\xE7\xE3o",
    slug: "live",
    etapas: [
      etapaNova({
        titulo: "Seus dados",
        textoBotao: "Continuar",
        campos: [
          campoNovo("texto", {
            name: "nome",
            label: "Nome completo",
            erro: "Digite seu nome completo"
          }),
          campoNovo("email", { name: "email", label: "E-mail" }),
          campoNovo("whatsapp", {
            name: "whatsapp",
            label: "WhatsApp com DDD",
            placeholder: "(11) 98765-4321"
          })
        ]
      }),
      etapaNova({
        titulo: "Confirma\xE7\xE3o",
        textoBotao: "Enviar",
        campos: [
          campoNovo("radio", {
            name: "assistiu_live",
            label: "Voc\xEA assistiu a live e est\xE1 de acordo?",
            opcoes: ops(
              ["Sim, eu assisti tudo e quero seguir os pr\xF3ximos passos", "assistiu-tudo"],
              ["Peguei pela metade, e quero entender mais das expedi\xE7\xF5es", "pela-metade"],
              ["N\xE3o consegui assistir a live e quero entender o roteiro", "nao-assistiu"]
            )
          })
        ]
      })
    ],
    tracking: { ...base2.tracking, eventoConversao: "live_lead", fallbackUtmContent: "live" },
    destino: {
      ...base2.destino,
      formName: "live-2026",
      slug: "live",
      camposFixos: [
        { id: uid("fixo"), name: "expedicao", valor: "Live" },
        { id: uid("fixo"), name: "fonte", valor: "[Destino] - Live" },
        { id: uid("fixo"), name: "source_id", valor: "" }
      ],
      aposEnvio: "redirect",
      redirectUrl: "https://wa.me/5511951251935",
      whatsappHandoff: true,
      // As tres respostas vao pro mesmo lugar (decisao do Bruno), entao nao ha
      // o que bifurcar. A saida condicional continua existindo no gerador — e
      // so adicionar regra aqui se algum dia uma resposta tiver que ir pra outro
      // destino.
      regrasSaida: [],
      // {assistiu_live} entra com o texto que o lead marcou. E o que a SDR le
      // primeiro: sem isso as tres respostas chegam no WhatsApp identicas, e a
      // qualificacao so apareceria depois, no CRM.
      whatsappMensagem: "Ol\xE1! Sou {nome}, vim da live. {assistiu_live}. Meu e-mail \xE9 {email}."
    },
    aparencia: { indicadorEtapas: true, rotuloEtapa: true, cartao: true }
  };
}

// .tmp-publicar-live.ts
var base = presetLive();
var spec = {
  ...base,
  nome: "Live \u2014 captacao",
  slug: "live",
  destino: {
    ...base.destino,
    // Mensagem que ja vai escrita na conversa do WhatsApp quando o lead chega.
    whatsappMensagem: "Assisti a live e quero seguir os pr\xF3ximos passos"
  }
};
var senha = process.env.STFV_SENHA;
if (!senha) {
  console.error("faltou STFV_SENHA");
  process.exit(1);
}
var pergunta = spec.etapas[1].campos[0].label;
console.log("pergunta:", pergunta);
console.log("mensagem wa:", spec.destino.whatsappMensagem);
var acentosOk = /você|Você/i.test(pergunta) && /próximos/.test(spec.destino.whatsappMensagem);
console.log("acentos ok?", acentosOk ? "SIM" : "NAO \u2014 abortando");
if (!acentosOk) process.exit(1);
var resp = await fetch("https://stfv-forms-geral.vercel.app/api/publicar", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8", "x-stfv-senha": senha },
  body: JSON.stringify({ spec })
});
var dados = await resp.json();
console.log("status:", resp.status);
console.log(JSON.stringify(dados));
