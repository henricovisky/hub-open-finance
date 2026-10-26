import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { FilterBar } from '@/components/ui/FilterBar';
import { DetailPanel } from '@/components/ui/DetailPanel';
import { Timeline, TimelineItem } from '@/components/timeline/Timeline';
import { formatMoney } from '@/lib/format';
import { formatDate } from '@/lib/dates';
import { useTheme } from '@/app/providers/ThemeProvider';
import { usePermissions } from '@/lib/permissions';
import {
  Search,
  List,
  GitCommit,
  Check,
  Tag,
  EyeOff,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  CheckSquare,
  Square,
} from 'lucide-react';
import clsx from 'clsx';

export function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { hideValues } = useTheme();
  const { isAdmin } = usePermissions();

  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [batchCategory, setBatchCategory] = useState('');

  const context = searchParams.get('context') || 'HOUSEHOLD';

  // Busca lista de transações
  const { data: txData, isLoading } = useQuery({
    queryKey: ['transactions', context, filterType, searchQuery],
    queryFn: async () => {
      try {
        const params: any = { context, page_size: 100 };
        if (filterType === 'EXPENSE') params.transaction_type = 'EXPENSE';
        if (filterType === 'INCOME') params.transaction_type = 'INCOME';
        if (filterType === 'UNCATEGORIZED') params.uncategorized_only = true;
        if (searchQuery) params.search = searchQuery;

        const res = await api.get<any>('/transactions', params);
        return res?.results || res?.data || res?.items || (Array.isArray(res) ? res : []);
      } catch {
        return [];
      }
    },
  });

  // Busca lista de categorias para o picker
  const { data: categories = [] } = useQuery({
    queryKey: ['categories-list', context],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/categories', { context });
        return res.data || res;
      } catch {
        return [];
      }
    },
  });

  // Mutation para atualizar uma transação
  const updateTxMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return api.patch(`/transactions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setSelectedTx(null);
    },
  });

  // Mutation para categorização em lote
  const batchUpdateMutation = useMutation({
    mutationFn: async ({ ids, categoryId }: { ids: string[]; categoryId: string }) => {
      return api.patch('/transactions/bulk', {
        transaction_ids: ids,
        category_id: categoryId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setBatchSelectedIds([]);
      setBatchCategory('');
    },
  });

  const transactions = Array.isArray(txData) ? txData : [];

  // Converte transações para o formato da Timeline T-01
  const timelineItems: TimelineItem[] = transactions.map((tx: any) => ({
    id: tx.id,
    kind: 'TRANSACTION',
    date: tx.date.split('T')[0],
    title: tx.description,
    amount: tx.amount,
    type: tx.type,
    categoryName: tx.category?.name || tx.provider_category,
    accountName: tx.account?.name,
    onClick: () => setSelectedTx(tx),
  }));

  const handleSelectAll = () => {
    if (batchSelectedIds.length === transactions.length) {
      setBatchSelectedIds([]);
    } else {
      setBatchSelectedIds(transactions.map((t: any) => t.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setBatchSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Movimentações</h1>
          <p className="text-xs text-text-muted mt-0.5">Extrato completo de lançamentos e categorização</p>
        </div>

        {/* Toggle Lista vs Timeline T-01 */}
        <div className="inline-flex items-center p-0.5 bg-surface-2 border border-border rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors',
              viewMode === 'list'
                ? 'bg-surface text-primary shadow-subtle'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <List className="w-3.5 h-3.5" />
            <span>Lista</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors',
              viewMode === 'timeline'
                ? 'bg-surface text-primary shadow-subtle'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <FilterBar
          options={[
            { id: 'ALL', label: 'Todas' },
            { id: 'EXPENSE', label: 'Despesas' },
            { id: 'INCOME', label: 'Receitas' },
            { id: 'UNCATEGORIZED', label: 'Sem Categoria' },
          ]}
          selectedId={filterType}
          onSelect={setFilterType}
        />

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por nome..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface-2 border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-primary"
          />
        </div>
      </div>

      {/* Barra de Ações em Lote (Desktop) */}
      {batchSelectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary-light border border-primary/30 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <CheckSquare className="w-4 h-4" />
            <span>{batchSelectedIds.length} selecionadas</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={batchCategory}
              onChange={(e) => setBatchCategory(e.target.value)}
              className="bg-surface border border-border text-xs rounded-lg px-2.5 py-1 text-text-primary"
            >
              <option value="">Atribuir categoria...</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!batchCategory || batchUpdateMutation.isPending}
              onClick={() =>
                batchUpdateMutation.mutate({
                  ids: batchSelectedIds,
                  categoryId: batchCategory,
                })
              }
              className="px-3 py-1 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover disabled:opacity-50"
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={() => setBatchSelectedIds([])}
              className="px-2 py-1 text-text-muted hover:text-text-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Visualização Lista / Tabela */}
      {viewMode === 'list' ? (
        <div className="bg-card border border-border rounded-card shadow-card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-text-muted">Carregando transações...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">Nenhuma transação encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-2 border-b border-border text-text-muted">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-text-muted hover:text-text-primary"
                      >
                        {batchSelectedIds.length === transactions.length ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 font-semibold">Data</th>
                    <th className="py-2.5 px-3 font-semibold">Descrição</th>
                    <th className="py-2.5 px-3 font-semibold">Categoria</th>
                    <th className="py-2.5 px-3 font-semibold">Conta</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {transactions.map((tx: any) => {
                    const isSelected = batchSelectedIds.includes(tx.id);
                    const isExpense = tx.type === 'EXPENSE';

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className={clsx(
                          'cursor-pointer transition-colors hover:bg-surface-2',
                          isSelected && 'bg-primary-light/50'
                        )}
                      >
                        <td
                          className="py-2.5 px-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectOne(tx.id);
                          }}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-text-muted" />
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap tabular-nums text-text-secondary">
                          {formatDate(tx.date, 'short')}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-text-primary max-w-xs truncate">
                          {tx.description}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 text-[11px] text-text-secondary border border-border">
                            <Tag className="w-3 h-3 text-text-muted" />
                            <span>{tx.category?.name || 'Não categorizada'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-text-muted whitespace-nowrap">
                          {tx.account?.name || 'Conta'}
                        </td>
                        <td
                          className={clsx(
                            'py-2.5 px-3 text-right font-bold tabular-nums whitespace-nowrap',
                            isExpense ? 'text-text-primary' : 'text-income'
                          )}
                        >
                          {!isExpense && '+'}
                          {formatMoney(tx.amount, hideValues)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Visualização Timeline T-01 */
        <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card">
          <Timeline items={timelineItems} />
        </div>
      )}

      {/* Painel Mestre-Detalhe de Transação */}
      <DetailPanel
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title="Detalhes da Transação"
        subtitle={selectedTx?.description}
        actions={
          <button
            type="button"
            onClick={() => setSelectedTx(null)}
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover"
          >
            Concluído
          </button>
        }
      >
        {selectedTx && (
          <div className="space-y-4 text-xs">
            {/* Valor */}
            <div className="p-4 bg-surface-2 rounded-xl text-center">
              <span className="text-text-muted text-[11px] block mb-1">Valor da Operação</span>
              <span
                className={clsx(
                  'text-2xl font-bold tabular-nums',
                  selectedTx.type === 'EXPENSE' ? 'text-text-primary' : 'text-income'
                )}
              >
                {selectedTx.type !== 'EXPENSE' && '+'}
                {formatMoney(selectedTx.amount, hideValues)}
              </span>
            </div>

            {/* Informações Básicas */}
            <div className="space-y-2 py-2 border-y border-border">
              <div className="flex justify-between py-1">
                <span className="text-text-muted">Data:</span>
                <span className="font-semibold text-text-primary">{formatDate(selectedTx.date, 'full')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">Conta de Origem:</span>
                <span className="font-semibold text-text-primary">{selectedTx.account?.name || 'Conta'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">Tipo:</span>
                <span className="font-semibold text-text-primary">{selectedTx.type}</span>
              </div>
            </div>

            {/* Edição de Categoria */}
            <div>
              <label className="block text-text-secondary font-semibold mb-1.5">
                Categoria Financeira
              </label>
              <select
                value={selectedTx.category_id || ''}
                onChange={(e) => {
                  const newCatId = e.target.value;
                  updateTxMutation.mutate({
                    id: selectedTx.id,
                    data: { category_id: newCatId || null },
                  });
                }}
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text-primary"
              >
                <option value="">Sem categoria</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Ignorar em Relatórios */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  updateTxMutation.mutate({
                    id: selectedTx.id,
                    data: { is_ignored_in_analytics: !selectedTx.is_ignored_in_analytics },
                  });
                }}
                className="flex items-center gap-2 text-text-muted hover:text-text-primary text-xs"
              >
                <EyeOff className="w-4 h-4" />
                <span>
                  {selectedTx.is_ignored_in_analytics
                    ? 'Transação ignorada em relatórios (clique para reativar)'
                    : 'Ignorar esta transação em relatórios e gráficos'}
                </span>
              </button>
            </div>
          </div>
        )}
      </DetailPanel>
    </div>
  );
}
