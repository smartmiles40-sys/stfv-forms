// src/lib/util.ts
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

// src/generators/comum.ts
function camposDoSpec(spec) {
  return spec.etapas.flatMap((e) => e.campos);
}
function trackKeys(spec) {
  return [...spec.tracking.utms, ...spec.tracking.clickIds];
}
function serializarEtapas(spec) {
  return spec.etapas.map((e) => {
    const base = {
      titulo: e.titulo,
      tipo: e.tipo,
      textoBotao: e.textoBotao,
      campos: e.campos.map((c) => {
        const campo = {
          tipo: c.tipo,
          name: c.name,
          label: c.label,
          obrigatorio: c.obrigatorio
        };
        const ph = c.placeholder || placeholderPadrao(c.tipo);
        if (ph) campo.placeholder = ph;
        if (c.ajuda) campo.ajuda = c.ajuda;
        if (c.erro) campo.erro = c.erro;
        if (c.largura === "metade") campo.largura = "metade";
        if (c.tipo === "oculto" && c.valorFixo) campo.valorFixo = c.valorFixo;
        if (c.opcoes.length) campo.opcoes = c.opcoes.map((o) => ({ label: o.label, slug: o.slug }));
        return campo;
      })
    };
    if (e.tipo === "video") base.video = { ...e.video };
    return base;
  });
}
function mapaDeSlugs(spec) {
  const mapa = {};
  for (const c of camposDoSpec(spec)) {
    if (!c.opcoes.length) continue;
    mapa[c.name] = Object.fromEntries(c.opcoes.map((o) => [o.label, o.slug]));
  }
  return mapa;
}
function camposFixosObjeto(spec) {
  return Object.fromEntries(
    spec.destino.camposFixos.filter((f) => f.name.trim()).map((f) => [f.name.trim(), f.valor])
  );
}
function json(valor, indent = 2) {
  return JSON.stringify(valor, null, indent);
}

// src/generators/cssIdentidade.ts
function cssPuro() {
  return `/* ==========================================================================
   Formul\xE1rio \u2014 identidade Se Tu For, Eu Vou! Viagens
   CSS puro (sem Tailwind). Cole junto com o HTML do formul\xE1rio.
   ========================================================================== */

.stfv-form {
  --dark-teal: #09282B;
  --lime: #D7F264;
  --lime-dark: #C0E046;
  --off-white: #F8F6F7;
  --soft-green: #EDF5DC;
  --fonte-titulo: "moret-variable", "Moret", Georgia, serif;

  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--dark-teal);
  background: #fff;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 8px 30px rgba(9, 40, 43, 0.08);
  text-align: left;
  -webkit-font-smoothing: antialiased;
}
@media (min-width: 768px) {
  .stfv-form { padding: 2rem; }
}
.stfv-form *, .stfv-form *::before, .stfv-form *::after { box-sizing: border-box; }
.stfv-form fieldset { border: 0; margin: 0; padding: 0; }

/* ---- Indicador de etapas ---- */
.stfv-steps {
  display: flex; align-items: center; justify-content: center;
  gap: 0.75rem; margin-bottom: 2rem;
}
.stfv-step-dot {
  width: 2rem; height: 2rem; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.875rem; font-weight: 700;
  background: rgba(9, 40, 43, 0.1); color: rgba(9, 40, 43, 0.5);
  transition: background-color .2s, color .2s;
}
.stfv-step-dot.is-ativo { background: var(--lime); color: var(--dark-teal); }
.stfv-step-dot.is-passado { background: var(--dark-teal); color: var(--off-white); }
.stfv-step-linha { width: 2.5rem; height: 2px; background: rgba(9, 40, 43, 0.2); }

/* ---- Campos ---- */
.stfv-etapa-rotulo {
  display: block; text-align: center; margin-bottom: 1.5rem;
  font-family: var(--fonte-titulo);
  font-size: 0.875rem; font-weight: 600; color: rgba(9, 40, 43, 0.6);
}
.stfv-campos { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
@media (min-width: 640px) {
  .stfv-campos { grid-template-columns: 1fr 1fr; }
  .stfv-campo { grid-column: span 2; }
  .stfv-campo.is-metade { grid-column: span 1; }
}
.stfv-label {
  display: block; font-size: 0.875rem; font-weight: 600;
  color: var(--dark-teal); margin-bottom: 0.5rem;
}
.stfv-label .stfv-opcional { font-weight: 400; color: rgba(9, 40, 43, 0.4); margin-left: 0.25rem; }
.stfv-input {
  width: 100%; border-radius: 0.75rem;
  border: 1px solid rgba(9, 40, 43, 0.15);
  background: var(--off-white);
  padding: 0.875rem 1rem;
  color: var(--dark-teal);
  font-family: inherit; font-size: 1rem;
  outline: none; transition: border-color .2s, box-shadow .2s;
}
.stfv-input::placeholder { color: rgba(9, 40, 43, 0.35); }
.stfv-input:focus {
  border-color: var(--lime-dark);
  box-shadow: 0 0 0 2px rgba(215, 242, 100, 0.4);
}
.stfv-input.is-erro { border-color: #ef4444; }
.stfv-input.is-erro:focus { border-color: #ef4444; box-shadow: 0 0 0 2px #fecaca; }
textarea.stfv-input { resize: vertical; min-height: 7rem; }

.stfv-ajuda { font-size: 0.75rem; color: rgba(9, 40, 43, 0.5); margin: 0.375rem 0 0; }
.stfv-erro { font-size: 0.75rem; color: #dc2626; margin: 0.375rem 0 0; }
.stfv-legend.is-erro { color: #dc2626; }

/* ---- Escolhas ---- */
.stfv-opcoes { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; }
.stfv-opcao {
  display: flex; align-items: center; gap: 0.75rem;
  border-radius: 0.75rem; border: 1px solid rgba(9, 40, 43, 0.15);
  background: var(--off-white); padding: 0.75rem 1rem;
  cursor: pointer; transition: border-color .2s, background-color .2s;
}
.stfv-opcao:hover { border-color: rgba(9, 40, 43, 0.3); }
.stfv-opcao:has(input:checked) { border-color: var(--lime-dark); background: rgba(215, 242, 100, 0.15); }
.stfv-opcao input { width: 1rem; height: 1rem; accent-color: var(--lime); margin: 0; }

/* ---- Botoes ---- */
.stfv-acoes { display: flex; flex-direction: column-reverse; gap: 0.75rem; margin-top: 2rem; }
@media (min-width: 640px) { .stfv-acoes { flex-direction: row; } }
.stfv-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 1rem 2rem; border-radius: 999px; border: 0;
  font-family: inherit; font-size: 1rem; font-weight: 600;
  cursor: pointer; transition: all .3s;
}
.stfv-btn-primary { background: var(--lime); color: var(--dark-teal); }
.stfv-btn-primary:hover:not(:disabled) {
  background: var(--lime-dark);
  box-shadow: 0 12px 40px -8px rgba(215, 242, 100, 0.4);
  transform: scale(1.02);
}
.stfv-btn-primary:active:not(:disabled) { transform: scale(0.98); }
.stfv-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.stfv-btn-outline {
  background: transparent; color: var(--dark-teal);
  border: 2px solid rgba(9, 40, 43, 0.2);
}
.stfv-btn-outline:hover { border-color: var(--dark-teal); background: rgba(9, 40, 43, 0.05); }
@media (min-width: 640px) {
  .stfv-acoes .stfv-btn-outline { width: 33.333%; }
  .stfv-acoes .stfv-btn-primary { flex: 1; }
}

/* ---- Etapa de v\xEDdeo ---- */
.stfv-video { margin-bottom: 1.5rem; }
.stfv-video iframe, .stfv-video video { width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: 0.75rem; }
.stfv-aviso {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  border-radius: 0.75rem; padding: 0.75rem 1rem; font-size: 0.875rem;
  background: rgba(237, 245, 220, 0.6); border: 1px solid rgba(9, 40, 43, 0.1);
  color: rgba(9, 40, 43, 0.75);
}
.stfv-aviso.is-liberado {
  background: rgba(215, 242, 100, 0.25); border-color: var(--lime);
  color: var(--dark-teal); font-weight: 600;
}
.stfv-btn-trava {
  position: relative; overflow: hidden; flex: 1;
  border-radius: 999px; border: 0; background: rgba(9, 40, 43, 0.1);
  padding: 1rem 2rem; cursor: default;
}
.stfv-btn-trava .stfv-barra {
  position: absolute; inset: 0 auto 0 0; width: 0%;
  background: var(--lime); transition: width .2s linear;
}
.stfv-btn-trava .stfv-btn-trava-texto {
  position: relative; z-index: 1;
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  font-size: 0.875rem; font-weight: 600; color: rgba(9, 40, 43, 0.7);
}

/* ---- Sucesso ---- */
.stfv-sucesso { text-align: center; padding: 2.5rem 0; }
.stfv-sucesso h3 {
  font-family: var(--fonte-titulo);
  font-size: 1.5rem; font-weight: 700; color: var(--dark-teal); margin: 0 0 0.5rem;
}
/* Use em qualquer titulo solto que voce adicionar ao form. */
.stfv-form .stfv-titulo { font-family: var(--fonte-titulo); }
.stfv-sucesso p { color: rgba(9, 40, 43, 0.7); margin: 0; }

.stfv-oculto { display: none !important; }
`;
}

// src/generators/htmlPuro.ts
function gerarHtml(spec) {
  const temVideo = spec.etapas.some((e) => e.tipo === "video");
  const tks = trackKeys(spec);
  const L = [];
  const p = (...linhas) => L.push(...linhas);
  const data = (/* @__PURE__ */ new Date()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  p("<!doctype html>");
  p('<html lang="pt-BR">');
  p("<head>");
  p('<meta charset="utf-8" />');
  p('<meta name="viewport" content="width=device-width, initial-scale=1" />');
  p(`<title>${escaparHtml(spec.nome)}</title>`);
  p('<link rel="preconnect" href="https://fonts.googleapis.com" />');
  p('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />');
  p('<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />');
  p('<link rel="preconnect" href="https://use.typekit.net" />');
  p('<link rel="stylesheet" href="https://use.typekit.net/zec1zie.css" />');
  p("<style>");
  p("body { margin: 0; background: #F8F6F7; padding: 2rem 1rem; }");
  p(".stfv-wrap { max-width: 42rem; margin: 0 auto; }");
  p(cssPuro());
  p("</style>");
  p("</head>");
  p("<body>");
  p("");
  p(`<!-- ==== COLE DAQUI ====================================================`);
  p(`     ${spec.nome} \u2014 gerado pelo STFV Forms em ${data}`);
  p("     Precisa de 3 coisas: a div#stfv-form abaixo, o bloco de estilo do <head>");
  p("     e o bloco de script logo em seguida.");
  p("     ================================================================== -->");
  p('<div class="stfv-wrap"><div id="stfv-form"></div></div>');
  p("");
  p("<script>");
  p("(function () {");
  p("  'use strict';");
  p("");
  p("  // ==== Configuracao =====================================================");
  p(`  var SLUG = ${JSON.stringify(spec.destino.slug)};`);
  p(`  var FORM_NAME = ${JSON.stringify(spec.destino.formName)};`);
  p(`  var ENDPOINT = ${JSON.stringify(spec.destino.url)};`);
  p(`  var CAMPOS_FIXOS = ${json(camposFixosObjeto(spec))};`);
  p(`  var ETAPAS = ${json(serializarEtapas(spec))};`);
  p(`  var TRACK_KEYS = ${json(tks, 0)};`);
  p(`  var FALLBACK_UTM_CONTENT = ${JSON.stringify(spec.tracking.fallbackUtmContent)};`);
  p(`  var FIRST_TOUCH = ${spec.tracking.firstTouch};`);
  p(`  var USA_DATALAYER = ${spec.tracking.dataLayer};`);
  p(`  var EVENTO_CONVERSAO = ${JSON.stringify(spec.tracking.eventoConversao)};`);
  p(`  var SLUGS_DE_RESPOSTA = ${json(mapaDeSlugs(spec))};`);
  p(`  var APOS_ENVIO = ${JSON.stringify(spec.destino.aposEnvio)};`);
  p(`  var REDIRECT_URL = ${JSON.stringify(spec.destino.redirectUrl)};`);
  p(`  var MSG_TITULO = ${JSON.stringify(spec.destino.mensagemTitulo)};`);
  p(`  var MSG_TEXTO = ${JSON.stringify(spec.destino.mensagemTexto)};`);
  p(`  var ERRO_ENVIO = ${JSON.stringify(spec.destino.erroEnvio)};`);
  p(`  var WHATSAPP_HANDOFF = ${spec.destino.whatsappHandoff};`);
  p(`  var WHATSAPP_MSG = ${JSON.stringify(spec.destino.whatsappMensagem)};`);
  p(
    `  var REGRAS_SAIDA = ${json(
      spec.destino.aposEnvio === "redirect" ? (spec.destino.regrasSaida ?? []).filter((r) => r.campo && r.valor).map((r) => ({ campo: r.campo, valor: r.valor, url: r.url, whatsapp: r.whatsapp })) : []
    )};`
  );
  p(`  var MOSTRA_INDICADOR = ${spec.aparencia.indicadorEtapas};`);
  p(`  var MOSTRA_ROTULO = ${spec.aparencia.rotuloEtapa};`);
  p(`  var TOTAL_PASSOS = ETAPAS.length${spec.destino.aposEnvio === "agendamento" ? " + 1" : ""};`);
  if (spec.destino.aposEnvio === "agendamento") {
    p(`  var ROTULO_AGENDA = ${JSON.stringify(spec.destino.agendamentoRotulo || "Escolha o hor\xE1rio")};`);
  }
  p("");
  p("  var LEAD_ID_KEY = SLUG + '_lead_id';");
  p("  var TRACK_STORAGE_KEY = SLUG + '_track';");
  p("");
  p("  // ==== Estado ===========================================================");
  p("  var indice = 0;");
  p("  var valores = {};");
  p("  var erros = {};");
  p("  var track = {};");
  p("  var liberados = {};");
  p("  var deadlines = {};");
  p("  var enviando = false;");
  p("  var erroDeEnvio = false;");
  p("  var raiz = document.getElementById('stfv-form');");
  p("  var timerVideo = null;");
  p("");
  p("  // ==== Helpers ==========================================================");
  p("  function mascaraWhatsapp(v) {");
  p("    var d = String(v).replace(/\\D/g, '').slice(0, 11);");
  p("    if (d.length <= 2) return d;");
  p("    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);");
  p("    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);");
  p("    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);");
  p("  }");
  p("");
  p("  function mascaraInstagram(v) {");
  p("    var h = String(v).replace(/\\s/g, '').replace(/@/g, '').replace(/[^a-zA-Z0-9._]/g, '').slice(0, 30);");
  p("    return h ? '@' + h : '';");
  p("  }");
  p("");
  p("  var EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/;");
  p("");
  p("  function validarCampo(campo, valor) {");
  p("    var lista = Array.isArray(valor);");
  p("    var vazio = lista ? valor.length === 0 : !String(valor == null ? '' : valor).trim();");
  p("    if (campo.tipo === 'oculto') return '';");
  p("    if (vazio) return campo.obrigatorio ? (campo.erro || 'Campo obrigat\xF3rio') : '';");
  p("    var v = lista ? '' : String(valor);");
  p("    if (campo.tipo === 'texto') return v.trim().length < 3 ? (campo.erro || 'Preencha este campo') : '';");
  p("    if (campo.tipo === 'email') return EMAIL_RE.test(v.trim()) ? '' : (campo.erro || 'Digite um e-mail v\xE1lido');");
  p("    if (campo.tipo === 'whatsapp') {");
  p("      var d = v.replace(/\\D/g, '');");
  p("      return d.length === 11 && d[2] === '9' ? '' : (campo.erro || 'Digite um celular v\xE1lido com DDD (11 d\xEDgitos). Ex.: (11) 98765-4321');");
  p("    }");
  p("    if (campo.tipo === 'instagram') return v.replace('@', '').length >= 2 ? '' : (campo.erro || 'Digite seu @ do Instagram');");
  p("    return '';");
  p("  }");
  p("");
  p("  function gerarLeadId() {");
  p("    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();");
  p("    return 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);");
  p("  }");
  p("");
  p("  function pushDataLayer(evento, dados) {");
  p("    if (!USA_DATALAYER) return;");
  p("    window.dataLayer = window.dataLayer || [];");
  p("    var o = { event: evento, form_name: FORM_NAME };");
  p("    for (var k in dados) if (Object.prototype.hasOwnProperty.call(dados, k)) o[k] = dados[k];");
  p("    window.dataLayer.push(o);");
  p("  }");
  p("");
  p("  function esc(s) {");
  p("    return String(s == null ? '' : s)");
  p("      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')");
  p(`      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');`);
  p("  }");
  p("");
  p("  // ==== Tracking =========================================================");
  p("  function capturarTrack() {");
  p("    var params = new URLSearchParams(window.location.search);");
  p("    var salvo = {};");
  p("    if (FIRST_TOUCH) {");
  p("      try {");
  p("        salvo = JSON.parse(sessionStorage.getItem(TRACK_STORAGE_KEY) || '{}') || {};");
  p("      } catch (e) { salvo = {}; }");
  p("    }");
  p("    TRACK_KEYS.forEach(function (k) {");
  p("      var atual = salvo[k] || '';");
  p("      var daUrl = (params.get(k) || '').slice(0, 200);");
  p("      // First-touch: quem chegou primeiro manda; a URL so preenche vazio.");
  p("      track[k] = FIRST_TOUCH ? (atual || daUrl) : daUrl;");
  p("    });");
  p("    if (FIRST_TOUCH) {");
  p("      try { sessionStorage.setItem(TRACK_STORAGE_KEY, JSON.stringify(track)); } catch (e) {}");
  p("    }");
  p("    // Fallback DERIVADO (nao persistido): se voltar taggeado, o valor real vence.");
  p("    if (FALLBACK_UTM_CONTENT && TRACK_KEYS.indexOf('utm_content') >= 0 && !track.utm_content) {");
  p("      track.utm_content = FALLBACK_UTM_CONTENT;");
  p("    }");
  p("  }");
  p("");
  p("  // ==== Render ===========================================================");
  p("  function htmlCampo(campo) {");
  p("    if (campo.tipo === 'oculto') return '';");
  p("    var erro = erros[campo.name] || '';");
  p("    var valor = valores[campo.name];");
  p("    var classe = 'stfv-campo' + (campo.largura === 'metade' ? ' is-metade' : '');");
  p("    var rodape = erro");
  p(`      ? '<p class="stfv-erro">' + esc(erro) + '</p>'`);
  p(`      : (campo.ajuda ? '<p class="stfv-ajuda">' + esc(campo.ajuda) + '</p>' : '');`);
  p("");
  p("    if (campo.tipo === 'radio' || campo.tipo === 'checkbox') {");
  p("      var marcado = Array.isArray(valor) ? valor : (valor ? [valor] : []);");
  p("      var opcoes = (campo.opcoes || []).map(function (o) {");
  p("        var chk = marcado.indexOf(o.label) >= 0 ? ' checked' : '';");
  p(`        return '<label class="stfv-opcao"><input type="' + (campo.tipo === 'radio' ? 'radio' : 'checkbox') +`);
  p(`          '" name="' + esc(campo.name) + '" value="' + esc(o.label) + '"' + chk + ' data-campo="' + esc(campo.name) + '" />' +`);
  p("          '<span>' + esc(o.label) + '</span></label>';");
  p("      }).join('');");
  p(`      return '<fieldset class="' + classe + '"><legend class="stfv-label stfv-legend' + (erro ? ' is-erro' : '') + '">' +`);
  p(`        esc(campo.label) + '</legend><div class="stfv-opcoes">' + opcoes + '</div>' + rodape + '</fieldset>';`);
  p("    }");
  p("");
  p("    if (campo.tipo === 'consentimento') {");
  p("      var c = valor === 'sim' ? ' checked' : '';");
  p(`      return '<div class="' + classe + '"><label class="stfv-opcao">' +`);
  p(`        '<input type="checkbox" data-campo="' + esc(campo.name) + '" data-consent="1"' + c + ' />' +`);
  p("        '<span>' + esc(campo.label) + '</span></label>' + rodape + '</div>';");
  p("    }");
  p("");
  p(`    var opcional = campo.obrigatorio ? '' : '<span class="stfv-opcional">(opcional)</span>';`);
  p(`    var rotulo = '<label class="stfv-label" for="' + esc(campo.name) + '">' + esc(campo.label) + opcional + '</label>';`);
  p("    var cls = 'stfv-input' + (erro ? ' is-erro' : '');");
  p("");
  p("    if (campo.tipo === 'select') {");
  p("      var itens = (campo.opcoes || []).map(function (o) {");
  p(`        return '<option value="' + esc(o.label) + '"' + (valor === o.label ? ' selected' : '') + '>' + esc(o.label) + '</option>';`);
  p("      }).join('');");
  p(`      return '<div class="' + classe + '">' + rotulo + '<select class="' + cls + '" id="' + esc(campo.name) +`);
  p(`        '" name="' + esc(campo.name) + '" data-campo="' + esc(campo.name) + '"><option value="">' +`);
  p("        esc(campo.placeholder || 'Selecione\u2026') + '</option>' + itens + '</select>' + rodape + '</div>';");
  p("    }");
  p("");
  p("    if (campo.tipo === 'textarea') {");
  p(`      return '<div class="' + classe + '">' + rotulo + '<textarea class="' + cls + '" id="' + esc(campo.name) +`);
  p(`        '" name="' + esc(campo.name) + '" rows="4" placeholder="' + esc(campo.placeholder) +`);
  p(`        '" data-campo="' + esc(campo.name) + '">' + esc(valor) + '</textarea>' + rodape + '</div>';`);
  p("    }");
  p("");
  p("    var tipoHtml = campo.tipo === 'email' ? 'email'");
  p("      : campo.tipo === 'whatsapp' ? 'tel'");
  p("      : campo.tipo === 'data' ? 'date'");
  p("      : campo.tipo === 'numero' ? 'number' : 'text';");
  p(`    var extra = campo.tipo === 'whatsapp' ? ' maxlength="15" inputmode="numeric"' : '';`);
  p(`    if (campo.tipo === 'instagram') extra += ' autocapitalize="none"';`);
  p(`    return '<div class="' + classe + '">' + rotulo + '<input class="' + cls + '" type="' + tipoHtml +`);
  p(`      '" id="' + esc(campo.name) + '" name="' + esc(campo.name) + '" placeholder="' + esc(campo.placeholder) +`);
  p(`      '" value="' + esc(valor) + '" data-campo="' + esc(campo.name) + '"' + extra + ' />' + rodape + '</div>';`);
  p("  }");
  p("");
  p("  /**");
  p("   * As bolinhas do topo. `ativo` e o passo atual (base 0).");
  p("   *");
  p("   * Vive fora do render() porque a tela do agendamento precisa das MESMAS");
  p("   * bolinhas: duplicar a marcacao faria uma divergir da outra no primeiro");
  p("   * ajuste, e o sintoma seria o indicador saltando de 2 pra 3 sem motivo.");
  p("   */");
  p("  function indicador(ativo) {");
  p("    if (!MOSTRA_INDICADOR || TOTAL_PASSOS < 2) return '';");
  p(`    var h = '<div class="stfv-steps">';`);
  p("    for (var i = 0; i < TOTAL_PASSOS; i++) {");
  p(`      if (i > 0) h += '<span class="stfv-step-linha"></span>';`);
  p("      var estado = i === ativo ? ' is-ativo' : (i < ativo ? ' is-passado' : '');");
  p(`      h += '<span class="stfv-step-dot' + estado + '">' + (i + 1) + '</span>';`);
  p("    }");
  p("    return h + '</div>';");
  p("  }");
  p("");
  p('  /** "Etapa 2 de 3 \xB7 Confirmacao" \u2014 o total conta o agendamento. */');
  p("  function rotuloDoPasso(ativo, titulo) {");
  p("    if (!MOSTRA_ROTULO) return '';");
  p("    var prefixo = TOTAL_PASSOS > 1 ? 'Etapa ' + (ativo + 1) + ' de ' + TOTAL_PASSOS + ' \xB7 ' : '';");
  p(`    return '<p class="stfv-etapa-rotulo">' + esc(prefixo + titulo) + '</p>';`);
  p("  }");
  p("");
  p("  function render() {");
  p("    var etapa = ETAPAS[indice];");
  p("    if (!etapa) return;");
  p("    var liberada = etapa.tipo !== 'video' || liberados[indice] === true;");
  p("    var ultima = indice === ETAPAS.length - 1;");
  p("    var h = '';");
  p("");
  p("    h += indicador(indice);");
  p("    h += rotuloDoPasso(indice, etapa.titulo);");
  p("");
  p("    if (etapa.tipo === 'video') {");
  p(`      h += '<div class="stfv-video">' + (etapa.video && etapa.video.embedHtml ? etapa.video.embedHtml : '') + '</div>';`);
  p("      h += liberada");
  p(`        ? '<div class="stfv-aviso is-liberado">' + esc(etapa.video.textoLiberado) + '</div>'`);
  p(`        : '<div class="stfv-aviso">' + esc(etapa.video.textoBloqueado) + '</div>';`);
  p("    } else {");
  p(`      h += '<div class="stfv-campos">' + etapa.campos.map(htmlCampo).join('') + '</div>';`);
  p("    }");
  p("");
  p(`    if (erroDeEnvio) h += '<p class="stfv-erro" style="text-align:center;margin-top:1.5rem">' + esc(ERRO_ENVIO) + '</p>';`);
  p("");
  p(`    h += '<div class="stfv-acoes">';`);
  p(`    if (indice > 0) h += '<button type="button" class="stfv-btn stfv-btn-outline" data-acao="voltar">Voltar</button>';`);
  p("    if (ultima) {");
  p(`      h += '<button type="submit" class="stfv-btn stfv-btn-primary"' + (enviando || !liberada ? ' disabled' : '') + '>' +`);
  p("        esc(enviando ? 'Enviando\u2026' : etapa.textoBotao) + '</button>';");
  p("    } else if (!liberada) {");
  p(`      h += '<button type="button" class="stfv-btn-trava" disabled><span class="stfv-barra"></span>' +`);
  p(`        '<span class="stfv-btn-trava-texto">Carregando as pr\xF3ximas perguntas\u2026</span></button>';`);
  p("    } else {");
  p(`      h += '<button type="button" class="stfv-btn stfv-btn-primary" data-acao="avancar">' + esc(etapa.textoBotao) + '</button>';`);
  p("    }");
  p("    h += '</div>';");
  p("");
  p(`    raiz.innerHTML = '<form class="stfv-form" novalidate>' + h + '</form>';`);
  p("    ligarEventos();");
  p("    if (etapa.tipo === 'video' && !liberada) iniciarTrava();");
  p("  }");
  p("");
  p("  function renderSucesso() {");
  p(`    raiz.innerHTML = '<div class="stfv-form"><div class="stfv-sucesso"><h3>' + esc(MSG_TITULO) +`);
  p("      '</h3><p>' + esc(MSG_TEXTO) + '</p></div></div>';");
  p("  }");
  p("");
  p("  // ==== Eventos ==========================================================");
  p("  function ligarEventos() {");
  p("    var form = raiz.querySelector('form');");
  p("    if (!form) return;");
  p("");
  p("    form.addEventListener('submit', function (e) { e.preventDefault(); enviar(); });");
  p("");
  p(`    form.querySelectorAll('[data-acao="avancar"]').forEach(function (b) {`);
  p("      b.addEventListener('click', avancar);");
  p("    });");
  p(`    form.querySelectorAll('[data-acao="voltar"]').forEach(function (b) {`);
  p("      b.addEventListener('click', function () {");
  p("        pushDataLayer('form_step_back', { from_step: indice + 1, to_step: indice });");
  p("        indice = Math.max(0, indice - 1);");
  p("        render();");
  p("      });");
  p("    });");
  p("");
  p("    form.querySelectorAll('[data-campo]').forEach(function (el) {");
  p("      var name = el.getAttribute('data-campo');");
  p("      var tipo = el.type;");
  p("      if (tipo === 'radio') {");
  p("        el.addEventListener('change', function () { valores[name] = el.value; erros[name] = ''; });");
  p("      } else if (tipo === 'checkbox' && el.getAttribute('data-consent')) {");
  p("        el.addEventListener('change', function () { valores[name] = el.checked ? 'sim' : ''; erros[name] = ''; });");
  p("      } else if (tipo === 'checkbox') {");
  p("        el.addEventListener('change', function () {");
  p("          var atual = Array.isArray(valores[name]) ? valores[name].slice() : [];");
  p("          var i = atual.indexOf(el.value);");
  p("          if (el.checked && i < 0) atual.push(el.value);");
  p("          if (!el.checked && i >= 0) atual.splice(i, 1);");
  p("          valores[name] = atual; erros[name] = '';");
  p("        });");
  p("      } else {");
  p("        el.addEventListener('input', function () {");
  p("          var campo = acharCampo(name);");
  p("          if (campo && campo.tipo === 'whatsapp') el.value = mascaraWhatsapp(el.value);");
  p("          if (campo && campo.tipo === 'instagram') el.value = mascaraInstagram(el.value);");
  p("          valores[name] = el.value; erros[name] = '';");
  p("        });");
  p("      }");
  p("    });");
  p("  }");
  p("");
  p("  function acharCampo(name) {");
  p("    for (var i = 0; i < ETAPAS.length; i++) {");
  p("      var achado = ETAPAS[i].campos.filter(function (c) { return c.name === name; })[0];");
  p("      if (achado) return achado;");
  p("    }");
  p("    return null;");
  p("  }");
  p("");
  if (temVideo) {
    p("  // Trava do video: deadline por etapa, entao voltar/avancar nao reinicia.");
    p("  function iniciarTrava() {");
    p("    var etapa = ETAPAS[indice];");
    p("    var total = Math.max(1, (etapa.video && etapa.video.travaSegundos) || 60) * 1000;");
    p("    if (deadlines[indice] == null) deadlines[indice] = Date.now() + total;");
    p("    if (timerVideo) clearInterval(timerVideo);");
    p("    var barra = raiz.querySelector('.stfv-barra');");
    p("    timerVideo = setInterval(function () {");
    p("      var ms = deadlines[indice] - Date.now();");
    p("      var pct = Math.min(100, Math.max(0, ((total - ms) / total) * 100));");
    p("      if (barra) barra.style.width = pct + '%';");
    p("      if (ms <= 0) {");
    p("        clearInterval(timerVideo); timerVideo = null;");
    p("        liberados[indice] = true;");
    p("        pushDataLayer('form_video_unlocked', { step: indice + 1 });");
    p("        render();");
    p("      }");
    p("    }, 250);");
    p("  }");
    p("");
  } else {
    p("  function iniciarTrava() {}");
    p("");
  }
  p("  // ==== Fluxo ============================================================");
  p("  function validarEtapa() {");
  p("    var etapa = ETAPAS[indice];");
  p("    var ok = true;");
  p("    etapa.campos.forEach(function (campo) {");
  p("      var v = valores[campo.name];");
  p("      if (v === undefined) v = campo.tipo === 'checkbox' ? [] : '';");
  p("      var msg = validarCampo(campo, v);");
  p("      erros[campo.name] = msg;");
  p("      if (msg) {");
  p("        ok = false;");
  p("        pushDataLayer('form_validation_error', { step: indice + 1, field: campo.name });");
  p("      }");
  p("    });");
  p("    return ok;");
  p("  }");
  p("");
  p("  function avancar() {");
  p("    var etapa = ETAPAS[indice];");
  p("    if (etapa.tipo === 'video' && !liberados[indice]) return;");
  p("    if (!validarEtapa()) { render(); return; }");
  p("    if (!sessionStorage.getItem(LEAD_ID_KEY)) sessionStorage.setItem(LEAD_ID_KEY, gerarLeadId());");
  p("    pushDataLayer('form_step_complete', { step: indice + 1, lead_id: sessionStorage.getItem(LEAD_ID_KEY) });");
  p("    indice = Math.min(indice + 1, ETAPAS.length - 1);");
  p("    pushDataLayer('form_step_view', { step: indice + 1 });");
  p("    render();");
  p("  }");
  p("");
  p("  function montarPayload(leadId) {");
  p("    var respostas = {};");
  p("    ETAPAS.forEach(function (et) {");
  p("      et.campos.forEach(function (campo) {");
  p("        if (campo.tipo === 'oculto') { respostas[campo.name] = campo.valorFixo || ''; return; }");
  p("        var v = valores[campo.name];");
  p("        var texto = Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v);");
  p("        // WhatsApp em E.164 e e-mail min\xFAsculo: \xE9 o formato que o CRM espera,");
  p("        // e no modo webhook direto n\xE3o h\xE1 backend pra normalizar depois.");
  p("        if (campo.tipo === 'whatsapp') texto = texto ? '+55' + texto.replace(/\\D/g, '') : '';");
  p("        if (campo.tipo === 'email') texto = texto.trim().toLowerCase();");
  p("        respostas[campo.name] = texto;");
  p("      });");
  p("    });");
  p("    var payload = { lead_id: leadId };");
  p("    for (var f in CAMPOS_FIXOS) payload[f] = CAMPOS_FIXOS[f];");
  p("    for (var r in respostas) payload[r] = respostas[r];");
  p("    for (var t in track) payload[t] = track[t];");
  p("    payload.form_name = FORM_NAME;");
  p("    payload.slug = SLUG;");
  p("    payload.timestamp = new Date().toISOString();");
  p("    payload.etapa = 'completo';");
  p("    payload.formulario_completo = true;");
  p("    return { payload: payload, respostas: respostas };");
  p("  }");
  p("");
  p("  /** Pra onde este lead vai, dada a resposta dele. */");
  p("  function destinoDoLead(respostas) {");
  p("    for (var i = 0; i < REGRAS_SAIDA.length; i++) {");
  p("      var regra = REGRAS_SAIDA[i];");
  p("      if (respostas[regra.campo] === regra.valor)");
  p("        return { url: regra.url, whatsapp: regra.whatsapp };");
  p("    }");
  p("    return { url: REDIRECT_URL, whatsapp: WHATSAPP_HANDOFF };");
  p("  }");
  p("");
  if (spec.destino.aposEnvio === "agendamento") {
    p("  // ==== AUTOAGENDAMENTO (QS) ============================================");
    p("  // Antes daqui a pessoa era jogada no wa.me. Trocado em 08/09/2026: o numero");
    p("  // unico do time estava sendo derrubado pelo volume, e mandar todo mundo pra");
    p("  // uma conversa que ninguem responde perde a reuniao que ja estava ganha.");
    p("  // Agora ela escolhe o horario na hora, e a reuniao nasce no QS com");
    p("  // especialista, sala do Meet e o card do Bitrix atualizado.");
    p(`  var QS_ORIGEM = '${origemDe(spec.destino.agendamentoUrl)}';`);
    p("");
    p("  function renderAgendamento(respostas, jaNoBitrix, payload) {");
    p(`    var url = QS_ORIGEM + '${caminhoDe(spec.destino.agendamentoUrl)}?embed=1&expedicao=' +`);
    p("      encodeURIComponent(CAMPOS_FIXOS.expedicao || '');");
    p("");
    p("    raiz.innerHTML =");
    p(`      '<div class="stfv-form">' +`);
    p("        // O ultimo passo, aceso. A pessoa ve desde a primeira tela que");
    p("        // sao tres \u2014 e aqui ve que esta no ultimo, nao numa tela extra.");
    p("        indicador(ETAPAS.length) +");
    p("        rotuloDoPasso(ETAPAS.length, ROTULO_AGENDA) +");
    p(`        '<div class="stfv-sucesso" style="padding:1.25rem 0 0.75rem">' +`);
    p("          '<h3>' + esc(MSG_TITULO) + '</h3>' +");
    p("          '<p>' + esc(MSG_TEXTO) + '</p>' +");
    p("        '</div>' +");
    p(`        '<iframe id="stfv-agenda" title="Escolha o dia e o horario" loading="eager" ' +`);
    p(`          'style="width:100%;border:0;display:block;min-height:520px"></iframe>' +`);
    p("      '</div>';");
    p("");
    p("    var quadro = document.getElementById('stfv-agenda');");
    p("");
    p("    window.addEventListener('message', function (e) {");
    p("      if (e.origin !== QS_ORIGEM || !e.data || typeof e.data !== 'object') return;");
    p("");
    p("      // O iframe avisa quando esta pronto; so entao os dados vao. Sem esse");
    p("      // aperto de mao, a mensagem sai antes de existir quem a escute.");
    p("      if (e.data.tipo === 'qs-agendar:pronto') {");
    p("        quadro.contentWindow.postMessage({");
    p("          tipo: 'qs-agendar:preencher',");
    p("          nome: respostas.nome || '',");
    p("          email: respostas.email || '',");
    p("          telefone: respostas.whatsapp || '',");
    p("          expedicao: CAMPOS_FIXOS.expedicao || '',");
    p("          origem: CAMPOS_FIXOS.fonte || '',");
    p("          // So afirma que o negocio existe quando o /api/save-lead REALMENTE");
    p("          // respondeu ok. Se o envio falhou, mentir aqui faria o QS pular a");
    p("          // criacao do card e a pessoa ficaria sem negocio nenhum no Bitrix.");
    p("          ja_no_bitrix: jaNoBitrix === true");
    p("        }, QS_ORIGEM);");
    p("      }");
    p("");
    p("      // O iframe nao sabe a propria altura pra quem esta de fora.");
    p("      if (e.data.tipo === 'qs-agendar:altura' && e.data.altura) {");
    p("        quadro.style.height = e.data.altura + 'px';");
    p("      }");
    p("");
    p("      if (e.data.tipo === 'qs-agendar:concluido') {");
    p("        pushDataLayer('reuniao_agendada', { form_name: FORM_NAME, destino: SLUG });");
    p("        // AGORA o lead vai pro Bitrix. Antes daqui ele so ficou guardado:");
    p("        // o negocio nasce quando a pessoa TERMINA o funil, nao quando ela");
    p("        // digita o nome. Nasce ja no funil comercial, na coluna de reuniao,");
    p("        // e ja dizendo o horario, o especialista e o link da sala.");
    p("        //");
    p('        // keepalive: a pessoa costuma fechar a aba assim que ve o "marcado".');
    p("        // Sem isso o navegador cancelaria o envio no meio e a reuniao");
    p("        // existiria no QS sem card no CRM.");
    p("        try {");
    p("          fetch(ENDPOINT, {");
    p("            method: 'POST',");
    p("            headers: { 'Content-Type': 'application/json' },");
    p("            keepalive: true,");
    p("            body: JSON.stringify(Object.assign({}, payload || {}, {");
    p("              agendado: true,");
    p("              reuniao_quando: e.data.quando || '',");
    p("              reuniao_especialista: e.data.especialista || '',");
    p("              reuniao_link: e.data.link || ''");
    p("            }))");
    p("          });");
    p("        } catch (err) { /* o QS ja tem a reuniao; o card entra pela lista de espera */ }");
    p("      }");
    p("    });");
    p("");
    p("    // src depois do listener: iframe em cache dispara o 'pronto' rapido demais.");
    p("    quadro.src = url;");
    p("  }");
    p("");
    p("  function concluir(respostas, salvou, payload) {");
    p("    sessionStorage.removeItem(LEAD_ID_KEY);");
    p("    renderAgendamento(respostas, salvou === true, payload);");
    p("  }");
  } else {
    p("  function concluir(respostas) {");
    p("    sessionStorage.removeItem(LEAD_ID_KEY);");
    p("    var saida = destinoDoLead(respostas);");
    p("    var url = saida.url;");
    p("    if (saida.whatsapp) {");
    p("      var msg = WHATSAPP_MSG.replace(/\\{(\\w+)\\}/g, function (_m, chave) {");
    p("        return String(respostas[chave] == null ? '' : respostas[chave]).trim();");
    p("      });");
    p("      try {");
    p("        sessionStorage.setItem('stfv_wa_msg', msg);");
    p("        sessionStorage.removeItem('stfv_wa_redirecionado');");
    p("      } catch (e) {}");
    p("      // Indo direto pro WhatsApp a mensagem tem que ir na URL: o sessionStorage");
    p("      // so e lido quando existe uma pagina de obrigado nossa no meio.");
    p("      if (/wa\\.me|api\\.whatsapp\\.com/.test(url))");
    p("        url += (url.indexOf('?') === -1 ? '?' : '&') + 'text=' + encodeURIComponent(msg);");
    p("    }");
    p("    if (APOS_ENVIO === 'redirect') window.location.href = url;");
    p("    else renderSucesso();");
    p("  }");
  }
  p("");
  p("  function enviar() {");
  p("    var etapa = ETAPAS[indice];");
  p("    if (etapa.tipo === 'video' && !liberados[indice]) return;");
  p("    erroDeEnvio = false;");
  p("    if (!validarEtapa()) { render(); return; }");
  p("");
  p("    var leadId = sessionStorage.getItem(LEAD_ID_KEY) || gerarLeadId();");
  p("    sessionStorage.setItem(LEAD_ID_KEY, leadId);");
  p("    var montado = montarPayload(leadId);");
  p("");
  p("    enviando = true;");
  p("    render();");
  p("");
  p("    fetch(ENDPOINT, {");
  p("      method: 'POST',");
  p("      headers: { 'Content-Type': 'application/json' },");
  p("      body: JSON.stringify(montado.payload)");
  p("    })");
  p("      .then(function (resp) {");
  p("        if (!resp.ok) throw new Error('envio ' + resp.status);");
  p("        var navegou = false;");
  p("        var fim = function () { if (navegou) return; navegou = true; concluir(montado.respostas, true, montado.payload); };");
  p("        if (USA_DATALAYER) {");
  p("          var respSlugs = {};");
  p("          for (var name in SLUGS_DE_RESPOSTA) {");
  p("            respSlugs[name] = SLUGS_DE_RESPOSTA[name][montado.respostas[name]] || '';");
  p("          }");
  p("          window.dataLayer = window.dataLayer || [];");
  p("          var evento = {");
  p("            event: EVENTO_CONVERSAO,");
  p("            form_name: FORM_NAME,");
  p("            destino: SLUG,");
  p("            event_id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),");
  p("            lead: {");
  p("              nome: montado.respostas.nome || '',");
  p("              email: montado.respostas.email || '', // j\xE1 normalizado acima");
  p("              whatsapp: montado.respostas.whatsapp || '', // j\xE1 em E.164");
  p("              instagram: montado.respostas.instagram || ''");
  p("            },");
  p("            resp: respSlugs,");
  p("            eventCallback: fim,");
  p("            eventTimeout: 2000");
  p("          };");
  p("          for (var k in track) evento[k] = track[k];");
  p("          window.dataLayer.push(evento);");
  p("          // Rede de seguranca: se o GTM nao chamar o callback, conclui mesmo assim.");
  p("          setTimeout(fim, 2000);");
  p("        } else {");
  p("          fim();");
  p("        }");
  p("      })");
  p("      .catch(function () {");
  p("        if (APOS_ENVIO === 'redirect') {");
  p("          // O envio falhou, mas segurar o lead aqui e o pior dos dois males:");
  p("          // quem chega no destino a gente ja tem (o numero esta na conversa),");
  p("          // quem fica parado numa mensagem de erro some. Ultima tentativa de");
  p("          // salvar com sendBeacon, que sobrevive a saida da pagina, e vai.");
  p("          try {");
  p("            if (navigator.sendBeacon) {");
  p("              navigator.sendBeacon(");
  p("                ENDPOINT,");
  p("                new Blob([JSON.stringify(montado.payload)], { type: 'application/json' })");
  p("              );");
  p("            }");
  p("          } catch (e) { /* sem rede: vai pro destino do mesmo jeito */ }");
  p("          // salvou = false: o POST falhou. O sendBeacon acima e a ultima");
  p("          // tentativa, e ninguem sabe se ela chegou \u2014 entao a etapa seguinte");
  p("          // NAO pode afirmar que o negocio ja existe no Bitrix.");
  p("          concluir(montado.respostas, false, montado.payload);");
  p("          return;");
  p("        }");
  p("        erroDeEnvio = true;");
  p("        enviando = false;");
  p("        render();");
  p("      });");
  p("  }");
  p("");
  p("  // ==== Boot =============================================================");
  p("  capturarTrack();");
  p("  pushDataLayer('form_step_view', { step: 1 });");
  p("  render();");
  p("})();");
  p("</script>");
  p("<!-- ==== ATE AQUI ==== -->");
  p("");
  p("</body>");
  p("</html>");
  return L.join("\n");
}
function origemDe(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "https://qs-turis.vercel.app";
  }
}
function caminhoDe(url) {
  try {
    const p = new URL(url).pathname;
    return p.endsWith("/") ? p : `${p}/`;
  } catch {
    return "/agendar/";
  }
}
function escaparHtml(texto) {
  return String(texto ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// src/types.ts
var ROTULOS_TIPO = {
  texto: "Texto",
  email: "E-mail",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  textarea: "Texto longo",
  radio: "Escolha \xFAnica",
  select: "Lista suspensa",
  checkbox: "M\xFAltipla escolha",
  consentimento: "Consentimento (LGPD)",
  data: "Data",
  numero: "N\xFAmero",
  oculto: "Campo oculto"
};
var TIPOS_COM_OPCOES = ["radio", "select", "checkbox"];

// src/lib/avisos.ts
function avisosDoSpec(spec) {
  const lista = [];
  const campos = spec.etapas.flatMap((e) => e.campos);
  const nomes = campos.map((c) => c.name);
  const semNome = campos.filter((c) => !c.name.trim()).length;
  if (semNome) lista.push(`${semNome} campo(s) sem nome \u2014 n\xE3o chegam ao CRM.`);
  const repetidos = [...new Set(nomes.filter((n, i) => n && nomes.indexOf(n) !== i))];
  if (repetidos.length)
    lista.push(`Nome repetido: ${repetidos.join(", ")} \u2014 um sobrescreve o outro no payload.`);
  if (!nomes.includes("nome") || !nomes.includes("whatsapp"))
    lista.push('Sem campo "nome" ou "whatsapp" \u2014 o backend rejeita o lead na valida\xE7\xE3o.');
  const semOpcoes = campos.filter((c) => TIPOS_COM_OPCOES.includes(c.tipo) && c.opcoes.length === 0);
  if (semOpcoes.length) lista.push(`${semOpcoes.length} campo(s) de escolha sem op\xE7\xF5es.`);
  if (!spec.destino.url.trim()) lista.push("Destino do lead vazio.");
  if (!spec.destino.formName.trim()) lista.push("form_name vazio \u2014 o n8n roteia por ele.");
  const videoSemEmbed = spec.etapas.filter((e) => e.tipo === "video" && !e.video.embedHtml.trim());
  if (videoSemEmbed.length) lista.push("Etapa de v\xEDdeo sem embed.");
  lista.push(...avisosDeSaida(spec, campos, nomes));
  return lista;
}
function avisosDeSaida(spec, campos, nomes) {
  if (spec.destino.aposEnvio !== "redirect") return [];
  const lista = [];
  spec.destino.regrasSaida.forEach((regra, i) => {
    const n = i + 1;
    if (!regra.campo.trim() || !regra.valor.trim()) {
      lista.push(`Sa\xEDda ${n} incompleta \u2014 sem campo ou sem resposta; ela nunca vai bater.`);
      return;
    }
    const campo = campos.find((c) => c.name === regra.campo);
    if (!campo) {
      lista.push(
        `Sa\xEDda ${n} consulta o campo "${regra.campo}", que n\xE3o existe \u2014 todos caem no destino padr\xE3o.`
      );
      return;
    }
    if (!TIPOS_COM_OPCOES.includes(campo.tipo)) {
      lista.push(
        `Sa\xEDda ${n} consulta "${regra.campo}", que \xE9 ${ROTULOS_TIPO[campo.tipo].toLowerCase()} \u2014 s\xF3 campo de escolha tem resposta exata pra comparar.`
      );
      return;
    }
    if (campo.tipo === "checkbox") {
      lista.push(
        `Sa\xEDda ${n} consulta "${regra.campo}", que \xE9 m\xFAltipla escolha \u2014 marcando mais de uma o valor vira "a, b" e a regra n\xE3o bate.`
      );
      return;
    }
    if (!campo.opcoes.some((o) => o.label === regra.valor)) {
      lista.push(
        `Sa\xEDda ${n} espera a resposta "${regra.valor}", que n\xE3o \xE9 mais uma op\xE7\xE3o de "${regra.campo}" \u2014 a regra est\xE1 \xF3rf\xE3 e todos caem no destino padr\xE3o.`
      );
      return;
    }
    if (!regra.url.trim()) lista.push(`Sa\xEDda ${n} sem URL de destino.`);
  });
  const usaWhatsapp = spec.destino.whatsappHandoff || spec.destino.regrasSaida.some((r) => r.whatsapp);
  if (usaWhatsapp && !spec.destino.whatsappMensagem.trim())
    lista.push("Sa\xEDda pro WhatsApp sem mensagem \u2014 o lead abre a conversa em branco.");
  const orfaos = [...spec.destino.whatsappMensagem.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((chave) => !nomes.includes(chave));
  if (orfaos.length)
    lista.push(
      `Mensagem do WhatsApp usa {${[...new Set(orfaos)].join("}, {")}} \u2014 n\xE3o existe campo com esse nome, sai vazio.`
    );
  return lista;
}
export {
  avisosDoSpec,
  gerarHtml
};
