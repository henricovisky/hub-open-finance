import {
  LayoutDashboard,
  TrendingUp,
  ArrowLeftRight,
  CreditCard,
  PieChart,
  Target,
  Flag,
  CalendarDays,
  LineChart,
  Settings,
  Code,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: any;
  requireAdmin?: boolean;
  feature?: string;
  badge?: string;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Visão Geral', path: '/', icon: LayoutDashboard },
  { id: 'cashflow', label: 'Fluxo de Caixa', path: '/fluxo', icon: TrendingUp },
  { id: 'transactions', label: 'Transações', path: '/transacoes', icon: ArrowLeftRight },
  { id: 'cards', label: 'Cartões', path: '/cartoes', icon: CreditCard },
  { id: 'categories', label: 'Categorias', path: '/categorias', icon: PieChart },
  { id: 'budgets', label: 'Orçamentos', path: '/orcamento', icon: Target },
  { id: 'goals', label: 'Metas', path: '/metas', icon: Flag },
  { id: 'agenda', label: 'Agenda & Projeção', path: '/agenda', icon: CalendarDays },
  { id: 'portfolio', label: 'Patrimônio', path: '/patrimonio', icon: LineChart, feature: 'investments' },
  { id: 'admin', label: 'Conexões & Admin', path: '/admin', icon: Settings, requireAdmin: true },
  { id: 'dev', label: 'Catálogo de UI', path: '/_dev/components', icon: Code },
];

export const BOTTOM_NAV_PRIMARY: NavItem[] = [
  { id: 'overview', label: 'Início', path: '/', icon: LayoutDashboard },
  { id: 'cashflow', label: 'Fluxo', path: '/fluxo', icon: TrendingUp },
  { id: 'transactions', label: 'Transações', path: '/transacoes', icon: ArrowLeftRight },
  { id: 'cards', label: 'Cartões', path: '/cartoes', icon: CreditCard },
];
