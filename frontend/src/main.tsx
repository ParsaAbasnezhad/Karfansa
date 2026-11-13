import '@fontsource-variable/vazirmatn'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { Providers } from '@/app/providers'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/home.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
