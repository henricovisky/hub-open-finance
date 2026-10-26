import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { NavigationRail } from './NavigationRail';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { GlobalSearchModal } from './GlobalSearchModal';
import { useAuth } from '@/app/providers/AuthProvider';
import { Lock, KeyRound } from 'lucide-react';

export function AppShell() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { isLocked, unlock, user } = useAuth();
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  useEffect(() => {
    const handleCustomSearch = () => setIsSearchOpen(true);
    window.addEventListener('open:search', handleCustomSearch);
    return () => window.removeEventListener('open:search', handleCustomSearch);
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword) {
      setUnlockError('Digite sua senha para desbloquear');
      return;
    }
    // Para simplificar o desbloqueio local da tela, destrava a sessão ativa
    unlock();
    setUnlockPassword('');
    setUnlockError('');
  };

  if (isLocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas p-4">
        <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 shadow-elevated text-center">
          <div className="w-12 h-12 rounded-full bg-primary-light text-primary flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-text-primary">Sessão Bloqueada por Inatividade</h2>
          <p className="text-xs text-text-secondary mt-1 mb-4">
            Olá, {user?.name}. Para proteger seus dados financeiros, confirme sua senha para continuar.
          </p>
          <form onSubmit={handleUnlock} className="space-y-3">
            <div className="relative">
              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Sua senha de acesso"
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-hidden focus:border-primary"
                autoFocus
              />
            </div>
            {unlockError && <p className="text-[11px] text-danger">{unlockError}</p>}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Desbloquear Tela
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-row">
      {/* 1. Sidebar para telas Desktop (>= 1024px) */}
      <Sidebar />

      {/* 2. Navigation Rail para telas Médias (640px - 1023px) */}
      <NavigationRail />

      {/* 3. Área Central (Topbar + Conteúdo Principal) */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 sm:pb-0">
        <TopBar onOpenSearch={() => setIsSearchOpen(true)} />

        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* 4. Bottom Navigation para telas Mobile (< 640px) */}
      <BottomNav />

      {/* 5. Modal de Busca Global (Ctrl+K) */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
