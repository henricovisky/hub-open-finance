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

  const [selectedCardId, setSelectedCardId] = useState<string>('card-1');

  // Busca lista de cartões
  const { data: accountsData } = useQuery({
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

  const cards = accountsData && accountsData.length > 0
    ? accountsData
    : [
        {
          id: 'card-1',
          name: 'Nubank Ultravioleta',
          last_four_digits: '4921',
          current_balance: '2450.00',
          credit_limit: '15000.00',
          available_limit: '12550.00',
          closing_day: 24,
          due_day: 28,
        },
        {
          id: 'card-2',
          name: 'Itaú Click Visa',
          last_four_digits: '8104',
          current_balance: '890.00',
          credit_limit: '8000.00',
          available_limit: '7110.00',
          closing_day: 15,
          due_day: 22,
        },
      ];

  const currentCard = cards.find((c: any) => c.id === selectedCardId) || cards[0];

  const limitUsedNum = parseFloat(currentCard.current_balance || '0');
  const limitTotalNum = parseFloat(currentCard.credit_limit || '0');
  const limitPercent = limitTotalNum > 0 ? (limitUsedNum / limitTotalNum) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Cartões de Crédito</h1>
        <p className="text-xs text-text-muted mt-0.5">Acompanhamento de faturas, limites e parcelas futuras</p>
      </div>

      {/* Seletor Visual de Cartões */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card: any) => {
          const isSelected = card.id === currentCard.id;
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
              value={currentCard.current_balance}
              icon={<CreditCard className="w-4 h-4 text-primary" />}
              subtitle={`Fecha em dia ${currentCard.closing_day || '—'}`}
            />
            <KpiCard
              title="Limite Disponível"
              value={currentCard.available_limit || (limitTotalNum - limitUsedNum)}
              icon={<ShieldCheck className="w-4 h-4 text-income" />}
              subtitle={`Limite total: ${formatMoney(currentCard.credit_limit, hideValues)}`}
            />
            <KpiCard
              title="Vencimento da Fatura"
              value={`Dia ${currentCard.due_day || '—'}`}
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

            <div className="divide-y divide-border/60 mt-2">
              {[
                { desc: 'Apple Store - MacBook', date: '20/10', amount: '450.00', installment: '3/10', cat: 'Eletrônicos' },
                { desc: 'Posto Ipiranga Combustível', date: '18/10', amount: '220.00', installment: null, cat: 'Transporte' },
                { desc: 'Supermercado St. Marche', date: '15/10', amount: '380.50', installment: null, cat: 'Alimentação' },
                { desc: 'Zara Brasil - Roupas', date: '10/10', amount: '299.90', installment: '2/3', cat: 'Vestuário' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary truncate">{item.desc}</span>
                      {item.installment && (
                        <span className="px-1.5 py-0.2 bg-primary-light text-primary text-[10px] font-bold rounded">
                          {item.installment}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-text-muted">
                      {item.date} • {item.cat}
                    </span>
                  </div>
                  <span className="font-bold tabular-nums text-text-primary whitespace-nowrap">
                    {formatMoney(item.amount, hideValues)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
