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
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import clsx from 'clsx';

export function CashflowPage() {
  const [searchParams] = useSearchParams();
  const { hideValues } = useTheme();
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('month');
  const [accountFilter, setAccountFilter] = useState('all');

  const context = searchParams.get('context') || 'HOUSEHOLD';
  const period = searchParams.get('period') || '';

  // Busca lista real de contas para o filtro
  const { data: accounts = [] } = useQuery({
    queryKey: ['cashflow-accounts', context],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/accounts', { context });
        return res.data || res || [];
      } catch {
        return [];
      }
    },
  });

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
        return { data: { points: [], totals: { income: '0.00', expenses: '0.00', net: '0.00' } } };
      }
    },
  });

  const totals = seriesData?.data?.totals || { income: '0.00', expenses: '0.00', net: '0.00' };
  const points = seriesData?.data?.points || [];

  const filterOptions = [
    { id: 'all', label: 'Todas as Contas' },
    ...accounts.map((acc: any) => ({
      id: acc.id,
      label: `${acc.name || 'Conta'} (${acc.institution_name || ''})`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Fluxo de Caixa</h1>
          <p className="text-xs text-text-muted mt-0.5">Visão consolidada de entradas, saídas e resultado acumulado</p>
        </div>

        {/* Seletor de Granularidade (Mensal padrão, Semanal, Diária) */}
        <div className="inline-flex items-center p-0.5 bg-surface-2 border border-border rounded-lg text-xs font-semibold self-start sm:self-auto">
          {[
            { id: 'month', label: 'Mensal' },
            { id: 'week', label: 'Semanal' },
            { id: 'day', label: 'Diária' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setGranularity(item.id as any)}
              className={clsx(
                'px-3.5 py-1.5 rounded-md transition-colors',
                granularity === item.id ? 'bg-surface text-primary shadow-subtle font-bold' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros de Contas */}
      {filterOptions.length > 1 && (
        <FilterBar
          options={filterOptions}
          selectedId={accountFilter}
          onSelect={setAccountFilter}
        />
      )}

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
          points.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              Nenhuma movimentação registrada no período selecionado.
            </div>
          ) : (
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
          )
        }
      >
        {points.length === 0 ? (
          <div className="h-[320px] flex flex-col items-center justify-center text-xs text-text-muted">
            <span>Nenhuma movimentação para exibir neste período.</span>
            <span className="text-[11px] mt-1">Conecte sua conta para começar a acompanhar o fluxo diário.</span>
          </div>
        ) : (
          <FlowChart points={points} height="320px" />
        )}
      </ChartCard>
    </div>
  );
}
