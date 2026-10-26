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
        bottom: 0,
        textStyle: { color: textColor, fontSize: 11 },
        data: ['Período Atual', 'Média 3 Meses'],
      },
      grid: {
        top: 15,
        left: '4%',
        right: '4%',
        bottom: 35,
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
        axisLabel: { color: textColor, fontSize: 11 },
      },
      series: [
        {
          name: 'Período Atual',
          type: 'bar',
          data: currentData,
          itemStyle: {
            color: '#2563eb',
            borderRadius: [0, 4, 4, 0],
          },
          barMaxWidth: 16,
        },
        {
          name: 'Média 3 Meses',
          type: 'bar',
          data: avgData,
          itemStyle: {
            color: isDark ? '#4b5563' : '#94a3b8',
            borderRadius: [0, 4, 4, 0],
          },
          barMaxWidth: 16,
        },
      ],
    };
  }, [categories, resolvedTheme, hideValues]);

  return <BaseChart options={options} height={height} ariaLabel="Comparativo por Categoria vs Média de 3 Meses (G-05)" />;
}
