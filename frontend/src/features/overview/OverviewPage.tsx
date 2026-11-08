import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { KpiCard } from '@/components/ui/KpiCard';
import { ChartCard } from '@/components/ui/ChartCard';
import { InsightBanner } from '@/components/ui/InsightBanner';
import { DataStatusBadge } from '@/components/ui/DataStatusBadge';
import { FlowChart } from '@/components/charts/FlowChart';
import { formatMoney } from '@/lib/format';
import { formatDate } from '@/lib/dates';
import { useTheme } from '@/app/providers/ThemeProvider';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Target,
  FileSpreadsheet,
} from 'lucide-react';
import clsx from 'clsx';

export function OverviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hideValues } = useTheme();

  const context = searchParams.get('context') || 'HOUSEHOLD';
  const period = searchParams.get('period') || '';

  const [activeBudgetTab, setActiveBudgetTab] = useState<'ALL' | 'ESSENTIAL' | 'NON_ESSENTIAL'>('ALL');
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // 1. KPIs e Resumo do Dashboard
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

  // 2. Série de Fluxo de Caixa (G-01)
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

  // 3. Resumo de Categorias Orçado vs Realizado (Planilha Pessoal)
  const { data: categoriesData = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['categories-summary', context, period],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/categories/summary', { context, period });
        return Array.isArray(res) ? res : res.data || [];
      } catch {
        return [];
      }
    },
  });

  // 4. Transações Reais da Conta Corrente Nubank
  const { data: txData, isLoading: isTxLoading } = useQuery({
    queryKey: ['recent-transactions', context],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/transactions', { context, page_size: 20 });
        return res.results || res.data || res.items || (Array.isArray(res) ? res : []);
      } catch {
        return [];
      }
    },
  });

  // Mutação para Sincronização em 1-clique do Nubank
  const syncMutation = useMutation({
    mutationFn: async () => {
      return api.post('/connections/sync-nubank');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow-series'] });
      queryClient.invalidateQueries({ queryKey: ['categories-summary'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
      setSyncSuccessMsg(`Sincronizado com sucesso! ${data.records_read || 0} lançamentos verificados.`);
      setTimeout(() => setSyncSuccessMsg(null), 5000);
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
  const transactions = Array.isArray(txData) ? txData : [];

  // Mapeamento de CategoryId -> CategoryName
  const categoryMap = useMemo(() => {
    const map = new Map<string, any>();
    categoriesData.forEach((c: any) => {
      map.set(c.id, c);
    });
    return map;
  }, [categoriesData]);

  // Filtragem das categorias pelo agrupamento da planilha
  const essentialCategories = categoriesData.filter((c: any) => c.is_essential);
  const nonEssentialCategories = categoriesData.filter((c: any) => !c.is_essential);

  const displayedCategories =
    activeBudgetTab === 'ESSENTIAL'
      ? essentialCategories
      : activeBudgetTab === 'NON_ESSENTIAL'
      ? nonEssentialCategories
      : categoriesData;

  // Cálculos de totais da tabela orçamentária
  const totalBudgeted = categoriesData.reduce((acc: number, c: any) => acc + (parseFloat(c.budget_amount) || 0), 0);
  const totalSpent = categoriesData.reduce((acc: number, c: any) => acc + (parseFloat(c.current_amount) || 0), 0);
  const totalDiff = totalBudgeted - totalSpent;
  const totalPercent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  const essentialBudgeted = essentialCategories.reduce((acc: number, c: any) => acc + (parseFloat(c.budget_amount) || 0), 0);
  const essentialSpent = essentialCategories.reduce((acc: number, c: any) => acc + (parseFloat(c.current_amount) || 0), 0);

  const nonEssentialBudgeted = nonEssentialCategories.reduce((acc: number, c: any) => acc + (parseFloat(c.budget_amount) || 0), 0);
  const nonEssentialSpent = nonEssentialCategories.reduce((acc: number, c: any) => acc + (parseFloat(c.current_amount) || 0), 0);

  // Helper para detectar forma de pagamento baseada no texto
  const getPaymentMethod = (tx: any) => {
    const desc = (tx.description || '').toUpperCase();
    if (desc.includes('PIX')) return 'PIX';
    if (desc.includes('BOLETO') || desc.includes('PAGAMENTO')) return 'Boleto / TED';
    if (desc.includes('DEBITO') || desc.includes('COMPRA NO DEBITO')) return 'Cartão de Débito';
    if (desc.includes('TRANSFERENCIA') || desc.includes('TRANSF')) return 'Transferência';
    return tx.type === 'INCOME' ? 'Crédito em C/C' : 'Débito em C/C';
  };

  return (
    <div className="space-y-6">
      {/* Header com Boas-vindas, Indicador de Conta e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-card p-4 sm:p-5 shadow-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              Nubank Conta Corrente
            </span>
            <DataStatusBadge asOf={cashflowData?.meta?.as_of} isStale={cashflowData?.meta?.is_stale} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
            Dashboard Financeiro
          </h1>
          <p className="text-xs text-text-muted">
            Controle integrado da Conta Corrente Nubank e Orçamento Pessoal
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className={clsx(
              'inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl text-white transition-all shadow-subtle',
              syncMutation.isPending
                ? 'bg-primary/70 cursor-not-allowed'
                : 'bg-primary hover:bg-primary-hover active:scale-95'
            )}
            title="Buscar movimentações mais recentes na Pluggy Open Finance"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', syncMutation.isPending && 'animate-spin')} />
            <span>{syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar Nubank'}</span>
          </button>
        </div>
      </div>

      {/* Alerta de Sucesso na Sincronização */}
      {syncSuccessMsg && (
        <div className="flex items-center gap-2 p-3 bg-income-bg text-income border border-income/30 rounded-xl text-xs font-medium animate-fade-in">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{syncSuccessMsg}</span>
        </div>
      )}

      {/* Insights Determinísticos */}
      {cashflowData?.insight && (
        <InsightBanner
          severity="info"
          message={cashflowData.insight}
          actionLabel="Ver detalhes do fluxo"
          onAction={() => navigate('/fluxo')}
        />
      )}

      {/* 4 KPIs Principais da Conta Corrente & Orçamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Saldo Conta Nubank"
          value={overviewData?.liquid_balance !== undefined ? String(overviewData.liquid_balance) : '0.00'}
          icon={<Wallet className="w-4 h-4 text-primary" />}
          subtitle="Nu Pagamentos S.A. (Conta Corrente)"
          isLoading={isOverviewLoading}
        />
        <KpiCard
          title="Receitas no Mês"
          value={totals.income}
          icon={<TrendingUp className="w-4 h-4 text-income" />}
          delta={totals.income !== '0.00' ? { percent: 0, isGood: true, text: 'entradas' } : undefined}
          isLoading={isCashflowLoading && !overviewData}
        />
        <KpiCard
          title="Despesas no Mês"
          value={totals.expenses}
          icon={<TrendingDown className="w-4 h-4 text-expense" />}
          subtitle={`Orçado: ${formatMoney(totalBudgeted, hideValues)}`}
          delta={totals.expenses !== '0.00' ? { percent: 0, isGood: false, text: 'saídas' } : undefined}
          isLoading={isCashflowLoading && !overviewData}
        />
        <KpiCard
          title="Resultado / Sobra"
          value={totals.net}
          icon={<DollarSign className="w-4 h-4 text-primary" />}
          subtitle={parseFloat(totals.net) >= 0 ? 'Sobra prevista no mês' : 'Déficit no mês'}
          isLoading={isCashflowLoading && !overviewData}
        />
      </div>

      {/* Seção Principal: Tabela Orçado vs Realizado (A estrutura exata da planilha modelo) */}
      <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <h2 className="text-base font-bold text-text-primary tracking-tight">
                Planilha de Orçamento — Orçado vs Realizado
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Comparativo de metas e gastos reais debitados na conta corrente
            </p>
          </div>

          {/* Seletor de visualização (Todas / Essenciais / Não Essenciais) */}
          <div className="inline-flex items-center gap-1 bg-surface-2 border border-border p-0.5 rounded-lg text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveBudgetTab('ALL')}
              className={clsx(
                'px-2.5 py-1 rounded-md transition-colors',
                activeBudgetTab === 'ALL'
                  ? 'bg-card text-text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              Todas ({categoriesData.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveBudgetTab('ESSENTIAL')}
              className={clsx(
                'px-2.5 py-1 rounded-md transition-colors',
                activeBudgetTab === 'ESSENTIAL'
                  ? 'bg-card text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              Essenciais ({essentialCategories.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveBudgetTab('NON_ESSENTIAL')}
              className={clsx(
                'px-2.5 py-1 rounded-md transition-colors',
                activeBudgetTab === 'NON_ESSENTIAL'
                  ? 'bg-card text-warning shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              Não Essenciais ({nonEssentialCategories.length})
            </button>
          </div>
        </div>

        {/* Resumo Rápido dos Totais */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-surface-2/60 rounded-xl border border-border/60 text-xs">
          <div>
            <span className="text-text-muted block text-[11px]">Total Essenciais:</span>
            <div className="flex items-center gap-2 mt-0.5 font-bold">
              <span className="text-text-primary">{formatMoney(essentialSpent, hideValues)}</span>
              <span className="text-text-muted font-normal">/ {formatMoney(essentialBudgeted, hideValues)}</span>
            </div>
          </div>
          <div>
            <span className="text-text-muted block text-[11px]">Total Não Essenciais:</span>
            <div className="flex items-center gap-2 mt-0.5 font-bold">
              <span className="text-text-primary">{formatMoney(nonEssentialSpent, hideValues)}</span>
              <span className="text-text-muted font-normal">/ {formatMoney(nonEssentialBudgeted, hideValues)}</span>
            </div>
          </div>
          <div>
            <span className="text-text-muted block text-[11px]">Consumo Geral do Orçamento:</span>
            <div className="flex items-center gap-2 mt-0.5 font-bold">
              <span className={clsx(totalPercent > 100 ? 'text-danger' : 'text-text-primary')}>
                {totalPercent.toFixed(1)}%
              </span>
              <span className="text-text-muted font-normal">
                (Diferença: {formatMoney(totalDiff, hideValues)})
              </span>
            </div>
          </div>
        </div>

        {/* Tabela de Categorias com Colunas Exatas da Planilha Modelo */}
        {isCategoriesLoading ? (
          <div className="py-12 text-center text-xs text-text-muted animate-pulse">
            Carregando categorias e orçamentos...
          </div>
        ) : displayedCategories.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-muted">
            Nenhuma categoria encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border text-text-muted font-semibold bg-surface-2/30">
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Itens Incluídos</th>
                  <th className="py-2.5 px-3 text-right">Valor Orçado Total</th>
                  <th className="py-2.5 px-3 text-right">Gasto Real</th>
                  <th className="py-2.5 px-3 text-right">Diferença</th>
                  <th className="py-2.5 px-3 text-right">% Orçamento</th>
                  <th className="py-2.5 px-3 w-36">% Realizado</th>
                  <th className="py-2.5 px-3 text-center">Tipo de Despesa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {displayedCategories.map((c: any) => {
                  const budgetNum = parseFloat(c.budget_amount) || 0;
                  const spentNum = parseFloat(c.current_amount) || 0;
                  const diffNum = parseFloat(c.difference) || 0;
                  const pctOrcamento = totalBudgeted > 0 ? (budgetNum / totalBudgeted) * 100 : 0;
                  const pctRealizado = budgetNum > 0 ? (spentNum / budgetNum) * 100 : 0;
                  const isOver = pctRealizado > 100;
                  const isClose = pctRealizado >= 80 && !isOver;

                  return (
                    <tr key={c.id} className="hover:bg-surface-2/40 transition-colors tabular-nums">
                      <td className="py-2.5 px-3 font-semibold text-text-primary whitespace-nowrap">
                        <span>{c.name}</span>
                      </td>
                      <td className="py-2.5 px-3 text-text-muted max-w-[220px] truncate" title={c.included_items}>
                        {c.included_items || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-text-primary">
                        {formatMoney(budgetNum, hideValues)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-text-primary">
                        {formatMoney(spentNum, hideValues)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        <span
                          className={clsx(
                            'inline-block px-1.5 py-0.5 rounded text-[11px]',
                            diffNum < 0
                              ? 'bg-danger-bg text-danger font-bold'
                              : 'bg-income-bg text-income font-medium'
                          )}
                        >
                          {diffNum > 0 ? '+' : ''}
                          {formatMoney(diffNum, hideValues)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-text-muted font-medium">
                        {pctOrcamento > 0 ? `${pctOrcamento.toFixed(0)}%` : '0%'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={clsx('font-bold', isOver ? 'text-danger' : isClose ? 'text-warning' : 'text-text-muted')}>
                              {pctRealizado.toFixed(0)}%
                            </span>
                            {isOver && <AlertTriangle className="w-3 h-3 text-danger" />}
                          </div>
                          <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden border border-border/40">
                            <div
                              className={clsx(
                                'h-full rounded-full transition-all duration-300',
                                isOver ? 'bg-danger' : isClose ? 'bg-warning' : 'bg-primary'
                              )}
                              style={{ width: `${Math.min(pctRealizado, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {c.is_essential ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            Essencial
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-text-muted border border-border">
                            Não Essencial
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold text-text-primary tabular-nums bg-surface-2/40">
                  <td className="py-3 px-3">💰 TOTAL GERAL</td>
                  <td className="py-3 px-3 text-text-muted font-normal text-[11px]">Consolidado</td>
                  <td className="py-3 px-3 text-right">{formatMoney(totalBudgeted, hideValues)}</td>
                  <td className="py-3 px-3 text-right">{formatMoney(totalSpent, hideValues)}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={clsx(totalDiff < 0 ? 'text-danger font-bold' : 'text-income')}>
                      {totalDiff > 0 ? '+' : ''}
                      {formatMoney(totalDiff, hideValues)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-text-muted font-medium">100%</td>
                  <td className="py-3 px-3 text-right font-bold text-primary">
                    {totalPercent.toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-center text-text-muted text-[11px] font-normal">
                    Orçamento
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Gráfico de Fluxo de Caixa Mensal (G-01) */}
      <ChartCard
        title="Fluxo de Caixa da Conta Corrente (G-01)"
        subtitle="Evolução diária de depósitos, despesas e resultado consolidado"
        summaryValue={formatMoney(totals.net, hideValues)}
        isLoading={isCashflowLoading}
        action={
          <button
            type="button"
            onClick={() => navigate('/fluxo')}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>Ver fluxo completo</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        }
      >
        {points.length === 0 ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-xs text-text-muted">
            <span>Nenhuma movimentação registrada no período.</span>
            <span className="text-[11px] mt-1">Clique em "Sincronizar Nubank" para atualizar.</span>
          </div>
        ) : (
          <FlowChart points={points} height="280px" />
        )}
      </ChartCard>

      {/* Tabela de Compras / Movimentações da Conta Nubank (Estilo Tabela Inferior da Planilha) */}
      <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-base font-bold text-text-primary tracking-tight">
                Compras & Movimentações — Nubank Conta Corrente
              </h2>
              <p className="text-xs text-text-muted">
                Extrato detalhado e categorizado das transações bancárias reais
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/transacoes')}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Ver extrato completo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isTxLoading ? (
          <div className="py-12 text-center text-xs text-text-muted animate-pulse">
            Carregando movimentações do Nubank...
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-muted">
            Nenhuma movimentação encontrada na conta corrente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border text-text-muted font-semibold bg-surface-2/30">
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Descrição da Compra</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                  <th className="py-2.5 px-3 text-right">Forma de Pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {transactions.slice(0, 15).map((tx: any) => {
                  const isIncome = tx.type === 'INCOME';
                  const amtNum = Math.abs(parseFloat(tx.amount) || 0);
                  const cat = tx.category_id ? categoryMap.get(tx.category_id) : null;
                  const catName = cat ? cat.name : '❓ Outros';

                  return (
                    <tr key={tx.id} className="hover:bg-surface-2/40 transition-colors tabular-nums">
                      <td className="py-2.5 px-3 text-text-muted whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-text-primary max-w-[280px] truncate" title={tx.description}>
                        <div className="flex items-center gap-2">
                          <div
                            className={clsx(
                              'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]',
                              isIncome ? 'bg-income-bg text-income' : 'bg-expense-bg text-expense'
                            )}
                          >
                            {isIncome ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          </div>
                          <span className="truncate">{tx.description}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-2 text-text-secondary border border-border">
                          {catName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        <span className={clsx(isIncome ? 'text-income' : 'text-text-primary')}>
                          {isIncome ? '+' : '-'} {formatMoney(amtNum, hideValues)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-text-muted">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-surface-2/60">
                          {getPaymentMethod(tx)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-2 flex justify-between items-center text-[11px] text-text-muted border-t border-border">
          <span>Exibindo as 15 movimentações mais recentes da conta corrente</span>
          <button
            type="button"
            onClick={() => navigate('/transacoes')}
            className="text-primary font-semibold hover:underline"
          >
            Gerenciar e Recategorizar &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
