/**
 * Script para categorizar todas as transações remanescentes no Actual Budget.
 */

const actual = require('@actual-app/api');
const path = require('path');
const fs = require('fs');

const NEW_CATEGORY_STRUCTURE = [
  {
    group: 'Educação',
    categories: [
      { name: 'Cursos e Estudos', is_income: false },
    ],
  },
  {
    group: 'Moradia & Contas da Casa',
    categories: [
      { name: 'Impostos e Taxas (IPTU, Sefaz, Detran)', is_income: false },
    ],
  },
  {
    group: 'Saúde & Cuidados',
    categories: [
      { name: 'Beleza e Estética', is_income: false },
      { name: 'Pet Shop e Veterinário', is_income: false },
    ],
  },
  {
    group: 'Lazer, Compras & Assinaturas',
    categories: [
      { name: 'Hospedagem e Viagens (Booking, etc)', is_income: false },
      { name: 'Cinema, Ingressos e Passeios', is_income: false },
      { name: 'Doações e Igreja', is_income: false },
      { name: 'Utilidades Domésticas', is_income: false },
    ],
  },
  {
    group: 'Família & Transferências',
    categories: [
      { name: 'Transferência entre Contas Próprias', is_income: false },
      { name: 'Pagamento de Fatura de Cartão', is_income: false },
      { name: 'Pequenos Pagamentos / Pix Avulso', is_income: false },
    ],
  },
  {
    group: 'Rendas & Receitas',
    categories: [
      { name: 'Consultoria e Serviços Extras', is_income: true },
    ],
  },
];

const EXTENDED_RULES = [
  // Educação
  { pattern: 'Gran Educacao', category: 'Cursos e Estudos' },

  // Impostos e Taxas
  { pattern: 'SEFAZ CEARA', category: 'Impostos e Taxas (IPTU, Sefaz, Detran)' },
  { pattern: 'PREF MUN FORTALEZA', category: 'Impostos e Taxas (IPTU, Sefaz, Detran)' },
  { pattern: 'SECRETARIA DA FAZENDA', category: 'Impostos e Taxas (IPTU, Sefaz, Detran)' },

  // Veículo e Manutenção
  { pattern: 'Jc Autos', category: 'Manutenção Moto / Veículo' },
  { pattern: 'Trok Lub', category: 'Manutenção Moto / Veículo' },
  { pattern: 'fabiomotos', category: 'Manutenção Moto / Veículo' },

  // Supermercados
  { pattern: 'MERCADINHO SAO LUIZ', category: 'Supermercado' },
  { pattern: 'EXTRA HIPER', category: 'Supermercado' },
  { pattern: 'OFERTASSO SUPERMERCADO', category: 'Supermercado' },
  { pattern: 'MACHADO SUPERMERCADO', category: 'Supermercado' },
  { pattern: 'SENDAS DISTRIBUIDORA', category: 'Supermercado' },
  { pattern: 'frangolandia', category: 'Supermercado' },
  { pattern: 'LUANDA MERCADINHO', category: 'Supermercado' },
  { pattern: 'M ARAUJO COMERCIO', category: 'Supermercado' },

  // Restaurantes e Delivery
  { pattern: 'ARCOS DOURADOS', category: 'Restaurantes e Delivery' },
  { pattern: 'KFC', category: 'Restaurantes e Delivery' },
  { pattern: 'AUSTRALIA BURGUERES', category: 'Restaurantes e Delivery' },
  { pattern: 'LUCCO BURGUER', category: 'Restaurantes e Delivery' },
  { pattern: 'Ponto Esfiha', category: 'Restaurantes e Delivery' },
  { pattern: 'Oficina Della Pizza', category: 'Restaurantes e Delivery' },
  { pattern: 'Cantinho Do Frango', category: 'Restaurantes e Delivery' },
  { pattern: 'GALETOSGRILL', category: 'Restaurantes e Delivery' },
  { pattern: '99 food', category: 'Restaurantes e Delivery' },
  { pattern: '50 SABORES', category: 'Restaurantes e Delivery' },
  { pattern: 'Pastel Na Praca', category: 'Restaurantes e Delivery' },
  { pattern: 'TAPIOCARIA MJ', category: 'Restaurantes e Delivery' },
  { pattern: 'KALZONE', category: 'Restaurantes e Delivery' },
  { pattern: 'BEC WS', category: 'Restaurantes e Delivery' },
  { pattern: 'Petiscaria', category: 'Restaurantes e Delivery' },

  // Padaria, Cafeteria e Lanches
  { pattern: 'Mercafe', category: 'Lanches e Conveniência' },
  { pattern: 'Panificadora M E M', category: 'Lanches e Conveniência' },
  { pattern: 'PANIFICADORA', category: 'Lanches e Conveniência' },
  { pattern: 'PANE VIDA', category: 'Lanches e Conveniência' },
  { pattern: 'PADARIA', category: 'Lanches e Conveniência' },
  { pattern: 'EDUBOLO', category: 'Lanches e Conveniência' },
  { pattern: 'Edubolo', category: 'Lanches e Conveniência' },
  { pattern: 'Bolos E Doces', category: 'Lanches e Conveniência' },
  { pattern: 'DOM BEIJINHO', category: 'Lanches e Conveniência' },
  { pattern: 'Dom Beijinho', category: 'Lanches e Conveniência' },
  { pattern: 'COFFEEBEACH', category: 'Lanches e Conveniência' },
  { pattern: 'Emporio De Fatima', category: 'Lanches e Conveniência' },

  // Compras Pessoais e Online
  { pattern: 'AliExpress', category: 'Compras Pessoais e Online' },
  { pattern: 'Mercadolivre', category: 'Compras Pessoais e Online' },
  { pattern: 'Enjoei', category: 'Compras Pessoais e Online' },
  { pattern: 'LOJAS RENNER', category: 'Compras Pessoais e Online' },
  { pattern: 'ALYCE S CALCADOS', category: 'Compras Pessoais e Online' },
  { pattern: 'Lasa', category: 'Compras Pessoais e Online' },
  { pattern: 'ARMARINHO JOAO ANJO', category: 'Compras Pessoais e Online' },
  { pattern: 'OURICO DO MAR', category: 'Compras Pessoais e Online' },
  { pattern: 'telmamariadas', category: 'Compras Pessoais e Online' },
  { pattern: 'M4 PRODUTOS', category: 'Compras Pessoais e Online' },

  // Utilidades Domésticas
  { pattern: 'Freitas', category: 'Utilidades Domésticas' },
  { pattern: 'MUNDO DAS UTILIDADES', category: 'Utilidades Domésticas' },
  { pattern: 'Ta Tudo Aqui', category: 'Utilidades Domésticas' },
  { pattern: 'Fort Tudo', category: 'Utilidades Domésticas' },
  { pattern: 'W DA SILVA LIMA', category: 'Utilidades Domésticas' },

  // Beleza, Estética e Farmácia
  { pattern: 'oboticario', category: 'Beleza e Estética' },
  { pattern: 'HNA*QDB', category: 'Beleza e Estética' },
  { pattern: 'Sibelle', category: 'Beleza e Estética' },
  { pattern: 'SameaVCoelho', category: 'Beleza e Estética' },
  { pattern: 'AnnaRaquelMouraRe', category: 'Beleza e Estética' },
  { pattern: 'TOQUE ALECRIM', category: 'Beleza e Estética' },
  { pattern: 'Farmacias Aldesul', category: 'Farmácia e Medicamentos' },
  { pattern: 'Farm Sao Bento', category: 'Farmácia e Medicamentos' },
  { pattern: 'Comercial De Medicamen', category: 'Farmácia e Medicamentos' },

  // Tecnologia e Telefonia
  { pattern: 'Google One', category: 'Streaming e Assinaturas' },
  { pattern: 'GOOGLE BRASIL', category: 'Streaming e Assinaturas' },
  { pattern: 'tim', category: 'Internet e Telefonia' },

  // Viagens, Hospedagem e Lazer
  { pattern: 'Booking.Com', category: 'Hospedagem e Viagens (Booking, etc)' },
  { pattern: 'BOOKING', category: 'Hospedagem e Viagens (Booking, etc)' },
  { pattern: 'VIACAO COMETA', category: 'Hospedagem e Viagens (Booking, etc)' },
  { pattern: 'INGRESSO.COM', category: 'Cinema, Ingressos e Passeios' },
  { pattern: 'SHOPPING CENTER', category: 'Cinema, Ingressos e Passeios' },
  { pattern: 'Iguatemi', category: 'Cinema, Ingressos e Passeios' },
  { pattern: 'CAIXA LOTERIAS', category: 'Lazer e Passeios' },

  // Estacionamento
  { pattern: 'GRAND PARKING', category: 'Estacionamento e Lavagem' },
  { pattern: 'NE ESTACIONAMENTO', category: 'Estacionamento e Lavagem' },
  { pattern: 'Estacon Estacionament', category: 'Estacionamento e Lavagem' },

  // Doações e Igreja
  { pattern: 'CARMELO SANTA TERESINHA', category: 'Doações e Igreja' },
  { pattern: 'DIOCESE DE ITAPIPOCA', category: 'Doações e Igreja' },
  { pattern: 'MITRA ARQUIDIOCESANA', category: 'Doações e Igreja' },

  // Pet
  { pattern: 'Megan Pet', category: 'Pet Shop e Veterinário' },

  // Academia
  { pattern: 'Mk Fitness', category: 'Academia e Esportes (Wellhub)' },

  // Receitas e Consultoria
  { pattern: 'APPROVARE CONSULTORIA', category: 'Consultoria e Serviços Extras' },
  { pattern: '693.970.826-04', category: 'Outras Receitas / Pix Recebido' },

  // Transferências entre Contas Próprias & Faturas
  { pattern: '042.928.933-22', category: 'Transferência entre Contas Próprias' },
  { pattern: 'Transferência recebida da conta digital', category: 'Transferência entre Contas Próprias' },
  { pattern: 'Saída Aplic Automat Cofrinhos', category: 'Reserva e Cofrinhos' },
  { pattern: 'Pagamento recebido', category: 'Pagamento de Fatura de Cartão' },
  { pattern: 'Pagamentos Validos Normais', category: 'Pagamento de Fatura de Cartão' },
  { pattern: 'Pagamento de fatura', category: 'Pagamento de Fatura de Cartão' },
  { pattern: 'PAGAMENTO DE FATURA', category: 'Pagamento de Fatura de Cartão' },
  { pattern: 'BANCO XP S.A', category: 'Pagamento de Fatura de Cartão' },
  { pattern: 'WILL FINANCEIRA', category: 'Pagamento de Fatura de Cartão' },
  { pattern: 'NU PAGAMENTOS', category: 'Pagamento de Fatura de Cartão' },
];

async function run() {
  const tmpDir = path.join(__dirname, 'tmp_api_data');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  await actual.init({
    dataDir: tmpDir,
    serverURL: 'http://localhost:5006',
    password: 'Hmn@2022',
  });

  const budgets = await actual.getBudgets();
  await actual.downloadBudget(budgets[0].groupId);

  // 1. Criar categorias complementares
  const existingGroups = await actual.getCategoryGroups();
  const existingCategories = await actual.getCategories();
  const categoryMap = new Map();

  for (const cat of existingCategories) {
    categoryMap.set(cat.name, cat.id);
  }

  for (const groupDef of NEW_CATEGORY_STRUCTURE) {
    let group = existingGroups.find(g => g.name === groupDef.group);
    let groupId;
    if (!group) {
      groupId = await actual.createCategoryGroup({ name: groupDef.group });
    } else {
      groupId = group.id;
    }

    for (const catDef of groupDef.categories) {
      if (!categoryMap.has(catDef.name)) {
        console.log(`+ Nova Categoria: ${catDef.name} (${groupDef.group})`);
        const catId = await actual.createCategory({
          name: catDef.name,
          group_id: groupId,
          is_income: catDef.is_income,
        });
        categoryMap.set(catDef.name, catId);
      }
    }
  }

  // 2. Registrar regras
  const existingRules = await actual.getRules();
  let newRulesCount = 0;

  for (const ruleDef of EXTENDED_RULES) {
    const catId = categoryMap.get(ruleDef.category);
    if (!catId) continue;

    const exists = existingRules.some(r => JSON.stringify(r).includes(ruleDef.pattern));
    if (!exists) {
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
        newRulesCount++;
      } catch (err) {
        // Ignora duplicatas
      }
    }
  }
  console.log(`Novas regras criadas: ${newRulesCount}`);

  // 3. Atualizar transações remanescentes
  const accounts = await actual.getAccounts();
  let updatedCount = 0;
  let remainingUncategorized = 0;

  for (const acc of accounts) {
    const txs = await actual.getTransactions(acc.id, '2020-01-01', '2030-12-31');
    for (const tx of txs) {
      if (tx.category) continue;

      const text = `${tx.imported_payee || ''} ${tx.notes || ''}`.toUpperCase();
      let matchedCatId = null;

      for (const ruleDef of EXTENDED_RULES) {
        if (text.includes(ruleDef.pattern.toUpperCase())) {
          matchedCatId = categoryMap.get(ruleDef.category);
          break;
        }
      }

      // Se ainda não deu match, mas tem CPF de terceiro ou nome de pessoa física em transferência:
      if (!matchedCatId) {
        // Verifica se é transferência Pix de pessoa física (contém números de CPF ou nomes específicos)
        const isPixPessoa = /\d{3}\.\d{3}\.\d{3}-\d{2}/.test(text) || tx.account === 'Nubank Conta Corrente' || tx.account === 'Itaú Conta Corrente';
        if (isPixPessoa && (tx.amount < 0)) {
          matchedCatId = categoryMap.get('Pequenos Pagamentos / Pix Avulso');
        } else if (isPixPessoa && tx.amount > 0) {
          matchedCatId = categoryMap.get('Outras Receitas / Pix Recebido');
        }
      }

      if (matchedCatId) {
        await actual.updateTransaction(tx.id, { category: matchedCatId });
        updatedCount++;
      } else {
        remainingUncategorized++;
      }
    }
  }

  console.log(`Transações categorizadas nesta rodada: ${updatedCount}`);
  console.log(`Transações ainda sem categoria: ${remainingUncategorized}`);

  console.log('Sincronizando com o Actual Budget...');
  await actual.sync();
  console.log('Concluído!');
  await actual.shutdown();
}

run().catch(console.error);
