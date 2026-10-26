import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ChartCard } from '@/components/ui/ChartCard';
import { KpiCard } from '@/components/ui/KpiCard';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';
import { CreditCard, Calendar, AlertCircle, ShoppingBag, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

export function CardsPage() {
  const [searchParams] = useSearchParams();
  const { hideValues } = useTheme();
  const context = searchParams.get('context') || 'HOUSEHOLD';

  const [selectedCardId, setSelectedCardId] = useState<string>('');

  // Busca lista de cartões
  const { data: accountsData = [], isLoading } = useQuery({
    queryKey: ['credit-accounts', context],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/accounts', { context });
        const allAccs = res.data || res || [];
        return allAccs.filter((acc: any) => acc.type === 'CREDIT');
      } catch {
        return [];
      }
    },
  });

  const cards = accountsData;
  const activeCardId = selectedCardId || (cards.length > 0 ? cards[0].id : '');
  const currentCard = cards.find((c: any) => c.id === activeCardId) || null;

  // Busca transações do cartão selecionado
  const { data: cardTransactions = [] } = useQuery({
    queryKey: ['card-transactions', currentCard?.id],
    enabled: !!currentCard?.id,
    queryFn: async () => {
      try {
        const res = await api.get<any>('/transactions', {
          account_id: currentCard.id,
          page_size: 50,
        });
        return res?.results || res?.data || res?.items || (Array.isArray(res) ? res : []);
      } catch {
        return [];
      }
    },
  });

  const limitUsedNum = parseFloat(currentCard?.current_balance || '0');
  const limitTotalNum = parseFloat(currentCard?.credit_limit || '0');
  const limitPercent = limitTotalNum > 0 ? (limitUsedNum / limitTotalNum) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Cartões de Crédito</h1>
        <p className="text-xs text-text-muted mt-0.5">Acompanhamento de faturas, limites e parcelas futuras</p>
      </div>

      {cards.length === 0 ? (
        <div className="bg-card border border-border rounded-card p-12 text-center shadow-card space-y-3">
          <CreditCard className="w-10 h-10 text-text-muted mx-auto" />
          <h3 className="text-sm font-bold text-text-primary">Nenhum cartão de crédito conectado</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            Conecte suas contas bancárias na aba Conexões & Admin para visualizar faturas, limites e compras parceladas.
          </p>
        </div>
      ) : (
        <>
          {/* Seletor Visual de Cartões */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card: any) => {
              const isSelected = card.id === currentCard?.id;
              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className={clsx(
                    'cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all relative overflow-hidden select-none',
                    isSelected
                      ? 'bg-gradient-to-br from-primary/90 to-primary text-white border-primary shadow-elevated'
                      : 'bg-card border-border hover:border-primary/50 text-text-primary shadow-card'
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold">{card.name}</span>
                    <CreditCard className="w-5 h-5 opacity-80" />
                  </div>
                  <div className="text-lg sm:text-xl font-bold tabular-nums tracking-wider mb-3">
                    •••• •••• •••• {card.last_four_digits || '0000'}
                  </div>
                  <div className="flex items-center justify-between text-xs opacity-90 pt-2 border-t border-white/20">
                    <span>Fatura Atual:</span>
                    <span className="font-bold tabular-nums">
                      {formatMoney(card.current_balance, hideValues)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detalhes do Cartão Selecionado */}
          {currentCard && (
            <div className="space-y-5">
              {/* KPIs do Cartão */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <KpiCard
                  title="Fatura Atual Aberta"
                  value={currentCard.current_balance || '0.00'}
                  icon={<CreditCard className="w-4 h-4 text-primary" />}
                  subtitle={`Fecha em dia ${currentCard.closing_day || '—'}`}
                />
                <KpiCard
                  title="Limite Disponível"
                  value={currentCard.available_limit || (limitTotalNum - limitUsedNum)}
                  icon={<ShieldCheck className="w-4 h-4 text-income" />}
                  subtitle={`Limite total: ${formatMoney(currentCard.credit_limit || '0.00', hideValues)}`}
                />
                <KpiCard
                  title="Vencimento da Fatura"
                  value={currentCard.due_day ? `Dia ${currentCard.due_day}` : '—'}
                  icon={<Calendar className="w-4 h-4 text-warning" />}
                  subtitle="Melhor dia de compra após fechamento"
                />
              </div>

              {/* Gráfico G-08: Utilização do Limite */}
              <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-text-primary">Utilização do Limite (G-08)</span>
                  <span className="font-bold tabular-nums text-text-primary">
                    {limitPercent.toFixed(1)}% utilizado
                  </span>
                </div>

                {/* Barra de Progresso do Limite */}
                <div className="w-full h-3 bg-surface-2 rounded-full overflow-hidden border border-border">
                  <div
                    className={clsx(
                      'h-full transition-all duration-300 rounded-full',
                      limitPercent > 80 ? 'bg-danger' : limitPercent > 50 ? 'bg-warning' : 'bg-primary'
                    )}
                    style={{ width: `${Math.min(limitPercent, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-text-muted">
                  <span>Fatura + Parcelas: {formatMoney(limitUsedNum, hideValues)}</span>
                  <span>Disponível: {formatMoney(currentCard.available_limit || (limitTotalNum - limitUsedNum), hideValues)}</span>
                </div>
              </div>

              {/* Compras Recentes do Cartão e Parcelas (G-10) */}
              <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-text-primary">Compras na Fatura Atual</h3>
                  </div>
                  <span className="text-xs text-text-muted">Ordenadas por data</span>
                </div>

                {cardTransactions.length === 0 ? (
                  <div className="py-6 text-center text-xs text-text-muted">
                    Nenhuma compra registrada nesta fatura.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60 mt-2">
                    {cardTransactions.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between py-2.5 text-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-text-primary truncate">{item.description}</span>
                            {item.installment_number && (
                              <span className="px-1.5 py-0.2 bg-primary-light text-primary text-[10px] font-bold rounded">
                                {item.installment_number}/{item.installment_total}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-text-muted">
                            {item.date?.split('T')[0] || ''} • {item.provider_category || 'Geral'}
                          </span>
                        </div>
                        <span className="font-bold tabular-nums text-text-primary whitespace-nowrap">
                          {formatMoney(item.amount, hideValues)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
