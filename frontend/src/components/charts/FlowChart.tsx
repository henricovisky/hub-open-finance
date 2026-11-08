import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { formatCompactMoney, formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';

export interface CashflowPoint {
  date: string;
  income: string | number;
  expenses: string | number;
  net: string | number;
  cumulative_net?: string | number;
  certainty?: 'CONFIRMED' | 'ESTIMATED';
}

interface FlowChartProps {
  points: CashflowPoint[];
  height?: string | number;
}

export function FlowChart({ points, height = '260px' }: FlowChartProps) {
  const { resolvedTheme, hideValues } = useTheme();

  const options = useMemo(() => {
    const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const FULL_MONTHS = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const dates = points.map((p) => {
      const parts = p.date.split('-');
      if (parts.length === 2) {
        const m = parseInt(parts[1], 10);
        return `${MONTHS[m - 1] || parts[1]}/${parts[0].slice(2)}`;
      }
      if (parts.length >= 3) {
        return `${parts[2]}/${parts[1]}`;
      }
      return p.date;
    });

    const incomeData = points.map((p) => (typeof p.income === 'string' ? parseFloat(p.income) : p.income));
    const expenseData = points.map((p) => (typeof p.expenses === 'string' ? parseFloat(p.expenses) : p.expenses));
    const netData = points.map((p) => (typeof p.net === 'string' ? parseFloat(p.net) : p.net));

    const isDark = resolvedTheme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const splitLineColor = isDark ? '#1f293d' : '#f1f5f9';

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const pt = points[idx];
          
          let title = pt.date;
          const parts = pt.date.split('-');
          if (parts.length === 2) {
            const m = parseInt(parts[1], 10);
            title = `${FULL_MONTHS[m - 1] || parts[1]} de ${parts[0]}`;
          } else if (parts.length >= 3) {
            title = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }

          let html = `<div style="font-size:12px; font-weight:600; margin-bottom:4px; color:${isDark ? '#f8fafc' : '#0f172a'}">${title}</div>`;
          params.forEach((item: any) => {
            const valStr = formatMoney(item.value, hideValues);
            html += `<div style="display:flex; justify-content:space-between; gap:12px; font-size:11px; margin-top:2px;">
              <span style="display:inline-flex; align-items:center; gap:4px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:2px; background:${item.color};"></span>
                ${item.seriesName}:
              </span>
              <strong style="font-variant-numeric:tabular-nums">${valStr}</strong>
            </div>`;
          });
          return html;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: textColor, fontSize: 11 },
        data: ['Entradas', 'Saídas', 'Líquido'],
      },
      grid: {
        top: 20,
        left: '3%',
        right: '3%',
        bottom: 35,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: textColor, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (val: number) => formatCompactMoney(val, hideValues),
        },
      },
      series: [
        {
          name: 'Entradas',
          type: 'bar',
          data: incomeData,
          itemStyle: {
            color: '#16a34a',
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 20,
        },
        {
          name: 'Saídas',
          type: 'bar',
          data: expenseData,
          itemStyle: {
            color: '#dc2626',
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 20,
        },
        {
          name: 'Líquido',
          type: 'line',
          data: netData,
          itemStyle: { color: '#2563eb' },
          lineStyle: { width: 2 },
          symbol: 'circle',
          symbolSize: 6,
        },
      ],
    };
  }, [points, resolvedTheme, hideValues]);

  return <BaseChart options={options} height={height} ariaLabel="Gráfico de Fluxo de Caixa (G-01)" />;
}
