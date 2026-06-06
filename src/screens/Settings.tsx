// src/screens/Settings.tsx
import { useRef, useState } from 'react';
import {
  Download, Upload, RotateCcw, Trash2,
  Calendar, Info, ChevronRight,
  User, FileSpreadsheet, Plus, Check, X, Timer, Pencil,
  CloudUpload, Wifi, WifiOff, RefreshCw, LogOut,
} from 'lucide-react';
import { usePref }            from '../lib/prefs';
import { useLogStore }        from '../hooks/useLogStore';
import { useCurrentSession }  from '../hooks/useCurrentSession';
import { useProfileStore }    from '../hooks/useProfileStore';
import { useProgramData } from '../hooks/useProgramData';
import { addSchedule, deleteSchedule, switchSchedule, renameSchedule, hasDefaultProgramData, DEFAULT_SCHEDULE_ID } from '../lib/schedules';
import { useToast }           from '../hooks/useToast';
import { ToastStack }         from '../components/Toast';
import { ConfirmDialog }      from '../components/ConfirmDialog';
import { BackgroundPicker }   from '../components/BackgroundPicker';
import { formatDisplayFull }  from '../lib/dates';
import { useDriveSync } from '../contexts/DriveSync';
// Caricamento lazy di xlsx — riduce il bundle iniziale (xlsx ~500KB raw)
const excelLib = () => import('../lib/excel');

const APP_VERSION = '0.2.0';

// ── Sezione wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="sl-label text-[10px] text-[var(--sl-cyan-soft)] px-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── Riga azione ───────────────────────────────────────────────────────────────
function ActionRow({
  icon, label, onClick, sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  sublabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="sl-panel w-full flex items-center justify-between gap-3 px-4 py-4 min-h-[56px]
        rounded-2xl text-sm font-semibold text-slate-100 active:brightness-110 transition"
    >
      <span className="flex items-center gap-3">
        {icon}
        <span>
          {label}
          {sublabel && <span className="block text-xs text-[var(--sl-text-dim)] font-normal">{sublabel}</span>}
        </span>
      </span>
      <ChevronRight size={16} className="text-[var(--sl-cyan)] opacity-60 shrink-0" />
    </button>
  );
}

// ── Riga toggle ─────────────────────────────────────────────────────────────────
function ToggleRow({
  icon, label, sublabel, value, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className="sl-panel w-full flex items-center justify-between gap-3 px-4 py-4 min-h-[56px]
        rounded-2xl text-sm font-semibold text-slate-100 active:brightness-110 transition"
    >
      <span className="flex items-center gap-3">
        {icon}
        <span className="text-left">
          {label}
          {sublabel && <span className="block text-xs text-[var(--sl-text-dim)] font-normal">{sublabel}</span>}
        </span>
      </span>
      <span className={[
        'relative w-12 h-7 rounded-full shrink-0 transition-colors border',
        value ? 'bg-[var(--sl-cyan)] border-[var(--sl-cyan-soft)] shadow-[0_0_10px_var(--sl-glow)]'
              : 'bg-slate-700/70 border-[var(--sl-line-soft)]',
      ].join(' ')}>
        <span className={[
          'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all',
          value ? 'left-[22px]' : 'left-0.5',
        ].join(' ')} />
      </span>
    </button>
  );
}

// ── Riga info ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="sl-panel flex items-center justify-between px-4 py-3.5 rounded-2xl">
      <span className="text-sm text-[var(--sl-text-dim)]">{label}</span>
      <span className="text-sm font-semibold text-slate-200">{value}</span>
    </div>
  );
}

// ── Schermata ─────────────────────────────────────────────────────────────────
export function Settings() {
  const {
    store, startDate,
    exportJSON, importJSON,
    resetAll, resetMesocycle,
  } = useLogStore();

  const { weekNumber }    = useCurrentSession(startDate);
  const { toasts, show }  = useToast();
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const excelImportRef    = useRef<HTMLInputElement>(null);

  const { profiles, activeProfile, createAndActivate, switchProfile, deleteProfile } = useProfileStore();
  const program = useProgramData();
  const [autoRest, setAutoRest] = usePref('autoRest');

  // "Predefinita" compare nell'elenco solo se ha log registrati.
  const showDefaultSchedule = hasDefaultProgramData(store.sessions);

  const drive = useDriveSync();
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenField, setShowTokenField] = useState(false);

  const [dialog, setDialog] = useState<'reset-meso' | 'reset-all' | 'del-profile' | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<{ id: string; name: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // ── Export ────────────────────────────────────────────────────────────────────
  function handleExport() {
    const json     = exportJSON();
    const blob     = new Blob([json], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const date     = new Date().toISOString().slice(0, 10);
    const filename = `training-log-${date}.json`;
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = filename;
    a.click();
    URL.revokeObjectURL(url);
    show(`Esportato: ${filename}`, 'ok');
  }

  // ── Import ────────────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result;
      if (typeof text !== 'string') { show('Errore nella lettura del file.', 'err'); return; }
      const ok = importJSON(text);
      show(ok ? 'Dati importati con successo! ✓' : 'File non valido o corrotto.', ok ? 'ok' : 'err');
    };
    reader.onerror = () => show('Errore nella lettura del file.', 'err');
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── Import Excel scheda ───────────────────────────────────────────────────────
  function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const scheduleName = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Nuova scheda';
    excelLib()
      .then(({ parseScheduleFile }) => parseScheduleFile(file))
      .then(({ sessions }) => {
        // Aggiunge una NUOVA scheda (non sostituisce) e la attiva (con reload)
        addSchedule(scheduleName, sessions);
      })
      .catch(err => show(`Errore importazione: ${String(err)}`, 'err'));
    e.target.value = '';
  }

  // ── Export Excel log ──────────────────────────────────────────────────────────
  function handleExcelExport() {
    excelLib()
      .then(({ exportLogToExcel }) => exportLogToExcel(program.baseSessions, store.sessions))
      .then(() => show('Export Excel avviato ✓', 'ok'))
      .catch(() => show('Errore durante l\'export.', 'err'));
  }

  // ── Stat riepilogo ────────────────────────────────────────────────────────────
  const totalSessions = store.sessions.length;
  const totalVolume   = store.sessions.reduce(
    (acc, s) => acc + s.exercises.reduce(
      (a, ex) => a + ex.sets.reduce((x, set) => x + set.reps * set.kg, 0), 0), 0);

  return (
    <>
      <div className="px-4 pt-6 pb-10 max-w-lg mx-auto space-y-7">

        <div>
          <p className="sl-label text-[10px] text-[var(--sl-cyan)] sl-glow-text">▣ Pannello di Controllo</p>
          <h1 className="sl-heading text-2xl mt-1">Sistema</h1>
        </div>

        {/* ── Profili ─────────────────────────────────────────────────────────── */}
        <Section title="Profili">

          {/* Lista profili */}
          {profiles.map(p => (
            <div key={p.id} className={[
              'flex items-center gap-3 px-4 py-3.5 rounded-2xl border',
              p.id === activeProfile?.id
                ? 'bg-[rgba(56,225,255,0.1)] border-[var(--sl-line)] shadow-[0_0_14px_rgba(56,225,255,0.1)]'
                : 'sl-panel',
            ].join(' ')}>
              <User size={18} className={p.id === activeProfile?.id ? 'text-[var(--sl-cyan)]' : 'text-[var(--sl-text-dim)]'} />
              <span className="flex-1 text-sm font-semibold text-slate-100">{p.name}</span>
              {p.id === activeProfile?.id
                ? <span className="sl-label text-[9px] text-[var(--sl-cyan-soft)]">attivo</span>
                : <button
                    onClick={() => switchProfile(p.id)}
                    className="text-xs text-[var(--sl-cyan)] underline min-h-[44px] px-2"
                  >
                    Entra
                  </button>
              }
            </div>
          ))}

          {/* Aggiungi profilo */}
          {showNewProfile ? (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newProfileName.trim()) {
                    createAndActivate(newProfileName);
                  }
                  if (e.key === 'Escape') setShowNewProfile(false);
                }}
                placeholder="Nome profilo…"
                maxLength={30}
                className="flex-1 bg-[rgba(6,10,20,0.85)] border border-[var(--sl-line)] rounded-xl px-3 py-2.5
                  text-slate-100 text-sm focus:outline-none focus:border-[var(--sl-cyan)]"
              />
              <button
                onClick={() => { if (newProfileName.trim()) createAndActivate(newProfileName); }}
                className="w-11 h-11 rounded-xl bg-[var(--sl-cyan)] flex items-center justify-center shadow-[0_0_12px_var(--sl-glow)]"
              >
                <Check size={18} className="text-[#06121e]" strokeWidth={3} />
              </button>
              <button
                onClick={() => setShowNewProfile(false)}
                className="w-11 h-11 rounded-xl bg-[rgba(56,225,255,0.08)] border border-[var(--sl-line)] flex items-center justify-center"
              >
                <X size={18} className="text-[var(--sl-text-dim)]" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewProfile(true)}
              className="sl-panel w-full flex items-center gap-3 px-4 py-3.5 min-h-[56px]
                rounded-2xl text-sm font-semibold text-slate-300 active:brightness-110 transition"
            >
              <Plus size={18} className="text-[var(--sl-cyan)] shrink-0" />
              Aggiungi profilo
            </button>
          )}

          {/* Elimina profilo attivo */}
          {profiles.length > 1 && (
            <button
              onClick={() => setDialog('del-profile')}
              className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[56px]
                bg-[rgba(40,10,16,0.5)] border border-rose-800/50 rounded-2xl
                text-sm font-semibold text-rose-400 active:bg-rose-950/30 transition-colors"
            >
              <Trash2 size={18} className="shrink-0" />
              Elimina profilo "{activeProfile?.name}"
            </button>
          )}
        </Section>

        {/* ── Allenamento ────────────────────────────────────────────────────── */}
        <Section title="Allenamento">
          <ToggleRow
            icon={<Timer size={18} className="text-[var(--sl-cyan)] shrink-0" />}
            label="Recupero automatico"
            sublabel="Avvia il timer da solo dopo aver inserito le reps"
            value={autoRest}
            onChange={setAutoRest}
          />
        </Section>

        {/* ── Aspetto / Sfondi ───────────────────────────────────────────────── */}
        <Section title="Aspetto — Sfondi">
          <p className="text-xs text-[var(--sl-text-dim)] px-1 -mt-1">
            Carica le tue immagini come sfondo. Vengono salvate sul dispositivo e
            funzionano offline. Lascia vuoto per lo sfondo "System" di default.
          </p>

          <div className="sl-panel rounded-2xl px-4 py-4 space-y-4">
            <BackgroundPicker bgKey="global"         label="Sfondo globale (tutta l'app)" />
            <hr className="sl-divider" />
            <BackgroundPicker bgKey="page:today"     label="Missione (Oggi)" />
            <BackgroundPicker bgKey="page:history"   label="Registro (Storico)" />
            <BackgroundPicker bgKey="page:volume"    label="Volume" />
            <BackgroundPicker bgKey="page:character" label="Status (Personaggio)" />
            <BackgroundPicker bgKey="page:settings"  label="Sistema (Impostazioni)" />
            <hr className="sl-divider" />
            <BackgroundPicker bgKey="exercise-default" label="Esercizi (sfondo predefinito)" />
          </div>
          <p className="text-xs text-[var(--sl-text-dim)] px-1">
            Per dare uno sfondo a un singolo esercizio, aprilo e usa l'icona immagine in alto.
          </p>
        </Section>

        {/* ── Schede di allenamento (Excel) ──────────────────────────────────── */}
        <Section title="Schede di allenamento">
          <p className="text-xs text-[var(--sl-text-dim)] px-1 -mt-1">
            Più schede per profilo. Esercizi e volume seguono la scheda attiva;
            Status, peso e achievement restano cumulativi.
          </p>

          {/* Lista schede */}
          {program.schedules.length === 0 && !showDefaultSchedule && (
            <div className="px-4 py-3 sl-panel rounded-2xl">
              <p className="text-xs text-slate-400">
                Nessuna scheda. Carica un file Excel qui sotto per iniziare.
              </p>
            </div>
          )}

          {/* Programma predefinito — mostrato solo se ha dati registrati,
              così quei log restano sempre raggiungibili. Non rinominabile/eliminabile. */}
          {showDefaultSchedule && (() => {
            const isActive = program.activeScheduleId === DEFAULT_SCHEDULE_ID;
            return (
              <div className={[
                'flex items-center gap-2 px-4 py-3 rounded-2xl border',
                isActive
                  ? 'bg-[rgba(139,92,255,0.12)] border-[var(--sl-violet)] shadow-[0_0_12px_var(--sl-glow-violet)]'
                  : 'sl-panel',
              ].join(' ')}>
                <FileSpreadsheet size={16} className={isActive ? 'text-[var(--sl-violet-soft)] shrink-0' : 'text-[var(--sl-text-dim)] shrink-0'} />
                <span className="flex-1 min-w-0 text-sm font-semibold text-slate-100 truncate">Predefinita</span>
                {isActive
                  ? <span className="sl-label text-[9px] text-[var(--sl-violet-soft)] shrink-0">attiva</span>
                  : <button onClick={() => switchSchedule(DEFAULT_SCHEDULE_ID)} className="text-xs text-[var(--sl-cyan)] underline min-h-[44px] px-1 shrink-0">Attiva</button>}
              </div>
            );
          })()}

          {program.schedules.map(sch => {
            const isActive   = sch.id === program.activeScheduleId;
            const isRenaming = renamingId === sch.id;
            return (
              <div key={sch.id} className={[
                'flex items-center gap-2 px-4 py-3 rounded-2xl border',
                isActive
                  ? 'bg-[rgba(139,92,255,0.12)] border-[var(--sl-violet)] shadow-[0_0_12px_var(--sl-glow-violet)]'
                  : 'sl-panel',
              ].join(' ')}>
                <FileSpreadsheet size={16} className={isActive ? 'text-[var(--sl-violet-soft)] shrink-0' : 'text-[var(--sl-text-dim)] shrink-0'} />

                {isRenaming ? (
                  <>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && renameValue.trim()) renameSchedule(sch.id, renameValue);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      maxLength={40}
                      className="flex-1 min-w-0 bg-[rgba(6,10,20,0.85)] border border-[var(--sl-line)] rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-[var(--sl-cyan)]"
                    />
                    <button onClick={() => { if (renameValue.trim()) renameSchedule(sch.id, renameValue); }} aria-label="Conferma" className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--sl-cyan)] text-[#06121e] shrink-0">
                      <Check size={16} strokeWidth={3} />
                    </button>
                    <button onClick={() => setRenamingId(null)} aria-label="Annulla" className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--sl-text-dim)] border border-[var(--sl-line)] shrink-0">
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 min-w-0 text-sm font-semibold text-slate-100 truncate">{sch.name}</span>
                    {isActive
                      ? <span className="sl-label text-[9px] text-[var(--sl-violet-soft)] shrink-0">attiva</span>
                      : <button onClick={() => switchSchedule(sch.id)} className="text-xs text-[var(--sl-cyan)] underline min-h-[44px] px-1 shrink-0">Attiva</button>}
                    <button
                      onClick={() => { setRenamingId(sch.id); setRenameValue(sch.name); }}
                      aria-label="Rinomina scheda"
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 active:text-[var(--sl-cyan-soft)] active:bg-[rgba(56,225,255,0.12)] shrink-0"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setScheduleToDelete({ id: sch.id, name: sch.name })}
                      aria-label="Elimina scheda"
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 active:text-rose-300 active:bg-rose-900/40 shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          <ActionRow
            icon={<Upload size={18} className="text-indigo-400 shrink-0" />}
            label="Aggiungi scheda (.xlsx)"
            sublabel="Carica un nuovo file: diventa la scheda attiva"
            onClick={() => excelImportRef.current?.click()}
          />
          <ActionRow
            icon={<Download size={18} className="text-indigo-400 shrink-0" />}
            label="Scarica template Excel"
            sublabel="Compilalo con i tuoi esercizi"
            onClick={() => excelLib().then(({ downloadTemplate }) => downloadTemplate())}
          />
          <ActionRow
            icon={<FileSpreadsheet size={18} className="text-emerald-400 shrink-0" />}
            label="Esporta log in Excel"
            sublabel={`${totalSessions} sessioni con dati compilati`}
            onClick={handleExcelExport}
          />
          <input
            ref={excelImportRef}
            type="file"
            accept=".xlsx,.xls,.ods,.csv"
            className="hidden"
            onChange={handleExcelImport}
          />
        </Section>

        {/* ── Backup ─────────────────────────────────────────────────────────── */}
        <Section title="Backup">
          <ActionRow
            icon={<Download size={18} className="text-indigo-400 shrink-0" />}
            label="Esporta JSON"
            sublabel={`${totalSessions} sessioni · ${Math.round(totalVolume).toLocaleString('it-IT')} kg`}
            onClick={handleExport}
          />
          <ActionRow
            icon={<Upload size={18} className="text-indigo-400 shrink-0" />}
            label="Importa JSON"
            sublabel="Sovrascrive i dati attuali"
            onClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </Section>

        {/* ── GitHub Gist Sync ───────────────────────────────────────────────── */}
        <Section title="Sync automatico — GitHub Gist">

          {/* Stato connessione */}
          <div className="sl-panel rounded-2xl px-4 py-3 flex items-center gap-3">
            {drive.status === 'synced'   && <Wifi      size={18} className="text-emerald-400 shrink-0" />}
            {drive.status === 'syncing'  && <RefreshCw size={18} className="text-[var(--sl-cyan)] shrink-0 animate-spin" />}
            {drive.status === 'error'    && <WifiOff   size={18} className="text-rose-400 shrink-0" />}
            {(drive.status === 'idle' || drive.status === 'disconnected') && (
              <CloudUpload size={18} className="text-[var(--sl-text-dim)] shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {drive.status === 'disconnected' && <p className="text-sm text-slate-400">Non connesso.</p>}
              {drive.status === 'syncing'  && <p className="text-sm text-[var(--sl-cyan)]">Sincronizzazione…</p>}
              {drive.status === 'synced'   && (
                <>
                  <p className="text-sm font-semibold text-emerald-300">Sincronizzato ✓</p>
                  {drive.username && <p className="text-xs text-[var(--sl-text-dim)]">GitHub: @{drive.username}</p>}
                  {drive.lastSync && <p className="text-xs text-[var(--sl-text-dim)]">
                    Ultima sync: {drive.lastSync.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </p>}
                </>
              )}
              {drive.status === 'idle' && drive.username && (
                <>
                  <p className="text-sm font-semibold text-slate-200">Connesso</p>
                  <p className="text-xs text-[var(--sl-text-dim)]">GitHub: @{drive.username}</p>
                </>
              )}
              {drive.status === 'error' && (
                <>
                  <p className="text-sm font-semibold text-rose-300">Errore sync</p>
                  {drive.error && <p className="text-xs text-rose-400/80 truncate">{drive.error}</p>}
                </>
              )}
            </div>
          </div>

          {/* Non connesso → mostra input token */}
          {drive.status === 'disconnected' && (
            <>
              {!showTokenField ? (
                <button
                  onClick={() => setShowTokenField(true)}
                  className="sl-panel w-full flex items-center gap-3 px-4 py-4 min-h-[56px]
                    rounded-2xl text-sm font-semibold text-slate-100 active:brightness-110 transition"
                >
                  <Wifi size={18} className="text-[var(--sl-cyan)] shrink-0" />
                  <span className="flex-1 text-left">
                    Connetti GitHub
                    <span className="block text-xs text-[var(--sl-text-dim)] font-normal">
                      Inserisci il Personal Access Token
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-[var(--sl-cyan)] opacity-60 shrink-0" />
                </button>
              ) : (
                <div className="sl-panel rounded-2xl px-4 py-3 space-y-3">
                  <p className="text-xs text-[var(--sl-text-dim)] leading-relaxed">
                    Crea un token su{' '}
                    <a href="https://github.com/settings/tokens/new?scopes=gist&description=Arise+App"
                       target="_blank" rel="noopener noreferrer"
                       className="text-[var(--sl-cyan)] underline font-semibold">
                      github.com/settings/tokens →
                    </a>
                    <br />
                    Spunta solo <strong className="text-slate-300">gist</strong> → Generate token → copia il valore.
                  </p>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="password"
                      value={tokenInput}
                      onChange={e => setTokenInput(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="flex-1 min-w-0 bg-[rgba(6,10,20,0.85)] border border-[var(--sl-line)] rounded-xl
                        px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-[var(--sl-cyan)]"
                    />
                    <button
                      onClick={() => { if (tokenInput.trim()) { drive.connect(tokenInput.trim()); setShowTokenField(false); setTokenInput(''); } }}
                      disabled={!tokenInput.trim()}
                      className="px-4 h-11 rounded-xl bg-[var(--sl-cyan)] text-[#06121e] text-xs font-bold
                        disabled:opacity-40 shrink-0"
                    >
                      Connetti
                    </button>
                    <button
                      onClick={() => { setShowTokenField(false); setTokenInput(''); }}
                      className="w-11 h-11 rounded-xl border border-[var(--sl-line)] flex items-center justify-center shrink-0"
                    >
                      <X size={16} className="text-[var(--sl-text-dim)]" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Connesso → Sync manuale + Disconnetti */}
          {drive.status !== 'disconnected' && (
            <div className="flex gap-2">
              <button
                onClick={() => drive.manualSync()}
                disabled={drive.status === 'syncing'}
                className="flex-1 sl-panel flex items-center justify-center gap-2 px-4 py-3.5 min-h-[48px]
                  rounded-2xl text-sm font-semibold text-slate-100 active:brightness-110 transition disabled:opacity-50"
              >
                <RefreshCw size={16} className={drive.status === 'syncing' ? 'animate-spin' : ''} />
                Sincronizza ora
              </button>
              <button
                onClick={() => drive.disconnect()}
                className="flex items-center justify-center gap-2 px-4 py-3.5 min-h-[48px]
                  sl-panel rounded-2xl text-sm text-rose-400 font-semibold active:bg-rose-950/30 transition"
              >
                <LogOut size={16} />
                Disconnetti
              </button>
            </div>
          )}

          <p className="text-xs text-slate-600 px-1 leading-relaxed">
            I dati vengono salvati in un Gist privato del tuo account GitHub.
            Ogni persona usa il proprio token → dati separati e indipendenti.
          </p>
        </Section>

        {/* ── Programma ──────────────────────────────────────────────────────── */}
        <Section title="Programma">
          <InfoRow label="Inizio mesociclo"   value={formatDisplayFull(startDate)} />
          <InfoRow label="Settimana corrente" value={`Settimana ${weekNumber} / 5`} />

          <button
            onClick={() => setDialog('reset-meso')}
            className="w-full flex items-center justify-between gap-3 px-4 py-4 min-h-[56px]
              bg-[rgba(40,30,8,0.5)] border border-amber-800/50 rounded-2xl
              text-sm font-semibold text-amber-400 active:bg-amber-950/30 transition-colors"
          >
            <span className="flex items-center gap-3">
              <RotateCcw size={18} className="shrink-0" />
              Ricomincia blocco
            </span>
            <ChevronRight size={16} className="opacity-40 shrink-0" />
          </button>

          <p className="text-xs text-slate-500 px-1">
            Resetta solo la data di inizio a oggi. I log delle sessioni passate
            restano nello Storico.
          </p>
        </Section>

        {/* ── Zona pericolosa ────────────────────────────────────────────────── */}
        <Section title="Zona pericolosa">
          <button
            onClick={() => setDialog('reset-all')}
            className="w-full flex items-center justify-between gap-3 px-4 py-4 min-h-[56px]
              bg-[rgba(40,10,16,0.5)] border border-rose-800/50 rounded-2xl
              text-sm font-semibold text-rose-400 active:bg-rose-950/30 transition-colors"
          >
            <span className="flex items-center gap-3">
              <Trash2 size={18} className="shrink-0" />
              Cancella tutti i dati
            </span>
            <ChevronRight size={16} className="opacity-40 shrink-0" />
          </button>

          <p className="text-xs text-slate-500 px-1">
            Cancella log, startDate e tutto il mesociclo. Operazione irreversibile.
          </p>
        </Section>

        {/* ── Info ───────────────────────────────────────────────────────────── */}
        <Section title="Info">
          <InfoRow label="Versione"        value={APP_VERSION} />
          <InfoRow label="Storage"         value="localStorage (offline)" />
          <InfoRow label="Dati sul server" value="Nessuno" />

          <div className="sl-panel rounded-2xl px-4 py-4 space-y-1.5">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Info size={13} className="text-indigo-400 shrink-0" />
              Basi scientifiche
            </p>
            <p className="text-xs text-slate-500 leading-relaxed pl-5">
              Periodizzazione e volume: <span className="text-slate-400">Eric Helms</span> —
              Ipertrofia e RIR: <span className="text-slate-400">Brad Schoenfeld</span> —
              Core e lombare: <span className="text-slate-400">Stuart McGill</span>
            </p>
          </div>

          <div className="sl-panel rounded-2xl px-4 py-3
            flex items-start gap-2">
            <Calendar size={13} className="text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              PWA mobile-first · funziona offline · nessun account richiesto.
            </p>
          </div>
        </Section>

      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={dialog === 'reset-meso'}
        title="Ricomincia il blocco?"
        description="La data di inizio verrà reimpostata a oggi. I log delle sessioni passate vengono conservati."
        confirmLabel="Ricomincia blocco"
        danger={false}
        onConfirm={() => {
          resetMesocycle();
          setDialog(null);
          show('Blocco riavviato. Log preservati.', 'ok');
        }}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === 'del-profile'}
        title={`Eliminare il profilo "${activeProfile?.name}"?`}
        description="Verranno eliminati tutti i log e la scheda di questo profilo. Irreversibile."
        confirmLabel="Elimina profilo"
        danger
        onConfirm={() => {
          if (activeProfile) deleteProfile(activeProfile.id);
        }}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={scheduleToDelete !== null}
        title={`Eliminare la scheda "${scheduleToDelete?.name}"?`}
        description="La scheda viene rimossa. I log restano nello storico ma il loro volume non sarà più mostrato in Volume."
        confirmLabel="Elimina scheda"
        danger
        onConfirm={() => { if (scheduleToDelete) deleteSchedule(scheduleToDelete.id); }}
        onCancel={() => setScheduleToDelete(null)}
      />

      <ConfirmDialog
        open={dialog === 'reset-all'}
        title="Cancellare tutti i dati?"
        description="Questa azione è irreversibile. Verranno cancellati tutti i log, la data di inizio e le impostazioni."
        confirmLabel="Cancella tutto"
        danger
        onConfirm={() => {
          resetAll();
          setDialog(null);
          show('Tutti i dati cancellati.', 'ok');
        }}
        onCancel={() => setDialog(null)}
      />

      <ToastStack toasts={toasts} />
    </>
  );
}
