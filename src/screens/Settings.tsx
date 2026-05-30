// src/screens/Settings.tsx
import { useRef, useState } from 'react';
import {
  Download, Upload, RotateCcw, Trash2,
  Calendar, Info, ChevronRight,
} from 'lucide-react';
import { useLogStore }        from '../hooks/useLogStore';
import { useCurrentSession }  from '../hooks/useCurrentSession';
import { useToast }           from '../hooks/useToast';
import { ToastStack }         from '../components/Toast';
import { ConfirmDialog }      from '../components/ConfirmDialog';
import { formatDisplayFull }  from '../lib/dates';

const APP_VERSION = '0.1.0';

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

  // Dialog state
  const [dialog, setDialog] = useState<'reset-meso' | 'reset-all' | null>(null);

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

  // ── Stat riepilogo ────────────────────────────────────────────────────────────
  const totalSessions = store.sessions.length;
  const totalVolume   = store.sessions.reduce(
    (acc, s) => acc + s.exercises.reduce(
      (a, ex) => a + ex.sets.reduce((x, set) => x + set.reps * set.kg, 0), 0), 0);

  return (
    <>
      <div className="px-4 pt-6 pb-10 max-w-lg mx-auto space-y-7">

        <h1 className="text-2xl font-bold">Impostazioni</h1>

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
