import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { formatCompactMoney, formatMoney } from '@/lib/format';
import { useTheme } from '@/app/providers/ThemeProvider';

export interface CategorySummaryItem {
  id: string;
  name: string;
  color_token?: string;
  current_amount: string | number;
  average_3m?: string | number | null;
  difference_percent?: number | null;
  status?: 'ABOVE_AVG' | 'BELOW_AVG' | 'IN_LINE' | 'INSUFFICIENT_HISTORY';
}

interface CategoryBarsProps {
  categories: CategorySummaryItem[];
  height?: string | number;
}

export function CategoryBars({ categories, height = '280px' }: CategoryBarsProps) {
  const { resolvedTheme, hideValues } = useTheme();

  const options = useMemo(() => {
    // Ordena por maior gasto atual
    const sorted = [...categories].sort((a, b) => {
      const valA = typeof a.current_amount === 'string' ? parseFloat(a.current_amount) : a.current_amount;
      const valB = typeof b.current_amount === 'string' ? parseFloat(b.current_amount) : b.current_amount;
      return valA - valB;
    });

    const categoryNames = sorted.map((c) => c.name);
    const currentData = sorted.map((c) =>
      typeof c.current_amount === 'string' ? parseFloat(c.current_amount) : c.current_amount
    );
    const avgData = sorted.map((c) => {
      if (c.average_3m === null || c.average_3m === undefined) return 0;
      return typeof c.average_3m === 'string' ? parseFloat(c.average_3m) : c.average_3m;
    });

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
          const cat = sorted[idx];
          let html = `<div style="font-size:12px; font-weight:600; margin-bottom:4px; color:${isDark ? '#f8fafc' : '#0f172a'}">${cat.name}</div>`;
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
          if (cat.difference_percent !== undefined && cat.difference_percent !== null) {
            const diffSign = cat.difference_percent > 0 ? '+' : '';
            const diffColor = cat.difference_percent > 15 ? '#ef4444' : '#16a34a';
            html += `<div style="margin-top:4px; font-size:10px; color:${diffColor}; font-weight:600;">
              Variação vs média: ${diffSign}${cat.difference_percent.toFixed(1)}%
            </div>`;
          }
          return html;
        },
      },
      legend: {
        top: 0,
        right: '4%',
        textStyle: { color: textColor, fontSize: 12, fontWeight: 500 },
        itemGap: 20,
        data: ['Período Atual', 'Média 3 Meses'],
      },
      grid: {
        top: 36,
        left: '4%',
        right: '6%',
        bottom: 25,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (val: number) => formatCompactMoney(val, hideValues),
        },
      },
      yAxis: {
        type: 'category',
        data: categoryNames,
        axisLine: { lineStyle: { color: splitLineColor } },
        axisLabel: {
          color: isDark ? '#e2e8f0' : '#1e293b',
          fontSize: 11,
          fontWeight: 500,
          formatter: (value: string) => {
            if (value.length > 22) {
              return value.slice(0, 20) + '...';
            }
            return value;
          },
        },
      },
      series: [
        {
          name: 'Período Atual',
          type: 'bar',
          data: currentData,
          itemStyle: {
            color: '#3b82f6',
            borderRadius: [0, 4, 4, 0],
          },
          barMaxWidth: 18,
          label: {
            show: true,
            position: 'right',
            color: isDark ? '#93c5fd' : '#2563eb',
            fontSize: 10,
            fontWeight: 600,
            formatter: (p: any) => p.value > 0 ? formatCompactMoney(p.value, hideValues) : '',
          },
        },
        {
          name: 'Média 3 Meses',
          type: 'bar',
          data: avgData,
          itemStyle: {
            color: '#f59e0b',
            borderRadius: [0, 4, 4, 0],
          },
          barMaxWidth: 18,
          label: {
            show: true,
            position: 'right',
            color: isDark ? '#fcd34d' : '#d97706',
            fontSize: 10,
            fontWeight: 600,
            formatter: (p: any) => p.value > 0 ? formatCompactMoney(p.value, hideValues) : '',
          },
        },
      ],
    };
  }, [categories, resolvedTheme, hideValues]);

  return <BaseChart options={options} height={height} ariaLabel="Comparativo por Categoria vs Média de 3 Meses (G-05)" />;
}
