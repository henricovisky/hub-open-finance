import { useSearchParams } from 'react-router-dom';
import { getCurrentPeriod, getPreviousPeriod, getNextPeriod, formatPeriod } from '@/lib/dates';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import clsx from 'clsx';

export function PeriodPicker({ className }: { className?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPeriod = searchParams.get('period') || getCurrentPeriod();
  const isCurrentMonth = currentPeriod === getCurrentPeriod();

  const setPeriod = (p: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('period', p);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div
      role="group"
      aria-label="Selecionar período mensal"
      className={clsx(
        'inline-flex items-center gap-1 bg-surface-2 border border-border rounded-lg p-0.5 text-xs font-medium',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setPeriod(getPreviousPeriod(currentPeriod))}
        className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
        aria-label="Mês anterior"
        title="Mês anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-1.5 px-2 py-1 text-text-primary font-semibold tabular-nums">
        <Calendar className="w-3.5 h-3.5 text-text-muted" />
        <span>{formatPeriod(currentPeriod)}</span>
      </div>

      <button
        type="button"
        onClick={() => setPeriod(getNextPeriod(currentPeriod))}
        className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
        aria-label="Próximo mês"
        title="Próximo mês"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {!isCurrentMonth && (
        <button
          type="button"
          onClick={() => setPeriod(getCurrentPeriod())}
          className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold text-primary bg-primary-light rounded hover:underline"
        >
          Hoje
        </button>
      )}
    </div>
  );
}
