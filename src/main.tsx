import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './app/App'
import 'remixicon/fonts/remixicon.css'
import './styles/index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('The application root could not be found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
