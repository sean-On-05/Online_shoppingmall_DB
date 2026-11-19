import json, os, re, secrets, sqlite3, uuid
from pathlib import Path
from datetime import datetime, timezone
from flask import Flask, jsonify, request, session, abort
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash
from database import (
    connect, initialize, load_state, save_state,
    create_order, cancel_order, process_payment, register_shipment, update_shipping_status
)

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
    return {'products': visible_products(s), 'items': s['carts'].get(key, []), 'orders': [{k:v for k,v in o.items() if k!='owner'} for o in s['orders'] if is_admin() or o['owner']==key]}

def visible_products(s):
    return s['products'] if is_admin() else [p for p in s['products'] if p['status'] == '판매중']
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
def shop():
    with connect(DB) as db:
        state = load_state(db)

    return jsonify(**visible(state))
@app.get('/api/products')
def products():
    with connect(DB) as db: return jsonify(visible_products(load_state(db)))
@app.get('/api/products/<int:pid>')
def detail(pid):
    with connect(DB) as db:
        p = product(load_state(db),pid)
        if p['status'] != '판매중' and not is_admin(): abort(404, '판매가 중지된 상품입니다.')
        return jsonify(p)
@app.put('/api/cart/items/<int:pid>')
def cart(pid):
    b=body(); q=b.get('quantity'); increment=b.get('increment')
    def change(s):
        items=s['carts'].setdefault(owner(),[])
        old=next((i['quantity'] for i in items if i['productId']==pid),0)
        qty=old+increment if integer(increment,1,99) else q
        if not integer(qty,0,99): abort(400,'수량은 0~99 정수여야 합니다.')
        if qty and product(s,pid)['status'] != '판매중': abort(409, '판매 중지된 상품은 장바구니에 담을 수 없습니다.')
        if qty and qty>product(s,pid)['stock']: abort(409,'재고가 부족합니다.')
        s['carts'][owner()]=[i for i in items if i['productId']!=pid]+([{'productId':pid,'quantity':qty}] if qty else [])
    return transact(change)
@app.post('/api/products')
@app.put('/api/products/<int:pid>')
def save(pid=None):
    admin(); b=body()
    def change(s):
        nonlocal pid
        current_status = product(s,pid)['status'] if pid is not None else '판매중'
        if pid is not None: product(s,pid)
        else: pid=max([p['id'] for p in s['products']]+[100])+1
        if not isinstance(b.get('name'),str) or not 1<=len(b['name'].strip())<=80: abort(400,'상품명을 확인해 주세요.')
        if not integer(b.get('price'),1,100000000) or not integer(b.get('stock'),0,100000): abort(400,'가격 또는 재고가 잘못되었습니다.')
        if b.get('originalPrice') is not None and not integer(b['originalPrice'],b['price']+1,100000000): abort(400,'정상가를 확인해 주세요.')
        if b.get('category') not in ['의류','가방','리빙','문구','액세서리']: abort(400,'카테고리를 확인해 주세요.')
        for field in ['image','description']:
            if not isinstance(b.get(field),str) or not b[field].strip(): abort(400,'이미지와 설명이 필요합니다.')
        p={k:b[k] for k in ['name','price','stock','category','image','description','originalPrice','label'] if k in b and b[k] is not None}; p['id']=pid
        p['status'] = current_status
        s['products']=[p if x['id']==pid else x for x in s['products']] if any(x['id']==pid for x in s['products']) else [p]+s['products']
    return transact(change)
@app.delete('/api/products/<int:pid>')
def delete(pid):
    admin()

    def change(s):
        p = product(s, pid)

        if p['status'] == '판매중지':
            abort(409, '이미 판매 중지된 상품입니다.')

        p['status'] = '판매중지'
        for key, items in s['carts'].items():
            s['carts'][key] = [item for item in items if item['productId'] != pid]

    return transact(change)
@app.post('/api/products/<int:pid>/resume')
def resume_product(pid):
    admin()
    def change(s):
        p = product(s, pid)
        if p['status'] != '판매중지':
            abort(409, '이미 판매 중인 상품입니다.')
        p['status'] = '판매중'
    return transact(change)

@app.post('/api/orders')
def order():
    shipping = body()
    # 기존 프론트엔드의 배송 정보 입력값 검증
    for field, limit in [
        ('recipient', 50),
        ('address', 200),
        ('addressDetail', 100),
        ('memo', 200),
        ('phone', 20),
        ('postalCode', 5)
    ]:
        value = shipping.get(field)
        if not isinstance(value, str) or len(value) > limit:
            abort(400, '배송 정보를 확인해 주세요.')

    if (
        not shipping['recipient'].strip()
        or not shipping['address'].strip()
        or not re.fullmatch(
            r'0\d{8,10}',
            re.sub(r'[\s-]', '', shipping['phone'])
        )
        or not re.fullmatch(r'\d{5}', shipping['postalCode'])
    ):
        abort(400, '배송 정보를 확인해 주세요.')

    try:
        with connect(DB) as db:
            db.execute('BEGIN IMMEDIATE')

            order_code = create_order(
                db,
                owner_key=owner(),
                warehouse_id=1,
                shipping=shipping
            )


            state = load_state(db)

        return jsonify(
            **visible(state),
            orderId=order_code
        )

    except ValueError as e:
        abort(409, str(e))

@app.post('/api/orders/<order_code>/payment')
def pay_order(order_code):
    data = body()

    # success는 반드시 boolean이어야 함
    success = data.get('success', True)
    payment_method = data.get('paymentMethod', '카드')

    if type(success) is not bool:
        abort(400, '결제 결과는 true 또는 false여야 합니다.')

    # 로그인 고객 또는 비회원 세션의 주문 소유자 확인
    with connect(DB) as db:
        order = db.execute(
            """
            SELECT order_id, owner_key
            FROM ORDERS
            WHERE order_code = ?
            """,
            (order_code,)
        ).fetchone()

        if order is None:
            abort(404, '존재하지 않는 주문입니다.')

        if order['owner_key'] != owner() and not is_admin():
            abort(403, '해당 주문에 접근할 권한이 없습니다.')

    try:
        with connect(DB) as db:
            db.execute('BEGIN IMMEDIATE')

            # SQL 트랜잭션 내부에서 결제 처리
            payment_status = process_payment(
                db,
                order_code=order_code,
                success=success,
                payment_method=payment_method
            )

        # 결제 저장이 완료된 이후 최신 정보 조회
        with connect(DB) as db:
            state = load_state(db)

        return jsonify(
            **visible(state),
            paymentStatus=payment_status
        )

    except ValueError as e:
        abort(409, str(e))
@app.post('/api/orders/<order_code>/shipment')
def create_shipment(order_code):
    admin()

    shipping = body()

    try:
        with connect(DB) as db:
            db.execute('BEGIN IMMEDIATE')

            shipping_status = register_shipment(
                db,
                order_code=order_code,
                shipping=shipping
            )

        with connect(DB) as db:
            state = load_state(db)

        return jsonify(
            **visible(state),
            shippingStatus=shipping_status
        )

    except ValueError as e:
        abort(409, str(e))

@app.patch('/api/orders/<order_code>/shipment')
def change_shipping_status(order_code):
    # 배송 상태 변경은 관리자만 가능
    admin()

    data = body()
    new_status = data.get('status')

    if new_status not in ('배송중', '배송완료'):
        abort(400, '변경할 배송 상태가 올바르지 않습니다.')

    try:
        with connect(DB) as db:
            db.execute('BEGIN IMMEDIATE')

            shipping_status = update_shipping_status(
                db,
                order_code=order_code,
                new_status=new_status
            )

        with connect(DB) as db:
            state = load_state(db)

        return jsonify(
            **visible(state),
            shippingStatus=shipping_status
        )

    except ValueError as e:
        abort(409, str(e))

@app.patch('/api/orders/<oid>')
def status(oid):
    admin()

    target = body().get('status')

    # 주문 취소는 별도의 SQL 트랜잭션으로 처리
    if target != '취소':
        abort(
            409,
            '주문 진행 상태는 배송 등록 및 배송 상태 API에서 관리합니다.'
        )

    try:
        with connect(DB) as db:
            db.execute('BEGIN IMMEDIATE')
            cancel_order(db, order_code=oid)

        with connect(DB) as db:
            state = load_state(db)

        return jsonify(**visible(state))

    except ValueError as e:
        abort(409, str(e))

    # 나머지 상태 변경은 기존 방식 유지
    def change(s):
        o = next(
            (o for o in s['orders'] if o['id'] == oid),
            None
        )

        if not o:
            abort(404, '주문을 찾을 수 없습니다.')

        if target == o['status']:
            return

        allowed = {
            '주문접수': ['배송준비'],
            '배송준비': ['배송중'],
            '배송중': ['배송완료']
        }

        if target not in allowed.get(o['status'], []):
            abort(409, '허용되지 않는 상태 변경입니다.')

        o['status'] = target

    return transact(change)
if __name__=='__main__': app.run(host='127.0.0.1',port=5000)
