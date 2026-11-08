import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';
import { Flag, Plus, Calendar, CheckCircle2, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

export function GoalsPage() {
  const [searchParams] = useSearchParams();
  const { hideValues } = useTheme();
  const context = searchParams.get('context') || 'HOUSEHOLD';

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', context],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/goals', { context });
        return res.data || res || [];
      } catch {
        return [];
      }
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Metas Financeiras (G-12)</h1>
          <p className="text-xs text-text-muted mt-0.5">Planeje seus objetivos e acompanhe o ritmo necessário para atingi-los</p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-subtle self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Meta</span>
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="bg-card border border-border rounded-card p-12 text-center shadow-card space-y-3">
          <Flag className="w-10 h-10 text-text-muted mx-auto" />
          <h3 className="text-sm font-bold text-text-primary">Nenhuma meta financeira cadastrada</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            Crie metas de curto, médio e longo prazo (como Reserva de Emergência, Viagens ou Compras) para acompanhar o progresso mensal.
          </p>
        </div>
      ) : (
        /* Grid de Metas */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal: any) => {
            const percent = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;

            return (
              <div
                key={goal.id}
                className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-sm font-bold text-text-primary block">{goal.name}</span>
                    <span className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Meta para {goal.target_date}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary-light text-primary tabular-nums">
                    {percent.toFixed(0)}%
                  </span>
                </div>

                {/* Barra de Progresso */}
                <div className="w-full h-3 bg-surface-2 rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-muted">
                    Acumulado: <strong className="text-text-primary">{formatMoney(goal.current_amount, hideValues)}</strong>
                  </span>
                  <span className="text-text-muted">
                    Alvo: <strong className="text-text-primary">{formatMoney(goal.target_amount, hideValues)}</strong>
                  </span>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-income" />
                    Ritmo necessário:
                  </span>
                  <span className="font-semibold text-text-primary tabular-nums">
                    {formatMoney(goal.monthly_contribution_needed, hideValues)} / mês
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
