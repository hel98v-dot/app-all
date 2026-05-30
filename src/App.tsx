// src/App.tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Today } from './screens/Today';
import { History } from './screens/History';
import { Volume } from './screens/Volume';
import { Character } from './screens/Character';
import { Settings } from './screens/Settings';
import { ExerciseLogger } from './screens/ExerciseLogger';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Tutte le schermate principali condividono il Layout con BottomNav */}
        <Route element={<Layout />}>
          <Route index                                                          element={<Today />} />
          <Route path="storico"                                                 element={<History />} />
          <Route path="volume"                                                  element={<Volume />} />
          <Route path="personaggio"                                             element={<Character />} />
          <Route path="impostazioni"                                            element={<Settings />} />
          {/* Schermata esercizio: non mostra BottomNav? per ora sì, step successivo decide */}
          <Route
            path="esercizio/:weekNumber/:sessionId/:exerciseId"
            element={<ExerciseLogger />}
          />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
