// ============================================================================
// A identidade visual em CSS puro. Duas saidas:
//
//  - cssPuro()      -> tudo escrito na mao, sem Tailwind. Vai dentro do HTML
//                      standalone e serve pra qualquer site (WordPress, LP de
//                      terceiro, pagina solta).
//  - cssTailwind()  -> o bloco @layer components pra colar no index.css de uma
//                      LP que ainda nao tenha as classes de formulario.
//
// Os valores sao os mesmos do tailwind.config.js das LPs:
//   dark-teal #09282B · lime #D7F264 (dark #C0E046) · off-white #F8F6F7
//   soft-green #EDF5DC · fonte Inter
// ============================================================================

export function cssPuro(): string {
  return `/* ==========================================================================
   Formulário — identidade Se Tu For, Eu Vou! Viagens
   CSS puro (sem Tailwind). Cole junto com o HTML do formulário.
   ========================================================================== */

.stfv-form {
  --dark-teal: #09282B;
  --lime: #D7F264;
  --lime-dark: #C0E046;
  --off-white: #F8F6F7;
  --soft-green: #EDF5DC;

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

/* ---- Etapa de vídeo ---- */
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
.stfv-sucesso h3 { font-size: 1.5rem; font-weight: 700; color: var(--dark-teal); margin: 0 0 0.5rem; }
.stfv-sucesso p { color: rgba(9, 40, 43, 0.7); margin: 0; }

.stfv-oculto { display: none !important; }
`
}

/** Bloco @layer components pro index.css de uma LP que ainda nao tenha as classes. */
export function cssTailwind(): string {
  return `/* ========== FORMULÁRIO PRÓPRIO — classes do padrão STFV ==========
   Cole dentro do @layer components { } do index.css da LP.
   Já existe nas LPs de expedição; só é necessário em site novo. */

  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 bg-lime hover:bg-lime-dark text-dark-teal font-semibold px-8 py-4 rounded-full transition-all duration-300 hover:shadow-lime-glow hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed;
  }
  .btn-outline {
    @apply inline-flex items-center justify-center gap-2 border-2 border-dark-teal/20 text-dark-teal font-semibold px-8 py-4 rounded-full transition-all hover:border-dark-teal hover:bg-dark-teal/5;
  }
  .card {
    @apply bg-white rounded-3xl shadow-card p-6 md:p-8;
  }
  .input-label {
    @apply block text-sm font-semibold text-dark-teal mb-2;
  }
  .input {
    @apply w-full rounded-xl border border-dark-teal/15 bg-off-white px-4 py-3.5 text-dark-teal placeholder:text-dark-teal/35 outline-none transition-colors focus:border-lime-dark focus:ring-2 focus:ring-lime/40;
  }
  .radio-group {
    @apply flex flex-col gap-2 mt-3;
  }
  .radio-item {
    @apply flex items-center gap-3 rounded-xl border border-dark-teal/15 bg-off-white px-4 py-3 cursor-pointer transition-colors hover:border-dark-teal/30 has-[:checked]:border-lime-dark has-[:checked]:bg-lime/15;
  }
  .field-error {
    @apply text-red-600 text-xs mt-1.5;
  }
  .input-error {
    @apply border-red-500 focus:border-red-500 focus:ring-red-200;
  }
  .radio-error-legend {
    @apply text-red-600;
  }

/* E no tailwind.config.js, dentro de theme.extend:
   colors: {
     'dark-teal': { DEFAULT: '#09282B', light: '#0F3A3F', soft: '#14494E' },
     'off-white': '#F8F6F7',
     lime: { DEFAULT: '#D7F264', dark: '#C0E046' },
     'light-green': '#DFEFC5',
     'soft-green': '#EDF5DC',
   },
   boxShadow: {
     'lime-glow': '0 12px 40px -8px rgba(215, 242, 100, 0.4)',
     card: '0 8px 30px rgba(9, 40, 43, 0.08)',
   },
*/
`
}
