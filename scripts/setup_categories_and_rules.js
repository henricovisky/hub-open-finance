/**
 * Script definitivo para organizar Contas, Grupos de Categorias,
 * Categorias e Regras Automáticas no Actual Budget via @actual-app/api.
 */

const actual = require('@actual-app/api');
const path = require('path');
const fs = require('fs');

// Mapeamento amigável de nomes das contas
const ACCOUNT_RENAME_MAP = {
  '3582236d-986a-4db9-aaec-d59f5c26a51f': 'Cartão Rico Visa Infinite',
  '5437aef2-66a6-4015-9a6d-d46578b80785': 'Nubank Conta Corrente',
  '80e9b8ce-e8ee-41a7-bf20-560164ee6aff': 'Nubank Cartão Platinum',
  '5a5105d1-be0f-42a4-9252-421dc953b131': 'Itaú Conta Corrente',
  'a29abf01-f2d5-4ae9-8fa3-c95bfd9624bd': 'Itaú Poupança (Tracking)',
  'c6dcaf8b-8a34-4952-9920-296def62ca7c': 'XP / Rico Investimentos (Tracking)',
  'abdf204d-0e4b-40eb-ba1d-3fa9d873559a': 'XP / Rico Custódia (Tracking)',
};

const CATEGORY_STRUCTURE = [
  {
    group: 'Moradia & Contas da Casa',
    categories: [
      { name: 'Energia Elétrica (Enel)', is_income: false },
      { name: 'Água e Esgoto (Cagece)', is_income: false },
      { name: 'Internet e Telefonia', is_income: false },
      { name: 'Condomínio e Aluguel', is_income: false },
      { name: 'Manutenção da Casa e Diarista', is_income: false },
    ],
  },
  {
    group: 'Alimentação & Mercado',
    categories: [
      { name: 'Supermercado', is_income: false },
      { name: 'Restaurantes e Delivery', is_income: false },
      { name: 'Lanches e Conveniência', is_income: false },
    ],
  },
  {
    group: 'Transporte',
    categories: [
      { name: 'Combustível', is_income: false },
      { name: 'Uber e Apps de Transporte', is_income: false },
      { name: 'Manutenção Moto / Veículo', is_income: false },
      { name: 'Estacionamento e Lavagem', is_income: false },
    ],
  },
  {
    group: 'Saúde & Cuidados',
    categories: [
      { name: 'Farmácia e Medicamentos', is_income: false },
      { name: 'Academia e Esportes (Wellhub)', is_income: false },
      { name: 'Consultas e Exames', is_income: false },
    ],
  },
  {
    group: 'Lazer, Compras & Assinaturas',
    categories: [
      { name: 'Streaming e Assinaturas', is_income: false },
      { name: 'Compras Pessoais e Online', is_income: false },
      { name: 'Lazer e Passeios', is_income: false },
    ],
  },
  {
    group: 'Família & Transferências',
    categories: [
      { name: 'Transferências Pessoais / Família', is_income: false },
    ],
  },
  {
    group: 'Investimentos & Reserva',
    categories: [
      { name: 'Aportes em Bolsa e Fundos', is_income: false },
      { name: 'Reserva e Cofrinhos', is_income: false },
    ],
  },
  {
    group: 'Rendas & Receitas',
    categories: [
      { name: 'Salário (3E Eficiência)', is_income: true },
      { name: 'Rendimentos e Juros', is_income: true },
      { name: 'Cashback e Investback', is_income: true },
      { name: 'Outras Receitas / Pix Recebido', is_income: true },
    ],
  },
];

const RULES_DEFINITION = [
  // Moradia
  { pattern: 'ENERGETICA DO CEARA', category: 'Energia Elétrica (Enel)' },
  { pattern: 'CAGECE', category: 'Água e Esgoto (Cagece)' },
  { pattern: 'KHA INFORMATICA', category: 'Internet e Telefonia' },
  { pattern: 'FAN R&V SECURITIZACAO', category: 'Condomínio e Aluguel' },
  { pattern: 'CONDOMINIO CIVIL', category: 'Condomínio e Aluguel' },
  { pattern: 'MARIA ERIVANDA', category: 'Manutenção da Casa e Diarista' },
  { pattern: 'Valdiza Arruda', category: 'Manutenção da Casa e Diarista' },

  // Alimentação
  { pattern: 'CENTER BOX', category: 'Supermercado' },
  { pattern: 'CENTERBOX', category: 'Supermercado' },
  { pattern: 'Vendbox', category: 'Lanches e Conveniência' },
  { pattern: 'vendbox', category: 'Lanches e Conveniência' },
  { pattern: 'Mack Vi', category: 'Lanches e Conveniência' },
  { pattern: 'BARATO COLETIVO', category: 'Restaurantes e Delivery' },
  { pattern: 'IFOOD', category: 'Restaurantes e Delivery' },

  // Transporte
  { pattern: 'POSTO NOBRE', category: 'Combustível' },
  { pattern: 'Posto Nobre', category: 'Combustível' },
  { pattern: 'POSTO', category: 'Combustível' },
  { pattern: 'Uber', category: 'Uber e Apps de Transporte' },
  { pattern: 'UBER', category: 'Uber e Apps de Transporte' },
  { pattern: 'FORT MOTOS', category: 'Manutenção Moto / Veículo' },

  // Saúde
  { pattern: 'Wellhub', category: 'Academia e Esportes (Wellhub)' },
  { pattern: 'EXTRA FARMA', category: 'Farmácia e Medicamentos' },
  { pattern: 'PAGUE MENOS', category: 'Farmácia e Medicamentos' },
  { pattern: 'DROGASIL', category: 'Farmácia e Medicamentos' },

  // Lazer e Compras
  { pattern: 'Amazonprime', category: 'Streaming e Assinaturas' },
  { pattern: 'AMAZON', category: 'Streaming e Assinaturas' },
  { pattern: 'Jim.com', category: 'Streaming e Assinaturas' },
  { pattern: 'Shopee', category: 'Compras Pessoais e Online' },
  { pattern: 'Shpp Brasil', category: 'Compras Pessoais e Online' },
  { pattern: 'JF REPASSE', category: 'Compras Pessoais e Online' },

  // Família
  { pattern: 'MARIA I B NASCIMENTO', category: 'Transferências Pessoais / Família' },
  { pattern: 'MARIA INGREDY', category: 'Transferências Pessoais / Família' },
  { pattern: 'EVADEILDA MARIA', category: 'Transferências Pessoais / Família' },
  { pattern: 'Rayssa Ribeiro', category: 'Transferências Pessoais / Família' },
  { pattern: 'João Elfredo', category: 'Transferências Pessoais / Família' },

  // Receitas
  { pattern: '3E EFICIENCIA ENERGETICA', category: 'Salário (3E Eficiência)' },
  { pattern: 'REND PAGO APLIC AUT MAIS', category: 'Rendimentos e Juros' },
  { pattern: 'Investback', category: 'Cashback e Investback' },
  { pattern: 'Pix recebido de Henrique Miranda', category: 'Outras Receitas / Pix Recebido' },

  // Investimentos
  { pattern: 'APLICACAO COFRINHOS', category: 'Reserva e Cofrinhos' },
  { pattern: 'OPERAÇÕES EM BOLSA', category: 'Aportes em Bolsa e Fundos' },
  { pattern: 'OPERACOES EM BOLSA', category: 'Aportes em Bolsa e Fundos' },
  { pattern: 'TED APLICAÇÃO FUNDO', category: 'Aportes em Bolsa e Fundos' },
];

async function run(password) {
  const tmpDir = path.join(__dirname, 'tmp_api_data');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  console.log('Conectando ao Actual Budget em http://localhost:5006 ...');
  await actual.init({
    dataDir: tmpDir,
    serverURL: 'http://localhost:5006',
    password: password,
  });

  const budgets = await actual.getBudgets();
  const targetBudget = budgets[0];
  if (!targetBudget) {
    throw new Error('Nenhum orçamento encontrado.');
  }

  console.log(`Carregando orçamento: "${targetBudget.name}" (${targetBudget.groupId}) ...`);
  await actual.downloadBudget(targetBudget.groupId);

  // 1. Renomear Contas para Nomes Amigáveis
  console.log('\n[1/4] Organizando nomes das contas...');
  const accounts = await actual.getAccounts();
  for (const acc of accounts) {
    const friendlyName = ACCOUNT_RENAME_MAP[acc.id];
    if (friendlyName && acc.name !== friendlyName) {
      console.log(`  • "${acc.name}" -> "${friendlyName}"`);
      await actual.updateAccount(acc.id, { name: friendlyName });
    }
  }

  // 2. Criar Grupos de Categorias e Categorias
  console.log('\n[2/4] Criando estrutura de categorias em Português...');
  const existingGroups = await actual.getCategoryGroups();
  const existingCategories = await actual.getCategories();
  const categoryMap = new Map();

  for (const cat of existingCategories) {
    categoryMap.set(cat.name, cat.id);
  }

  for (const groupDef of CATEGORY_STRUCTURE) {
    let group = existingGroups.find(g => g.name === groupDef.group);
    let groupId;
    if (!group) {
      console.log(`  + Grupo: ${groupDef.group}`);
      groupId = await actual.createCategoryGroup({ name: groupDef.group });
    } else {
      groupId = group.id;
    }

    for (const catDef of groupDef.categories) {
      if (!categoryMap.has(catDef.name)) {
        console.log(`    + Categoria: ${catDef.name}`);
        const catId = await actual.createCategory({
          name: catDef.name,
          group_id: groupId,
          is_income: catDef.is_income,
        });
        categoryMap.set(catDef.name, catId);
      }
    }
  }

  // 3. Criar Regras Automáticas
  console.log('\n[3/4] Registrando Regras Automáticas para futuras transações...');
  const existingRules = await actual.getRules();
  let rulesCreated = 0;

  for (const ruleDef of RULES_DEFINITION) {
    const catId = categoryMap.get(ruleDef.category);
    if (!catId) continue;

    const alreadyExists = existingRules.some(r =>
      JSON.stringify(r).includes(ruleDef.pattern)
    );

    if (!alreadyExists) {
      try {
        await actual.createRule({
          stage: 'pre',
          conditionsOp: 'or',
          conditions: [
            { field: 'imported_payee', op: 'contains', value: ruleDef.pattern },
            { field: 'notes', op: 'contains', value: ruleDef.pattern },
          ],
          actions: [
            { field: 'category', op: 'set', value: catId },
          ],
        });
        rulesCreated++;
      } catch (err) {
        console.warn(`  ! Aviso ao criar regra para "${ruleDef.pattern}":`, err.message);
      }
    }
  }
  console.log(`  Total de regras automáticas criadas: ${rulesCreated}`);

  // 4. Categorizar Retroativamente as 470 Transações
  console.log('\n[4/4] Categorizando transações existentes...');
  let updatedCount = 0;
  const reloadedAccounts = await actual.getAccounts();

  for (const acc of reloadedAccounts) {
    const txs = await actual.getTransactions(acc.id, '2020-01-01', '2030-12-31');
    for (const tx of txs) {
      if (tx.category) continue; // se já possui categoria, não sobrescreve

      const text = `${tx.imported_payee || ''} ${tx.notes || ''}`.toUpperCase();
      let matchedCatId = null;

      for (const ruleDef of RULES_DEFINITION) {
        if (text.includes(ruleDef.pattern.toUpperCase())) {
          matchedCatId = categoryMap.get(ruleDef.category);
          break;
        }
      }

      if (matchedCatId) {
        await actual.updateTransaction(tx.id, { category: matchedCatId });
        updatedCount++;
      }
    }
  }

  console.log(`  Sucesso: ${updatedCount} transações foram categorizadas automaticamente!`);
  console.log('\nSincronizando todas as mudanças com o servidor...');
  await actual.sync();
  console.log('Tudo pronto! Todas as contas, categorias e regras estão atualizadas.');
  await actual.shutdown();
}

const userPassword = process.argv[2] || 'Hmn@2022';
run(userPassword).catch(err => {
  console.error('Erro na execução:', err);
  process.exit(1);
});
