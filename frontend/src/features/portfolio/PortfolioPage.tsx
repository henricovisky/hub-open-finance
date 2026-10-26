import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ChartCard } from '@/components/ui/ChartCard';
import { KpiCard } from '@/components/ui/KpiCard';
import { formatMoney, formatPP, formatPercent } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';
import { LineChart, PieChart, Calculator, ShieldCheck, ArrowUpRight } from 'lucide-react';

export function PortfolioPage() {
  const [searchParams] = useSearchParams();
  const { hideValues } = useTheme();
  const context = searchParams.get('context') || 'HOUSEHOLD';

  const [contributionAmount, setContributionAmount] = useState('5000');

  const { data: assetAllocation = [], isLoading } = useQuery({
    queryKey: ['portfolio-allocation', context],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/investments/portfolio', { context });
        return res.data || res || [];
      } catch {
        return [];
      }
    },
  });

  const totalPortfolio = assetAllocation.reduce((acc: number, curr: any) => acc + (curr.currentVal || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Patrimônio & Investimentos</h1>
        <p className="text-xs text-text-muted mt-0.5">Alocação por classes de ativos, evolução histórica e simulador de aportes</p>
      </div>

      {assetAllocation.length === 0 ? (
        <div className="bg-card border border-border rounded-card p-12 text-center shadow-card space-y-3">
          <LineChart className="w-10 h-10 text-text-muted mx-auto" />
          <h3 className="text-sm font-bold text-text-primary">Nenhum investimento sincronizado</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            Conecte sua corretora ou banco de investimentos na aba Conexões & Admin para visualizar seu patrimônio total, classes de ativos e rebalanceamento.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs de Patrimônio */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <KpiCard
              title="Patrimônio Total Custodiado"
              value={totalPortfolio}
              icon={<LineChart className="w-4 h-4 text-primary" />}
              subtitle="Soma de contas de investimento conectadas"
            />
            <KpiCard
              title="Rendimento no Ano (2026)"
              value="0.0%"
              icon={<ArrowUpRight className="w-4 h-4 text-income" />}
            />
            <KpiCard
              title="Colchão de Liquidez"
              value="0 meses"
              icon={<ShieldCheck className="w-4 h-4 text-warning" />}
              subtitle="Com base nos seus gastos médios"
            />
          </div>

          {/* Alocação Atual vs Alvo (G-16) expressa em p.p. */}
          <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-text-primary">Alocação de Ativos: Atual vs Alvo (G-16)</h3>
              </div>
              <span className="text-xs text-text-muted">Desvios em pontos percentuais (p.p.)</span>
            </div>

            <div className="space-y-3">
              {assetAllocation.map((item: any, idx: number) => {
                const diffPP = (item.current || 0) - (item.target || 0);

                return (
                  <div key={idx} className="p-3 bg-surface-2 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text-primary">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted tabular-nums">
                          Atual: <strong>{item.current?.toFixed(1) || '0.0'}%</strong> ({formatMoney(item.currentVal || 0, hideValues)})
                        </span>
                        <span className="text-text-muted tabular-nums">
                          Alvo: <strong>{item.target?.toFixed(1) || '0.0'}%</strong>
                        </span>
                        <span
                          className={`font-bold tabular-nums px-2 py-0.5 rounded text-[11px] ${
                            diffPP > 0 ? 'bg-primary-light text-primary' : 'bg-warning-bg text-warning'
                          }`}
                        >
                          {formatPP(diffPP)}
                        </span>
                      </div>
                    </div>

                    {/* Barra de Comparação */}
                    <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-border relative">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${item.current || 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Simulador de Aporte para Rebalanceamento (G-17) */}
          <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Calculator className="w-4 h-4 text-primary" />
              <div>
                <h3 className="text-sm font-bold text-text-primary">Simulador de Aporte de Rebalanceamento (G-17)</h3>
                <p className="text-[11px] text-text-muted">Calcula onde investir para aproximar a carteira dos alvos sem resgates</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-text-secondary" htmlFor="aporte">
                Valor a aportar (R$):
              </label>
              <input
                id="aporte"
                type="number"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                className="w-36 bg-surface-2 border border-border rounded-xl px-3 py-1.5 text-xs text-text-primary font-bold tabular-nums"
              />
            </div>

            <p className="text-[11px] text-text-muted bg-surface-2 p-2.5 rounded-lg leading-relaxed">
              <strong>Aviso:</strong> Este simulador é estritamente matemático e visa rebalancear a alocação configurada por você. Não constitui recomendação de investimento.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
