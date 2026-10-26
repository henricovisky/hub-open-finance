import React, { useState } from 'react';
import { BarChart3, Table, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { Skeleton } from './Skeleton';
import clsx from 'clsx';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  summaryValue?: string;
  insight?: string;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  isPartial?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  children: React.ReactNode;
  tableAlternative?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  summaryValue,
  insight,
  isLoading,
  isError,
  isEmpty,
  isPartial,
  errorMessage = 'Falha ao carregar visualização.',
  onRetry,
  children,
  tableAlternative,
  action,
  className,
}: ChartCardProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  return (
    <section
      aria-label={title}
      className={clsx(
        'bg-card border border-border rounded-card p-4 sm:p-5 shadow-card flex flex-col',
        className
      )}
    >
      {/* Header do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-text-primary tracking-tight">{title}</h3>
            {isPartial && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning-bg text-warning border border-warning/30">
                Parcial
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
        </div>

        {/* Controles do Header (Resumo, Ações e Toggle Gráfico/Tabela) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {summaryValue && (
            <span className="text-sm font-bold text-text-primary tabular-nums mr-1">{summaryValue}</span>
          )}

          {action}

          {/* Toggle Gráfico / Tabela (Obrigatório CAT §0) */}
          {tableAlternative && !isLoading && !isError && !isEmpty && (
            <div
              role="group"
              aria-label="Alternar modo de visualização"
              className="inline-flex items-center p-0.5 bg-surface-2 border border-border rounded-lg text-xs"
            >
              <button
                type="button"
                onClick={() => setViewMode('chart')}
                className={clsx(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'chart'
                    ? 'bg-surface text-primary shadow-subtle'
                    : 'text-text-muted hover:text-text-primary'
                )}
                aria-pressed={viewMode === 'chart'}
                title="Ver como gráfico"
                aria-label="Ver como gráfico"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={clsx(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'table'
                    ? 'bg-surface text-primary shadow-subtle'
                    : 'text-text-muted hover:text-text-primary'
                )}
                aria-pressed={viewMode === 'table'}
                title="Ver como tabela"
                aria-label="Ver como tabela"
              >
                <Table className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Insight Banner (se presente) */}
      {insight && !isLoading && !isError && (
        <div className="my-2.5 px-3 py-2 bg-primary-light border border-primary/20 rounded-lg flex items-center gap-2 text-xs text-primary font-medium">
          <Sparkles className="w-4 h-4 shrink-0 text-primary" />
          <span className="flex-1">{insight}</span>
        </div>
      )}

      {/* Corpo da Visualização */}
      <div className="flex-1 min-h-[220px] sm:min-h-[260px] flex flex-col justify-center mt-3">
        {isLoading ? (
          <div className="w-full h-full flex flex-col gap-3 py-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-44 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-8 h-8 text-danger mb-2" />
            <p className="text-xs text-text-secondary mb-3">{errorMessage}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-border text-xs font-semibold text-text-primary rounded-lg transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Tentar novamente
              </button>
            )}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
            <BarChart3 className="w-8 h-8 opacity-40 mb-2" />
            <p className="text-xs">Nenhum dado encontrado para este período.</p>
          </div>
        ) : viewMode === 'chart' ? (
          <div className="w-full h-full flex-1">{children}</div>
        ) : (
          <div className="w-full h-full flex-1 overflow-x-auto">{tableAlternative}</div>
        )}
      </div>
    </section>
  );
}
