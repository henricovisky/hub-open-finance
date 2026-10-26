import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BOTTOM_NAV_PRIMARY, MAIN_NAV_ITEMS } from './navItems';
import { usePermissions } from '@/lib/permissions';
import { Menu, X, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { PeriodPicker } from './PeriodPicker';

export function BottomNav() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { isAdmin, canAccessFeature } = usePermissions();
  const location = useLocation();

  const preserveParams = (path: string) => `${path}${location.search}`;

  const remainingItems = MAIN_NAV_ITEMS.filter((item) => {
    // Apenas os itens que não estão na barra primária inferior
    if (BOTTOM_NAV_PRIMARY.some((p) => p.id === item.id)) return false;
    if (item.requireAdmin && !isAdmin) return false;
    if (item.feature && !canAccessFeature(item.feature)) return false;
    return true;
  });

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border px-2 py-1 flex items-center justify-around shadow-elevated"
        aria-label="Navegação móvel"
      >
        {BOTTOM_NAV_PRIMARY.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={preserveParams(item.path)}
              end={item.path === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1 rounded-lg transition-colors',
                  isActive ? 'text-primary font-bold' : 'text-text-muted hover:text-text-secondary'
                )
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] leading-tight">{item.label}</span>
            </NavLink>
          );
        })}

        {/* Botão "Mais" */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className={clsx(
            'flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1 rounded-lg transition-colors',
            isDrawerOpen ? 'text-primary font-bold' : 'text-text-muted hover:text-text-secondary'
          )}
          aria-label="Mais opções"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Mais</span>
        </button>
      </nav>

      {/* Drawer Móvel de Mais Opções */}
      {isDrawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Sheet */}
          <div className="relative bg-surface rounded-t-2xl border-t border-border p-4 max-h-[80vh] overflow-y-auto shadow-elevated">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-sm font-bold text-text-primary">Mais Funcionalidades</span>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 text-text-secondary hover:text-text-primary rounded-lg"
                aria-label="Fechar gaveta"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Seletor de Período para Mobile */}
            <div className="my-3 p-2 bg-surface-2 rounded-xl flex items-center justify-between">
              <span className="text-xs text-text-muted font-medium">Período ativo:</span>
              <PeriodPicker />
            </div>

            {/* Grid de Itens Restantes */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              {remainingItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={preserveParams(item.path)}
                    onClick={() => setIsDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-2 border border-border text-xs font-medium text-text-primary hover:border-primary transition-colors"
                  >
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.requireAdmin && <ShieldCheck className="w-3.5 h-3.5 ml-auto text-primary opacity-60" />}
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
