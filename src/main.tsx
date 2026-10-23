import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './fuentes.css'
import './index.css'
import './shell.css'
import './resumen.css'
import './limpieza.css'
import './seguridad.css'
import App from './App.tsx'
import { AuthProvider } from './AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
