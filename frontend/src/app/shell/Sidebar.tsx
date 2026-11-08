import { NavLink, useLocation } from 'react-router-dom';
import { MAIN_NAV_ITEMS } from './navItems';
import { usePermissions } from '@/lib/permissions';
import { ShieldCheck, Wallet } from 'lucide-react';
import clsx from 'clsx';

export function Sidebar() {
  const { isAdmin, canAccessFeature } = usePermissions();
  const location = useLocation();

  // Preserva os query params (context e period) ao navegar entre abas!
  const preserveParams = (path: string) => {
    return `${path}${location.search}`;
  };

  const visibleItems = MAIN_NAV_ITEMS.filter((item) => {
    if (item.requireAdmin && !isAdmin) return false;
    if (item.feature && !canAccessFeature(item.feature)) return false;
    return true;
  });

  return (
    <aside className="hidden lg:flex flex-col w-60 h-screen sticky top-0 bg-surface border-r border-border shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-subtle">
          <Wallet className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-text-primary tracking-tight">Hub Financeiro</span>
          <span className="text-[10px] text-text-muted font-medium">Open Finance v2.0</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Navegação principal">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={preserveParams(item.path)}
              end={item.path === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary-light text-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.requireAdmin && (
                <span title="Apenas Admin">
                  <ShieldCheck className="w-3.5 h-3.5 ml-auto text-primary opacity-70" />
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-between text-[11px] text-text-muted px-2 py-1 bg-surface-2 rounded-md">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-income inline-block animate-pulse" />
            <span>Open Finance Ativo</span>
          </span>
          <span className="tabular-nums">v2.0</span>
        </div>
      </div>
    </aside>
  );
}
