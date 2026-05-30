# App Allenamento — Project Brief

## Obiettivo
Progressive Web App (PWA) mobile-first per tracciare gli allenamenti durante le sessioni in palestra/casa.
Single user (solo proprietario). Niente backend, niente autenticazione, niente sincronizzazione cloud.
Funzionamento offline garantito.

## Stack tecnico
- React 18 + Vite + TypeScript (strict mode)
- Tailwind CSS
- React Router (`react-router-dom`) per il routing
- localStorage per persistenza dei log
- PWA con `vite-plugin-pwa` + Workbox (installabile su iOS/Android via "Aggiungi a schermata Home")
- Nessuna dipendenza da servizi esterni

## Vincoli UX (mobile-first, non negoziabili)
- Progettata per uso sul telefono con UNA mano in palestra (anche con mani sudate)
- Touch target minimo 48×48px
- Contrasto alto, font corpo minimo 16px
- Bottoni primari grandi e ben distanziati
- Apertura: direttamente sulla sessione del giorno corrente, zero passaggi intermedi
- Tema scuro di default (riduce affaticamento visivo in palestra)
- Niente animazioni lente, niente loader pesanti
- Input numerici con tasti +/- accanto per incremento rapido senza tastierino

## Struttura dati
- `src/data/program.ts`: piano statico (5 settimane × 5 sessioni × N esercizi). NON modificare a runtime.
- `src/types.ts`: tipi TypeScript condivisi (importati anche da program.ts)
- localStorage key: `training-log-v1`

### Schema del log
```typescript
type SetLog = { reps: number; kg: number };

type ExerciseLog = {
  exerciseId: string;
  sets: SetLog[];
  completedAt: string;        // ISO timestamp
  notes?: string;
};

type SessionLog = {
  id: string;
  weekNumber: number;         // 1-5
  sessionId: string;
  date: string;               // YYYY-MM-DD
  exercises: ExerciseLog[];
};

type LogStore = {
  startDate: string;          // YYYY-MM-DD, fissata al primo avvio
  sessions: SessionLog[];
};
```

## Funzionalità (in ordine di implementazione)
1. **Tipi e dati**: `src/types.ts` + `src/data/program.ts`.
2. **Storage layer**: hook `useLogStore()` con CRUD + export/import JSON.
3. **Routing + bottom nav**: 5 schermate (`/`, `/storico`, `/volume`, `/personaggio`, `/impostazioni`).
4. **Schermata "Oggi"**: mostra la sessione corrispondente al giorno corrente.
5. **Schermata "Esercizio"**: logging set per set, calcolo volume in tempo reale.
6. **Schermata "Storico"**: lista sessioni passate raggruppate per settimana.
7. **Schermata "Volume"**: tabella volume per muscolo × settimana + confronti %.
8. **Schermata "Personaggio"** (RPG-style): 5 statistiche, radar, livello globale, achievement.
9. **Schermata "Impostazioni"**: export/import JSON, reset, info versione.
10. **PWA**: manifest + service worker, offline-first.

## Regole di calcolo
- Volume di una serie: `reps × kg`
- Volume di un esercizio in una sessione: somma dei volumi delle serie loggate
- Volume di una sessione: somma dei volumi degli esercizi loggati
- Volume di una settimana: somma dei volumi delle sessioni di quella settimana
- Volume per gruppo muscolare in una settimana: somma raggruppata per `Exercise.muscle`
- Confronto % tra due periodi: `(current - previous) / previous`. Se `previous === 0`, mostra "—".
- Colore confronti: verde se `> 0`, rosso se `< 0`, nessuno se `=== 0` o "—".

## Calcolo della settimana corrente
- Al primo avvio: registra `startDate = today` su localStorage.
- Settimana corrente = `Math.min(5, Math.floor((today - startDate) / 7days) + 1)`.
- Dopo Sett 5: l'utente può "ricominciare il blocco" → reset di `startDate` a today.

## Mappa giorno → sessione
- Lunedì → Lun (Upper Push palestra)
- Martedì → Mar (Lower + Glutei casa)
- Mercoledì → riposo
- Giovedì → Gio (Lower Glute-Focused palestra)
- Venerdì → Ven (Upper Pull palestra)
- Sabato → Sab (Upper Push casa)
- Domenica → riposo

## Sistema Personaggio (RPG-style)
Calcolato sull'intero mesociclo (somma di tutte le 5 settimane). Cinque statistiche su scala 0-100:

### Definizioni
- **FORZA**: volume totale degli esercizi multiarticolari principali (panca DB, hip thrust BB, RDL, lat machine, rematore DB). Misura il carico assoluto.
- **RESISTENZA**: volume totale degli esercizi con reps target ≥ 12 (range alti) + tutti i carries. Misura endurance muscolare.
- **COSTANZA**: percentuale di sessioni completate. Una sessione è "completata" se il suo volume > 0. Target: 25/25.
- **VOLUME**: volume totale del mesociclo. Proxy della crescita complessiva del lavoro.
- **CORE / STABILITÀ**: volume sugli esercizi anti-movement (carries, Pallof, ab wheel, renegade, stir-the-pot). Priorità per la lombare.

### Normalizzazione
Ogni stat ha un target massimo (=100). Configurabile in `src/data/character.ts`:
```typescript
export const STAT_TARGETS = {
  forza: 90000,
  resistenza: 130000,
  costanza: 25,       // numero sessioni
  volume: 280000,
  core: 70000,
};
```
Formula: `value = min(100, round(actual / target * 100))`.

### Rating
- 0-19 → **D**
- 20-39 → **C**
- 40-59 → **B**
- 60-79 → **A**
- 80-100 → **S**

### Livello Globale
Media pesata delle 5 stat: Forza 25%, Volume 25%, Costanza 20%, Resistenza 15%, Core 15%. Stesso schema di rating D-S applicato.

### XP
Volume totale del mesociclo / 100. Solo display.

### Achievement (sbloccati automaticamente)
1. **💪 Iron Glutes** — volume glutei mesociclo > 20.000
2. **🛡 Core Warrior** — stat CORE ≥ 70
3. **⚔ Strong Intermediate** — stat FORZA ≥ 60
4. **🎯 Perfect Attendance** — stat COSTANZA ≥ 95
5. **🔥 Volume Beast** — stat VOLUME ≥ 80
6. **👑 Well-Rounded Hero** — tutte le stat ≥ 60
7. **💎 Progressive Overload** — volume Sett 4 ≥ 1.2 × volume Sett 1
8. **🌟 Legend** — Livello Globale ≥ 80

### Liste di classificazione esercizi
In `src/data/character.ts` esporta tre array di `exerciseId`:
- `STRENGTH_PRIMARY_IDS`: gli ID dei 5 multiarticolari principali (vedi sotto)
- `CORE_ANTI_MOVEMENT_IDS`: gli ID dei 9 esercizi anti-movement
- `ENDURANCE_HIGH_REPS_IDS`: derivato da program.ts (esercizi con reps target che contengono "12-15", "15-20", "10-15", "passi" o `metric === 'meters'`)

**STRENGTH_PRIMARY:**
- `lun-1` (Panca piana con manubri)
- `gio-1` (Hip thrust con bilanciere)
- `gio-3` (Romanian Deadlift)
- `ven-1` (Lat machine pronata)
- `ven-2` (Rematore manubri panca 30°)

**CORE_ANTI_MOVEMENT:**
- `lun-7`, `lun-8`, `mar-7`, `mar-8`, `gio-7`, `ven-8`, `ven-9`, `sab-9`, `sab-10`

## Convenzioni codice
- TypeScript strict, niente `any`
- Componenti funzionali con hooks
- Custom hook per logica condivisa (`useLogStore`, `useCurrentSession`, `useVolumeAggregate`, `useCharacterStats`)
- File organizzati per feature, non per tipo (cartelle: `screens/`, `components/`, `hooks/`, `data/`, `types.ts`)
- Nomi di componenti e variabili in inglese, copy UI in italiano
- Commits in italiano, modo imperativo, max 72 caratteri

## Note specifiche del dominio
- **Esercizi con `metric: 'meters'`** (carries): label "metri" anziché "reps". Logica del volume invariata (`metri × kg`).
- **Esercizi con `unilateral: true`**: l'utente traccia un lato, esegue entrambi. UI mostra "per lato".
- **Settimana 5 (Deload)**: sets pre-ridotti in `program.ts`. Banner UI ricorda di ridurre il carico del ~10%.
- **Esercizi a corpo libero puro**: kg può essere 0 (o livello elastico 1-5). Volume basso o nullo è atteso.

## File di contesto
- `piano_allenamento.md`: riassunto del piano e dei principi (Helms, Schoenfeld, McGill).
