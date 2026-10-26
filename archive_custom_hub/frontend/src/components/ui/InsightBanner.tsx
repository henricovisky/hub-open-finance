import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import clsx from 'clsx';

export type InsightSeverity = 'info' | 'warning' | 'danger' | 'success';

interface InsightBannerProps {
  severity?: InsightSeverity;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function InsightBanner({
  severity = 'info',
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
  className,
}: InsightBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const icons = {
    info: <Info className="w-4 h-4 text-primary shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-warning shrink-0" />,
    danger: <AlertCircle className="w-4 h-4 text-danger shrink-0" />,
    success: <CheckCircle className="w-4 h-4 text-income shrink-0" />,
  };

  const bgColors = {
    info: 'bg-primary-light border-primary/20 text-primary',
    warning: 'bg-warning-bg border-warning/30 text-warning',
    danger: 'bg-danger-bg border-danger/30 text-danger',
    success: 'bg-income-bg border-income/30 text-income',
  };

  return (
    <div
      role="alert"
      className={clsx(
        'flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border text-xs font-medium transition-all shadow-subtle',
        bgColors[severity],
        className
      )}
    >
      <div className="mt-0.5">{icons[severity]}</div>

      <div className="flex-1">
        {title && <span className="font-bold block text-text-primary mb-0.5">{title}</span>}
        <span className="text-text-primary/90 leading-relaxed">{message}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-1.5 block text-xs font-bold underline hover:opacity-80 transition-opacity"
          >
            {actionLabel}
          </button>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 -mr-1 -mt-1 text-text-muted hover:text-text-primary rounded"
          aria-label="Dispensar aviso"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
