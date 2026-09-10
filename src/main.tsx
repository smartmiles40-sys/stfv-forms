import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Portao from './components/Portao'
import './index.css'

// O painel inteiro vive atras do Portao: nada monta antes de o servidor
// confirmar a senha. Ver o cabecalho de Portao.tsx.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Portao>
      <App />
    </Portao>
  </StrictMode>,
)
