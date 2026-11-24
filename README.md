# SSU Mall — 온라인 쇼핑몰 주문·재고 관리

데이터베이스 수업 기말 팀 프로젝트입니다. 숭실대 굿즈를 판매하는 쇼핑몰을 만들고, 주문이 들어오거나 취소될 때 재고가 어떻게 바뀌는지 구현했습니다.

[배포 사이트](https://online-shoppingmall-db.vercel.app/)

## 구현한 기능

- 고객은 상품을 조회하고 장바구니에 담아 주문할 수 있습니다. 주문 후에는 모의 결제 결과와 배송 상태를 확인할 수 있습니다.
- 관리자는 상품 등록·수정·판매 중지, 재고 조정, 주문 취소와 배송 상태 변경을 할 수 있습니다.
- 주문을 받을 때 재고 확인, 차감, 주문 저장을 하나의 트랜잭션에서 처리합니다. 재고가 부족하면 주문을 받지 않고, 주문을 취소하면 출고 창고의 재고를 복구합니다.

## 개발 환경

웹 화면은 React, TypeScript, Vite로 만들고 Vercel에 배포했습니다. Flask로 작성한 Python API는 PythonAnywhere에서 실행됩니다. 웹 화면은 HTTP로 API를 호출하고, SQLite 파일은 백엔드 서버에서 관리합니다. 팀 작업에는 Git과 GitHub를 사용했습니다.

- `frontend/` — 고객 화면과 관리자 화면
- `backend/` — Flask API와 SQLite 스키마
- `docs/` — 업무 흐름도, ERD, 테이블 정의서 등 설계 자료

## 제출 DB로 실행하기

Python 3.12와 Node.js 22.13 이상을 준비합니다. 아래 명령은 저장소 루트에서 시작하며, `shop.db`는 제출용 SQLite 파일의 이름입니다.

**터미널 1 · 백엔드**

제출용 DB를 `backend/`에 넣고 실행합니다.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
SHOP_DATABASE=shop.db python app.py
```

Windows PowerShell에서는 가상환경 활성화에 `.\.venv\Scripts\Activate.ps1`을 사용합니다. 실행 전 `$env:SHOP_DATABASE = "shop.db"`를 입력한 뒤 `python app.py`를 실행합니다. DB 파일명이 다르면 실제 이름을 지정하세요. `SHOP_DATABASE`를 설정하지 않으면 앱은 `backend/shop.sqlite3`를 사용합니다.

**터미널 2 · 프런트엔드**

로컬 실행본의 `frontend/vite.config.ts`에서 `/api` 프록시의 `target`을 `http://127.0.0.1:5000`으로 바꿉니다. 기본 설정은 PythonAnywhere의 배포 API에 연결됩니다.

```bash
cd frontend
npm ci
npm run dev
```

브라우저에서 [http://localhost:5173](http://localhost:5173)을 엽니다.

## 시연 순서

시연 상품의 재고를 1개로 맞춘 뒤, 두 고객 세션의 장바구니에 그 상품을 각각 1개씩 담습니다. 첫 고객이 주문하면 재고는 0개가 되고, 두 번째 고객의 주문은 재고 부족으로 차단됩니다. 관리자 화면에서 첫 주문을 취소한 뒤 재고가 1개로 돌아오는지 확인합니다.
