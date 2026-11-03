import '@fontsource-variable/vazirmatn'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Providers } from '@/app/providers'
import { router } from '@/app/router'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/home.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
)
