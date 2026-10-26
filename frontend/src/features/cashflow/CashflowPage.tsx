import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ChartCard } from '@/components/ui/ChartCard';
import { FilterBar } from '@/components/ui/FilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { FlowChart } from '@/components/charts/FlowChart';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';
import { mockCashflowSeries } from '@/mocks/fixtures/cashflow';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import clsx from 'clsx';

export function CashflowPage() {
  const [searchParams] = useSearchParams();
  const { hideValues } = useTheme();
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [accountFilter, setAccountFilter] = useState('all');

  const context = searchParams.get('context') || 'HOUSEHOLD';
  const period = searchParams.get('period') || '';

  const { data: seriesData, isLoading } = useQuery({
    queryKey: ['cashflow-page-series', context, period, granularity, accountFilter],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/cashflow/series', {
          context,
          period,
          granularity,
          account_id: accountFilter !== 'all' ? accountFilter : undefined,
        });
        return res;
      } catch {
        return mockCashflowSeries;
      }
    },
  });

  const totals = seriesData?.data?.totals || mockCashflowSeries.data.totals;
  const points = seriesData?.data?.points || mockCashflowSeries.data.points;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Fluxo de Caixa</h1>
          <p className="text-xs text-text-muted mt-0.5">Visão consolidada de entradas, saídas e resultado acumulado</p>
        </div>

        {/* Seletor de Granularidade (Dia, Semana, Mês) */}
        <div className="inline-flex items-center p-0.5 bg-surface-2 border border-border rounded-lg text-xs font-semibold self-start sm:self-auto">
          {(['day', 'week', 'month'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={clsx(
                'px-3 py-1.5 rounded-md transition-colors capitalize',
                granularity === g ? 'bg-surface text-primary shadow-subtle' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {g === 'day' ? 'Dia' : g === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros de Contas */}
      <FilterBar
        options={[
          { id: 'all', label: 'Todas as Contas' },
          { id: 'nubank', label: 'Nubank' },
          { id: 'itau', label: 'Itaú' },
        ]}
        selectedId={accountFilter}
        onSelect={setAccountFilter}
      />

      {/* Totais do Período */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          title="Total de Entradas"
          value={totals.income}
          icon={<TrendingUp className="w-4 h-4 text-income" />}
          isLoading={isLoading}
        />
        <KpiCard
          title="Total de Saídas"
          value={totals.expenses}
          icon={<TrendingDown className="w-4 h-4 text-expense" />}
          isLoading={isLoading}
        />
        <KpiCard
          title="Resultado Líquido"
          value={totals.net}
          icon={<DollarSign className="w-4 h-4 text-primary" />}
          isLoading={isLoading}
        />
      </div>

      {/* Gráfico Principal G-01 com Tabela Alternativa */}
      <ChartCard
        title="Fluxo Detalhado"
        subtitle={`Exibição agrupada por ${granularity === 'day' ? 'dia' : granularity === 'week' ? 'semana' : 'mês'}`}
        summaryValue={formatMoney(totals.net, hideValues)}
        isLoading={isLoading}
        tableAlternative={
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2.5">Data / Período</th>
                <th className="py-2.5 text-right">Entradas</th>
                <th className="py-2.5 text-right">Saídas</th>
                <th className="py-2.5 text-right">Líquido</th>
                <th className="py-2.5 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {points.map((pt: any) => (
                <tr key={pt.date} className="border-b border-border/50 tabular-nums">
                  <td className="py-2.5 font-medium">{pt.date}</td>
                  <td className="py-2.5 text-right text-income">R$ {pt.income}</td>
                  <td className="py-2.5 text-right text-expense">R$ {pt.expenses}</td>
                  <td className="py-2.5 text-right font-semibold">R$ {pt.net}</td>
                  <td className="py-2.5 text-right text-text-muted">R$ {pt.cumulative_net || pt.net}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <FlowChart points={points} height="320px" />
      </ChartCard>
    </div>
  );
}
