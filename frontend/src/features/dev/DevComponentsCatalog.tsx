import { useState } from 'react';
import { KpiCard } from '@/components/ui/KpiCard';
import { ChartCard } from '@/components/ui/ChartCard';
import { InsightBanner } from '@/components/ui/InsightBanner';
import { FilterBar } from '@/components/ui/FilterBar';
import { EstimateTag } from '@/components/ui/EstimateTag';
import { DataStatusBadge } from '@/components/ui/DataStatusBadge';
import { FlowChart } from '@/components/charts/FlowChart';
import { CategoryBars } from '@/components/charts/CategoryBars';
import { Timeline, TimelineItem } from '@/components/timeline/Timeline';
import { CalendarMonth, CalendarEvent } from '@/components/timeline/CalendarMonth';
import { mockCashflowSeries } from '@/mocks/fixtures/cashflow';
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

export function DevComponentsCatalog() {
  const [filterId, setFilterId] = useState('all');

  const demoCategories = [
    { id: '1', name: 'Supermercado', current_amount: 1450.0, average_3m: 1200.0, difference_percent: 20.8 },
    { id: '2', name: 'Moradia / Aluguel', current_amount: 2800.0, average_3m: 2800.0, difference_percent: 0.0 },
    { id: '3', name: 'Transporte & Combustível', current_amount: 450.0, average_3m: 600.0, difference_percent: -25.0 },
    { id: '4', name: 'Lazer & Restaurantes', current_amount: 890.0, average_3m: 750.0, difference_percent: 18.6 },
  ];

  const demoTimelineItems: TimelineItem[] = [
    {
      id: 't1',
      kind: 'TRANSACTION',
      date: '2026-10-24',
      title: 'Pão de Açúcar',
      amount: '312.50',
      type: 'EXPENSE',
      categoryName: 'Supermercado',
      accountName: 'Nubank Cartão',
    },
    {
      id: 't2',
      kind: 'BILL_CLOSING',
      date: '2026-10-24',
      title: 'Fechamento da Fatura Nubank',
      amount: '2450.00',
    },
    {
      id: 't3',
      kind: 'TRANSACTION',
      date: '2026-10-23',
      title: 'Salário Empresa XYZ',
      amount: '8200.00',
      type: 'INCOME',
      categoryName: 'Salário',
      accountName: 'Itaú Conta Corrente',
    },
    {
      id: 't4',
      kind: 'TRANSACTION',
      date: '2026-10-23',
      title: 'Assinatura Netflix (Estimado)',
      amount: '55.90',
      type: 'EXPENSE',
      categoryName: 'Assinaturas',
      accountName: 'Nubank Cartão',
      certainty: 'ESTIMATED',
    },
    {
      id: 't5',
      kind: 'BILL_PAYMENT',
      date: '2026-10-20',
      title: 'Pagamento de Fatura Itaú',
      amount: '1890.00',
    },
  ];

  const demoCalendarEvents: CalendarEvent[] = [
    { id: 'c1', date: '2026-10-24', title: 'Fechamento Fatura Nubank', amount: '2450.00', type: 'BILL_CLOSING' },
    { id: 'c2', date: '2026-10-28', title: 'Vencimento Fatura Itaú', amount: '1890.00', type: 'BILL_DUE' },
    { id: 'c3', date: '2026-10-30', title: 'Aluguel Apartamento', amount: '2800.00', type: 'RECURRING' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
          Catálogo Interno de Componentes (F2)
        </h1>
        <p className="text-xs text-text-muted mt-1">
          Ambiente de validação visual de tokens, breakpoints, estados e gráficos modulares.
        </p>
      </div>

      {/* 1. Tokens e Tags */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-text-primary border-b border-border pb-1">
          1. Badges, Tags de Estimativa e Status
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <EstimateTag basis="Média 3 meses" />
          <DataStatusBadge />
          <DataStatusBadge isStale />
          <DataStatusBadge availability="UNAVAILABLE" />
        </div>
      </section>

      {/* 2. Banners de Insight */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-text-primary border-b border-border pb-1">
          2. Banners de Insight (Determinísticos)
        </h2>
        <div className="space-y-2">
          <InsightBanner
            severity="info"
            message="Você gastou 12% menos que no mesmo período do mês passado."
            actionLabel="Ver detalhes do fluxo"
            onAction={() => {}}
          />
          <InsightBanner
            severity="warning"
            message="Supermercado está 20,8% acima da média dos últimos 3 meses."
            actionLabel="Ajustar limite de categoria"
            onAction={() => {}}
          />
          <InsightBanner
            severity="danger"
            message="A fatura do cartão Nubank vence em 3 dias (R$ 2.450,00)."
          />
          <InsightBanner
            severity="success"
            message="Meta Reserva de Emergência atingiu 80% do objetivo estipulado!"
          />
        </div>
      </section>

      {/* 3. Filtros Rápidos (FilterBar) */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-text-primary border-b border-border pb-1">
          3. Barra de Filtros Rápidos (Chips)
        </h2>
        <FilterBar
          options={[
            { id: 'all', label: 'Todas as Contas', count: 48 },
            { id: 'expenses', label: 'Despesas', count: 32 },
            { id: 'income', label: 'Receitas', count: 12 },
            { id: 'uncategorized', label: 'Não Categorizadas', count: 4 },
          ]}
          selectedId={filterId}
          onSelect={setFilterId}
        />
      </section>

      {/* 4. KPI Cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-text-primary border-b border-border pb-1">
          4. KpiCard (4 Estados Principais)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            title="Saldo Disponível"
            value="15420.50"
            icon={<Wallet className="w-4 h-4 text-primary" />}
            subtitle="Soma de 3 contas correntes"
          />
          <KpiCard
            title="Receitas no Mês"
            value="9900.00"
            icon={<TrendingUp className="w-4 h-4 text-income" />}
            delta={{ percent: 8.5, isGood: true, text: 'vs mês anterior' }}
          />
          <KpiCard
            title="Despesas no Mês"
            value="3942.55"
            icon={<TrendingDown className="w-4 h-4 text-expense" />}
            delta={{ percent: -12.3, isGood: true, text: 'vs mês anterior' }}
          />
          <KpiCard
            title="Líquido no Período"
            value="5957.45"
            icon={<DollarSign className="w-4 h-4 text-primary" />}
            delta={{ percent: 24.1, isGood: true }}
          />
        </div>
        {/* Loading state do KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Carregando..." value={null} isLoading />
        </div>
      </section>

      {/* 5. Gráfico G-01 Fluxo de Caixa */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-text-primary border-b border-border pb-1">
          5. ChartCard & FlowChart (G-01 com Tabela Alternativa)
        </h2>
        <ChartCard
          title="Fluxo de Caixa (G-01)"
          subtitle="Entradas, saídas e saldo líquido diário"
          summaryValue="R$ 5.957,45"
          insight="Você poupou 60% da renda recebida até agora neste mês."
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
                {mockCashflowSeries.data.points.map((pt) => (
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
          <FlowChart points={mockCashflowSeries.data.points} />
        </ChartCard>
      </section>

      {/* 6. Gráfico G-05 Categorias vs Média */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-text-primary border-b border-border pb-1">
          6. CategoryBars (G-05 - Atual vs Média 3 Meses)
        </h2>
        <ChartCard
          title="Gastos por Categoria vs Média de 3 Meses (G-05)"
          subtitle="Identifique desvios em relação ao seu padrão histórico"
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
                {demoCategories.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 tabular-nums">
                    <td className="py-2 font-medium">{c.name}</td>
                    <td className="py-2 text-right font-semibold">R$ {c.current_amount.toFixed(2)}</td>
                    <td className="py-2 text-right text-text-muted">R$ {c.average_3m.toFixed(2)}</td>
                    <td className="py-2 text-right font-bold">
                      {c.difference_percent > 0 ? '+' : ''}
                      {c.difference_percent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <CategoryBars categories={demoCategories} />
        </ChartCard>
      </section>

      {/* 7. Timeline T-01 e Calendário T-03 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-text-primary border-b border-border pb-1">
            7. Timeline (T-01 com Marcadores)
          </h2>
          <div className="bg-card border border-border rounded-card p-4">
            <Timeline items={demoTimelineItems} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-text-primary border-b border-border pb-1">
            8. Calendário de Contas (T-03)
          </h2>
          <CalendarMonth events={demoCalendarEvents} initialMonth="2026-10" />
        </section>
      </div>
    </div>
  );
}
