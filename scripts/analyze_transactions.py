import sqlite3
from collections import Counter

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
            if field_num == 4:
                raw_val = val[2:]
                s = raw_val.decode('utf-8', errors='ignore')
                if s.startswith('S:'):
                    fields['value'] = s[2:]
                elif s.startswith('N:'):
                    try:
                        num = float(s[2:])
                        fields['value'] = int(num) if num.is_integer() else num
                    except:
                        fields['value'] = s[2:]
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
txs = rows_by_table.get('transactions', {})

counts = Counter()
amounts = Counter()

for tx_id, data in txs.items():
    p_id = data.get('payee')
    name = payee_names.get(p_id) or data.get('imported_payee') or data.get('notes') or 'Sem Descrição'
    name_clean = str(name).strip()
    amt = data.get('amount', 0)
    try:
        amt_f = float(amt) / 100.0
    except:
        amt_f = 0.0
    counts[name_clean] += 1
    amounts[name_clean] += amt_f

print(f"Total Unique Payees/Descriptions: {len(counts)}")
print("\nTop 40 most frequent transactions:")
for name, cnt in counts.most_common(40):
    tot = amounts[name]
    print(f"{cnt:3d}x | Total: R$ {tot:10.2f} | {name}")
