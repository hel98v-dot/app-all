// src/lib/excel.ts
// Utilità per import/export Excel con SheetJS.

import * as XLSX from 'xlsx';
import type { Session, Exercise, Muscle, Location, MetricUnit } from '../data/program';
import type { SessionLog } from '../types';

// ── Mapping nomi italiani → DayKey ────────────────────────────────────────────

const DAY_MAP: Record<string, string> = {
  'lunedi': 'lunedi', 'lunedì': 'lunedi', 'lun': 'lunedi', 'monday': 'lunedi',
  'martedi': 'martedi', 'martedì': 'martedi', 'mar': 'martedi', 'tuesday': 'martedi',
  'mercoledi': 'mercoledi', 'mercoledì': 'mercoledi', 'mer': 'mercoledi',
  'giovedi': 'giovedi', 'giovedì': 'giovedi', 'gio': 'giovedi', 'thursday': 'giovedi',
  'venerdi': 'venerdi', 'venerdì': 'venerdi', 'ven': 'venerdi', 'friday': 'venerdi',
  'sabato': 'sabato', 'sab': 'sabato', 'saturday': 'sabato',
  'domenica': 'domenica', 'dom': 'domenica', 'sunday': 'domenica',
};

const DAY_LABELS: Record<string, string> = {
  lunedi: 'Lunedì', martedi: 'Martedì', mercoledi: 'Mercoledì',
  giovedi: 'Giovedì', venerdi: 'Venerdì', sabato: 'Sabato', domenica: 'Domenica',
};

const VALID_MUSCLES = new Set<string>([
  'Petto','Dorso','Spalle','Bicipiti','Tricipiti',
  'Glutei','Quadricipiti','Femorali','Addome',
]);

function normMuscle(raw: string): Muscle {
  const s = raw.trim();
  // Case-insensitive match
  const found = [...VALID_MUSCLES].find(m => m.toLowerCase() === s.toLowerCase());
  return (found as Muscle) ?? 'Addome';
}

function normBool(raw: unknown): boolean {
  const s = String(raw ?? '').toLowerCase().trim();
  return s === 'sì' || s === 'si' || s === 'yes' || s === '1' || s === 'true';
}

// ── 1. Download template vuoto ────────────────────────────────────────────────

export function downloadTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Foglio istruzioni
  const instructions: string[][] = [
    ['ISTRUZIONI — Scheda Allenamento'],
    [''],
    ['• Ogni riga = un esercizio. Le righe dello stesso giorno appartengono alla stessa sessione.'],
    ['• Sessione: usa A / B / C per i blocchi (A = Push, B = Glutei/Gambe, C = Pull).'],
    ['    Per le sessioni a casa aggiungi "1": A1 / B1 / C1. (Vanno bene anche i giorni: Lunedì…)'],
    ['• Luogo: palestra  o  casa'],
    ['• Muscolo: Petto | Dorso | Spalle | Bicipiti | Tricipiti | Glutei | Quadricipiti | Femorali | Addome'],
    ['• Set: numero intero (es. 4)'],
    ['• Reps: stringa (es. 8-10  oppure  12-15)'],
    ['• RPE: stringa (es. 7-8)'],
    ['• Recupero: stringa (es. 2\'  oppure  90")'],
    ['• Unilaterale: sì  oppure  no'],
    ['• Metrica: reps  oppure  metri  (per carries/trasporti)'],
    ['• Superset: stesso valore (es. 1) su due esercizi della stessa sessione = li pre-abbina'],
    ['• Note: testo libero opzionale'],
    [''],
    ['Salva il file, poi caricalo nell\'app dalla schermata Impostazioni → Profilo → Carica scheda.'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), 'Istruzioni');

  // Foglio scheda con intestazioni + righe di esempio
  const rows: (string | number)[][] = [
    ['Sessione','Luogo','Esercizio','Muscolo','Set','Reps','RPE','Recupero','Unilaterale','Metrica','Superset','Note'],
    ['A','palestra','Panca piana con manubri','Petto', 4,'8-10','7-8',"2'",'no','reps','',''],
    ['A','palestra','Alzate laterali manubri','Spalle',3,'12-15','8-9',"90\"",'no','reps','1',''],
    ['A','palestra','Pushdown ai cavi','Tricipiti',3,'10-12','8-9',"90\"",'no','reps','1',''],
    ['B1','casa','Hip thrust BW','Glutei',4,'12-15','8',"90\"",'no','reps','',''],
    ['B1','casa','Ab wheel rollout','Addome',4,'8-12','8',"90\"",'no','reps','',''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    {wch:12},{wch:10},{wch:35},{wch:14},
    {wch:6},{wch:10},{wch:8},{wch:10},
    {wch:12},{wch:8},{wch:10},{wch:30},
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Scheda');

  XLSX.writeFile(wb, 'template-scheda-allenamento.xlsx');
}

// ── 2. Importa scheda da file .xlsx ──────────────────────────────────────────

export interface ParseResult {
  sessions: Session[];
  warnings: string[];
}

export function parseScheduleFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array' });

        // Cerca il foglio 'Scheda', altrimenti usa il primo
        const sheetName = wb.SheetNames.find(n =>
          n.toLowerCase().includes('scheda') ||
          n.toLowerCase().includes('piano') ||
          n.toLowerCase().includes('program')
        ) ?? wb.SheetNames[0];

        if (!sheetName) { reject(new Error('Nessun foglio trovato.')); return; }

        const ws = wb.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          defval: '',
          blankrows: false,
        }) as unknown[][];

        // Trova riga intestazioni (cerca "Sessione" o "Esercizio")
        let headerIdx = raw.findIndex(row =>
          Array.isArray(row) && row.some(c =>
            typeof c === 'string' && (
              c.toLowerCase().includes('sessione') ||
              c.toLowerCase().includes('esercizio')
            )
          )
        );
        if (headerIdx === -1) headerIdx = 0;

        const headers = (raw[headerIdx] as string[]).map(h => String(h).toLowerCase().trim());
        const idx = (name: string) => {
          const i = headers.findIndex(h => h.includes(name));
          return i === -1 ? null : i;
        };

        const COL = {
          sessione:    idx('sessione') ?? 0,
          luogo:       idx('luogo')    ?? 1,
          esercizio:   idx('esercizio') ?? 2,
          muscolo:     idx('muscolo')  ?? 3,
          set:         idx('set')      ?? 4,
          reps:        idx('reps')     ?? 5,
          rpe:         idx('rpe')      ?? 6,
          recupero:    idx('recupero') ?? 7,
          unilaterale: idx('unilateral') ?? 8,
          metrica:     idx('metrica') ?? 9,
          superset:    idx('superset'),     // colonna opzionale
          note:        idx('note')    ?? 11,
        };

        const slugify = (s: string): string =>
          s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sess';

        const warnings: string[] = [];
        interface SessionAcc {
          exercises: Exercise[];
          location: Location;
          label: string;
          dayKey: string;
          sessionId: string;
        }
        const sessionMap = new Map<string, SessionAcc>();
        const sessionOrder: string[] = [];
        const usedIds = new Set<string>();

        for (let r = headerIdx + 1; r < raw.length; r++) {
          const row = raw[r] as unknown[];
          const getCell = (i: number | null) => (i === null ? '' : String(row[i] ?? '').trim());

          const sessionName = getCell(COL.sessione);
          const exerciseName = getCell(COL.esercizio);
          if (!sessionName || !exerciseName) continue;

          const mapKey = sessionName.toLowerCase();
          const knownDay = DAY_MAP[mapKey];

          if (!sessionMap.has(mapKey)) {
            // Id univoco: giorno noto → 'lun'/'mar'…, altrimenti slug del nome (es. "A" → "a")
            let sid = knownDay ? knownDay.slice(0, 3) : slugify(sessionName);
            while (usedIds.has(sid)) sid += 'x';
            usedIds.add(sid);
            sessionMap.set(mapKey, {
              exercises: [],
              location: getCell(COL.luogo).toLowerCase() === 'casa' ? 'casa' : 'palestra',
              label: sessionName,
              dayKey: knownDay ?? 'lunedi',
              sessionId: sid,
            });
            sessionOrder.push(mapKey);
          }

          const entry = sessionMap.get(mapKey)!;
          const setsVal = parseInt(getCell(COL.set)) || 3;
          const metricRaw = getCell(COL.metrica).toLowerCase();
          const isMeters = metricRaw === 'metri' || metricRaw === 'meters' || metricRaw === 'm';
          const supersetVal = getCell(COL.superset);

          const exercise: Exercise = {
            id: `${entry.sessionId}-${entry.exercises.length}`,
            name:           exerciseName,
            muscle:         normMuscle(getCell(COL.muscolo)),
            prescribedSets: setsVal,
            repsTarget:     getCell(COL.reps)     || '10-12',
            rpeTarget:      getCell(COL.rpe)      || '7-8',
            rest:           getCell(COL.recupero) || "90\"",
            ...(normBool(row[COL.unilaterale]) ? { unilateral: true as const } : {}),
            ...(isMeters ? { metric: 'meters' as MetricUnit } : {}),
            ...(getCell(COL.note) ? { notes: getCell(COL.note) } : {}),
            ...(supersetVal ? { supersetGroup: supersetVal } : {}),
          };

          entry.exercises.push(exercise);
        }

        if (sessionMap.size === 0) {
          reject(new Error('Nessuna sessione trovata nel file. Controlla il formato.'));
          return;
        }

        const sessions: Session[] = sessionOrder.map(key => {
          const { exercises, location, label, dayKey, sessionId } = sessionMap.get(key)!;
          const dk = dayKey as import('../data/program').DayKey;
          const isDayName = DAY_MAP[label.toLowerCase()] !== undefined;
          return {
            id:       sessionId,
            day:      dk,
            dayLabel: isDayName ? (DAY_LABELS[dayKey] ?? label) : label,
            focus:    label,
            location,
            exercises,
          };
        });

        resolve({ sessions, warnings });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Errore lettura file.'));
    reader.readAsArrayBuffer(file);
  });
}

// ── 3. Esporta log compilato in Excel ────────────────────────────────────────

export function exportLogToExcel(
  sessions: Session[],
  logs: SessionLog[],
): void {
  const wb = XLSX.utils.book_new();

  // Foglio 1: riepilogo log dettagliato
  const logRows: (string | number)[][] = [[
    'Data', 'Sessione', 'Esercizio', 'Muscolo',
    'Set 1 Reps', 'Set 1 Kg', 'Set 2 Reps', 'Set 2 Kg',
    'Set 3 Reps', 'Set 3 Kg', 'Set 4 Reps', 'Set 4 Kg',
    'Set 5 Reps', 'Set 5 Kg',
    'Volume (kg)', 'Note',
  ]];

  // Mappa id → exercise per lookup
  const exMap = new Map<string, { name: string; muscle: string }>();
  for (const s of sessions) {
    for (const e of s.exercises) exMap.set(e.id, { name: e.name, muscle: e.muscle });
  }

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  for (const log of sorted) {
    const sessionDef = sessions.find(s => s.id === log.sessionId);
    const sessionLabel = sessionDef?.focus ?? log.sessionId;

    for (const exLog of log.exercises) {
      const ex = exMap.get(exLog.exerciseId);
      const vol = exLog.sets.reduce((acc, s) => acc + s.reps * s.kg, 0);
      const setCells: (string | number)[] = [];
      for (let i = 0; i < 5; i++) {
        setCells.push(exLog.sets[i]?.reps ?? '');
        setCells.push(exLog.sets[i]?.kg   ?? '');
      }
      logRows.push([
        log.date,
        sessionLabel,
        ex?.name    ?? exLog.exerciseId,
        ex?.muscle  ?? '',
        ...setCells,
        vol,
        exLog.notes ?? '',
      ]);
    }
  }

  const wsLog = XLSX.utils.aoa_to_sheet(logRows);
  wsLog['!cols'] = [
    {wch:12},{wch:20},{wch:35},{wch:14},
    {wch:8},{wch:8},{wch:8},{wch:8},{wch:8},{wch:8},{wch:8},{wch:8},{wch:8},{wch:8},
    {wch:12},{wch:30},
  ];
  XLSX.utils.book_append_sheet(wb, wsLog, 'Log Allenamenti');

  // Foglio 2: scheda programma (come il template)
  const schedRows: (string | number)[][] = [
    ['Sessione','Luogo','Esercizio','Muscolo','Set','Reps','RPE','Recupero','Unilaterale','Metrica','Superset','Note'],
  ];
  for (const s of sessions) {
    for (const ex of s.exercises) {
      schedRows.push([
        s.dayLabel,
        s.location,
        ex.name,
        ex.muscle,
        ex.prescribedSets,
        ex.repsTarget,
        ex.rpeTarget,
        ex.rest,
        ex.unilateral ? 'sì' : 'no',
        ex.metric === 'meters' ? 'metri' : 'reps',
        ex.supersetGroup ?? '',
        ex.notes ?? '',
      ]);
    }
  }
  const wsSched = XLSX.utils.aoa_to_sheet(schedRows);
  XLSX.utils.book_append_sheet(wb, wsSched, 'Scheda Programma');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `allenamento-log-${date}.xlsx`);
}
