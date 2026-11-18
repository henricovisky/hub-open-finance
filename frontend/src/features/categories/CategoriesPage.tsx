import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ChartCard } from '@/components/ui/ChartCard';
import { CategoryBars } from '@/components/charts/CategoryBars';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';
import { ArrowUpRight, ArrowDownRight, Tag, Plus, Sparkles, X } from 'lucide-react';
import clsx from 'clsx';

export function CategoriesPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { hideValues } = useTheme();
  const context = searchParams.get('context') || 'HOUSEHOLD';
  const period = searchParams.get('period') || undefined;
  const [chartViewCount, setChartViewCount] = useState<number | 'all'>(10);

  // Estado para criação rápida de categoria
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [isEssential, setIsEssential] = useState(true);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories-full', context, period],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/categories/summary', { context, period });
        return Array.isArray(res) ? res : (res?.data || []);
      } catch {
        return [];
      }
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      return api.post('/categories', {
        name: name.trim(),
        budget_limit: budgetLimit ? parseFloat(budgetLimit) : 0,
        is_essential: isEssential,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-full'] });
      queryClient.invalidateQueries({ queryKey: ['categories-summary'] });
      queryClient.invalidateQueries({ queryKey: ['categories-list'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setIsCreateOpen(false);
      setName('');
      setBudgetLimit('');
    },
  });

  const seedCategoriesMutation = useMutation({
    mutationFn: async () => {
      return api.post('/categories/seed-defaults');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-full'] });
      queryClient.invalidateQueries({ queryKey: ['categories-summary'] });
      queryClient.invalidateQueries({ queryKey: ['categories-list'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  // Categorias exibidas no gráfico com base no filtro
  const chartCategories = useMemo(() => {
    if (chartViewCount === 'all') return categories;
    return categories.slice(0, chartViewCount);
  }, [categories, chartViewCount]);

  // Altura dinâmica e generosa para garantir que todas as barras fiquem perfeitamente visíveis
  const chartHeight = useMemo(() => {
    const count = chartCategories.length;
    if (count <= 6) return '340px';
    if (count <= 10) return '440px';
    if (count <= 15) return '600px';
    return `${Math.max(500, count * 36)}px`;
  }, [chartCategories.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Categorias de Gastos</h1>
          <p className="text-xs text-text-muted mt-0.5">Distribuição das despesas e comparação com o padrão dos últimos 3 meses</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Seletor de visualização do gráfico */}
          {categories.length > 8 && (
            <div className="inline-flex items-center p-0.5 bg-surface-2 border border-border rounded-lg text-xs font-semibold">
              {[
                { id: 8, label: 'Top 8' },
                { id: 10, label: 'Top 10' },
                { id: 15, label: 'Top 15' },
                { id: 'all', label: `Todas (${categories.length})` },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setChartViewCount(opt.id as any)}
                  className={clsx(
                    'px-3 py-1.5 rounded-md transition-colors',
                    chartViewCount === opt.id
                      ? 'bg-surface text-primary shadow-subtle font-bold'
                      : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover shadow-subtle transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Categoria</span>
          </button>
        </div>
      </div>

      {/* Gráfico G-05 de Barras com Média Ampliado e Nítido */}
      <ChartCard
        title="Gastos vs Média Histórica de 3 Meses (G-05)"
        subtitle="Identifique desvios de consumo em relação ao histórico habitual dos últimos 90 dias"
        isLoading={isLoading}
        tableAlternative={
          categories.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              Nenhuma categoria com lançamentos no período.
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="py-2.5">Categoria</th>
                  <th className="py-2.5 text-right">Gasto Atual</th>
                  <th className="py-2.5 text-right">Média 3M</th>
                  <th className="py-2.5 text-right">Desvio</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c: any) => (
                  <tr key={c.id} className="border-b border-border/50 tabular-nums">
                    <td className="py-2.5 font-medium">{c.name}</td>
                    <td className="py-2.5 text-right font-semibold">{formatMoney(c.current_amount, hideValues)}</td>
                    <td className="py-2.5 text-right text-text-muted">{formatMoney(c.average_3m, hideValues)}</td>
                    <td className="py-2.5 text-right font-bold">
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
        {categories.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-xs text-text-muted space-y-1">
            <span className="font-semibold text-text-primary">Nenhum gasto por categoria para exibir neste período.</span>
            <span className="text-[11px]">Verifique os filtros de contexto acima ou conecte uma conta na aba Admin.</span>
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <CategoryBars categories={chartCategories} height={chartHeight} />
          </div>
        )}
      </ChartCard>

      {/* Lista de Categorias com Detalhamento: Gasto lado a lado com a Média */}
      <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Detalhamento por Categoria</h3>
            <p className="text-[11px] text-text-muted">Comparativo direto do valor gasto lado a lado com a média histórica</p>
          </div>
          <span className="text-xs text-text-muted font-medium">
            {categories.length} categoria{categories.length === 1 ? '' : 's'}
          </span>
        </div>

        {categories.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-muted">
            Nenhuma categoria com despesas registradas no período selecionado.
          </div>
        ) : (
          <div className="space-y-2.5">
            {categories.map((cat: any) => {
              const isAbove = (cat.difference_percent || 0) > 15;
              const isBelow = (cat.difference_percent || 0) < -15;

              return (
                <div
                  key={cat.id}
                  className="p-3 sm:p-3.5 rounded-xl border border-border/80 bg-surface hover:bg-surface-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle"
                >
                  {/* Nome da categoria e ícone */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-surface-2 border border-border/60 flex items-center justify-center text-primary shrink-0">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary text-xs sm:text-sm truncate">{cat.name}</span>
                        {cat.status === 'ABOVE_AVG' && (
                          <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-danger/10 text-danger border border-danger/20">
                            Acima do habitual
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-muted truncate block">Classificação Pluggy</span>
                    </div>
                  </div>

                  {/* Valor Gasto PRÓXIMO À MÉDIA lado a lado */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                    {/* Gasto Atual */}
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">Gasto Atual</span>
                      <span className="text-xs sm:text-sm font-extrabold text-text-primary tabular-nums">
                        {formatMoney(cat.current_amount, hideValues)}
                      </span>
                    </div>

                    {/* Média 3M colada ao gasto */}
                    <div className="text-left sm:text-right pl-3 sm:pl-5 border-l border-border/70">
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">Média (3M)</span>
                      <span className="text-xs sm:text-sm font-semibold text-text-secondary tabular-nums">
                        {formatMoney(cat.average_3m || '0.00', hideValues)}
                      </span>
                    </div>

                    {/* Desvio % */}
                    <div className="text-right min-w-[75px] pl-3 sm:pl-5 border-l border-border/70">
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">Desvio</span>
                      <div className="flex items-center justify-end gap-1 text-xs font-bold mt-0.5">
                        {isAbove ? (
                          <span className="text-expense flex items-center gap-0.5">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            +{cat.difference_percent?.toFixed(1)}%
                          </span>
                        ) : isBelow ? (
                          <span className="text-income flex items-center gap-0.5">
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            {cat.difference_percent?.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-text-muted text-[11px] font-medium">Na média</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Modal de Criação de Categoria */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-surface border border-border rounded-2xl p-5 shadow-elevated space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-primary" />
                <span>Nova Categoria</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary font-semibold mb-1">Nome da Categoria</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Supermercado, Pet, etc."
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:outline-hidden focus:border-primary"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-text-secondary font-semibold mb-1">Meta de Orçamento Mensal (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text-primary focus:outline-hidden focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-semibold mb-1">Classificação</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEssential(true)}
                    className={clsx(
                      'p-2 rounded-xl border text-center font-semibold transition-all',
                      isEssential
                        ? 'bg-primary-light border-primary text-primary'
                        : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
                    )}
                  >
                    Essencial
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEssential(false)}
                    className={clsx(
                      'p-2 rounded-xl border text-center font-semibold transition-all',
                      !isEssential
                        ? 'bg-warning-bg border-warning text-warning'
                        : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
                    )}
                  >
                    Estilo de Vida
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-border text-text-secondary hover:text-text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!name.trim() || createCategoryMutation.isPending}
                  onClick={() => createCategoryMutation.mutate()}
                  className="px-4 py-1.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-subtle"
                >
                  {createCategoryMutation.isPending ? 'Salvando...' : 'Salvar Categoria'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
