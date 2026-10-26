import { useSearchParams } from 'react-router-dom';
import { usePermissions, FinancialContext } from '@/lib/permissions';
import { Home, User, Layers, TrendingUp, Briefcase } from 'lucide-react';
import clsx from 'clsx';

export function ContextSwitcher({ className }: { className?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = usePermissions();

  const currentContext = (searchParams.get('context') as FinancialContext) || 'HOUSEHOLD';

  const setContext = (ctx: FinancialContext) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('context', ctx);
    setSearchParams(nextParams, { replace: true });
  };

  const options: Array<{ id: FinancialContext; label: string; icon: React.ReactNode }> = [
    { id: 'HOUSEHOLD', label: 'Casa', icon: <Home className="w-3.5 h-3.5" /> },
    { id: 'PERSONAL', label: 'Pessoal', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'INVESTMENT', label: 'Investimentos', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'WORK', label: 'Trabalho / PJ', icon: <Briefcase className="w-3.5 h-3.5" /> },
  ];

  if (isAdmin) {
    options.push({
      id: 'CONSOLIDATED',
      label: 'Consolidado',
      icon: <Layers className="w-3.5 h-3.5" />,
    });
  }

  return (
    <div
      role="group"
      aria-label="Selecionar contexto financeiro"
      className={clsx(
        'inline-flex items-center p-0.5 bg-surface-2 border border-border rounded-lg text-xs font-medium',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = currentContext === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setContext(opt.id)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all duration-150',
              isActive
                ? 'bg-surface text-primary shadow-subtle font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            )}
            aria-pressed={isActive}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
