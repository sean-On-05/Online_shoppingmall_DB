import json, os, re, secrets, sqlite3, uuid
from pathlib import Path
from datetime import datetime, timezone
from flask import Flask, jsonify, request, session, abort
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash
from database import connect, initialize, load_state, save_state

BASE = Path(__file__).resolve().parent
app = Flask(__name__)
secret_path = BASE / '.session-secret'
if not secret_path.exists():
    secret_path.write_text(secrets.token_hex(32))
app.config.update(SECRET_KEY=os.environ.get('SECRET_KEY') or secret_path.read_text(), SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax')
DB = os.environ.get('SHOP_DATABASE', str(BASE / 'shop.sqlite3'))
initialize(DB)

def account(username):
    with connect(DB) as db:
        row = db.execute('SELECT * FROM CUSTOMER WHERE username=?', (username,)).fetchone()
        return dict(row) if row else None

def public_account(row):
    if not row: return None
    return dict(id=str(row['customer_id']), username=row['username'], displayName=row['name'], role='admin' if row['is_admin'] else 'customer')

def is_admin():
    row = account(session.get('username'))
    return bool(row and row['is_admin'])

def owner():
    if 'visitor' not in session: session['visitor'] = uuid.uuid4().hex
    return session.get('username') or session['visitor']
def admin():
    if not is_admin(): abort(403, '관리자 권한이 필요합니다.')
def body():
    value = request.get_json(silent=True)
    if not isinstance(value, dict): abort(400, 'JSON 객체가 필요합니다.')
    return value
def integer(value, low, high):
    return type(value) is int and low <= value <= high
def visible(s):
    key=owner()
    return {'products': s['products'], 'items': s['carts'].get(key, []), 'orders': [{k:v for k,v in o.items() if k!='owner'} for o in s['orders'] if is_admin() or o['owner']==key]}
def transact(fn):
    with connect(DB) as db:
        db.execute('BEGIN IMMEDIATE')
        s=load_state(db)
        extra=fn(s) or {}
        save_state(db,s)
        return jsonify(**visible(s), **extra)
def product(s, pid):
    p=next((p for p in s['products'] if p['id']==pid),None)
    if p is None: abort(404,'상품을 찾을 수 없습니다.')
    return p
@app.errorhandler(HTTPException)
def error(e): return jsonify(message=e.description), e.code
@app.before_request
def origin_check():
    if request.method not in ('GET','HEAD','OPTIONS'):
        from urllib.parse import urlparse
        origin=request.headers.get('Origin')
        if origin and urlparse(origin).netloc != request.host: abort(403,'허용되지 않는 요청입니다.')
@app.get('/')
@app.get('/api/health')
def health(): return jsonify(status='ok',service='ssu-mall-backend')
@app.get('/api/session')
def current():
    owner()
    return jsonify(user=public_account(account(session.get('username'))))
def validate_contact(b):
    email, phone, address = b.get('email'), b.get('phone'), b.get('address')
    if not isinstance(email, str) or len(email.strip()) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email.strip()):
        abort(400, '이메일 형식을 확인해 주세요.')
    if not isinstance(phone, str) or len(phone) > 20 or not re.fullmatch(r'0\d{8,10}', re.sub(r'[\s-]', '', phone)):
        abort(400, '전화번호 형식을 확인해 주세요.')
    if not isinstance(address, str) or not 1 <= len(address.strip()) <= 200:
        abort(400, '주소를 1~200자로 입력해 주세요.')
    email = email.strip().lower()
    phone = re.sub(r'[\s-]', '', phone)
    return email, phone, address.strip()

@app.post('/api/users')
def register():
    b = body()
    username, name, password = b.get('username'), b.get('name'), b.get('password')
    if not isinstance(username, str) or not re.fullmatch(r'[A-Za-z0-9_]{4,30}', username):
        abort(400, '아이디는 영문·숫자·밑줄 4~30자로 입력해 주세요.')
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 50:
        abort(400, '이름을 1~50자로 입력해 주세요.')
    if not isinstance(password, str) or not 8 <= len(password) <= 100 or not password.strip():
        abort(400, '비밀번호를 8~100자로 입력해 주세요.')
    email, phone, address = validate_contact(b)
    try:
        with connect(DB) as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT 1 FROM CUSTOMER WHERE username = ? COLLATE NOCASE', (username,)).fetchone():
                abort(409, '이미 사용 중인 아이디입니다.')
            if db.execute('SELECT 1 FROM CUSTOMER WHERE email = ? COLLATE NOCASE', (email,)).fetchone():
                abort(409, '이미 사용 중인 이메일입니다.')
            db.execute('INSERT INTO CUSTOMER(username,name,password_hash,email,phone,address,is_admin) VALUES (?,?,?,?,?,?,0)',
                       (username, name.strip(), generate_password_hash(password), email, phone, address.strip()))
    except sqlite3.IntegrityError:
        abort(409, '이미 사용 중인 아이디 또는 이메일입니다.')
    return jsonify(message='회원가입이 완료되었습니다.'), 201

def require_customer():
    row = account(session.get('username'))
    if not row: abort(401, '로그인이 필요합니다.')
    return row

def profile(row):
    return dict(username=row['username'], name=row['name'], email=row['email'] or '',
                phone=row['phone'] or '', address=row['address'] or '')

@app.get('/api/me')
def get_profile():
    return jsonify(profile(require_customer()))

@app.patch('/api/me')
def update_profile():
    row = require_customer()
    email, phone, address = validate_contact(body())
    try:
        with connect(DB) as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT 1 FROM CUSTOMER WHERE email = ? COLLATE NOCASE AND customer_id != ?', (email, row['customer_id'])).fetchone():
                abort(409, '이미 사용 중인 이메일입니다.')
            db.execute('UPDATE CUSTOMER SET email=?,phone=?,address=? WHERE customer_id=?',
                       (email, phone, address, row['customer_id']))
    except sqlite3.IntegrityError:
        abort(409, '이미 사용 중인 이메일입니다.')
    return jsonify(profile(account(row['username'])))

@app.get('/api/me/orders')
def my_orders():
    row = require_customer()
    with connect(DB) as db:
        orders = load_state(db)['orders']
        return jsonify([{k:v for k,v in o.items() if k != 'owner'} for o in orders if o['owner'] == row['username']])

@app.post('/api/session')
def login():
    b=body(); name=b.get('username')
    row = account(name) if isinstance(name,str) else None
    if not row or not isinstance(b.get('password'),str) or not check_password_hash(row['password_hash'],b['password']): abort(401,'로그인 정보를 확인해 주세요.')
    old=owner()
    session['username']=name
    def merge(s):
        if old!=name and not account(old):
            cart=s['carts'].pop(old,[])
            target=s['carts'].setdefault(name,[])
            for item in cart:
                existing=next((i for i in target if i['productId']==item['productId']),None)
                if existing: existing['quantity']=min(99,existing['quantity']+item['quantity'])
                else: target.append(item)
            for o in s['orders']:
                if o['owner']==old: o['owner']=name
        return {'user':public_account(row)}
    return transact(merge)
@app.delete('/api/session')
def logout():
    session.clear(); owner()
    return jsonify(user=None)
@app.get('/api/shop')
def shop(): return transact(lambda s: None)
@app.get('/api/products')
def products():
    with connect(DB) as db: return jsonify(load_state(db)['products'])
@app.get('/api/products/<int:pid>')
def detail(pid):
    with connect(DB) as db: return jsonify(product(load_state(db),pid))
@app.put('/api/cart/items/<int:pid>')
def cart(pid):
    b=body(); q=b.get('quantity'); increment=b.get('increment')
    def change(s):
        items=s['carts'].setdefault(owner(),[])
        old=next((i['quantity'] for i in items if i['productId']==pid),0)
        qty=old+increment if integer(increment,1,99) else q
        if not integer(qty,0,99): abort(400,'수량은 0~99 정수여야 합니다.')
        if qty and qty>product(s,pid)['stock']: abort(409,'재고가 부족합니다.')
        s['carts'][owner()]=[i for i in items if i['productId']!=pid]+([{'productId':pid,'quantity':qty}] if qty else [])
    return transact(change)
@app.post('/api/products')
@app.put('/api/products/<int:pid>')
def save(pid=None):
    admin(); b=body()
    def change(s):
        nonlocal pid
        if pid is not None: product(s,pid)
        else: pid=max([p['id'] for p in s['products']]+[100])+1
        if not isinstance(b.get('name'),str) or not 1<=len(b['name'].strip())<=80: abort(400,'상품명을 확인해 주세요.')
        if not integer(b.get('price'),1,100000000) or not integer(b.get('stock'),0,100000): abort(400,'가격 또는 재고가 잘못되었습니다.')
        if b.get('originalPrice') is not None and not integer(b['originalPrice'],b['price']+1,100000000): abort(400,'정상가를 확인해 주세요.')
        if b.get('category') not in ['의류','가방','리빙','문구','액세서리']: abort(400,'카테고리를 확인해 주세요.')
        for field in ['image','description']:
            if not isinstance(b.get(field),str) or not b[field].strip(): abort(400,'이미지와 설명이 필요합니다.')
        p={k:b[k] for k in ['name','price','stock','category','image','description','originalPrice','label'] if k in b and b[k] is not None}; p['id']=pid
        s['products']=[p if x['id']==pid else x for x in s['products']] if any(x['id']==pid for x in s['products']) else [p]+s['products']
    return transact(change)
@app.delete('/api/products/<int:pid>')
def delete(pid):
    admin()
    def change(s):
        product(s,pid)
        if any(o['status'] not in ['취소','배송완료'] and any(i['productId']==pid for i in o['items']) for o in s['orders']): abort(409,'진행 중인 주문에 포함된 상품입니다.')
        s['products']=[p for p in s['products'] if p['id']!=pid]
        for key in s['carts']: s['carts'][key]=[i for i in s['carts'][key] if i['productId']!=pid]
    return transact(change)
@app.post('/api/orders')
def order():
    shipping=body()
    for field,limit in [('recipient',50),('address',200),('addressDetail',100),('memo',200),('phone',20),('postalCode',5)]:
        if not isinstance(shipping.get(field),str) or len(shipping[field])>limit: abort(400,'배송 정보를 확인해 주세요.')
    if not shipping['recipient'].strip() or not shipping['address'].strip() or not re.fullmatch(r'0\d{8,10}',re.sub(r'[\s-]','',shipping['phone'])) or not re.fullmatch(r'\d{5}',shipping['postalCode']): abort(400,'배송 정보를 확인해 주세요.')
    def change(s):
        items=s['carts'].get(owner(),[])
        if not items: abort(400,'장바구니가 비어 있습니다.')
        lines=[]
        for i in items:
            p=product(s,i['productId'])
            if i['quantity']>p['stock']: abort(409,'재고가 부족합니다.')
            p['stock']-=i['quantity']; lines.append({'productId':p['id'],'name':p['name'],'image':p['image'],'price':p['price'],'quantity':i['quantity']})
        subtotal=sum(i['price']*i['quantity'] for i in lines); fee=0 if subtotal>=50000 else 3000
        oid='SSU-'+uuid.uuid4().hex.upper()
        s['orders'].insert(0,dict(id=oid,owner=owner(),createdAt=datetime.now(timezone.utc).isoformat(),items=lines,shipping=shipping,subtotal=subtotal,shippingFee=fee,total=subtotal+fee,status='주문접수',payment='데모 결제'))
        s['carts'][owner()]=[]
        return {'orderId':oid}
    return transact(change)
@app.patch('/api/orders/<oid>')
def status(oid):
    admin(); target=body().get('status')
    def change(s):
        o=next((o for o in s['orders'] if o['id']==oid),None)
        if not o: abort(404,'주문을 찾을 수 없습니다.')
        if target==o['status']: return
        if target not in {'주문접수':['배송준비','취소'],'배송준비':['배송중','취소'],'배송중':['배송완료']}.get(o['status'],[]): abort(409,'허용되지 않는 상태 변경입니다.')
        if target=='취소':
            for i in o['items']: product(s,i['productId'])['stock']+=i['quantity']
        o['status']=target
    return transact(change)
if __name__=='__main__': app.run(host='127.0.0.1',port=5000)
