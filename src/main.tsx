import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { readSchedules, collapseToSingleCustomSchedule, reconcileActiveProfile } from './lib/schedules'

// Prima del primo render:
//  1. Migrazione schede/log (tag scheduleId).
//  2. Collasso al modello "un solo programma" (unisce vecchie schede multiple).
//  3. Riconciliazione: ri-tagga i log orfani e atterra l'utente sui propri dati.
try { readSchedules() } catch { /* ignore */ }
try { collapseToSingleCustomSchedule() } catch { /* ignore */ }
try { reconcileActiveProfile() } catch { /* ignore */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
