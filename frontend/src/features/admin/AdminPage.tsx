import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Timeline, TimelineItem } from '@/components/timeline/Timeline';
import { formatDate } from '@/lib/dates';
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
} from 'lucide-react';
import clsx from 'clsx';

declare global {
  interface Window {
    PluggyConnect: any;
  }
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  // 1. Busca Conexões Ativas
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

  // 2. Busca Usuários para a Matriz de Permissões
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

  // 3. Sincronização Manual de Conexão
  const syncMutation = useMutation({
    mutationFn: async (connId: string) => {
      return api.post(`/connections/${connId}/sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-connections'] });
    },
  });

  // 3.1. Limpeza / Reset Total de Dados Financeiros
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

  // 4. Carrega e Abre o Pluggy Connect Widget v2
  const handleOpenPluggyConnect = async () => {
    setIsConnecting(true);
    setConnectStatus('Obtendo token de conexão seguro...');

    try {
      // Busca connect token da API
      const tokenRes = await api.post<any>('/connections/connect-token');
      const connectToken = tokenRes.data?.connect_token || tokenRes.connect_token;

      if (!connectToken) {
        throw new Error('Não foi possível obter o token do widget.');
      }

      setConnectStatus('Carregando widget Pluggy...');

      // Carrega o script da Pluggy se não estiver presente
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
          setConnectStatus('Conectado com sucesso! Registrando no sistema...');
          try {
            await api.post('/connections/complete', {
              pluggy_item_id: itemData.item.id,
            });
            queryClient.invalidateQueries({ queryKey: ['admin-connections'] });
            setConnectStatus('Conexão concluída e sincronizada!');
            setTimeout(() => {
              setIsConnecting(false);
              setConnectStatus(null);
            }, 2000);
          } catch (e: any) {
            setConnectStatus(`Erro ao salvar conexão: ${e.message}`);
          }
        },
        onError: (err: any) => {
          setConnectStatus(`Erro na Pluggy: ${err?.message || 'Falha na conexão'}`);
        },
        onClose: () => {
          if (!connectStatus?.includes('Concluída')) {
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

  // 3. Busca Eventos de Auditoria / Sincronização
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
            Gerenciamento de integrações bancárias, sincronização e matriz de permissões
          </p>
        </div>

        {/* Botão de Conectar Instituição */}
        <button
          type="button"
          onClick={handleOpenPluggyConnect}
          disabled={isConnecting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover shadow-subtle self-start sm:self-auto disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>{isConnecting ? 'Conectando...' : 'Conectar Instituição'}</span>
        </button>
      </div>

      {/* Banner de Estado do Widget */}
      {connectStatus && (
        <div className="p-3.5 bg-primary-light border border-primary/30 rounded-xl text-xs text-primary font-semibold animate-pulse">
          {connectStatus}
        </div>
      )}

      {/* 1. Lista de Conexões */}
      <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-3">
        <h2 className="text-sm font-bold text-text-primary">Conexões Ativas</h2>

        {isConnectionsLoading ? (
          <div className="p-6 text-center text-xs text-text-muted">Carregando conexões...</div>
        ) : connections.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">
            Nenhuma instituição bancária conectada ainda. Clique no botão acima para conectar.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {connections.map((conn: any) => (
              <div key={conn.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">{conn.institution_name}</span>
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold',
                        conn.status === 'UPDATED' || conn.status === 'CONNECTED'
                          ? 'bg-income-bg text-income'
                          : 'bg-warning-bg text-warning'
                      )}
                    >
                      {conn.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted block mt-0.5">
                    Última sincronização: {conn.last_synced_at ? formatDate(conn.last_synced_at, 'full') : 'Nunca'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => syncMutation.mutate(conn.id)}
                    disabled={syncMutation.isPending}
                    className="p-2 rounded-lg bg-surface-2 hover:bg-border text-text-secondary hover:text-text-primary transition-colors"
                    title="Sincronizar agora"
                  >
                    <RefreshCw className={clsx('w-3.5 h-3.5', syncMutation.isPending && 'animate-spin')} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Matriz de Permissões Conta x Usuário */}
      <div className="bg-card border border-border rounded-card p-4 sm:p-5 shadow-card space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Matriz de Permissões de Acesso</h2>
            <p className="text-[11px] text-text-muted">
              Controle quais contas cada membro da família pode visualizar ou categorizar
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

      {/* 3. Timeline de Auditoria Técnica (T-06) */}
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

      {/* 4. Zona de Perigo: Limpeza / Reset Total de Dados */}
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
