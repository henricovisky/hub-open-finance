import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Timeline, TimelineItem } from '@/components/timeline/Timeline';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Layers,
  Building2,
  CreditCard,
  TrendingUp,
  Briefcase,
  Home,
  User as UserIcon,
  Tag,
  ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';

declare global {
  interface Window {
    PluggyConnect: any;
  }
}

interface AccountItem {
  id: string;
  connection_id: string;
  pluggy_account_id: string;
  name: string;
  type: string;
  subtype?: string;
  currency: string;
  current_balance?: number;
  available_balance?: number;
  credit_limit?: number;
  owner_context: 'HOUSEHOLD' | 'PERSONAL' | 'INVESTMENT' | 'WORK' | 'OTHER';
  is_active: boolean;
  last_synced_at?: string;
}

const CONTEXT_OPTIONS: Array<{
  id: 'HOUSEHOLD' | 'PERSONAL' | 'INVESTMENT' | 'WORK';
  label: string;
  icon: typeof Home;
  colorClass: string;
  activeBgClass: string;
}> = [
  { id: 'HOUSEHOLD', label: 'Casa', icon: Home, colorClass: 'text-primary', activeBgClass: 'bg-primary/10 text-primary border-primary/30' },
  { id: 'PERSONAL', label: 'Pessoal', icon: UserIcon, colorClass: 'text-violet-600', activeBgClass: 'bg-violet-500/10 text-violet-600 border-violet-500/30' },
  { id: 'INVESTMENT', label: 'Investimentos', icon: TrendingUp, colorClass: 'text-emerald-600', activeBgClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  { id: 'WORK', label: 'Trabalho / PJ', icon: Briefcase, colorClass: 'text-amber-600', activeBgClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
];

export function AdminPage() {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);
  const [manualItemId, setManualItemId] = useState('');
  const [accountUpdateStatus, setAccountUpdateStatus] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  // 1. Conexões Ativas
  const { data: connections = [], isLoading: isConnectionsLoading } = useQuery({
    queryKey: ['admin-connections'],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/connections');
        return res.data || res || [];
      } catch {
        return [];
      }
    },
  });

  // 2. Contas Bancárias & Cartões para Gerenciamento de Tags
  const { data: accounts = [], isLoading: isAccountsLoading } = useQuery<AccountItem[]>({
    queryKey: ['admin-accounts'],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/accounts?include_inactive=true');
        return res.data || res || [];
      } catch {
        return [];
      }
    },
  });

  // 3. Usuários para a Matriz de Permissões
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/admin/users');
        return res.data || res || [];
      } catch {
        return [
          { id: '1', name: 'Henrico (Admin)', email: 'admin@exemplo.com', role: 'ADMIN' },
          { id: '2', name: 'Membro Família', email: 'membro@exemplo.com', role: 'MEMBER' },
        ];
      }
    },
  });

  // 4. Sincronização Manual de Conexão
  const syncMutation = useMutation({
    mutationFn: async (connId: string) => {
      return api.post(`/connections/${connId}/sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-connections'] });
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['wealth'] });
    },
  });

  // 5. Importação Manual por Item ID (Ideal para Meu Pluggy)
  const importItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return api.post('/connections/complete', {
        item_id: itemId.trim(),
        pluggy_item_id: itemId.trim(),
      });
    },
    onSuccess: () => {
      setManualItemId('');
      setConnectStatus('Conexão importada e sincronizada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['admin-connections'] });
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['wealth'] });
      setTimeout(() => setConnectStatus(null), 4000);
    },
    onError: (err: any) => {
      setConnectStatus(`Erro ao importar conexão: ${err.message || 'Falha na validação'}`);
    },
  });

  // 6. Atualização de Tag de Contexto da Conta (Casa, Pessoal, Investimentos, Trabalho/PJ)
  const updateAccountContextMutation = useMutation({
    mutationFn: async ({ accountId, owner_context }: { accountId: string; owner_context: string }) => {
      return api.patch(`/accounts/${accountId}`, { owner_context });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['wealth'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-growth'] });
      setAccountUpdateStatus('Tag de contexto atualizada com sucesso!');
      setTimeout(() => setAccountUpdateStatus(null), 3000);
    },
    onError: (err: any) => {
      setAccountUpdateStatus(`Erro ao atualizar tag: ${err.message || 'Falha na requisição'}`);
    },
  });

  // 7. Limpeza / Reset Total de Dados Financeiros
  const resetMutation = useMutation({
    mutationFn: async () => {
      return await api.post<any>('/admin/reset-data', {});
    },
    onSuccess: (data) => {
      setResetStatus(data?.message || 'Dados limpos com sucesso! Aplicação zerada.');
      setIsResetModalOpen(false);
      setResetConfirmText('');
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      setResetStatus(`Erro ao limpar base: ${err.message || 'Falha na requisição'}`);
    },
  });

  // 8. Carrega e Abre o Pluggy Connect Widget v2
  const handleOpenPluggyConnect = async () => {
    setIsConnecting(true);
    setConnectStatus('Obtendo token de conexão seguro...');

    try {
      const tokenRes = await api.post<any>('/connections/connect-token');
      const connectToken = tokenRes.data?.connect_token || tokenRes.connect_token;

      if (!connectToken) {
        throw new Error('Não foi possível obter o token do widget.');
      }

      setConnectStatus('Carregando widget Pluggy...');

      if (!window.PluggyConnect) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Falha ao baixar script do Pluggy Connect.'));
          document.body.appendChild(script);
        });
      }

      setConnectStatus('Aguardando conclusão no widget...');

      const pluggy = new window.PluggyConnect({
        connectToken,
        includeSandbox: true,
        onSuccess: async (itemData: any) => {
          setConnectStatus('Conectado com sucesso! Registrando no sistema e sincronizando dados...');
          try {
            const resolvedId = itemData?.item?.id || itemData?.id || itemData?.itemId;
            if (!resolvedId) {
              throw new Error('Identificador da conexão não retornado pelo widget.');
            }
            await api.post('/connections/complete', {
              item_id: resolvedId,
              pluggy_item_id: resolvedId,
            });
            queryClient.invalidateQueries({ queryKey: ['admin-connections'] });
            queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
            queryClient.invalidateQueries({ queryKey: ['wealth'] });
            setConnectStatus('Conexão concluída e dados importados com sucesso!');
            setTimeout(() => {
              setIsConnecting(false);
              setConnectStatus(null);
            }, 3000);
          } catch (e: any) {
            setConnectStatus(`Erro ao salvar conexão: ${e.message}`);
          }
        },
        onError: (err: any) => {
          setConnectStatus(`Erro na Pluggy: ${err?.message || 'Falha na conexão'}`);
        },
        onClose: () => {
          if (!connectStatus?.includes('concluída') && !connectStatus?.includes('sucesso')) {
            setIsConnecting(false);
            setConnectStatus(null);
          }
        },
      });

      pluggy.init();
    } catch (err: any) {
      setConnectStatus(`Erro: ${err.message}`);
      setIsConnecting(false);
    }
  };

  // 9. Timeline de Auditoria Técnica (T-06)
  const { data: auditEvents = [] } = useQuery<TimelineItem[]>({
    queryKey: ['admin-audit-events'],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/sync/events');
        const items = res.data || res || [];
        return items.map((ev: any) => ({
          id: ev.id,
          kind: 'SYNC_EVENT',
          date: ev.created_at?.split('T')[0] || '',
          title: ev.event_type || 'Sincronização',
          categoryName: ev.details || 'Atualização de dados via Pluggy',
        }));
      } catch {
        return [];
      }
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span>Administração & Conexões Open Finance</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Gerenciamento de integrações bancárias, classificação de contas (Casa, Pessoal, Investimentos, Trabalho/PJ) e auditoria
          </p>
        </div>

        {/* Botão de Conectar Instituição via Widget */}
        <button
          type="button"
          onClick={handleOpenPluggyConnect}
          disabled={isConnecting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover shadow-subtle self-start sm:self-auto disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{isConnecting ? 'Conectando...' : 'Conectar Instituição'}</span>
        </button>
      </div>

      {/* Banner de Estado do Widget / Importação */}
      {connectStatus && (
        <div className={clsx(
          'p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between animate-fade-in',
          connectStatus.includes('Erro')
            ? 'bg-danger-bg text-danger border-danger/30'
            : 'bg-primary-light text-primary border-primary/30'
        )}>
          <span>{connectStatus}</span>
          <button
            type="button"
            onClick={() => setConnectStatus(null)}
            className="text-[11px] hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 1. Lista de Conexões e Importação Direta */}
      <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Conexões Ativas Open Finance</h2>
            <p className="text-[11px] text-text-muted">
              Instituições conectadas e sincronizadas via Pluggy
            </p>
          </div>
          <span className="text-xs text-text-muted font-medium">
            {connections.length} {connections.length === 1 ? 'conexão' : 'conexões'}
          </span>
        </div>

        {isConnectionsLoading ? (
          <div className="p-6 text-center text-xs text-text-muted">Carregando conexões...</div>
        ) : connections.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted bg-surface-2/40 rounded-xl border border-dashed border-border">
            Nenhuma instituição bancária conectada ainda. Clique em <strong>Conectar Instituição</strong> acima ou informe um Item ID abaixo.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {connections.map((conn: any) => (
              <div key={conn.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-text-secondary" />
                    <span className="font-semibold text-text-primary">{conn.institution_name}</span>
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold',
                        conn.status === 'UPDATED' || conn.status === 'CONNECTED'
                          ? 'bg-income-bg text-income'
                          : conn.status === 'SYNCING'
                          ? 'bg-primary-light text-primary animate-pulse'
                          : 'bg-warning-bg text-warning'
                      )}
                    >
                      {conn.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-text-muted mt-1">
                    <span>Item ID: <code className="font-mono text-text-secondary">{conn.pluggy_item_id}</code></span>
                    <span>•</span>
                    <span>Última sincronização: {conn.last_sync_at ? formatDate(conn.last_sync_at, 'full') : 'Nunca'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => syncMutation.mutate(conn.id)}
                    disabled={syncMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-border text-text-secondary hover:text-text-primary text-xs font-medium transition-colors disabled:opacity-50"
                    title="Forçar sincronização de dados agora"
                  >
                    <RefreshCw className={clsx('w-3.5 h-3.5', syncMutation.isPending && 'animate-spin')} />
                    <span>Sincronizar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Importação por Item ID (Meu Pluggy) */}
        <div className="pt-3 border-t border-border/80">
          <label htmlFor="manual-item-id" className="block text-xs font-semibold text-text-primary mb-1">
            Importar Conexão Existente por Item ID (Meu Pluggy)
          </label>
          <p className="text-[11px] text-text-muted mb-2">
            Se você já conectou uma conta pelo app do <em>Meu Pluggy</em> ou o widget fechou antes de salvar, cole o identificador do Item abaixo para importar e disparar a sincronização imediata:
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              id="manual-item-id"
              type="text"
              value={manualItemId}
              onChange={(e) => setManualItemId(e.target.value)}
              placeholder="Ex: 8f4d9a6c-1234-4567-890a-bcdef0123456"
              className="flex-1 bg-surface-2 border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
            <button
              type="button"
              onClick={() => manualItemId.trim() && importItemMutation.mutate(manualItemId.trim())}
              disabled={!manualItemId.trim() || importItemMutation.isPending}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-surface-2 hover:bg-border border border-border text-text-primary text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {importItemMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                  <span>Importar & Sincronizar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Gerenciamento de Contas Bancárias & Tags de Contexto */}
      <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-text-primary">Contas Bancárias & Tags de Contexto</h2>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">
              Defina se cada conta pertence a <strong>Casa</strong>, <strong>Pessoal</strong>, <strong>Investimentos</strong> ou <strong>Trabalho / PJ</strong>. Os lançamentos e gráficos se ajustam automaticamente.
            </p>
          </div>
          <span className="text-xs text-text-muted font-medium">
            {accounts.length} {accounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}
          </span>
        </div>

        {accountUpdateStatus && (
          <div className={clsx(
            'p-3 rounded-xl border text-xs font-medium flex items-center justify-between animate-fade-in',
            accountUpdateStatus.includes('Erro')
              ? 'bg-danger-bg text-danger border-danger/30'
              : 'bg-income-bg text-income border-income/30'
          )}>
            <span>{accountUpdateStatus}</span>
            <button
              type="button"
              onClick={() => setAccountUpdateStatus(null)}
              className="text-[11px] hover:underline"
            >
              Fechar
            </button>
          </div>
        )}

        {isAccountsLoading ? (
          <div className="p-6 text-center text-xs text-text-muted">Carregando contas...</div>
        ) : accounts.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted bg-surface-2/40 rounded-xl border border-dashed border-border">
            Nenhuma conta bancária importada ainda. Conecte sua instituição acima para listar as contas.
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => {
              const isCredit = acc.type === 'CREDIT';
              const isInvestment = acc.type === 'INVESTMENT';
              return (
                <div
                  key={acc.id}
                  className="p-3.5 bg-surface rounded-xl border border-border hover:border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
                >
                  {/* Identificação da Conta */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-surface-2 text-text-secondary mt-0.5">
                      {isCredit ? (
                        <CreditCard className="w-4 h-4 text-warning" />
                      ) : isInvestment ? (
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Building2 className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-text-primary">{acc.name}</span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-surface-2 text-text-muted">
                          {acc.type === 'BANK' ? 'Conta Corrente' : acc.type === 'CREDIT' ? 'Cartão' : acc.type === 'INVESTMENT' ? 'Investimento' : acc.type}
                        </span>
                        {!acc.is_active && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-danger-bg text-danger">
                            Inativa
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-text-muted mt-0.5">
                        <span>
                          Saldo: <strong className="text-text-primary font-semibold">{formatMoney(acc.current_balance ?? 0)}</strong>
                        </span>
                        {acc.credit_limit ? (
                          <>
                            <span>•</span>
                            <span>Limite: {formatMoney(acc.credit_limit)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Seletor de Tags de Contexto (Casa, Pessoal, Investimentos, Trabalho/PJ) */}
                  <div className="flex items-center gap-1.5 self-start md:self-auto flex-wrap">
                    <span className="text-[11px] font-medium text-text-muted mr-1 hidden sm:inline">Contexto:</span>
                    {CONTEXT_OPTIONS.map((opt) => {
                      const isSelected = acc.owner_context === opt.id;
                      const IconComponent = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            if (!isSelected) {
                              updateAccountContextMutation.mutate({
                                accountId: acc.id,
                                owner_context: opt.id,
                              });
                            }
                          }}
                          disabled={updateAccountContextMutation.isPending}
                          className={clsx(
                            'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                            isSelected
                              ? opt.activeBgClass
                              : 'bg-surface-2/60 border-border text-text-muted hover:text-text-primary hover:bg-surface-2'
                          )}
                        >
                          <IconComponent className={clsx('w-3.5 h-3.5', isSelected ? opt.colorClass : 'text-text-muted')} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Matriz de Permissões Conta x Usuário */}
      <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Matriz de Permissões de Acesso</h2>
            <p className="text-[11px] text-text-muted">
              Controle de visibilidade por perfil (Administrador vs Membro da Família)
            </p>
          </div>
          <Lock className="w-4 h-4 text-text-muted" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-text-muted border-b border-border">
              <tr>
                <th className="py-2">Usuário</th>
                <th className="py-2">Papel</th>
                <th className="py-2">Acesso Pessoal</th>
                <th className="py-2">Acesso Casa</th>
                <th className="py-2">Consolidado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {users.map((u: any) => (
                <tr key={u.id} className="py-2">
                  <td className="py-2.5 font-medium text-text-primary">{u.name}</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-2 text-text-secondary">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2.5 text-income font-semibold">Liberado</td>
                  <td className="py-2.5 text-income font-semibold">Liberado</td>
                  <td className="py-2.5">
                    {u.role === 'ADMIN' ? (
                      <span className="text-income font-semibold">Liberado</span>
                    ) : (
                      <span className="text-text-muted">Bloqueado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Banner de Estado da Limpeza */}
      {resetStatus && (
        <div className={clsx(
          'p-3.5 rounded-xl border text-xs flex items-center justify-between',
          resetStatus.includes('Erro')
            ? 'bg-danger-bg text-danger border-danger/30'
            : 'bg-income-bg text-income border-income/30'
        )}>
          <span>{resetStatus}</span>
          <button
            type="button"
            onClick={() => setResetStatus(null)}
            className="text-[11px] font-bold hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 4. Timeline de Auditoria Técnica (T-06) */}
      <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-3">
        <h2 className="text-sm font-bold text-text-primary">Histórico de Eventos & Sincronização (T-06)</h2>
        {auditEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-text-muted">
            Nenhum evento de sincronização registrado ainda.
          </div>
        ) : (
          <Timeline items={auditEvents} />
        )}
      </div>

      {/* 5. Zona de Perigo: Limpeza / Reset Total de Dados */}
      <div className="bg-danger-bg/40 border border-danger/30 rounded-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-danger">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <h2 className="text-sm font-bold">Zona de Perigo — Limpeza do Banco de Dados</h2>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Esta ação limpa permanentemente todas as <strong>conexões bancárias, contas correntes, faturas de cartão, investimentos e lançamentos</strong>, retornando o sistema ao estado inicial zerado para novas integrações reais com a Pluggy. Os usuários e credenciais de acesso não são excluídos.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-danger text-white text-xs font-bold rounded-xl hover:bg-danger/90 shadow-subtle transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Zerar Todos os Dados Financeiros</span>
          </button>
        </div>
      </div>

      {/* Modal de Confirmação de Limpeza com Trava de Segurança */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-elevated space-y-4">
            <div className="flex items-center gap-2.5 text-danger">
              <div className="p-2 bg-danger-bg rounded-xl">
                <Trash2 className="w-5 h-5 text-danger" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Confirmar Limpeza Total</h3>
                <span className="text-xs text-danger font-semibold">Ação destrutiva e irreversível</span>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Você está prestes a apagar <strong>todas as conexões bancárias, contas e movimentações</strong> salvas neste banco de dados. Os dados não poderão ser recuperados.
            </p>

            <div className="space-y-1.5 bg-surface-2 p-3 rounded-xl border border-border">
              <label htmlFor="confirm-reset-input" className="text-[11px] font-semibold text-text-muted block">
                Para confirmar, digite <strong className="text-text-primary font-mono select-all">ZERAR</strong> no campo abaixo:
              </label>
              <input
                id="confirm-reset-input"
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="ZERAR"
                className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary font-mono uppercase focus:ring-1 focus:ring-danger focus:border-danger outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetConfirmText('');
                }}
                disabled={resetMutation.isPending}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-surface-2 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => resetMutation.mutate()}
                disabled={resetConfirmText !== 'ZERAR' || resetMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-danger text-white text-xs font-bold rounded-xl hover:bg-danger/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-subtle transition-colors"
              >
                {resetMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Limpando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Apagar e Zerar Banco</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
