const actual = require('@actual-app/api');
const path = require('path');
const fs = require('fs');

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

  const categories = await actual.getCategories();
  const catMap = new Map();
  for (const c of categories) {
    catMap.set(c.name, c.id);
  }

  const catCompras = catMap.get('Compras Pessoais e Online');
  const catLanches = catMap.get('Lanches e Conveniência');
  const catCombustivel = catMap.get('Combustível');
  const catRendimentos = catMap.get('Rendimentos e Juros');
  const catPixAvulso = catMap.get('Pequenos Pagamentos / Pix Avulso');
  const catCashback = catMap.get('Cashback e Investback');

  const accounts = await actual.getAccounts();
  let count = 0;

  for (const acc of accounts) {
    const txs = await actual.getTransactions(acc.id, '2020-01-01', '2030-12-31');
    for (const tx of txs) {
      if (tx.category) continue;

      const desc = `${tx.imported_payee || ''} ${tx.notes || ''}`.toUpperCase();
      let chosenCat = catPixAvulso;

      if (desc.includes('DELTA') || desc.includes('PAULOCESARGOMESDA')) {
        chosenCat = catCompras;
      } else if (desc.includes('ESTORNO')) {
        chosenCat = catCashback;
      } else if (desc.includes('FVSPANIFICADO') || desc.includes('MK IG2') || desc.includes('MK MESSEJANA') || desc.includes('EDUBOLO') || desc.includes('COSTA E SILVA')) {
        chosenCat = catLanches;
      } else if (desc.includes('REDE CEARA AQUIRAZ')) {
        chosenCat = catCombustivel;
      } else if (acc.name.includes('Poupança') || desc.includes('SEM DESCRIÇÃO') || desc.includes('SEM DESCRICAO')) {
        chosenCat = catRendimentos;
      }

      await actual.updateTransaction(tx.id, { category: chosenCat });
      count++;
    }
  }

  console.log(`Finalizadas mais ${count} transações!`);
  console.log('Sincronizando com o Actual Budget...');
  await actual.sync();
  console.log('100% das transações categorizadas com sucesso!');
  await actual.shutdown();
}

run().catch(console.error);
