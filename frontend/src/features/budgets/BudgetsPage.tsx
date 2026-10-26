import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';
import { Target, AlertTriangle, CheckCircle, Plus } from 'lucide-react';
import clsx from 'clsx';

export function BudgetsPage() {
  const [searchParams] = useSearchParams();
  const { hideValues } = useTheme();
  const context = searchParams.get('context') || 'HOUSEHOLD';

  const demoBudgets = [
    { category: 'Alimentação & Supermercado', spent: 1830.5, limit: 2000.0, projected: 2150.0 },
    { category: 'Lazer & Restaurantes', spent: 890.0, limit: 800.0, projected: 1020.0 },
    { category: 'Transporte & Combustível', spent: 450.0, limit: 700.0, projected: 580.0 },
    { category: 'Compras Pessoais', spent: 340.0, limit: 600.0, projected: 450.0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Orçamentos (G-04)</h1>
          <p className="text-xs text-text-muted mt-0.5">Defina limites mensais e acompanhe o ritmo de consumo</p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-subtle self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Orçamento</span>
        </button>
      </div>

      {/* Lista de Orçamentos G-04 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {demoBudgets.map((b, idx) => {
          const percent = (b.spent / b.limit) * 100;
          const isOver = percent >= 100;
          const isWarning = percent >= 80 && !isOver;

          return (
            <div
              key={idx}
              className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text-primary">{b.category}</span>
                <span
                  className={clsx(
                    'text-xs font-bold tabular-nums px-2 py-0.5 rounded-md flex items-center gap-1',
                    isOver && 'bg-danger-bg text-danger',
                    isWarning && 'bg-warning-bg text-warning',
                    !isOver && !isWarning && 'bg-surface-2 text-text-secondary'
                  )}
                >
                  {isOver && <AlertTriangle className="w-3 h-3" />}
                  {percent.toFixed(0)}%
                </span>
              </div>

              {/* Barra de Progresso G-04 */}
              <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden border border-border">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-300',
                    isOver ? 'bg-danger' : isWarning ? 'bg-warning' : 'bg-primary'
                  )}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted">
                  Gasto: <strong>{formatMoney(b.spent, hideValues)}</strong>
                </span>
                <span className="text-text-muted">
                  Limite: <strong>{formatMoney(b.limit, hideValues)}</strong>
                </span>
              </div>

              {/* Projeção de Fechamento */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted">
                <span>Projeção até fim do mês:</span>
                <span className={clsx('font-semibold tabular-nums', b.projected > b.limit ? 'text-danger' : 'text-text-primary')}>
                  {formatMoney(b.projected, hideValues)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
