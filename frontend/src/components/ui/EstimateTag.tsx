import clsx from 'clsx';
import { HelpCircle } from 'lucide-react';

interface EstimateTagProps {
  basis?: string;
  className?: string;
}

export function EstimateTag({ basis, className }: EstimateTagProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-text-muted border border-dashed border-estimate pattern-estimate select-none',
        className
      )}
      title={basis ? `Estimativa baseada em: ${basis}` : 'Valor estimado / projetado'}
    >
      <HelpCircle className="w-2.5 h-2.5" />
      <span>ESTIMADO</span>
    </span>
  );
}
