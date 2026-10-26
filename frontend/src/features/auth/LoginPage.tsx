import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { Wallet, Lock, Mail, ArrowRight, ShieldCheck, User } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Preencha seu e-mail e senha.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Falha ao autenticar. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(demoEmail.includes('admin') ? 'AdminPass123!Secure' : 'MemberPass123!Secure');
    setError('');
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-elevated">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-subtle mb-3">
            <Wallet className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Hub Financeiro</h1>
          <p className="text-xs text-text-muted mt-1">Gestão Pessoal & Familiar conectada ao Open Finance</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-danger-bg border border-danger/30 text-danger text-xs font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5" htmlFor="email">
              E-mail de acesso
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-text-muted absolute left-3 top-3" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-surface-2 border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5" htmlFor="password">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-text-muted absolute left-3 top-3" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-surface-2 border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-subtle disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <span>Entrando...</span>
            ) : (
              <>
                <span>Entrar no Hub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Atalhos de Preenchimento para Desenvolvimento/Testes */}
        <div className="mt-6 pt-5 border-t border-border">
          <p className="text-[11px] text-text-muted text-center mb-2.5 font-medium">Acesso rápido de teste:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleFillDemo('admin@exemplo.com')}
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-surface-2 hover:bg-border text-[11px] font-semibold text-text-secondary transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Admin
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo('membro@exemplo.com')}
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-surface-2 hover:bg-border text-[11px] font-semibold text-text-secondary transition-colors"
            >
              <User className="w-3.5 h-3.5 text-text-muted" />
              Membro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
