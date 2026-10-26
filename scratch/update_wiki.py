with open('D:/Documentos/60_Referências/segundo-cerebro/wiki/pessoal/projetos/hub-open-finance.md', 'r', encoding='utf-8') as f:
    text = f.read()

new_section = """### 6.4 Como Zerar os Dados Financeiros (Limpeza Total)
Caso queira reiniciar todas as conexões e lançamentos sem perder as contas de usuário (ADMIN e MEMBER):
- **Pelo Frontend:** Acesse a aba **Conexões & Admin** (`/admin`), desça até a **Zona de Perigo**, clique em **"Zerar Todos os Dados Financeiros"**, digite `ZERAR` e confirme.
- **Pela API:** Chamada autenticada com token de administrador para `POST /api/v1/admin/reset-data`.
- **Por Script:** Executar `python scripts/reset_database_clean.py`.

---

"""

pos = text.find('## Related')
if pos != -1:
    text = text[:pos] + new_section + text[pos:]
    with open('D:/Documentos/60_Referências/segundo-cerebro/wiki/pessoal/projetos/hub-open-finance.md', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Wiki updated successfully')
