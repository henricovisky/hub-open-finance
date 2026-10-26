import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, FileText, CalendarCheck } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';
import clsx from 'clsx';

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  amount: string | number;
  type: 'BILL_DUE' | 'BILL_CLOSING' | 'RECURRING' | 'INSTALLMENT' | 'INCOME_EXPECTED';
}

interface CalendarMonthProps {
  events: CalendarEvent[];
  initialMonth?: string; // YYYY-MM
  className?: string;
}

export function CalendarMonth({ events, initialMonth, className }: CalendarMonthProps) {
  const { hideValues } = useTheme();
  const [currentDate, setCurrentDate] = useState(() => {
    if (initialMonth) {
      const [y, m] = initialMonth.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthLabel = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Dias da semana
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Gera a matriz de dias do mês
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days: Array<{ dayNumber: number; dateStr: string; isCurrentMonth: boolean }> = [];

    // Preenche dias vazios antes do dia 1
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNumber: 0, dateStr: '', isCurrentMonth: false });
    }

    // Dias do mês corrente
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: true });
    }

    return days;
  }, [year, month]);

  // Mapa de eventos por data
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((ev) => {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    });
    return map;
  }, [events]);

  const selectedEvents = selectedDay ? eventsByDate.get(selectedDay) || [] : [];

  return (
    <div className={clsx('bg-card border border-border rounded-card p-4 sm:p-5 shadow-card', className)}>
      {/* Header do Calendário */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <h3 className="text-sm sm:text-base font-bold text-text-primary capitalize">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grade Semanal */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-text-muted my-2">
        {weekDays.map((wd) => (
          <div key={wd} className="py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Grade de Dias */}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {calendarDays.map((cell, idx) => {
          if (!cell.isCurrentMonth) {
            return <div key={`empty-${idx}`} className="h-12 sm:h-14 bg-surface-2/20 rounded-lg" />;
          }

          const dayEvents = eventsByDate.get(cell.dateStr) || [];
          const hasDue = dayEvents.some((e) => e.type === 'BILL_DUE');
          const hasClosing = dayEvents.some((e) => e.type === 'BILL_CLOSING');
          const hasRecurring = dayEvents.some((e) => e.type === 'RECURRING');
          const isSelected = selectedDay === cell.dateStr;

          return (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => setSelectedDay(cell.dateStr)}
              className={clsx(
                'h-12 sm:h-14 p-1 rounded-lg border transition-all flex flex-col justify-between items-start text-left',
                isSelected
                  ? 'border-primary bg-primary-light font-bold text-primary shadow-subtle'
                  : 'border-border/60 bg-surface hover:border-border hover:bg-surface-2 text-text-secondary'
              )}
            >
              <span className="text-[11px] font-semibold tabular-nums leading-none">{cell.dayNumber}</span>

              {/* Indicadores de Eventos */}
              <div className="flex items-center gap-1 mt-auto">
                {hasDue && <span className="w-2 h-2 rounded-full bg-expense shrink-0" title="Vencimento" />}
                {hasClosing && <span className="w-2 h-2 rounded-full bg-warning shrink-0" title="Fechamento de Fatura" />}
                {hasRecurring && <span className="w-2 h-2 rounded-full bg-primary shrink-0" title="Recorrência" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detalhe do Dia Selecionado */}
      {selectedDay && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-xs font-bold text-text-primary mb-2 flex items-center justify-between">
            <span>Compromissos de {selectedDay}:</span>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-[11px] text-text-muted hover:text-text-primary"
            >
              Fechar
            </button>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="text-xs text-text-muted">Nenhum vencimento ou compromisso neste dia.</p>
          ) : (
            <div className="space-y-1.5">
              {selectedEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-2 rounded-lg bg-surface-2 border border-border flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    {ev.type === 'BILL_DUE' && <AlertCircle className="w-3.5 h-3.5 text-expense" />}
                    {ev.type === 'BILL_CLOSING' && <FileText className="w-3.5 h-3.5 text-warning" />}
                    {ev.type === 'RECURRING' && <CalendarCheck className="w-3.5 h-3.5 text-primary" />}
                    <span className="font-semibold text-text-primary">{ev.title}</span>
                  </div>
                  <span className="font-bold tabular-nums text-text-primary">
                    {formatMoney(ev.amount, hideValues)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
