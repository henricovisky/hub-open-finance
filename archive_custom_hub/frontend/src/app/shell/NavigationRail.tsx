import { NavLink, useLocation } from 'react-router-dom';
import { MAIN_NAV_ITEMS } from './navItems';
import { usePermissions } from '@/lib/permissions';
import { Wallet } from 'lucide-react';
import clsx from 'clsx';

export function NavigationRail() {
  const { isAdmin, canAccessFeature } = usePermissions();
  const location = useLocation();

  const preserveParams = (path: string) => `${path}${location.search}`;

  const visibleItems = MAIN_NAV_ITEMS.filter((item) => {
    if (item.requireAdmin && !isAdmin) return false;
    if (item.feature && !canAccessFeature(item.feature)) return false;
    return true;
  });

  return (
    <aside className="hidden sm:flex lg:hidden flex-col w-16 h-screen sticky top-0 bg-surface border-r border-border shrink-0 select-none items-center py-3">
      {/* Brand Icon */}
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-subtle mb-4">
        <Wallet className="w-5 h-5" />
      </div>

      {/* Nav Icons */}
      <nav className="flex-1 overflow-y-auto space-y-2 w-full px-2" aria-label="Navegação compacta">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={preserveParams(item.path)}
              end={item.path === '/'}
              title={item.label}
              className={({ isActive }) =>
                clsx(
                  'flex items-center justify-center w-full h-11 rounded-xl transition-colors',
                  isActive
                    ? 'bg-primary-light text-primary font-semibold shadow-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                )
              }
            >
              <Icon className="w-5 h-5" />
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
