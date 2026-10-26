import { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global key listener for Ctrl/Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger open
          const event = new CustomEvent('open:search');
          window.dispatchEvent(event);
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-elevated overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-border gap-3">
          <Search className="w-5 h-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por transação, categoria, conta ou atalho..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-text-muted hover:text-text-primary rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Results / Quick Suggestions */}
        <div className="p-3 max-h-80 overflow-y-auto">
          <div className="text-[11px] font-semibold text-text-muted px-2 py-1 uppercase tracking-wider">
            Navegação Rápida
          </div>
          <div className="space-y-1 mt-1">
            {[
              { label: 'Ir para Visão Geral', path: '/' },
              { label: 'Ver Fluxo de Caixa', path: '/fluxo' },
              { label: 'Listar Movimentações Recentes', path: '/transacoes' },
              { label: 'Acessar Faturas e Limites de Cartão', path: '/cartoes' },
              { label: 'Acompanhar Metas e Sonhos', path: '/metas' },
              { label: 'Ver Agenda de Vencimentos', path: '/agenda' },
            ].map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleSelect(item.path)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-2 rounded-lg transition-colors text-left"
              >
                <span>{item.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
              </button>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-surface-2 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
          <span>Dica: Use as setas para navegar</span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" /> Selecionar
          </span>
        </div>
      </div>
    </div>
  );
}
