import clsx from 'clsx';

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterBarProps {
  options: FilterOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function FilterBar({ options, selectedId, onSelect, className }: FilterBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Filtros rápidos"
      className={clsx(
        'flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs select-none',
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = opt.id === selectedId;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isSelected}
            type="button"
            onClick={() => onSelect(opt.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all duration-150',
              isSelected
                ? 'bg-primary text-white shadow-subtle font-semibold'
                : 'bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-border'
            )}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={clsx(
                  'px-1.5 py-0.2 rounded-full text-[10px] tabular-nums',
                  isSelected ? 'bg-white/20 text-white' : 'bg-surface text-text-muted'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
