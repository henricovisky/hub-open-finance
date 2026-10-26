import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarMonth, CalendarEvent } from '@/components/timeline/CalendarMonth';
import { Timeline, TimelineItem } from '@/components/timeline/Timeline';
import { ChartCard } from '@/components/ui/ChartCard';
import { FlowChart } from '@/components/charts/FlowChart';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';
import { CalendarDays, GitCommit, HelpCircle, Check, X, ShieldAlert } from 'lucide-react';

export function AgendaPage() {
  const [searchParams] = useSearchParams();
  const { hideValues } = useTheme();
  const [includeEstimates, setIncludeEstimates] = useState(true);

  const demoEvents: CalendarEvent[] = [
    { id: '1', date: '2026-10-24', title: 'Fechamento Nubank', amount: '2450.00', type: 'BILL_CLOSING' },
    { id: '2', date: '2026-10-28', title: 'Vencimento Nubank', amount: '2450.00', type: 'BILL_DUE' },
    { id: '3', date: '2026-10-30', title: 'Aluguel Apartamento', amount: '2800.00', type: 'RECURRING' },
    { id: '4', date: '2026-11-05', title: 'Salário Empresa XYZ', amount: '8200.00', type: 'INCOME_EXPECTED' },
  ];

  const demoCommitments: TimelineItem[] = [
    { id: 'c1', kind: 'BILL_CLOSING', date: '2026-10-24', title: 'Fechamento Nubank', amount: '2450.00' },
    { id: 'c2', kind: 'TRANSACTION', date: '2026-10-28', title: 'Pagamento Fatura Nubank', amount: '2450.00', type: 'EXPENSE' },
    { id: 'c3', kind: 'TRANSACTION', date: '2026-10-30', title: 'Aluguel & Condomínio', amount: '2800.00', type: 'EXPENSE', certainty: 'CONFIRMED' },
    { id: 'c4', kind: 'TRANSACTION', date: '2026-11-05', title: 'Recebimento de Salário', amount: '8200.00', type: 'INCOME', certainty: 'ESTIMATED' },
  ];

  const filteredCommitments = includeEstimates
    ? demoCommitments
    : demoCommitments.filter((c) => c.certainty !== 'ESTIMATED');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Agenda & Projeção</h1>
          <p className="text-xs text-text-muted mt-0.5">Calendário de vencimentos e previsão de saldo futuro</p>
        </div>

        {/* Toggle Incluir Estimativas */}
        <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary cursor-pointer select-none bg-surface-2 border border-border px-3 py-1.5 rounded-xl self-start sm:self-auto">
          <input
            type="checkbox"
            checked={includeEstimates}
            onChange={(e) => setIncludeEstimates(e.target.checked)}
            className="rounded text-primary focus:ring-0"
          />
          <span>Incluir estimativas e recorrências</span>
        </label>
      </div>

      {/* Grid: Calendário T-03 + Timeline de Compromissos T-02 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <CalendarMonth events={demoEvents} initialMonth="2026-10" />
        </div>

        <div className="lg:col-span-5 bg-card border border-border rounded-card p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <h3 className="text-sm font-bold text-text-primary">Próximos 30 Dias (T-02)</h3>
            <span className="text-xs text-text-muted">{filteredCommitments.length} eventos</span>
          </div>
          <Timeline items={filteredCommitments} />
        </div>
      </div>

      {/* Painel Explicativo "Como Calculamos" */}
      <div className="bg-surface-2 border border-border rounded-2xl p-4 sm:p-5 text-xs text-text-secondary space-y-2">
        <div className="flex items-center gap-2 font-bold text-text-primary">
          <HelpCircle className="w-4 h-4 text-primary" />
          <span>Como calculamos as projeções e vencimentos?</span>
        </div>
        <p className="leading-relaxed text-[11px]">
          As projeções de saldo combinam faturas de cartão de crédito abertas e fechadas obtidas via Open Finance, recorrências identificadas pelo padrão dos lançamentos e receitas regulares. Compromissos estimados aparecem sinalizados com a etiqueta <strong>ESTIMADO</strong> e textura hachurada para clara diferenciação visual.
        </p>
      </div>
    </div>
  );
}
