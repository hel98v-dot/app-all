// src/App.tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout }           from './components/Layout';
import { Today }            from './screens/Today';
import { History }          from './screens/History';
import { Volume }           from './screens/Volume';
import { Character }        from './screens/Character';
import { Settings }         from './screens/Settings';
import { ExerciseLogger }   from './screens/ExerciseLogger';
import { SupersetLogger }    from './screens/SupersetLogger';
import { ProfileSelect }      from './screens/ProfileSelect';
import { useProfileStore }    from './hooks/useProfileStore';
import { BackgroundsProvider } from './hooks/useBackgrounds';
import { RestTimerProvider }   from './hooks/useRestTimer';
import { ErrorBoundary }       from './components/ErrorBoundary';
import { PWAAutoUpdate }        from './components/PWAAutoUpdate';

export default function App() {
  const { profiles, activeProfile, createAndActivate, switchProfile } = useProfileStore();

  // Nessun profilo attivo → schermata di "risveglio" / registrazione Player
  if (!activeProfile) {
    return (
      <BackgroundsProvider>
        <ProfileSelect
          profiles={profiles}
          onCreate={name => createAndActivate(name)}
          onSelect={switchProfile}
        />
      </BackgroundsProvider>
    );
  }

  return (
    <BackgroundsProvider>
      <PWAAutoUpdate />
      <RestTimerProvider>
      <ErrorBoundary>
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
            <Route
              path="superset/:weekNumber/:sessionId/:ids"
              element={<SupersetLogger />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ErrorBoundary>
      </RestTimerProvider>
    </BackgroundsProvider>
  );
}
