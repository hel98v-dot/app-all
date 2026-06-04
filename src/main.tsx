import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { readSchedules } from './lib/schedules'

// Migrazione schede/log (tag scheduleId) prima del primo render.
try { readSchedules() } catch { /* ignore */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
