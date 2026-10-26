import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/app/shell/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { DevComponentsCatalog } from '@/features/dev/DevComponentsCatalog';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { CashflowPage } from '@/features/cashflow/CashflowPage';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';
import { CardsPage } from '@/features/cards/CardsPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { BudgetsPage } from '@/features/budgets/BudgetsPage';
import { GoalsPage } from '@/features/goals/GoalsPage';
import { AgendaPage } from '@/features/agenda/AgendaPage';
import { PortfolioPage } from '@/features/portfolio/PortfolioPage';
import { AdminPage } from '@/features/admin/AdminPage';
import { useAuth } from '@/app/providers/AuthProvider';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="fluxo" element={<CashflowPage />} />
        <Route path="transacoes" element={<TransactionsPage />} />
        <Route path="cartoes" element={<CardsPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="orcamento" element={<BudgetsPage />} />
        <Route path="metas" element={<GoalsPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="patrimonio" element={<PortfolioPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="_dev/components" element={<DevComponentsCatalog />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
