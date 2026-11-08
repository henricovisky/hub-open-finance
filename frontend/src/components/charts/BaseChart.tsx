import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTheme } from '@/app/providers/ThemeProvider';

// Registra módulos mínimos do ECharts (modularidade para respeitar orçamento de bundle)
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
  BarChart,
  LineChart,
  PieChart,
  CanvasRenderer,
]);

export interface BaseChartProps {
  options: echarts.EChartsCoreOption;
  height?: string | number;
  className?: string;
  ariaLabel?: string;
}

export function BaseChart({ options, height = '260px', className, ariaLabel }: BaseChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!chartRef.current) return;

    // Inicializa ECharts
    const chart = echarts.init(chartRef.current, resolvedTheme === 'dark' ? 'dark' : undefined, {
      renderer: 'canvas',
    });
    chartInstance.current = chart;

    // Listener de Resize com ResizeObserver nativo
    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartInstance.current = null;
    };
  }, [resolvedTheme]);

  useEffect(() => {
    if (chartInstance.current && options) {
      chartInstance.current.setOption(options, true);
    }
  }, [options]);

  return (
    <div
      ref={chartRef}
      role="img"
      aria-label={ariaLabel || 'Gráfico financeiro'}
      style={{ width: '100%', height }}
      className={className}
    />
  );
}
