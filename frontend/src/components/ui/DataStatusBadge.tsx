import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface DataStatusBadgeProps {
  asOf?: string | null;
  isStale?: boolean;
  availability?: string;
  className?: string;
}

export function DataStatusBadge({ asOf, isStale, availability, className }: DataStatusBadgeProps) {
  if (availability === 'UNAVAILABLE') {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-2 text-text-muted border border-border',
          className
        )}
      >
        <AlertTriangle className="w-3 h-3 text-warning" />
        <span>Indisponível</span>
      </span>
    );
  }

  if (isStale) {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-warning-bg text-warning border border-warning/30',
          className
        )}
      >
        <Clock className="w-3 h-3" />
        <span>Dados desatualizados</span>
      </span>
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-2 text-text-secondary border border-border',
        className
      )}
    >
      <CheckCircle2 className="w-3 h-3 text-income" />
      <span>Sincronizado</span>
    </span>
  );
}
