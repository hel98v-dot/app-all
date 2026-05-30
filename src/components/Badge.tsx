// src/components/Badge.tsx
// Piccola etichetta colorata riusabile.
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'indigo' | 'emerald' | 'amber' | 'rose';
}

const VARIANTS: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-slate-700 text-slate-300',
  indigo:  'bg-indigo-900/60 text-indigo-300',
  emerald: 'bg-emerald-900/60 text-emerald-300',
  amber:   'bg-amber-900/60 text-amber-300',
  rose:    'bg-rose-900/60 text-rose-300',
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}
