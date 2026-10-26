wiki_path = r"D:\Documentos\60_Referências\segundo-cerebro\wiki\pessoal\projetos\hub-open-finance.md"
with open(wiki_path, "r", encoding="utf-8") as f:
    content = f.read()

old_sec = """### 6.3 Como Importar Contas Conectadas na Pluggy
Como contas gratuitas da Pluggy possuem restrição `LIST_ITEMS_FEATURE_NOT_ENABLED` (não permitindo enumeração cega), a importação deve ser feita informando os IDs das conexões geradas:
```bash
python scripts/import_connected_pluggy_items.py <ITEM_ID_1> <ITEM_ID_2>
```
Ou clicando no botão **"+ Conectar"** na aba *Conexões* do próprio app web, abrindo o widget oficial da Pluggy."""

new_sec = """### 6.3 Como Importar Contas Conectadas na Pluggy
Como contas gratuitas ou do *Meu Pluggy* possuem restrição `LIST_ITEMS_FEATURE_NOT_ENABLED` (não permitindo enumeração cega), a importação e sincronização ocorrem das seguintes formas:
1. **Pelo Widget Integrado:** Clicando no botão **"Conectar Instituição"** na página de Administração (`/admin`).
2. **Por Item ID na Interface:** Na seção **"Importar Conexão Existente por Item ID (Meu Pluggy)"** da tela de Administração, colando o ID da conexão e clicando em **"Importar & Sincronizar"**.
3. **Por Script Backend:** Executando no terminal:
```bash
python scripts/import_connected_pluggy_items.py <ITEM_ID_1> <ITEM_ID_2>
```"""

if old_sec in content:
    content = content.replace(old_sec, new_sec)
    with open(wiki_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Wiki updated successfully!")
else:
    # Try normalizing newlines
    content_norm = content.replace("\r\n", "\n")
    old_sec_norm = old_sec.replace("\r\n", "\n")
    new_sec_norm = new_sec.replace("\r\n", "\n")
    if old_sec_norm in content_norm:
        content_norm = content_norm.replace(old_sec_norm, new_sec_norm)
        with open(wiki_path, "w", encoding="utf-8") as f:
            f.write(content_norm)
        print("Wiki updated with normalized newlines!")
    else:
        print("Could not match section in wiki file.")
