import zipfile
import sqlite3
import tempfile
import os

blob_path = 'actual-data/user-files/file-1a3386d4-3042-4beb-90d8-150f69caa818.blob'
with zipfile.ZipFile(blob_path, 'r') as z:
    tmpdir = tempfile.mkdtemp()
    db_file = z.extract('db.sqlite', tmpdir)
    print('metadata.json:', z.read('metadata.json').decode('utf-8'))
    conn = sqlite3.connect(db_file)
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in c.fetchall()]
    print('Tables in db.sqlite:', tables)
    for t in ['accounts', 'categories', 'category_groups', 'payees', 'transactions', 'rules']:
        if t in tables:
            c.execute(f'SELECT count(*) FROM {t}')
            print(f'  {t}: {c.fetchone()[0]} rows')
    
    print('\nAccounts:')
    for row in c.execute('SELECT id, name, offbudget, closed FROM accounts'):
        print(' ', row)
    
    print('\nCategory Groups & Categories:')
    for row in c.execute('SELECT cg.name, c.name, c.is_income FROM categories c JOIN category_groups cg ON c.cat_group = cg.id'):
        print(' ', row)

    print('\nSample 10 Transactions:')
    for row in c.execute('SELECT date, amount, payee, notes, imported_payee, category FROM transactions LIMIT 10'):
        print(' ', row)
