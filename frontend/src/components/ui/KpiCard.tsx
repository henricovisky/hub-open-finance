import React from 'react';
import { useTheme } from '@/app/providers/ThemeProvider';
import { formatMoney } from '@/lib/format';
import { Skeleton } from './Skeleton';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import clsx from 'clsx';

interface KpiCardProps {
  title: string;
  value: string | number | null | undefined;
  icon?: React.ReactNode;
  delta?: {
    percent: number;
    text?: string;
    isGood?: boolean; // Se positivo é bom (ex: receitas ou saldo) ou ruim (ex: despesas)
  };
  subtitle?: string;
  isLoading?: boolean;
  className?: string;
}

export function KpiCard({ title, value, icon, delta, subtitle, isLoading, className }: KpiCardProps) {
  const { hideValues } = useTheme();

  if (isLoading) {
    return (
      <div className={clsx('bg-card border border-border rounded-card p-4 shadow-card flex flex-col justify-between h-32', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-36 my-2" />
        <Skeleton className="h-3 w-28" />
      </div>
    );
  }

  const formattedValue = formatMoney(value, hideValues);

  return (
    <div
      className={clsx(
        'bg-card border border-border rounded-card p-4 sm:p-5 shadow-card transition-all duration-150 hover:border-border-strong flex flex-col justify-between',
        className
      )}
    >
      {/* Header com Título e Ícone */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-medium text-text-secondary">{title}</span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-text-secondary shrink-0">
            {icon}
          </div>
        )}
      </div>

      {/* Valor Principal (Tabular Nums) */}
      <div className="my-2 sm:my-3">
        <div className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary tabular-nums">
          {formattedValue}
        </div>
      </div>

      {/* Footer com Delta ou Subtítulo */}
      <div className="flex items-center gap-2 text-xs">
        {delta ? (
          <div
            className={clsx(
              'inline-flex items-center gap-0.5 font-semibold text-[11px] px-1.5 py-0.5 rounded',
              delta.isGood
                ? 'bg-income-bg text-income'
                : 'bg-expense-bg text-expense'
            )}
          >
            {delta.percent > 0 ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : delta.percent < 0 ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            <span className="tabular-nums">
              {delta.percent > 0 ? '+' : ''}
              {delta.percent.toFixed(1)}%
            </span>
            {delta.text && <span className="ml-1 text-text-muted font-normal">{delta.text}</span>}
          </div>
        ) : subtitle ? (
          <span className="text-text-muted text-[11px] truncate">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}
