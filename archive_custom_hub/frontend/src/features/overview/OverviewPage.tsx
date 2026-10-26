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
        return { data: { points: [], totals: { income: '0.00', expenses: '0.00', net: '0.00' } } };
      }
    },
  });

  // 3. Busca Categorias vs Média (G-05)
  const { data: categoriesData = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['categories-summary', context, period],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/categories/summary', { context, period });
        return res.data || res || [];
      } catch {
        return [];
      }
    },
  });

  // 4. Busca Cartões Ativos
  const { data: cards = [] } = useQuery({
    queryKey: ['overview-cards', context],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/cards', { context });
        return res.data || res || [];
      } catch {
        return [];
      }
    },
  });

  const totals = cashflowData?.data?.totals?.income !== undefined && cashflowData?.data?.totals?.income !== '0.00'
    ? cashflowData.data.totals
    : {
        income: overviewData?.monthly_income !== undefined ? String(overviewData.monthly_income) : '0.00',
        expenses: overviewData?.monthly_expenses !== undefined ? String(overviewData.monthly_expenses) : '0.00',
        net: overviewData?.monthly_net !== undefined ? String(overviewData.monthly_net) : '0.00',
      };

  const points = cashflowData?.data?.points || [];
  const primaryCard = cards[0] || null;

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
          value={overviewData?.liquid_balance !== undefined ? String(overviewData.liquid_balance) : '0.00'}
          icon={<Wallet className="w-4 h-4 text-primary" />}
          subtitle="Soma das contas correntes ativas"
          isLoading={isOverviewLoading}
        />
        <KpiCard
          title="Entradas no Mês"
          value={totals.income}
          icon={<TrendingUp className="w-4 h-4 text-income" />}
          delta={totals.income !== '0.00' ? { percent: 0, isGood: true, text: 'período atual' } : undefined}
          isLoading={isCashflowLoading && !overviewData}
        />
        <KpiCard
          title="Saídas no Mês"
          value={totals.expenses}
          icon={<TrendingDown className="w-4 h-4 text-expense" />}
          delta={totals.expenses !== '0.00' ? { percent: 0, isGood: false, text: 'período atual' } : undefined}
          isLoading={isCashflowLoading && !overviewData}
        />
        <KpiCard
          title="Saldo Líquido"
          value={totals.net}
          icon={<DollarSign className="w-4 h-4 text-primary" />}
          isLoading={isCashflowLoading && !overviewData}
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
              points.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted">
                  Nenhuma movimentação registrada no período selecionado.
                </div>
              ) : (
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
              )
            }
          >
            {points.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-xs text-text-muted">
                <span>Nenhum lançamento no período.</span>
                <span className="text-[11px] mt-1">Conecte sua instituição financeira para carregar o histórico.</span>
              </div>
            ) : (
              <FlowChart points={points} height="280px" />
            )}
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
            {primaryCard ? (
              <div className="mt-3 space-y-3">
                <div>
                  <span className="text-xs text-text-muted block">
                    {primaryCard.name} (•••• {primaryCard.last_four_digits || '0000'})
                  </span>
                  <span className="text-xl font-bold text-text-primary tabular-nums">
                    {formatMoney(primaryCard.current_balance || '0.00', hideValues)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-text-muted">
                Nenhum cartão de crédito ativo conectado.
              </div>
            )}
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
            <div className="py-6 text-center text-xs text-text-muted">
              Nenhum vencimento pendente para os próximos dias.
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
          categoriesData.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              Nenhum gasto por categoria registrado no período.
            </div>
          ) : (
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
                {categoriesData.map((c: any) => (
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
          )
        }
      >
        {categoriesData.length === 0 ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-xs text-text-muted">
            <span>Nenhuma despesa categorizada neste período.</span>
            <span className="text-[11px] mt-1">Conecte seus extratos para visualizar os comparativos.</span>
          </div>
        ) : (
          <CategoryBars categories={categoriesData} height="280px" />
        )}
      </ChartCard>
    </div>
  );
}
