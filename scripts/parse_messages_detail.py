import sqlite3

conn = sqlite3.connect('actual-data/user-files/group-ee44640c-6fd8-4792-b510-474a95d32174.sqlite')
c = conn.cursor()

def decode_message(content):
    pos = 0
    fields = {}
    while pos < len(content):
        tag = content[pos]
        wire_type = tag & 0x07
        field_num = tag >> 3
        pos += 1
        if wire_type == 2:
            length = 0
            shift = 0
            while True:
                b = content[pos]
                pos += 1
                length |= (b & 0x7F) << shift
                if not (b & 0x80):
                    break
                shift += 7
            val = content[pos:pos+length]
            pos += length
            if field_num == 4: # Value submessage
                v_field = val[0] >> 3
                raw_val = val[2:]
                # strip type prefix: S:string, N:number, 0/1:boolean
                s = raw_val.decode('utf-8', errors='ignore')
                if s.startswith('S:'):
                    fields['value'] = s[2:]
                elif s.startswith('N:'):
                    try:
                        num = float(s[2:])
                        fields['value'] = int(num) if num.is_integer() else num
                    except:
                        fields['value'] = s[2:]
                elif s.startswith('0'):
                    fields['value'] = False
                elif s.startswith('1'):
                    fields['value'] = True
                else:
                    fields['value'] = s
            else:
                fields[field_num] = val.decode('utf-8', errors='ignore')
        else:
            break
    return fields

rows_by_table = {}
for ts, content in c.execute('SELECT timestamp, content FROM messages_binary'):
    m = decode_message(content)
    dataset = m.get(1)
    row_id = m.get(2)
    col = m.get(3)
    val = m.get('value')
    if dataset:
        if dataset not in rows_by_table:
            rows_by_table[dataset] = {}
        if row_id not in rows_by_table[dataset]:
            rows_by_table[dataset][row_id] = {}
        rows_by_table[dataset][row_id][col] = val

payees = rows_by_table.get('payees', {})
payee_names = {pid: pdata.get('name') for pid, pdata in payees.items()}

accounts = rows_by_table.get('accounts', {})
account_names = {aid: adata.get('name') for aid, adata in accounts.items()}

txs = rows_by_table.get('transactions', {})
print(f"Total Transactions: {len(txs)}")
print("\nTransactions Sample (first 25):")
for tx_id, data in list(txs.items())[:25]:
    date_str = str(data.get('date', ''))
    if len(date_str) == 8:
        date_fmt = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
    else:
        date_fmt = date_str
    amt = data.get('amount', 0)
    try:
        amt_brl = float(amt) / 100.0
    except:
        amt_brl = 0.0
    p_id = data.get('payee')
    payee_name = str(payee_names.get(p_id) or data.get('imported_payee') or data.get('notes') or 'Sem Beneficiario')
    acc_name = str(account_names.get(data.get('account')) or 'Conta ?')
    cat = str(data.get('category') or 'Sem Categoria')
    notes = str(data.get('notes') or '')
    print(f"[{date_fmt}] {acc_name[:15]:15} | R$ {amt_brl:8.2f} | {payee_name[:30]:30} | Notes: {notes[:20]}")
