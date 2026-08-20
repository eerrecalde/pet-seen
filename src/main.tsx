import { StrictMode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './app/App'
import { AuthProvider } from './auth/AuthProvider'
import { queryClient } from './lib/query-client'
import './i18n'
import 'remixicon/fonts/remixicon.css'
import './styles/index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/service-worker.js') })
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('The application root could not be found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider><App /></AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
