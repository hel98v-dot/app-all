// src/App.tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout }           from './components/Layout';
import { Today }            from './screens/Today';
import { History }          from './screens/History';
import { Volume }           from './screens/Volume';
import { Character }        from './screens/Character';
import { Settings }         from './screens/Settings';
import { ExerciseLogger }   from './screens/ExerciseLogger';
import { ProfileSelect }    from './screens/ProfileSelect';
import { useProfileStore }  from './hooks/useProfileStore';

export default function App() {
  const { profiles, activeProfile, createAndActivate, switchProfile } = useProfileStore();

  // Nessun profilo attivo → mostra selezione/creazione
  if (!activeProfile) {
    return (
      <ProfileSelect
        profiles={profiles}
        onCreate={name => createAndActivate(name)}
        onSelect={switchProfile}
      />
    );
  }

  return (
    // key={activeProfile.id} forza il remount di tutti gli hook al cambio profilo
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index                                               element={<Today />} />
          <Route path="storico"                                      element={<History />} />
          <Route path="volume"                                       element={<Volume />} />
          <Route path="personaggio"                                  element={<Character />} />
          <Route path="impostazioni"                                 element={<Settings />} />
          <Route
            path="esercizio/:weekNumber/:sessionId/:exerciseId"
            element={<ExerciseLogger />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
