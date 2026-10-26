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

  const accounts = await actual.getAccounts();
  const uncategorized = [];

  for (const acc of accounts) {
    const txs = await actual.getTransactions(acc.id, '2020-01-01', '2030-12-31');
    for (const tx of txs) {
      if (!tx.category) {
        uncategorized.push({
          account: acc.name,
          date: tx.date,
          amount: tx.amount / 100.0,
          imported_payee: tx.imported_payee,
          notes: tx.notes,
          payee: tx.payee,
        });
      }
    }
  }

  console.log(`Total uncategorized: ${uncategorized.length}`);
  
  // Group by description/notes/imported_payee
  const map = new Map();
  for (const tx of uncategorized) {
    const desc = (tx.imported_payee || tx.notes || 'Sem Descrição').trim();
    if (!map.has(desc)) {
      map.set(desc, { count: 0, total: 0, examples: [] });
    }
    const entry = map.get(desc);
    entry.count++;
    entry.total += tx.amount;
    if (entry.examples.length < 2) entry.examples.push(tx);
  }

  // Sort by count descending
  const sorted = Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  for (const [desc, data] of sorted) {
    console.log(`${data.count}x | Total: R$ ${data.total.toFixed(2)} | "${desc}" | Ex: ${data.examples[0].account}`);
  }

  await actual.shutdown();
}

run().catch(console.error);
