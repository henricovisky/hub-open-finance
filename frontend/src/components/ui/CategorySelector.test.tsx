// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CategorySelector } from './CategorySelector';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('CategorySelector', () => {
  it('renders default button and opens modal when clicked', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CategorySelector
          transactionId="123"
          transactionDescription="Compra Padaria"
          currentCategoryName={null}
        />
      </QueryClientProvider>
    );

    const triggerBtn = screen.getByText('❓ Outros');
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    expect(screen.getByText('Atribuir Categoria')).toBeDefined();
    expect(screen.getByText('Aplicar também para transações com mesma descrição')).toBeDefined();
    expect(screen.getByText('+ Nova categoria rápida')).toBeDefined();
  });
});
