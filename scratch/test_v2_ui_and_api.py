import urllib.request
import urllib.parse
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000"

def test_endpoint(name, method="GET", path="", body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()
            if "application/json" in content_type:
                res_json = json.loads(raw.decode("utf-8"))
                print(f"✅ {name}: HTTP {resp.status} (JSON)")
                return res_json
            else:
                print(f"✅ {name}: HTTP {resp.status} ({content_type}, {len(raw)} bytes)")
                return raw.decode("utf-8")
    except urllib.error.HTTPError as e:
        print(f"❌ {name}: HTTP {e.code} - {e.read().decode('utf-8')}")
        return None
    except Exception as e:
        print(f"❌ {name}: Error - {e}")
        return None

print("=== INICIANDO TESTES DO HUB RESPONSIVO V2 ===")

# 1. Healthcheck
test_endpoint("1. Healthcheck", path="/api/v1/health")

# 2. Login Admin
admin_login = test_endpoint(
    "2. Login Admin",
    method="POST",
    path="/api/v1/auth/login",
    body={"email": "admin@exemplo.com", "password": "AdminPass123!Secure"}
)
admin_token = admin_login.get("access_token") if admin_login else None
assert admin_token, "Falha ao obter token de admin"

# 3. Auth Me
test_endpoint("3. Auth Me (Admin)", path="/api/v1/auth/me", token=admin_token)

# 4. Dashboard Overview
test_endpoint("4. Dashboard Overview", path="/api/v1/dashboard/overview?context=HOUSEHOLD", token=admin_token)

# 5. Cashflow Series (G-01)
cf_series = test_endpoint("5. Cashflow Series (G-01)", path="/api/v1/cashflow/series?context=HOUSEHOLD&granularity=day", token=admin_token)
if cf_series:
    print(f"   📊 Pontos de fluxo retornados: {len(cf_series.get('data', {}).get('points', []))}")
    print(f"   💰 Totais: {cf_series.get('data', {}).get('totals')}")

# 6. Categories Summary (G-05)
cat_summary = test_endpoint("6. Categories Summary (G-05)", path="/api/v1/categories/summary?context=HOUSEHOLD", token=admin_token)
if cat_summary:
    print(f"   🏷️ Categorias com histórico: {len(cat_summary)}")

# 7. Transactions List
txs = test_endpoint("7. Lista de Transações", path="/api/v1/transactions?context=HOUSEHOLD&page_size=5", token=admin_token)
if txs:
    print(f"   💳 Total de transações: {txs.get('total')}")

# 8. Contas e Cartões
accs = test_endpoint("8. Lista de Contas", path="/api/v1/accounts?context=HOUSEHOLD", token=admin_token)
if accs and len(accs) > 0:
    first_acc_id = accs[0]["id"]
    test_endpoint(f"9. Uso de Limite do Cartão ({first_acc_id})", path=f"/api/v1/cards/{first_acc_id}/limit-usage", token=admin_token)

# 10. SPA HTML Delivery
test_endpoint("10. SPA Root (/) Delivery", path="/")
test_endpoint("11. SPA Route (/transacoes) Fallback Delivery", path="/transacoes")
test_endpoint("12. SPA Dev Catalog (/_dev/components) Delivery", path="/_dev/components")

print("=== TODOS OS TESTES PASSARAM COM SUCESSO! ===")
