import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ChartCard } from '@/components/ui/ChartCard';
import { CategoryBars } from '@/components/charts/CategoryBars';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';
import { PieChart, ArrowUpRight, ArrowDownRight, Tag } from 'lucide-react';

export function CategoriesPage() {
  const [searchParams] = useSearchParams();
  const { hideValues } = useTheme();
  const context = searchParams.get('context') || 'HOUSEHOLD';

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories-full', context],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/categories/summary', { context });
        return res.data || res || [];
      } catch {
        return [];
      }
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Categorias de Gastos</h1>
        <p className="text-xs text-text-muted mt-0.5">Distribuição das despesas e comparação com o padrão dos últimos 3 meses</p>
      </div>

      {/* Gráfico G-05 de Barras com Média */}
      <ChartCard
        title="Gastos vs Média Histórica de 3 Meses (G-05)"
        subtitle="Identifique categorias com consumo acima da média habitual"
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
          <div className="h-[300px] flex flex-col items-center justify-center text-xs text-text-muted">
            <span>Nenhum gasto por categoria para exibir neste período.</span>
            <span className="text-[11px] mt-1">Conecte sua conta para começar a categorizar os lançamentos.</span>
          </div>
        ) : (
          <CategoryBars categories={categories} height="300px" />
        )}
      </ChartCard>

      {/* Lista de Categorias com Detalhamento */}
      <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card">
        <h3 className="text-sm font-bold text-text-primary mb-3">Detalhamento por Categoria</h3>
        {categories.length === 0 ? (
          <div className="py-6 text-center text-xs text-text-muted">
            Nenhuma categoria com despesas registradas.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {categories.map((cat: any) => {
              const isAbove = (cat.difference_percent || 0) > 15;
              const isBelow = (cat.difference_percent || 0) < -15;

              return (
                <div key={cat.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-text-secondary">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-text-primary block">{cat.name}</span>
                      <span className="text-[11px] text-text-muted">
                        Média: {formatMoney(cat.average_3m, hideValues)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold tabular-nums text-text-primary block">
                      {formatMoney(cat.current_amount, hideValues)}
                    </span>
                    <div className="flex items-center justify-end gap-1 text-[11px] font-semibold mt-0.5">
                      {isAbove ? (
                        <span className="text-expense flex items-center">
                          <ArrowUpRight className="w-3 h-3" />
                          +{cat.difference_percent?.toFixed(1)}%
                        </span>
                      ) : isBelow ? (
                        <span className="text-income flex items-center">
                          <ArrowDownRight className="w-3 h-3" />
                          {cat.difference_percent?.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-text-muted">Dentro da média</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
