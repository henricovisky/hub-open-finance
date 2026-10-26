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
            # Varint length
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
                # Decode Value
                v_tag = val[0]
                v_wire = v_tag & 0x07
                v_field = v_tag >> 3
                if v_field == 1: # string
                    fields['value'] = val[2:].decode('utf-8', errors='ignore')
                elif v_field == 2: # float
                    import struct
                    fields['value'] = struct.unpack('<d', val[1:9])[0] if len(val)>=9 else None
                elif v_field == 3: # integer
                    # varint
                    v_int = 0
                    v_shift = 0
                    v_p = 1
                    while v_p < len(val):
                        b = val[v_p]
                        v_p += 1
                        v_int |= (b & 0x7F) << v_shift
                        if not (b & 0x80):
                            break
                        v_shift += 7
                    fields['value'] = v_int
                else:
                    fields['value'] = val
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

print("Datasets summary:")
for ds, rows in rows_by_table.items():
    print(f"  {ds}: {len(rows)} entities")

print("\nAccounts found:")
for acc_id, data in rows_by_table.get('accounts', {}).items():
    print(f"  ID: {acc_id} | Name: {data.get('name')} | Offbudget: {data.get('offbudget')} | Closed: {data.get('closed')}")

print("\nSample 5 Payees:")
for p_id, data in list(rows_by_table.get('payees', {}).items())[:5]:
    print(f"  {data.get('name')}")

print("\nSample 10 Transactions:")
for tx_id, data in list(rows_by_table.get('transactions', {}).items())[:10]:
    print(f"  Date: {data.get('date')} | Amount: {data.get('amount')} | Payee: {data.get('imported_payee') or data.get('payee')} | Category: {data.get('category')}")
