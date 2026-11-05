from database import initialize, connect
initialize('shop.sqlite3')
with connect('shop.sqlite3') as db:
    for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name!='sqlite_sequence' ORDER BY name"):
        name=row[0]
        print(name, db.execute('SELECT COUNT(*) FROM '+name).fetchone()[0])
    print('foreign_key_check:',len(db.execute('PRAGMA foreign_key_check').fetchall()))
    print('integrity_check:',db.execute('PRAGMA integrity_check').fetchone()[0])
