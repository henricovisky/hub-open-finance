import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Tag, Plus, Check, X, Search, Sparkles } from 'lucide-react';
import clsx from 'clsx';

interface CategorySelectorProps {
  transactionId: string;
  currentCategoryId?: string | null;
  currentCategoryName?: string | null;
  transactionDescription: string;
  onAssigned?: () => void;
  className?: string;
}

export function CategorySelector({
  transactionId,
  currentCategoryId,
  currentCategoryName,
  transactionDescription,
  onAssigned,
  className,
}: CategorySelectorProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [applyToSimilar, setApplyToSimilar] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  // Estado do formulário "+ Nova Categoria"
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIsEssential, setNewCatIsEssential] = useState(true);

  // Busca lista de categorias disponíveis
  const { data: categories = [], isLoading } = useQuery<any[]>({
    queryKey: ['categories-list'],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/categories');
        return Array.isArray(res) ? res : res.data || [];
      } catch {
        return [];
      }
    },
    enabled: isOpen,
  });

  // Mutação para atribuir categoria à transação
  const assignMutation = useMutation({
    mutationFn: async ({ categoryId, applySimilar }: { categoryId: string | null; applySimilar: boolean }) => {
      return api.patch(`/transactions/${transactionId}`, {
        category_id: categoryId,
        apply_to_similar: applySimilar,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['categories-summary'] });
      queryClient.invalidateQueries({ queryKey: ['categories-list'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow-series'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow'] });
      setIsOpen(false);
      onAssigned?.();
    },
  });

  // Mutação para criar nova categoria e já atribuir
  const createAndAssignMutation = useMutation({
    mutationFn: async ({ name, isEssential }: { name: string; isEssential: boolean }) => {
      const created = await api.post<any>('/categories', {
        name: name.trim(),
        is_essential: isEssential,
      });
      const newCatId = created.id || created.data?.id;
      if (newCatId) {
        await api.patch(`/transactions/${transactionId}`, {
          category_id: newCatId,
          apply_to_similar: applyToSimilar,
        });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-list'] });
      queryClient.invalidateQueries({ queryKey: ['categories-summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow-series'] });
      queryClient.invalidateQueries({ queryKey: ['cashflow'] });
      setIsCreatingNew(false);
      setNewCatName('');
      setIsOpen(false);
      onAssigned?.();
    },
  });

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  };

  const handleSelectCategory = (catId: string | null) => {
    assignMutation.mutate({
      categoryId: catId,
      applySimilar: applyToSimilar,
    });
  };

  const handleCreateCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    createAndAssignMutation.mutate({
      name: newCatName.trim(),
      isEssential: newCatIsEssential,
    });
  };

  const filteredCategories = categories.filter((c: any) =>
    (c.name || '').toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  const displayName = currentCategoryName || (currentCategoryId ? 'Categorizada' : '❓ Outros');
  const hasCategory = Boolean(currentCategoryId || (currentCategoryName && currentCategoryName !== '❓ Outros' && currentCategoryName !== 'Não categorizada'));

  return (
    <>
      {/* Botão trigger da tag de categoria */}
      <button
        type="button"
        onClick={handleOpen}
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer text-left',
          hasCategory
            ? 'bg-surface-2 hover:bg-border/60 text-text-secondary hover:text-text-primary border-border'
            : 'bg-warning-bg/60 hover:bg-warning-bg text-warning border-warning/30 font-semibold',
          className
        )}
        title="Clique para alterar ou atribuir categoria"
      >
        <Tag className="w-3 h-3 flex-shrink-0 opacity-70" />
        <span className="truncate max-w-[130px] sm:max-w-[160px]">{displayName}</span>
      </button>

      {/* Modal / Bottom-sheet Seletor de Categoria */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          <div
            className="w-full sm:max-w-md bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 shadow-elevated flex flex-col max-h-[85vh] text-xs text-text-primary animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Seletor */}
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div className="pr-2 min-w-0">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-primary" />
                  <span>Atribuir Categoria</span>
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5 truncate" title={transactionDescription}>
                  {transactionDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Opção: Aplicar para transações com mesma descrição */}
            <div className="pt-3">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2/70 border border-border cursor-pointer select-none hover:bg-surface-2 transition-colors">
                <input
                  type="checkbox"
                  checked={applyToSimilar}
                  onChange={(e) => setApplyToSimilar(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-text-primary">
                    Aplicar também para transações com mesma descrição
                  </span>
                  <span className="text-[10px] text-text-muted">
                    Auto-categoriza outros lançamentos existentes iguais
                  </span>
                </div>
              </label>
            </div>

            {/* Ação rápida: + Nova Categoria inline */}
            <div className="pt-2">
              {!isCreatingNew ? (
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-primary/40 text-primary hover:bg-primary-light text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Nova categoria rápida</span>
                </button>
              ) : (
                <form
                  onSubmit={handleCreateCategorySubmit}
                  className="p-3 bg-surface-2/80 border border-border rounded-xl space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-text-primary flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Criar Nova Categoria
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(false)}
                      className="text-text-muted hover:text-text-primary text-[11px]"
                    >
                      Cancelar
                    </button>
                  </div>

                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nome da categoria (ex: Pet Shop, Lanches...)"
                    className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-hidden focus:border-primary"
                    autoFocus
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted font-medium">Classificação:</span>
                    <div className="inline-flex rounded-lg p-0.5 bg-surface border border-border text-[11px]">
                      <button
                        type="button"
                        onClick={() => setNewCatIsEssential(true)}
                        className={clsx(
                          'px-2 py-1 rounded-md transition-colors font-medium',
                          newCatIsEssential
                            ? 'bg-primary text-white font-semibold shadow-xs'
                            : 'text-text-muted hover:text-text-primary'
                        )}
                      >
                        Essencial
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCatIsEssential(false)}
                        className={clsx(
                          'px-2 py-1 rounded-md transition-colors font-medium',
                          !newCatIsEssential
                            ? 'bg-warning text-white font-semibold shadow-xs'
                            : 'text-text-muted hover:text-text-primary'
                        )}
                      >
                        Estilo de Vida
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={!newCatName.trim() || createAndAssignMutation.isPending}
                      className="px-3.5 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-subtle"
                    >
                      {createAndAssignMutation.isPending ? 'Salvando...' : 'Salvar e Atribuir'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Campo de Busca de Categorias */}
            <div className="pt-3 pb-2 relative">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar categorias..."
                className="w-full bg-surface-2 border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-primary"
              />
            </div>

            {/* Lista de Categorias com Seleção em 1 Toque */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar min-h-[160px] max-h-[260px]">
              {isLoading ? (
                <div className="py-8 text-center text-text-muted">Carregando categorias...</div>
              ) : filteredCategories.length === 0 ? (
                <div className="py-8 text-center text-text-muted">
                  Nenhuma categoria encontrada. Crie uma acima!
                </div>
              ) : (
                filteredCategories.map((c: any) => {
                  const isSelected = currentCategoryId === c.id || currentCategoryName === c.name;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCategory(c.id)}
                      disabled={assignMutation.isPending}
                      className={clsx(
                        'w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all',
                        isSelected
                          ? 'bg-primary-light border-primary text-primary font-semibold'
                          : 'bg-surface hover:bg-surface-2 border-border text-text-primary'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">{c.icon ? '' : '🏷️'}</span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-xs truncate">{c.name}</span>
                          <span className="text-[10px] text-text-muted">
                            {c.is_essential ? 'Essencial' : 'Não Essencial / Estilo de Vida'}
                            {c.included_items ? ` • ${c.included_items}` : ''}
                          </span>
                        </div>
                      </div>
                      {isSelected ? (
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      ) : (
                        <span className="text-[11px] text-text-muted opacity-0 group-hover:opacity-100">
                          Toque para aplicar
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer com opção de remover categoria */}
            {hasCategory && (
              <div className="pt-2 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => handleSelectCategory(null)}
                  disabled={assignMutation.isPending}
                  className="w-full text-center py-1.5 text-danger hover:underline text-[11px] font-medium"
                >
                  Remover categorização desta transação
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
