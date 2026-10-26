export const mockAdminUser = {
  id: 'a0000000-0000-0000-0000-000000000001',
  name: 'Henrico (Admin)',
  email: 'admin@exemplo.com',
  role: 'ADMIN' as const,
  account_permissions: [],
  feature_permissions: {
    investments: true,
    reports: true,
    budgets: true,
  },
};

export const mockMemberUser = {
  id: 'm0000000-0000-0000-0000-000000000002',
  name: 'Membro Família',
  email: 'membro@exemplo.com',
  role: 'MEMBER' as const,
  account_permissions: [
    {
      account_id: 'acc-nubank-household-01',
      can_view: true,
      can_categorize: true,
    },
  ],
  feature_permissions: {
    investments: false,
    reports: false,
    budgets: true,
  },
};
