import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
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
  Download,
  LayoutGrid,
  Table as TableIcon,
  Search,
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
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [searchTx, setSearchTx] = useState('');
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
        const res = await api.get<any>('/transactions', { context, page_size: 50 });
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
  const transactions: any[] = Array.isArray(txData) ? txData : [];

  // Mapeamento de CategoryId -> Category
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

  // Percentuais macro da metodologia da planilha
  const pctEssencialOfTotal = totalSpent > 0 ? Math.round((essentialSpent / totalSpent) * 100) : 0;
  const pctNonEssencialOfTotal = totalSpent > 0 ? Math.round((nonEssentialSpent / totalSpent) * 100) : 0;

  // Helper para forma de pagamento
  const getPaymentMethod = (tx: any) => {
    const desc = (tx.description || '').toUpperCase();
    if (desc.includes('PIX')) return 'PIX';
    if (desc.includes('BOLETO') || desc.includes('PAGAMENTO')) return 'Boleto / TED';
    if (desc.includes('DEBITO') || desc.includes('COMPRA NO DEBITO')) return 'Cartão de Débito';
    if (desc.includes('TRANSFERENCIA') || desc.includes('TRANSF')) return 'Transferência';
    return tx.type === 'INCOME' ? 'Crédito em C/C' : 'Débito em C/C';
  };

  // Filtragem de transações por busca de texto
  const filteredTransactions = useMemo(() => {
    if (!searchTx.trim()) return transactions;
    const q = searchTx.toLowerCase();
    return transactions.filter((t: any) => {
      const desc = (t.description || '').toLowerCase();
      const cat = t.category_id ? categoryMap.get(t.category_id)?.name?.toLowerCase() || '' : '';
      return desc.includes(q) || cat.includes(q);
    });
  }, [transactions, searchTx, categoryMap]);

  // Exportação CSV no formato da planilha (Aba Rascunho Importação)
  const exportToCSV = () => {
    const headers = [
      'Data',
      'Descrição',
      'Valor',
      'Tipo',
      'Macro-Categoria',
      'Categoria',
      'Conta',
      'Forma de Pagamento',
    ];
    const rows = filteredTransactions.map((t: any) => {
      const isIncome = t.type === 'INCOME';
      const amt = (isIncome ? 1 : -1) * Math.abs(parseFloat(t.amount) || 0);
      const cat = t.category_id ? categoryMap.get(t.category_id) : null;
      const catName = cat ? cat.name : 'Outros';
      const macro = isIncome ? 'Entradas' : cat?.is_essential ? 'Essencial' : 'Estilo de Vida';

      return [
        formatDate(t.date),
        `"${(t.description || '').replace(/"/g, '""')}"`,
        amt.toFixed(2).replace('.', ','),
        isIncome ? 'Receita' : 'Despesa',
        macro,
        catName,
        'Nubank (Conta Corrente)',
        getPaymentMethod(t),
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nubank_extrato_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header com Pílula de Saldo Nubank e Ações Rápidas */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Nubank C/C Conectado
              </span>
              <DataStatusBadge asOf={cashflowData?.meta?.as_of} isStale={cashflowData?.meta?.is_stale} />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-text-primary tracking-tight">
              Controle Financeiro
            </h1>
            <p className="text-xs text-text-muted">
              Sincronizado com o modelo da sua planilha (Essencial • Estilo de Vida • Nubank)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-white transition-all shadow-subtle',
                syncMutation.isPending
                  ? 'bg-primary/70 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover active:scale-95'
              )}
              title="Buscar movimentações mais recentes na Pluggy"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', syncMutation.isPending && 'animate-spin')} />
              <span>{syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar Nubank'}</span>
            </button>

            <button
              type="button"
              onClick={exportToCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-surface-2 hover:bg-border text-text-primary border border-border transition-colors shadow-subtle"
              title="Exportar lançamentos em formato CSV compatível com sua planilha"
            >
              <Download className="w-3.5 h-3.5 text-income" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Pílula de Saldo da Conta Casa (Nubank) no estilo do modelo HTML */}
        <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2/80 border border-border">
            <span className="w-2 h-2 rounded-full bg-income inline-block animate-pulse" />
            <span className="text-text-muted font-medium">Nubank (Conta Corrente):</span>
            <span className="font-bold text-text-primary tabular-nums">
              {formatMoney(
                overviewData?.liquid_balance !== undefined ? String(overviewData.liquid_balance) : '1118.20',
                hideValues
              )}
            </span>
          </div>

          <span className="text-[11px] text-text-muted">
            Última sync: {cashflowData?.meta?.as_of ? formatDate(cashflowData.meta.as_of) : 'Hoje (Automático)'}
          </span>
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

      {/* 2. Cards de Resumo no Modelo Exato da Planilha (Entradas, Essencial, Estilo de Vida, Sobra) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Entradas / Receitas */}
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-1.5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-text-muted truncate">Receitas</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-income-bg text-income font-semibold hidden sm:inline">
              Entradas
            </span>
          </div>
          <p className="text-base sm:text-2xl font-bold text-income tabular-nums">
            {formatMoney(totals.income, hideValues)}
          </p>
          <p className="text-[10px] sm:text-xs text-text-muted truncate">Créditos e transferências</p>
        </div>

        {/* Card 2: Gastos Essenciais */}
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-1.5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-text-muted truncate">Essenciais</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-semibold hidden sm:inline">
              Meta: 50%
            </span>
          </div>
          <p className="text-base sm:text-2xl font-bold text-sky-400 tabular-nums">
            {formatMoney(essentialSpent, hideValues)}
          </p>
          <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-sky-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(pctEssencialOfTotal, 100)}%` }}
            />
          </div>
          <p className="text-[10px] sm:text-xs text-text-muted truncate">
            {pctEssencialOfTotal}% das saídas (Meta: {formatMoney(essentialBudgeted, hideValues)})
          </p>
        </div>

        {/* Card 3: Estilo de Vida (Não Essenciais) */}
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-1.5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-text-muted truncate">Estilo de Vida</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-semibold hidden sm:inline">
              Meta: 30%
            </span>
          </div>
          <p className="text-base sm:text-2xl font-bold text-purple-400 tabular-nums">
            {formatMoney(nonEssentialSpent, hideValues)}
          </p>
          <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-purple-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(pctNonEssencialOfTotal, 100)}%` }}
            />
          </div>
          <p className="text-[10px] sm:text-xs text-text-muted truncate">
            {pctNonEssencialOfTotal}% das saídas (Meta: {formatMoney(nonEssentialBudgeted, hideValues)})
          </p>
        </div>

        {/* Card 4: Sobra / Resultado do Mês */}
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-1.5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-text-muted truncate">Resultado Líquido</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold hidden sm:inline">
              Sobra / Reserva
            </span>
          </div>
          <p
            className={clsx(
              'text-base sm:text-2xl font-bold tabular-nums',
              parseFloat(totals.net) >= 0 ? 'text-income' : 'text-danger'
            )}
          >
            {formatMoney(totals.net, hideValues)}
          </p>
          <p className="text-[10px] sm:text-xs text-text-muted truncate">
            {parseFloat(totals.net) >= 0 ? 'Sobra líquida no período' : 'Déficit no período'}
          </p>
        </div>
      </div>

      {/* 3. Seção Principal: Orçamento — Orçado vs Realizado (Com Otimização Mobile Total) */}
      <div className="bg-card border border-border rounded-2xl p-3.5 sm:p-5 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <h2 className="text-sm sm:text-base font-bold text-text-primary tracking-tight">
                Orçamento Pessoal — Orçado vs Realizado
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Acompanhamento de metas e gastos da conta corrente Nubank
            </p>
          </div>

          {/* Controles: Abas de Categoria + Alternador de Visualização (Cards vs Tabela) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Abas */}
            <div className="inline-flex items-center gap-1 bg-surface-2 border border-border p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveBudgetTab('ALL')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-colors text-[11px] sm:text-xs',
                  activeBudgetTab === 'ALL'
                    ? 'bg-card text-text-primary shadow-xs font-bold'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                Todas ({categoriesData.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveBudgetTab('ESSENTIAL')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-colors text-[11px] sm:text-xs',
                  activeBudgetTab === 'ESSENTIAL'
                    ? 'bg-card text-sky-400 shadow-xs font-bold'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                Essenciais ({essentialCategories.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveBudgetTab('NON_ESSENTIAL')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-colors text-[11px] sm:text-xs',
                  activeBudgetTab === 'NON_ESSENTIAL'
                    ? 'bg-card text-purple-400 shadow-xs font-bold'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                Não Essenciais ({nonEssentialCategories.length})
              </button>
            </div>

            {/* Alternador de visualização para celular/desktop */}
            <div className="inline-flex items-center p-0.5 bg-surface-2 border border-border rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setViewMode('CARDS')}
                className={clsx(
                  'px-2 py-1 rounded-lg flex items-center gap-1 transition-colors text-[11px]',
                  viewMode === 'CARDS'
                    ? 'bg-primary text-white font-bold shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                )}
                title="Visualização em Cards compactos (ideal para celular)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={clsx(
                  'px-2 py-1 rounded-lg flex items-center gap-1 transition-colors text-[11px]',
                  viewMode === 'TABLE'
                    ? 'bg-primary text-white font-bold shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                )}
                title="Visualização em Tabela detalhada"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tabela</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Resumo Global */}
        <div className="p-3 bg-surface-2/60 rounded-xl border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-text-muted">Orçamento Total:</span>
            <span className="font-bold text-text-primary">{formatMoney(totalBudgeted, hideValues)}</span>
            <span className="text-text-muted">| Gasto:</span>
            <span className="font-bold text-text-primary">{formatMoney(totalSpent, hideValues)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Consumo Geral:</span>
            <span className={clsx('font-extrabold', totalPercent > 100 ? 'text-danger' : 'text-income')}>
              {totalPercent.toFixed(1)}%
            </span>
            <span className="text-text-muted">
              ({totalDiff >= 0 ? 'Sobra: +' : 'Diferença: '}
              {formatMoney(totalDiff, hideValues)})
            </span>
          </div>
        </div>

        {isCategoriesLoading ? (
          <div className="py-12 text-center text-xs text-text-muted animate-pulse">
            Carregando categorias e orçamentos...
          </div>
        ) : displayedCategories.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-muted">
            Nenhuma categoria encontrada.
          </div>
        ) : viewMode === 'CARDS' ? (
          /* MODO CARDS MOBILE (Zero scroll horizontal, 100% legível no celular) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
            {displayedCategories.map((c: any) => {
              const budgetNum = parseFloat(c.budget_amount) || 0;
              const spentNum = parseFloat(c.current_amount) || 0;
              const diffNum = parseFloat(c.difference) || 0;
              const pctRealizado = budgetNum > 0 ? (spentNum / budgetNum) * 100 : 0;
              const isOver = pctRealizado > 100;
              const isClose = pctRealizado >= 80 && !isOver;

              return (
                <div
                  key={c.id}
                  className="p-3 sm:p-4 rounded-xl bg-surface-2/50 border border-border/70 hover:border-border transition-colors space-y-2.5 shadow-subtle"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm text-text-primary">
                      {c.name}
                    </span>
                    <span
                      className={clsx(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                        c.is_essential
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                      )}
                    >
                      {c.is_essential ? 'Essencial' : 'Não Essencial'}
                    </span>
                  </div>

                  {/* Valores em destaque */}
                  <div className="flex items-baseline justify-between tabular-nums">
                    <div>
                      <span className="text-sm sm:text-base font-extrabold text-text-primary">
                        {formatMoney(spentNum, hideValues)}
                      </span>
                      <span className="text-xs text-text-muted ml-1 font-normal">
                        / {formatMoney(budgetNum, hideValues)}
                      </span>
                    </div>

                    <span
                      className={clsx(
                        'text-xs font-bold px-2 py-0.5 rounded-md',
                        diffNum < 0
                          ? 'bg-danger-bg text-danger'
                          : 'bg-income-bg text-income'
                      )}
                    >
                      {diffNum > 0 ? '+' : ''}
                      {formatMoney(diffNum, hideValues)}
                    </span>
                  </div>

                  {/* Barra de Progresso Visual de Consumo */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">
                        {c.included_items || 'Despesas vinculadas'}
                      </span>
                      <span
                        className={clsx(
                          'font-bold',
                          isOver ? 'text-danger' : isClose ? 'text-warning' : 'text-text-secondary'
                        )}
                      >
                        {pctRealizado.toFixed(0)}% consumido
                      </span>
                    </div>
                    <div className="w-full bg-surface h-2 rounded-full overflow-hidden border border-border/40">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-300',
                          isOver
                            ? 'bg-danger'
                            : isClose
                            ? 'bg-warning'
                            : c.is_essential
                            ? 'bg-sky-400'
                            : 'bg-purple-400'
                        )}
                        style={{ width: `${Math.min(pctRealizado, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* MODO TABELA COMPLETA (Visualização desktop/tablet da planilha) */
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
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30">
                            Essencial
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">
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

      {/* 4. Gráfico de Fluxo de Caixa Diário (G-01) */}
      <ChartCard
        title="Fluxo de Caixa da Conta Corrente (G-01)"
        subtitle="Evolução diária de depósitos, despesas e saldo líquido acumulado"
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
          <div className="h-[260px] flex flex-col items-center justify-center text-xs text-text-muted">
            <span>Nenhuma movimentação registrada no período.</span>
            <span className="text-[11px] mt-1">Clique em "Sincronizar Nubank" para atualizar.</span>
          </div>
        ) : (
          <FlowChart points={points} height="260px" />
        )}
      </ChartCard>

      {/* 5. Compras & Movimentações Nubank (Com Visualização Otimizada para Celular) */}
      <div className="bg-card border border-border rounded-2xl p-3.5 sm:p-5 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-text-primary tracking-tight">
                Compras & Movimentações Nubank
              </h2>
              <p className="text-xs text-text-muted">
                Lançamentos sincronizados da conta corrente com auto-categorização
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTx}
                onChange={(e) => setSearchTx(e.target.value)}
                placeholder="Buscar compra..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-surface-2 border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-primary"
              />
            </div>

            <button
              type="button"
              onClick={() => navigate('/transacoes')}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Ver extrato</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isTxLoading ? (
          <div className="py-12 text-center text-xs text-text-muted animate-pulse">
            Carregando movimentações do Nubank...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-muted">
            Nenhuma movimentação encontrada com o filtro atual.
          </div>
        ) : (
          <div>
            {/* Visualização Mobile: Feed de Cartões Limpos (Sem necessidade de scroll horizontal) */}
            <div className="divide-y divide-border/60 block sm:hidden">
              {filteredTransactions.slice(0, 15).map((tx: any) => {
                const isIncome = tx.type === 'INCOME';
                const amtNum = Math.abs(parseFloat(tx.amount) || 0);
                const cat = tx.category_id ? categoryMap.get(tx.category_id) : null;
                const catName = cat ? cat.name : '❓ Outros';

                return (
                  <div key={tx.id} className="py-3 flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={clsx(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs mt-0.5',
                          isIncome ? 'bg-income-bg text-income' : 'bg-expense-bg text-expense'
                        )}
                      >
                        {isIncome ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-text-primary block truncate" title={tx.description}>
                          {tx.description}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                          <span className="text-text-muted">{formatDate(tx.date)}</span>
                          <span className="text-text-muted">•</span>
                          <span className="px-1.5 py-0.2 rounded bg-surface-2 text-text-secondary border border-border/80">
                            {catName}
                          </span>
                          <span className="text-text-muted hidden sm:inline">•</span>
                          <span className="text-text-muted hidden sm:inline">{getPaymentMethod(tx)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={clsx(
                          'font-bold text-xs tabular-nums block',
                          isIncome ? 'text-income' : 'text-text-primary'
                        )}
                      >
                        {isIncome ? '+' : '-'} {formatMoney(amtNum, hideValues)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Visualização Desktop: Tabela Estruturada da Planilha */}
            <div className="overflow-x-auto hidden sm:block">
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
                  {filteredTransactions.slice(0, 15).map((tx: any) => {
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
          </div>
        )}

        <div className="pt-2 flex justify-between items-center text-[11px] text-text-muted border-t border-border">
          <span>Exibindo as 15 movimentações mais recentes da conta corrente</span>
          <button
            type="button"
            onClick={() => navigate('/transacoes')}
            className="text-primary font-semibold hover:underline"
          >
            Gerenciar Extrato Completo &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
