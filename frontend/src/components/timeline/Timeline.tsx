import React from 'react';
import { formatMoney } from '@/lib/format';
import { formatDate } from '@/lib/dates';
import { useTheme } from '@/app/providers/ThemeProvider';
import { EstimateTag } from '@/components/ui/EstimateTag';
import { ArrowDownLeft, ArrowUpRight, FileText, CheckCircle2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

export interface TimelineItem {
  id: string;
  kind: 'TRANSACTION' | 'BILL_CLOSING' | 'BILL_PAYMENT' | 'SYNC_EVENT';
  date: string;
  title: string;
  amount?: string | number;
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  categoryName?: string;
  categoryColorToken?: string;
  accountName?: string;
  certainty?: 'CONFIRMED' | 'ESTIMATED';
  onClick?: () => void;
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  const { hideValues } = useTheme();

  // Agrupa itens por dia (Data)
  const grouped = React.useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    items.forEach((item) => {
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    });
    return Array.from(map.entries());
  }, [items]);

  return (
    <ol className={clsx('relative border-l-2 border-border ml-3 sm:ml-4 space-y-6', className)}>
      {grouped.map(([dateStr, dayItems]) => (
        <li key={dateStr} className="relative pl-5 sm:pl-6">
          {/* Marcador de Data */}
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-surface border-2 border-primary flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          </div>

          <div className="text-xs font-bold text-text-primary mb-2 flex items-center gap-2">
            <span>{formatDate(dateStr, 'medium')}</span>
            <span className="text-[11px] text-text-muted font-normal">
              ({dayItems.length} {dayItems.length === 1 ? 'evento' : 'eventos'})
            </span>
          </div>

          {/* Lista de Eventos do Dia */}
          <div className="space-y-2">
            {dayItems.map((item) => {
              const isExpense = item.type === 'EXPENSE';
              const isIncome = item.type === 'INCOME';

              return (
                <div
                  key={item.id}
                  onClick={item.onClick}
                  className={clsx(
                    'p-3 bg-card border border-border rounded-xl transition-all flex items-center justify-between gap-3 shadow-subtle',
                    item.onClick && 'cursor-pointer hover:border-primary hover:shadow-card'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
                        item.kind === 'BILL_CLOSING' && 'bg-warning-bg text-warning',
                        item.kind === 'BILL_PAYMENT' && 'bg-confirmed/10 text-confirmed',
                        item.kind === 'SYNC_EVENT' && 'bg-surface-2 text-text-muted',
                        item.kind === 'TRANSACTION' && isExpense && 'bg-expense-bg text-expense',
                        item.kind === 'TRANSACTION' && isIncome && 'bg-income-bg text-income'
                      )}
                    >
                      {item.kind === 'BILL_CLOSING' && <FileText className="w-4 h-4" />}
                      {item.kind === 'BILL_PAYMENT' && <CheckCircle2 className="w-4 h-4" />}
                      {item.kind === 'SYNC_EVENT' && <RefreshCw className="w-4 h-4" />}
                      {item.kind === 'TRANSACTION' && isExpense && <ArrowDownLeft className="w-4 h-4" />}
                      {item.kind === 'TRANSACTION' && isIncome && <ArrowUpRight className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-text-primary truncate flex items-center gap-1.5">
                        <span className="truncate">{item.title}</span>
                        {item.certainty === 'ESTIMATED' && <EstimateTag />}
                      </div>
                      <div className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                        {item.categoryName && <span>{item.categoryName}</span>}
                        {item.accountName && <span>• {item.accountName}</span>}
                      </div>
                    </div>
                  </div>

                  {item.amount !== undefined && (
                    <div
                      className={clsx(
                        'text-xs sm:text-sm font-bold tabular-nums whitespace-nowrap text-right',
                        isExpense && 'text-text-primary',
                        isIncome && 'text-income'
                      )}
                    >
                      {isIncome ? '+' : ''}
                      {formatMoney(item.amount, hideValues)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}
