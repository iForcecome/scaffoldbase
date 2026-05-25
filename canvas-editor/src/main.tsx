import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { installStoreCoordinators } from './stores/coordinate'
import './test-bridge'

installStoreCoordinators()

document.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) e.preventDefault()
}, { passive: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
