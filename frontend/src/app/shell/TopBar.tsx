import { useTheme } from '@/app/providers/ThemeProvider';
import { useAuth } from '@/app/providers/AuthProvider';
import { ContextSwitcher } from './ContextSwitcher';
import { PeriodPicker } from './PeriodPicker';
import { Eye, EyeOff, Sun, Moon, Search, LogOut, ShieldCheck, Wallet } from 'lucide-react';

interface TopBarProps {
  onOpenSearch: () => void;
}

export function TopBar({ onOpenSearch }: TopBarProps) {
  const { resolvedTheme, setTheme, hideValues, toggleHideValues } = useTheme();
  const { user, logout } = useAuth();

  const actionsNode = (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
  );

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-border px-3 sm:px-4 lg:px-6 shadow-subtle">
      {/* Disposição Mobile (< md): duas linhas */}
      <div className="md:hidden flex flex-col py-2 gap-2">
        {/* Linha superior: Identidade/título e ícones de ação sem quebra */}
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white shadow-subtle shrink-0">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-text-primary tracking-tight truncate">Hub Financeiro</span>
            <PeriodPicker className="hidden sm:inline-flex" />
          </div>
          {actionsNode}
        </div>

        {/* Linha inferior: ContextSwitcher em linha fluida com scroll horizontal */}
        <div className="w-full overflow-x-auto no-scrollbar pb-0.5">
          <ContextSwitcher className="w-full overflow-x-auto flex-nowrap gap-2 pb-1 no-scrollbar justify-start" />
        </div>
      </div>

      {/* Disposição Desktop (>= md): Linha única tradicional */}
      <div className="hidden md:flex items-center justify-between gap-2 h-14">
        {/* Esquerda: Contexto e Período */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <ContextSwitcher />
          <PeriodPicker className="hidden sm:inline-flex" />
        </div>

        {/* Direita: Ações Rápidas */}
        {actionsNode}
      </div>
    </header>
  );
}
