const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getPreviousPeriod(period: string): string {
  if (!period || !period.includes('-')) return getCurrentPeriod();
  const [yStr, mStr] = period.split('-');
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10) - 1;

  if (month < 1) {
    month = 12;
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getNextPeriod(period: string): string {
  if (!period || !period.includes('-')) return getCurrentPeriod();
  const [yStr, mStr] = period.split('-');
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10) + 1;

  if (month > 12) {
    month = 1;
    year += 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatPeriod(period: string): string {
  if (!period || !period.includes('-')) return period;
  const [yStr, mStr] = period.split('-');
  const monthIdx = parseInt(mStr, 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${MONTH_NAMES[monthIdx]} ${yStr}`;
  }
  return period;
}

export function formatDate(
  dateInput: string | Date | null | undefined,
  formatStyle: 'short' | 'medium' | 'long' | string = 'short'
): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';

  const day = String(d.getDate()).padStart(2, '0');
  const monthIdx = d.getMonth();
  const monthNum = String(monthIdx + 1).padStart(2, '0');
  const year = d.getFullYear();

  if (formatStyle === 'medium') {
    return `${day} de ${MONTH_NAMES_SHORT[monthIdx]}`;
  }
  if (formatStyle === 'long') {
    return `${day} de ${MONTH_NAMES[monthIdx]} de ${year}`;
  }

  return `${day}/${monthNum}/${year}`;
}
