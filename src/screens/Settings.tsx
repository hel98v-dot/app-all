// src/screens/Settings.tsx
import { useRef, useState } from 'react';
import {
  Download, Upload, RotateCcw, Trash2,
  Calendar, Info, ChevronRight,
  User, FileSpreadsheet, Plus, Check, X,
} from 'lucide-react';
import { useLogStore }        from '../hooks/useLogStore';
import { useCurrentSession }  from '../hooks/useCurrentSession';
import { useProfileStore }    from '../hooks/useProfileStore';
import { useProgramData, saveCustomProgram, clearCustomProgram } from '../hooks/useProgramData';
import { useToast }           from '../hooks/useToast';
import { ToastStack }         from '../components/Toast';
import { ConfirmDialog }      from '../components/ConfirmDialog';
import { formatDisplayFull }  from '../lib/dates';
// Caricamento lazy di xlsx — riduce il bundle iniziale (xlsx ~500KB raw)
const excelLib = () => import('../lib/excel');

const APP_VERSION = '0.2.0';

// ── Sezione wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 px-1">
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
      className="w-full flex items-center justify-between gap-3 px-4 py-4 min-h-[56px]
        bg-slate-800 border border-slate-700/60 rounded-2xl
        text-sm font-semibold text-slate-100 active:bg-slate-700 transition-colors"
    >
      <span className="flex items-center gap-3">
        {icon}
        <span>
          {label}
          {sublabel && <span className="block text-xs text-slate-500 font-normal">{sublabel}</span>}
        </span>
      </span>
      <ChevronRight size={16} className="opacity-40 shrink-0" />
    </button>
  );
}

// ── Riga info ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5
      bg-slate-800 border border-slate-700/60 rounded-2xl">
      <span className="text-sm text-slate-400">{label}</span>
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

  const [dialog, setDialog] = useState<'reset-meso' | 'reset-all' | 'del-profile' | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [showNewProfile, setShowNewProfile] = useState(false);

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
    excelLib()
      .then(({ parseScheduleFile }) => parseScheduleFile(file))
      .then(({ sessions, warnings }) => {
        saveCustomProgram(sessions);
        if (warnings.length) show(`Importato con avvisi: ${warnings[0]}`, 'ok');
        else show(`Scheda importata: ${sessions.length} sessioni ✓`, 'ok');
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

        <h1 className="text-2xl font-bold">Impostazioni</h1>

        {/* ── Profili ─────────────────────────────────────────────────────────── */}
        <Section title="Profili">

          {/* Lista profili */}
          {profiles.map(p => (
            <div key={p.id} className={[
              'flex items-center gap-3 px-4 py-3.5 rounded-2xl border',
              p.id === activeProfile?.id
                ? 'bg-indigo-950/40 border-indigo-700/50'
                : 'bg-slate-800 border-slate-700/60',
            ].join(' ')}>
              <User size={18} className={p.id === activeProfile?.id ? 'text-indigo-400' : 'text-slate-500'} />
              <span className="flex-1 text-sm font-semibold text-slate-100">{p.name}</span>
              {p.id === activeProfile?.id
                ? <span className="text-xs text-indigo-400 font-medium">attivo</span>
                : <button
                    onClick={() => switchProfile(p.id)}
                    className="text-xs text-slate-400 underline min-h-[44px] px-2"
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
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                  text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => { if (newProfileName.trim()) createAndActivate(newProfileName); }}
                className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center"
              >
                <Check size={18} className="text-white" />
              </button>
              <button
                onClick={() => setShowNewProfile(false)}
                className="w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center"
              >
                <X size={18} className="text-slate-300" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewProfile(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[56px]
                bg-slate-800 border border-slate-700/60 rounded-2xl
                text-sm font-semibold text-slate-300 active:bg-slate-700 transition-colors"
            >
              <Plus size={18} className="text-indigo-400 shrink-0" />
              Aggiungi profilo
            </button>
          )}

          {/* Elimina profilo attivo */}
          {profiles.length > 1 && (
            <button
              onClick={() => setDialog('del-profile')}
              className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[56px]
                bg-slate-800 border border-rose-800/40 rounded-2xl
                text-sm font-semibold text-rose-400 active:bg-rose-950/30 transition-colors"
            >
              <Trash2 size={18} className="shrink-0" />
              Elimina profilo "{activeProfile?.name}"
            </button>
          )}
        </Section>

        {/* ── Scheda Allenamento (Excel) ─────────────────────────────────────── */}
        <Section title="Scheda Allenamento">

          {program.isCustom && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-950/40 border border-emerald-700/40 rounded-2xl">
              <FileSpreadsheet size={16} className="text-emerald-400 shrink-0" />
              <span className="text-sm text-emerald-300 flex-1">Scheda personalizzata caricata</span>
              <button
                onClick={() => { clearCustomProgram(); }}
                className="text-xs text-rose-400 underline min-h-[44px] px-2"
              >
                Rimuovi
              </button>
            </div>
          )}

          {!program.isCustom && (
            <div className="px-4 py-3 bg-slate-800/60 border border-slate-700/40 rounded-2xl">
              <p className="text-xs text-slate-400">
                Stai usando la scheda di default. Carica il tuo file Excel per usare esercizi personalizzati.
              </p>
            </div>
          )}

          <ActionRow
            icon={<Download size={18} className="text-indigo-400 shrink-0" />}
            label="Scarica template Excel"
            sublabel="Compilalo con i tuoi esercizi"
            onClick={() => excelLib().then(({ downloadTemplate }) => downloadTemplate())}
          />
          <ActionRow
            icon={<Upload size={18} className="text-indigo-400 shrink-0" />}
            label="Carica scheda (.xlsx)"
            sublabel={program.isCustom ? 'Sostituisce la scheda attuale' : 'Carica il tuo file compilato'}
            onClick={() => excelImportRef.current?.click()}
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

        {/* ── Programma ──────────────────────────────────────────────────────── */}
        <Section title="Programma">
          <InfoRow label="Inizio mesociclo"   value={formatDisplayFull(startDate)} />
          <InfoRow label="Settimana corrente" value={`Settimana ${weekNumber} / 5`} />

          <button
            onClick={() => setDialog('reset-meso')}
            className="w-full flex items-center justify-between gap-3 px-4 py-4 min-h-[56px]
              bg-slate-800 border border-amber-800/40 rounded-2xl
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
              bg-slate-800 border border-rose-800/40 rounded-2xl
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

          <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl px-4 py-4 space-y-1.5">
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

          <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl px-4 py-3
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
