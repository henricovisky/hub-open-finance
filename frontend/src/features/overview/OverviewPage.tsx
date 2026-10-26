import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { KpiCard } from '@/components/ui/KpiCard';
import { ChartCard } from '@/components/ui/ChartCard';
import { InsightBanner } from '@/components/ui/InsightBanner';
import { DataStatusBadge } from '@/components/ui/DataStatusBadge';
import { FlowChart } from '@/components/charts/FlowChart';
import { CategoryBars } from '@/components/charts/CategoryBars';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';
import { Wallet, TrendingUp, TrendingDown, DollarSign, CreditCard, Calendar, ArrowRight } from 'lucide-react';
import { mockCashflowSeries } from '@/mocks/fixtures/cashflow';

export function OverviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { hideValues } = useTheme();

  const context = searchParams.get('context') || 'HOUSEHOLD';
  const period = searchParams.get('period') || '';

  // 1. Busca KPIs e resumo do Dashboard
  const { data: overviewData, isLoading: isOverviewLoading } = useQuery({
    queryKey: ['overview', context, period],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/dashboard/overview', { context });
        return res.data || res;
      } catch {
        return null;
      }
    },
  });

  // 2. Busca Série de Fluxo de Caixa (G-01)
  const { data: cashflowData, isLoading: isCashflowLoading } = useQuery({
    queryKey: ['cashflow-series', context, period],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/cashflow/series', { context, period, granularity: 'day' });
        return res;
      } catch {
        // Fallback para mock enquanto o endpoint não estiver montado
        return mockCashflowSeries;
      }
    },
  });

  // 3. Busca Categorias vs Média (G-05)
  const { data: categoriesData, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['categories-summary', context, period],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/categories/summary', { context, period });
        return res.data || res;
      } catch {
        return [
          { id: '1', name: 'Supermercado', current_amount: 1450.0, average_3m: 1200.0, difference_percent: 20.8 },
          { id: '2', name: 'Moradia / Aluguel', current_amount: 2800.0, average_3m: 2800.0, difference_percent: 0.0 },
          { id: '3', name: 'Transporte', current_amount: 450.0, average_3m: 600.0, difference_percent: -25.0 },
          { id: '4', name: 'Lazer', current_amount: 890.0, average_3m: 750.0, difference_percent: 18.6 },
        ];
      }
    },
  });

  const totals = cashflowData?.data?.totals || overviewData?.totals || {
    income: '9900.00',
    expenses: '3942.55',
    net: '5957.45',
  };

  const points = cashflowData?.data?.points || mockCashflowSeries.data.points;

  return (
    <div className="space-y-6">
      {/* Header com Boas-vindas e Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Visão Geral</h1>
          <p className="text-xs text-text-muted mt-0.5">Resumo financeiro e fluxo de caixa do período</p>
        </div>
        <div className="flex items-center gap-2">
          <DataStatusBadge asOf={cashflowData?.meta?.as_of} isStale={cashflowData?.meta?.is_stale} />
        </div>
      </div>

      {/* Insights Determinísticos */}
      {cashflowData?.insight && (
        <InsightBanner
          severity="info"
          message={cashflowData.insight}
          actionLabel="Ver detalhes do fluxo"
          onAction={() => navigate('/fluxo')}
        />
      )}

      {/* 4 KPIs Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Saldo Disponível"
          value={overviewData?.available_balance || '15420.50'}
          icon={<Wallet className="w-4 h-4 text-primary" />}
          subtitle="Soma das contas ativas"
          isLoading={isOverviewLoading}
        />
        <KpiCard
          title="Entradas no Mês"
          value={totals.income}
          icon={<TrendingUp className="w-4 h-4 text-income" />}
          delta={{ percent: 8.5, isGood: true, text: 'vs mês passado' }}
          isLoading={isCashflowLoading}
        />
        <KpiCard
          title="Saídas no Mês"
          value={totals.expenses}
          icon={<TrendingDown className="w-4 h-4 text-expense" />}
          delta={{ percent: -12.3, isGood: true, text: 'vs mês passado' }}
          isLoading={isCashflowLoading}
        />
        <KpiCard
          title="Saldo Líquido"
          value={totals.net}
          icon={<DollarSign className="w-4 h-4 text-primary" />}
          delta={{ percent: 24.1, isGood: true }}
          isLoading={isCashflowLoading}
        />
      </div>

      {/* Grid Principal: Gráfico G-01 Fluxo de Caixa (8 colunas) + Resumo Lateral (4 colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8">
          <ChartCard
            title="Fluxo de Caixa (G-01)"
            subtitle="Evolução diária de entradas, saídas e resultado acumulado"
            summaryValue={formatMoney(totals.net, hideValues)}
            isLoading={isCashflowLoading}
            action={
              <button
                type="button"
                onClick={() => navigate('/fluxo')}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <span>Ver tudo</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            }
            tableAlternative={
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="py-2">Data</th>
                    <th className="py-2 text-right">Entradas</th>
                    <th className="py-2 text-right">Saídas</th>
                    <th className="py-2 text-right">Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((pt: any) => (
                    <tr key={pt.date} className="border-b border-border/50 tabular-nums">
                      <td className="py-2 font-medium">{pt.date}</td>
                      <td className="py-2 text-right text-income">R$ {pt.income}</td>
                      <td className="py-2 text-right text-expense">R$ {pt.expenses}</td>
                      <td className="py-2 text-right font-semibold">R$ {pt.net}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <FlowChart points={points} height="280px" />
          </ChartCard>
        </div>

        {/* Resumo Lateral: Cartões e Próximos Vencimentos */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card Resumo de Cartões */}
          <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <h3 className="text-xs sm:text-sm font-bold text-text-primary">Fatura do Cartão</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/cartoes')}
                className="text-[11px] text-primary font-semibold hover:underline"
              >
                Detalhes
              </button>
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <span className="text-xs text-text-muted block">Nubank Ultravioleta (•••• 4921)</span>
                <span className="text-xl font-bold text-text-primary tabular-nums">
                  {formatMoney('2450.00', hideValues)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-text-secondary bg-surface-2 p-2 rounded-lg">
                <span>Fecha em: <strong>24/10</strong></span>
                <span>Vence em: <strong className="text-expense">28/10</strong></span>
              </div>
            </div>
          </div>

          {/* Próximos Compromissos */}
          <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-warning" />
                <h3 className="text-xs sm:text-sm font-bold text-text-primary">Próximos Compromissos</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/agenda')}
                className="text-[11px] text-primary font-semibold hover:underline"
              >
                Agenda
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { title: 'Fatura Nubank', date: '28/10', amount: '2450.00', isExpense: true },
                { title: 'Aluguel Apartamento', date: '30/10', amount: '2800.00', isExpense: true },
                { title: 'Aporte Investimentos', date: '05/11', amount: '1500.00', isExpense: false },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                  <div>
                    <span className="font-semibold text-text-primary block">{item.title}</span>
                    <span className="text-[11px] text-text-muted">Vence em {item.date}</span>
                  </div>
                  <span className="font-bold tabular-nums text-text-primary">
                    {formatMoney(item.amount, hideValues)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico G-05 Categorias vs Média */}
      <ChartCard
        title="Gastos por Categoria vs Média de 3 Meses (G-05)"
        subtitle="Compare seus gastos atuais com sua média histórica recente"
        isLoading={isCategoriesLoading}
        action={
          <button
            type="button"
            onClick={() => navigate('/categorias')}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>Ver categorias</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        }
        tableAlternative={
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2">Categoria</th>
                <th className="py-2 text-right">Atual</th>
                <th className="py-2 text-right">Média 3M</th>
                <th className="py-2 text-right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {categoriesData?.map((c: any) => (
                <tr key={c.id} className="border-b border-border/50 tabular-nums">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2 text-right font-semibold">
                    {formatMoney(c.current_amount, hideValues)}
                  </td>
                  <td className="py-2 text-right text-text-muted">
                    {formatMoney(c.average_3m, hideValues)}
                  </td>
                  <td className="py-2 text-right font-bold">
                    {c.difference_percent > 0 ? '+' : ''}
                    {c.difference_percent?.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <CategoryBars categories={categoriesData || []} height="280px" />
      </ChartCard>
    </div>
  );
}
