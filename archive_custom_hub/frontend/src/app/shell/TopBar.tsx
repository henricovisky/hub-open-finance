import { useTheme } from '@/app/providers/ThemeProvider';
import { useAuth } from '@/app/providers/AuthProvider';
import { ContextSwitcher } from './ContextSwitcher';
import { PeriodPicker } from './PeriodPicker';
import { Eye, EyeOff, Sun, Moon, Search, LogOut, ShieldCheck, RefreshCw } from 'lucide-react';

interface TopBarProps {
  onOpenSearch: () => void;
}

export function TopBar({ onOpenSearch }: TopBarProps) {
  const { resolvedTheme, setTheme, hideValues, toggleHideValues } = useTheme();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 h-14 bg-surface border-b border-border px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 shadow-subtle">
      {/* Esquerda: Contexto e Período */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <ContextSwitcher />
        <PeriodPicker className="hidden sm:inline-flex" />
      </div>

      {/* Direita: Ações Rápidas (Busca, Ocultar Valores, Tema, Perfil) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Busca rápida */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-text-muted hover:text-text-primary bg-surface-2 border border-border rounded-lg transition-colors"
          aria-label="Busca global (Ctrl+K)"
          title="Busca global (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Buscar...</span>
          <kbd className="hidden lg:inline text-[10px] bg-surface px-1 py-0.5 rounded border border-border">⌘K</kbd>
        </button>

        {/* Ocultar Valores */}
        <button
          type="button"
          onClick={toggleHideValues}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors"
          aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
          title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
        >
          {hideValues ? <EyeOff className="w-4 h-4 text-warning" /> : <Eye className="w-4 h-4" />}
        </button>

        {/* Alternar Tema Claro/Escuro */}
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors"
          aria-label={resolvedTheme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          title={resolvedTheme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
        >
          {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Usuário / Logout */}
        {user && (
          <div className="flex items-center pl-1 sm:pl-2 border-l border-border gap-1.5">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-text-primary leading-tight flex items-center justify-end gap-1">
                {user.role === 'ADMIN' && <ShieldCheck className="w-3 h-3 text-primary" />}
                {user.name.split(' ')[0]}
              </span>
              <span className="text-[10px] text-text-muted">{user.role}</span>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="p-2 text-text-secondary hover:text-danger hover:bg-danger-bg rounded-lg transition-colors"
              aria-label="Sair da conta"
              title="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
