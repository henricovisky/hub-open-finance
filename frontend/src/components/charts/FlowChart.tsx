import { useState, useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { formatCompactMoney, formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';
import clsx from 'clsx';
import { TrendingUp, BarChart2 } from 'lucide-react';

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
  defaultMode?: 'cumulative' | 'daily';
  showModeToggle?: boolean;
}

export function FlowChart({
  points,
  height = '260px',
  defaultMode = 'cumulative',
  showModeToggle = true,
}: FlowChartProps) {
  const { resolvedTheme, hideValues } = useTheme();
  const [mode, setMode] = useState<'cumulative' | 'daily'>(defaultMode);

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

    let runIncome = 0;
    let runExpense = 0;
    let runNet = 0;

    const cumIncomeData: number[] = [];
    const cumExpenseData: number[] = [];
    const cumNetData: number[] = [];
    const dailyIncomeData: number[] = [];
    const dailyExpenseData: number[] = [];
    const dailyNetData: number[] = [];

    points.forEach((p) => {
      const inc = typeof p.income === 'string' ? parseFloat(p.income) : Number(p.income) || 0;
      const exp = typeof p.expenses === 'string' ? parseFloat(p.expenses) : Number(p.expenses) || 0;

      runIncome += inc;
      runExpense += exp;
      runNet += (inc - exp);

      cumIncomeData.push(runIncome);
      cumExpenseData.push(runExpense);
      cumNetData.push(runNet);

      dailyIncomeData.push(inc);
      dailyExpenseData.push(exp);
      dailyNetData.push(inc - exp);
    });

    const isDark = resolvedTheme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const splitLineColor = isDark ? '#1f293d' : '#f1f5f9';

    if (mode === 'cumulative') {
      // 1. VISÃO ACUMULADA (Cresce com entradas, reduz com saídas)
      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross', lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } },
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

            const netVal = cumNetData[idx];
            const incVal = cumIncomeData[idx];
            const expVal = cumExpenseData[idx];
            const dInc = dailyIncomeData[idx];
            const dExp = dailyExpenseData[idx];

            let html = `<div style="font-size:12px; font-weight:700; margin-bottom:6px; color:${isDark ? '#f8fafc' : '#0f172a'}">📅 ${title}</div>`;

            // Destaque do Saldo Acumulado
            html += `<div style="display:flex; justify-content:space-between; gap:14px; font-size:12px; margin-bottom:4px; padding-bottom:4px; border-bottom:1px solid ${isDark ? '#334155' : '#e2e8f0'};">
              <span style="font-weight:600; color:${isDark ? '#38bdf8' : '#0284c7'}">📈 Saldo Acumulado:</span>
              <strong style="font-variant-numeric:tabular-nums; color:${netVal >= 0 ? '#10b981' : '#f43f5e'}">
                ${formatMoney(netVal, hideValues)}
              </strong>
            </div>`;

            // Entradas e Saídas Acumuladas
            html += `<div style="display:flex; justify-content:space-between; gap:12px; font-size:11px; margin-top:2px;">
              <span style="color:#10b981;">• Entradas Acumuladas:</span>
              <strong style="font-variant-numeric:tabular-nums">${formatMoney(incVal, hideValues)}</strong>
            </div>`;

            html += `<div style="display:flex; justify-content:space-between; gap:12px; font-size:11px; margin-top:2px;">
              <span style="color:#f43f5e;">• Saídas Acumuladas:</span>
              <strong style="font-variant-numeric:tabular-nums">${formatMoney(expVal, hideValues)}</strong>
            </div>`;

            // Movimentação específica do dia se houver
            if (dInc > 0 || dExp > 0) {
              html += `<div style="margin-top:6px; padding-top:4px; border-top:1px dashed ${isDark ? '#334155' : '#e2e8f0'}; font-size:10px; color:${textColor}">
                <span>Neste dia: </span>
                ${dInc > 0 ? `<span style="color:#10b981; font-weight:600;">+${formatMoney(dInc, hideValues)}</span> ` : ''}
                ${dExp > 0 ? `<span style="color:#f43f5e; font-weight:600;">-${formatMoney(dExp, hideValues)}</span>` : ''}
              </div>`;
            }

            return html;
          },
        },
        legend: {
          bottom: 0,
          textStyle: { color: textColor, fontSize: 11 },
          data: ['Saldo Acumulado', 'Entradas Acumuladas', 'Saídas Acumuladas'],
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
            name: 'Saldo Acumulado',
            type: 'line',
            smooth: 0.25,
            data: cumNetData,
            itemStyle: { color: isDark ? '#38bdf8' : '#0284c7' },
            lineStyle: { width: 3, color: isDark ? '#38bdf8' : '#0284c7' },
            symbol: 'circle',
            symbolSize: 5,
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: isDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(2, 132, 199, 0.20)' },
                  { offset: 1, color: isDark ? 'rgba(56, 189, 248, 0.0)' : 'rgba(2, 132, 199, 0.0)' },
                ],
              },
            },
          },
          {
            name: 'Entradas Acumuladas',
            type: 'line',
            smooth: 0.25,
            data: cumIncomeData,
            itemStyle: { color: '#10b981' },
            lineStyle: { width: 2, type: 'dashed', color: '#10b981' },
            symbol: 'none',
          },
          {
            name: 'Saídas Acumuladas',
            type: 'line',
            smooth: 0.25,
            data: cumExpenseData,
            itemStyle: { color: '#f43f5e' },
            lineStyle: { width: 2, type: 'dashed', color: '#f43f5e' },
            symbol: 'none',
          },
        ],
      };
    }

    // 2. VISÃO DIÁRIA CLÁSSICA (Barras de entradas/saídas por dia)
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
        data: ['Entradas', 'Saídas', 'Líquido do Dia'],
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
          data: dailyIncomeData,
          itemStyle: {
            color: '#10b981',
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 20,
        },
        {
          name: 'Saídas',
          type: 'bar',
          data: dailyExpenseData,
          itemStyle: {
            color: '#f43f5e',
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 20,
        },
        {
          name: 'Líquido do Dia',
          type: 'line',
          data: dailyNetData,
          itemStyle: { color: isDark ? '#38bdf8' : '#0284c7' },
          lineStyle: { width: 2 },
          symbol: 'circle',
          symbolSize: 6,
        },
      ],
    };
  }, [points, mode, resolvedTheme, hideValues]);

  return (
    <div className="space-y-2">
      {showModeToggle && (
        <div className="flex justify-end">
          <div className="inline-flex items-center p-0.5 bg-surface-2 border border-border rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setMode('cumulative')}
              className={clsx(
                'px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors text-[11px]',
                mode === 'cumulative'
                  ? 'bg-primary text-white font-bold shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              )}
              title="Curva de saldo acumulado (cresce com entradas e reduz com saídas)"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Acumulado (Padrão)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('daily')}
              className={clsx(
                'px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors text-[11px]',
                mode === 'daily'
                  ? 'bg-primary text-white font-bold shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              )}
              title="Visão diária de barras (entradas e saídas individuais)"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Barras Diárias</span>
            </button>
          </div>
        </div>
      )}

      <BaseChart options={options} height={height} ariaLabel="Gráfico de Fluxo de Caixa Acumulado (G-01)" />
    </div>
  );
}
