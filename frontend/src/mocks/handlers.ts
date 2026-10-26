import { http, HttpResponse } from 'msw';
import { mockAdminUser } from './fixtures/auth';
import { mockCashflowSeries } from './fixtures/cashflow';

export const handlers = [
  // Auth Me
  http.get('/api/v1/auth/me', () => {
    return HttpResponse.json({
      status: 'success',
      data: mockAdminUser,
    });
  }),

  // Cashflow Series (G-01)
  http.get('/api/v1/cashflow/series', ({ request }) => {
    const url = new URL(request.url);
    const context = url.searchParams.get('context') || 'HOUSEHOLD';
    return HttpResponse.json({
      ...mockCashflowSeries,
      context,
    });
  }),
];
