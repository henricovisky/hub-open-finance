const actual = require('@actual-app/api');
const path = require('path');
const fs = require('fs');

async function test() {
  const tmpDir = path.join(__dirname, 'tmp_api_data');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  try {
    await actual.init({
      dataDir: tmpDir,
      serverURL: 'http://localhost:5006',
      password: 'test',
    });
    console.log('Connected to server!');
    const budgets = await actual.getBudgets();
    console.log('Budgets:', budgets);
  } catch (err) {
    console.error('Init error:', err.message);
  }
}

test();
