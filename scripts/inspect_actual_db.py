import sqlite3
import glob

for db_path in glob.glob('actual-data/**/*.sqlite', recursive=True):
    print('=== DB:', db_path)
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cursor.fetchall()]
        print('Tables:', tables)
        for t in tables:
            cursor.execute(f'SELECT count(*) FROM "{t}"')
            print(f'  {t}: {cursor.fetchone()[0]} rows')
    except Exception as e:
        print('Error:', e)
