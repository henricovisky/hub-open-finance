import urllib.request
import json

# 1. Login
req = urllib.request.Request(
    'http://localhost:8000/api/v1/auth/login',
    data=json.dumps({'email': 'admin@exemplo.com', 'password': 'AdminPass123!Secure'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
resp = urllib.request.urlopen(req)
token = json.loads(resp.read().decode('utf-8'))['access_token']
print('1. Login OK, token obtained.')

headers = {'Authorization': f'Bearer {token}'}

def get_json(url):
    r = urllib.request.Request(url, headers=headers)
    res = urllib.request.urlopen(r)
    return res.status, json.loads(res.read().decode('utf-8'))

# 2. Categories CONSOLIDATED
st, cat_data = get_json('http://localhost:8000/api/v1/categories/summary?context=CONSOLIDATED')
print(f'2. Categories CONSOLIDATED: HTTP {st}, items: {len(cat_data)}')
if cat_data:
    print('   Top category:', cat_data[0]['name'], 'Current:', cat_data[0]['current_amount'], '3M Avg:', cat_data[0]['average_3m'])

# 3. Cards CONSOLIDATED
st, cards_data = get_json('http://localhost:8000/api/v1/cards?context=CONSOLIDATED')
print(f'3. Cards CONSOLIDATED: HTTP {st}, items: {len(cards_data)}')
for c in cards_data:
    print('   Card:', c['name'], 'Balance:', c['current_balance'], 'Due:', c['due_day'], 'Closing:', c['closing_day'])

# 4. Cashflow Month CONSOLIDATED
st, cf_month = get_json('http://localhost:8000/api/v1/cashflow/series?granularity=month&context=CONSOLIDATED')
pts = cf_month['data']['points']
print(f'4. Cashflow Month CONSOLIDATED: HTTP {st}, points: {len(pts)}')
for p in pts[-3:]:
    print('   Point', p['date'], 'Income:', p['income'], 'Expenses:', p['expenses'], 'Net:', p['net'])

# 5. Cashflow Week CONSOLIDATED
st, cf_week = get_json('http://localhost:8000/api/v1/cashflow/series?granularity=week&context=CONSOLIDATED')
print(f'5. Cashflow Week CONSOLIDATED: HTTP {st}, points: {len(cf_week["data"]["points"])}')

# 6. Cashflow Day CONSOLIDATED
st, cf_day = get_json('http://localhost:8000/api/v1/cashflow/series?granularity=day&context=CONSOLIDATED')
print(f'6. Cashflow Day CONSOLIDATED: HTTP {st}, points: {len(cf_day["data"]["points"])}')

# 7. Dashboard Overview CONSOLIDATED
st, ov = get_json('http://localhost:8000/api/v1/dashboard/overview?context=CONSOLIDATED')
print(f'7. Overview CONSOLIDATED: HTTP {st}, Liquid: {ov["liquid_balance"]}, Income: {ov["monthly_income"]}, Expenses: {ov["monthly_expenses"]}')

# 8. Accounts CONSOLIDATED
st, accs = get_json('http://localhost:8000/api/v1/accounts?context=CONSOLIDATED')
print(f'8. Accounts CONSOLIDATED: HTTP {st}, count: {len(accs)}')

# 9. Transactions CONSOLIDATED
st, txs = get_json('http://localhost:8000/api/v1/transactions?context=CONSOLIDATED&page_size=10')
print(f'9. Transactions CONSOLIDATED: HTTP {st}, total: {txs["total"]}, returned: {len(txs["results"])}')

# 10. SPA static routes
spa_req = urllib.request.Request('http://localhost:8000/categorias')
spa_res = urllib.request.urlopen(spa_req)
print(f'10. SPA /categorias: HTTP {spa_res.status}, length: {len(spa_res.read().decode("utf-8"))}')
