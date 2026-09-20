import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * Registered from BASE_URL, not '/', because Pages serves this app from
 * /Song-Game/ — a worker at the root would be out of scope there and silently
 * control nothing. Failure is ignored on purpose: the worker only exists to
 * make the app installable, so the game must not depend on it.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
