// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopBar } from './TopBar';

const queryClient = new QueryClient();

describe('TopBar', () => {
  it('renders topbar and brand header', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TopBar onOpenSearch={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Hub Financeiro')).toBeDefined();
    expect(screen.getAllByLabelText('Busca global (Ctrl+K)')).toHaveLength(2);
  });
});
