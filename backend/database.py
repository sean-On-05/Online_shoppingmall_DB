"""Relational persistence; API dictionaries keep the existing frontend contract."""
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from werkzeug.security import generate_password_hash

BASE = Path(__file__).resolve().parent

@contextmanager
def connect(path):
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        with db:
            yield db
    finally:
        db.close()

def customer_id(db, key):
    row = db.execute('SELECT customer_id FROM CUSTOMER WHERE username=?', (key,)).fetchone()
    return row[0] if row else None

def load_state(db):
    products = []
    for r in db.execute('SELECT p.*, c.category_name, COALESCE((SELECT SUM(quantity) FROM INVENTORY i WHERE i.product_id=p.product_id),0) AS stock FROM PRODUCT p JOIN CATEGORY c USING(category_id) ORDER BY p.product_id DESC'):
        p = dict(id=r['product_id'], name=r['product_name'], category=r['category_name'], price=r['price'], stock=r['stock'], image=r['image'], description=r['description'])
        if r['original_price'] is not None: p['originalPrice'] = r['original_price']
        if r['label'] is not None: p['label'] = r['label']
        products.append(p)
    carts = {r['owner_key']: [dict(productId=i['product_id'], quantity=i['quantity']) for i in db.execute('SELECT * FROM CART_ITEM WHERE cart_id=?', (r['cart_id'],))] for r in db.execute('SELECT * FROM CART')}
    orders = []
    for r in db.execute('SELECT * FROM ORDERS ORDER BY order_id DESC'):
        shipping = db.execute('SELECT * FROM SHIPMENT WHERE order_id=?', (r['order_id'],)).fetchone()
        payment = db.execute('SELECT * FROM PAYMENT WHERE order_id=?', (r['order_id'],)).fetchone()
        items = [dict(productId=i['original_product_id'], name=i['product_name'], image=i['image'], quantity=i['quantity'], price=i['unit_price']) for i in db.execute('SELECT * FROM ORDER_ITEM WHERE order_id=? ORDER BY order_item_id', (r['order_id'],))]
        orders.append(dict(id=r['order_code'], owner=r['owner_key'], createdAt=r['order_date'], subtotal=r['subtotal'], shippingFee=r['shipping_fee'], total=r['total_amount'], status=r['order_status'], payment=payment['payment_method'], items=items, shipping=dict(recipient=shipping['recipient'], phone=shipping['phone'], postalCode=shipping['postal_code'], address=shipping['shipping_address'], addressDetail=shipping['address_detail'], memo=shipping['memo'])))
    return dict(products=products, carts=carts, orders=orders)

def save_state(db, state):
    # Mutations run under BEGIN IMMEDIATE; unchanged order snapshots are never rewritten.
    ids = {p['id'] for p in state['products']}
    for p in state['products']:
        db.execute('INSERT OR IGNORE INTO CATEGORY(category_name) VALUES (?)', (p['category'],))
        category = db.execute('SELECT category_id FROM CATEGORY WHERE category_name=?', (p['category'],)).fetchone()[0]
        db.execute('''INSERT INTO PRODUCT(product_id,category_id,product_name,price,original_price,image,description,label,status) VALUES (?,?,?,?,?,?,?,?,?)
          ON CONFLICT(product_id) DO UPDATE SET category_id=excluded.category_id,product_name=excluded.product_name,price=excluded.price,original_price=excluded.original_price,image=excluded.image,description=excluded.description,label=excluded.label,status=excluded.status''', (p['id'],category,p['name'],p['price'],p.get('originalPrice'),p['image'],p['description'],p.get('label'),'판매중' if p['stock'] else '품절'))
        # Current UI edits total stock. Increases go to the default warehouse;
        # reductions consume existing warehouse rows without losing their identities.
        rows = db.execute('SELECT warehouse_id,quantity FROM INVENTORY WHERE product_id=? ORDER BY warehouse_id', (p['id'],)).fetchall()
        delta = p['stock'] - sum(r['quantity'] for r in rows)
        if delta >= 0:
            db.execute('INSERT INTO INVENTORY VALUES (?,1,?) ON CONFLICT(product_id,warehouse_id) DO UPDATE SET quantity=quantity+excluded.quantity', (p['id'],delta))
        else:
            remaining = -delta
            for r in rows:
                take = min(remaining,r['quantity'])
                db.execute('UPDATE INVENTORY SET quantity=quantity-? WHERE product_id=? AND warehouse_id=?',(take,p['id'],r['warehouse_id']))
                remaining -= take
    for r in db.execute('SELECT product_id FROM PRODUCT').fetchall():
        if r[0] not in ids: db.execute('DELETE FROM PRODUCT WHERE product_id=?',(r[0],))
    for r in db.execute('SELECT cart_id,owner_key FROM CART').fetchall():
        if r['owner_key'] not in state['carts']: db.execute('DELETE FROM CART WHERE cart_id=?',(r['cart_id'],))
    for key, items in state['carts'].items():
        db.execute('INSERT INTO CART(customer_id,owner_key) VALUES (?,?) ON CONFLICT(owner_key) DO UPDATE SET customer_id=excluded.customer_id',(customer_id(db,key),key))
        cid = db.execute('SELECT cart_id FROM CART WHERE owner_key=?',(key,)).fetchone()[0]
        db.execute('DELETE FROM CART_ITEM WHERE cart_id=?',(cid,))
        db.executemany('INSERT INTO CART_ITEM VALUES (?,?,?)',[(cid,i['productId'],i['quantity']) for i in items])
    for o in reversed(state['orders']):
        existing = db.execute('SELECT order_id FROM ORDERS WHERE order_code=?',(o['id'],)).fetchone()
        if existing:
            oid = existing[0]
            db.execute('UPDATE ORDERS SET customer_id=?,owner_key=?,order_status=? WHERE order_id=?',(customer_id(db,o['owner']),o['owner'],o['status'],oid))
            db.execute('UPDATE SHIPMENT SET shipping_status=? WHERE order_id=?',(o['status'],oid))
            if o['status']=='취소': db.execute("UPDATE PAYMENT SET payment_status='취소' WHERE order_id=?",(oid,))
            continue
        oid = db.execute('INSERT INTO ORDERS(order_code,customer_id,owner_key,order_date,subtotal,shipping_fee,total_amount,order_status) VALUES (?,?,?,?,?,?,?,?)',(o['id'],customer_id(db,o['owner']),o['owner'],o['createdAt'],o['subtotal'],o['shippingFee'],o['total'],o['status'])).lastrowid
        for i in o['items']:
            db.execute('INSERT INTO ORDER_ITEM(order_id,product_id,original_product_id,product_name,image,quantity,unit_price) VALUES (?,?,?,?,?,?,?)',(oid,i['productId'] if i['productId'] in ids else None,i['productId'],i['name'],i['image'],i['quantity'],i['price']))
        db.execute('INSERT INTO PAYMENT(order_id,payment_method,payment_status,payment_date) VALUES (?,?,?,?)',(oid,o['payment'],'취소' if o['status']=='취소' else '데모 완료',o['createdAt']))
        sh = o['shipping']
        db.execute('INSERT INTO SHIPMENT(order_id,shipping_address,shipping_status,recipient,phone,postal_code,address_detail,memo) VALUES (?,?,?,?,?,?,?,?)',(oid,sh['address'],o['status'],sh['recipient'],sh['phone'],sh['postalCode'],sh['addressDetail'],sh['memo']))

def initialize(path):
    with connect(path) as db:
        legacy = db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='state'").fetchone()
        if legacy:
            backup = str(path)+'.before-relational.bak'
            if not Path(backup).exists():
                with sqlite3.connect(backup) as target: db.backup(target)
        db.execute('BEGIN IMMEDIATE')
        if db.execute('PRAGMA user_version').fetchone()[0] >= 1: return
        for statement in (BASE/'schema.sql').read_text(encoding='utf-8-sig').split(';'):
            if statement.strip(): db.execute(statement)
        for username,name,flag in [('ADMIN','관리자',1),('user','숭실인',0)]:
            db.execute('INSERT INTO CUSTOMER(username,name,password_hash,is_admin) VALUES (?,?,?,?)',(username,name,generate_password_hash(username),flag))
        db.execute("INSERT INTO WAREHOUSE VALUES (1,'기본 창고','')")
        raw = db.execute('SELECT data FROM state WHERE id=1').fetchone() if legacy else None
        state = json.loads(raw[0]) if raw else dict(products=json.loads((BASE/'products.json').read_text(encoding='utf-8-sig')),carts={},orders=[])
        if 'admin' in state['carts']:
            state['carts']['ADMIN'] = state['carts'].pop('admin')
        for order in state['orders']:
            if order['owner'] == 'admin': order['owner'] = 'ADMIN'
        save_state(db,state)
        if db.execute('PRAGMA foreign_key_check').fetchall(): raise ValueError('Foreign key validation failed')
        if legacy: db.execute('DROP TABLE state')
        db.execute('PRAGMA user_version=1')
