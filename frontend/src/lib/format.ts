export function formatMoney(
  value: number | string | null | undefined,
  hideValues: boolean = false
): string {
  if (hideValues) return '••••••';
  if (value === null || value === undefined || value === '') return 'R$ 0,00';

  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (isNaN(num)) return 'R$ 0,00';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatCompactMoney(
  value: number | string | null | undefined,
  hideValues: boolean = false
): string {
  if (hideValues) return '••••';
  if (value === null || value === undefined || value === '') return 'R$ 0';

  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (isNaN(num)) return 'R$ 0';

  if (Math.abs(num) >= 1_000_000) {
    return `R$ ${(num / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (Math.abs(num) >= 1_000) {
    return `R$ ${(num / 1_000).toFixed(1).replace('.', ',')}k`;
  }

  return formatMoney(num, false);
}

export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0,0%';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '0,0%';
  return `${num.toFixed(1).replace('.', ',')}%`;
}

export function formatPP(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0,0 p.p.';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '0,0 p.p.';
  return `${num > 0 ? '+' : ''}${num.toFixed(1).replace('.', ',')} p.p.`;
}
