import httpx

client = httpx.Client(base_url="http://localhost:8000")

# 1. Login as Admin
login_resp = client.post("/api/v1/auth/login", json={"email": "admin@exemplo.com", "password": "AdminPass123!Secure"})
print("Login status:", login_resp.status_code)
if login_resp.status_code != 200:
    print("Login error:", login_resp.text)
    exit(1)

data = login_resp.json()
token = data.get("access_token")
headers = {"Authorization": f"Bearer {token}"}

for ctx in ["CONSOLIDATED", "HOUSEHOLD", "PERSONAL", "INVESTMENT", "WORK"]:
    print(f"\n================ Testing context: {ctx} ================")
    # Overview
    r_ov = client.get(f"/api/v1/dashboard/overview?context={ctx}", headers=headers)
    print(f"Overview ({r_ov.status_code}): liquid_bal={r_ov.json().get('liquid_balance')}, inc={r_ov.json().get('monthly_income')}, exp={r_ov.json().get('monthly_expenses')}")

    # Cashflow series
    r_cf = client.get(f"/api/v1/cashflow/series?context={ctx}&granularity=day", headers=headers)
    cf_data = r_cf.json().get("data", {})
    print(f"Cashflow ({r_cf.status_code}): totals={cf_data.get('totals')}, points={len(cf_data.get('points', []))}")

    # Categories summary
    r_cat = client.get(f"/api/v1/categories/summary?context={ctx}", headers=headers)
    print(f"Categories ({r_cat.status_code}): count={len(r_cat.json()) if isinstance(r_cat.json(), list) else r_cat.text}")

    # Transactions
    r_tx = client.get(f"/api/v1/transactions?context={ctx}&page_size=5", headers=headers)
    print(f"Transactions ({r_tx.status_code}): total={r_tx.json().get('total')}, results={len(r_tx.json().get('results', []))}")

    # Cards
    r_cards = client.get(f"/api/v1/cards?context={ctx}", headers=headers)
    print(f"Cards ({r_cards.status_code}): count={len(r_cards.json()) if isinstance(r_cards.json(), list) else r_cards.text}")

    # Investments portfolio
    r_port = client.get(f"/api/v1/investments/portfolio?context={ctx}", headers=headers)
    print(f"Portfolio ({r_port.status_code}): count={len(r_port.json()) if isinstance(r_port.json(), list) else r_port.text}")
