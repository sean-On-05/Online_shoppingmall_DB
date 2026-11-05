import { useState } from "react";
import type { FormEvent } from "react";
import { Modal, ModalBody, ModalHeader } from "flowbite-react";
import { categories, money, productImage, type Product } from "../data";
import {
  nextStatuses,
  orderStatuses,
  type Order,
  type OrderStatus,
} from "../domain";
import OrderDetail, { orderDate } from "../components/OrderDetail";
interface Props {
  products: Product[];
  orders: Order[];
  section: string;
  onSave: (product: Product) => Promise<string | null>;
  onDelete: (id: number) => Promise<string | null>;
  onStatus: (id: string, status: OrderStatus) => Promise<string | null>;
  onLogout: () => void;
}
export default function Admin({
  products,
  orders,
  section,
  onSave,
  onDelete,
  onStatus,
  onLogout,
}: Props) {
  const tab =
    section === "inventory" || section === "orders" ? section : "products";
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{
    id: string;
    status: OrderStatus;
  } | null>(null);
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({});
  const [stockMessage, setStockMessage] = useState("");
  const activeOrder = orders.find((o) => o.id === selectedOrder);
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (tab !== "inventory" ||
        stockFilter === "all" ||
        (stockFilter === "out" ? p.stock === 0 : p.stock > 0 && p.stock <= 10)),
  );
  const filteredOrders = orders.filter(
    (o) =>
      (statusFilter === "all" || o.status === statusFilter) &&
      `${o.id} ${o.shipping.recipient} ${o.items.map((i) => i.name).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const form = new FormData(e.currentTarget);
    const originalPrice = String(form.get("originalPrice")).trim();
    const result = await onSave({
      ...editing,
      name: String(form.get("name")).trim(),
      price: Number(form.get("price")),
      stock: Number(form.get("stock")),
      category: String(form.get("category")),
      image: String(form.get("image")).trim(),
      description: String(form.get("description")).trim(),
      label: String(form.get("label")) || undefined,
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
    });
    setError(result ?? "");
    if (!result) setEditing(null);
  }
  async function saveStock(product: Product) {
    const value = stockDrafts[product.id];
    if (value === undefined || !value.trim()) {
      setStockMessage("재고 수량을 입력해 주세요.");
      return;
    }
    const result = await onSave({ ...product, stock: Number(value) });
    setStockMessage(
      result ?? `${product.name} 재고를 ${Number(value)}개로 저장했습니다.`,
    );
    if (!result)
      setStockDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
  }
  function edit(product: Product) {
    setError("");
    setEditing(product);
  }
  const title =
    tab === "inventory"
      ? "재고 현황"
      : tab === "orders"
        ? "주문 관리"
        : "상품 관리";
  return (
    <main className="inner-page admin-page container">
      <div className="admin-top">
        <span className="eyebrow">SSU MALL ADMINISTRATION</span>
        <div>
          <span className="admin-session">● admin 로그인 중</span>
          <button className="secondary-button" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </div>
      <nav className="admin-tabs" aria-label="관리자 메뉴">
        {[
          { key: "products", label: "상품 관리" },
          { key: "inventory", label: "재고 현황" },
          { key: "orders", label: "주문 관리" },
        ].map((t) => (
          <a
            key={t.key}
            className={tab === t.key ? "selected" : ""}
            aria-current={tab === t.key ? "page" : undefined}
            href={`#/admin/${t.key}`}
            onClick={() => {
              setQuery("");
              setStockMessage("");
            }}
          >
            {t.label}
          </a>
        ))}
        <a href="#/">고객용 쇼핑몰 ↗</a>
      </nav>
      <div className="admin-heading">
        <div>
          <h1>{title}</h1>
          <p className="page-description">
            {tab === "orders"
              ? "고객 주문을 확인하고 배송 상태를 관리하세요."
              : tab === "inventory"
                ? "품절과 재고 부족 상품을 확인하고 수량을 조정하세요."
                : "숭실 굿즈의 상품 정보와 판매 상태를 관리하세요."}
          </p>
        </div>
        {tab === "products" && (
          <button
            className="primary-button"
            onClick={() =>
              edit({
                id: Date.now(),
                name: "",
                price: 10000,
                stock: 20,
                description: "SSU Mall 캠퍼스 굿즈 컬렉션입니다.",
                category: "액세서리",
                image: "/images/goods/keyring.svg",
                label: "NEW",
              })
            }
          >
            + 상품 등록
          </button>
        )}
      </div>
      <div className="admin-stats">
        <div>
          <span>{tab === "orders" ? "전체 주문" : "전체 상품"}</span>
          <strong>
            {tab === "orders" ? orders.length : products.length}
            <small>{tab === "orders" ? "건" : "개"}</small>
          </strong>
        </div>
        <div>
          <span>
            {tab === "orders" ? "처리 대기" : "재고 부족 (10개 이하)"}
          </span>
          <strong>
            {tab === "orders"
              ? orders.filter(
                  (o) => o.status === "주문접수" || o.status === "배송준비",
                ).length
              : products.filter((p) => p.stock > 0 && p.stock <= 10).length}
            <small>{tab === "orders" ? "건" : "종"}</small>
          </strong>
        </div>
        <div>
          <span>{tab === "orders" ? "배송 완료" : "품절 상품"}</span>
          <strong>
            {tab === "orders"
              ? orders.filter((o) => o.status === "배송완료").length
              : products.filter((p) => p.stock === 0).length}
            <small>{tab === "orders" ? "건" : "종"}</small>
          </strong>
        </div>
      </div>
      <div className="management-toolbar">
        <input
          className="admin-search"
          aria-label={tab === "orders" ? "주문 검색" : "관리 상품 검색"}
          placeholder={
            tab === "orders" ? "주문번호 · 수령인 · 상품명 검색" : "상품명 검색"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {tab === "inventory" && (
          <select
            aria-label="재고 상태 필터"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
          >
            <option value="all">전체 재고</option>
            <option value="low">재고 부족</option>
            <option value="out">품절</option>
          </select>
        )}
        {tab === "orders" && (
          <select
            aria-label="주문 상태 필터"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">전체 상태</option>
            {orderStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
        <span>
          {tab === "orders" ? filteredOrders.length : filteredProducts.length}건
        </span>
      </div>
      {stockMessage && (
        <p className="inline-notice" role="status">
          {stockMessage}
        </p>
      )}
      {tab === "orders" ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>주문번호 · 접수일</th>
                <th>상품</th>
                <th>수령인</th>
                <th>주문 금액</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <button
                      className="order-id"
                      onClick={() => setSelectedOrder(o.id)}
                    >
                      {o.id}
                    </button>
                    <small className="table-subtext">
                      {orderDate(o.createdAt)}
                    </small>
                  </td>
                  <td>
                    {o.items[0]?.name}
                    {o.items.length > 1 ? ` 외 ${o.items.length - 1}종` : ""}
                  </td>
                  <td>{o.shipping.recipient}</td>
                  <td>{money(o.total)}</td>
                  <td>
                    <span
                      className={`status-pill ${o.status === "취소" ? "soldout" : ""}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setSelectedOrder(o.id)}
                    >
                      상세
                    </button>
                    {nextStatuses(o.status).map((status) => (
                      <button
                        key={status}
                        className={`text-button ${status === "취소" ? "delete" : ""}`}
                        onClick={() => setPendingStatus({ id: o.id, status })}
                      >
                        {status === "취소" ? "주문 취소" : `${status} 처리`}
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredOrders.length && (
            <div className="empty-state">
              <h2>
                {orders.length
                  ? "검색된 주문이 없습니다."
                  : "아직 접수된 주문이 없습니다."}
              </h2>
              <p>고객용 화면에서 데모 주문을 완료하면 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>상품</th>
                <th>카테고리</th>
                <th>판매가</th>
                <th>재고 · 상태</th>
                <th>{tab === "inventory" ? "재고 조정" : "관리"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a className="table-product" href={`#/products/${p.id}`}>
                      <img src={productImage(p.image)} alt="" />
                      {p.name}
                    </a>
                  </td>
                  <td>{p.category}</td>
                  <td>{money(p.price)}</td>
                  <td>
                    <span
                      className={`status-pill ${p.stock === 0 ? "soldout" : p.stock <= 10 ? "low-stock" : ""}`}
                    >
                      {p.stock === 0
                        ? "품절"
                        : `${p.stock}개${p.stock <= 10 ? " · 부족" : ""}`}
                    </span>
                  </td>
                  <td>
                    {tab === "inventory" ? (
                      <div className="stock-editor">
                        <input
                          aria-label={`${p.name} 재고`}
                          type="number"
                          min="0"
                          max="100000"
                          step="1"
                          value={stockDrafts[p.id] ?? p.stock}
                          onChange={(e) =>
                            setStockDrafts((current) => ({
                              ...current,
                              [p.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          className="text-button"
                          disabled={stockDrafts[p.id] === undefined}
                          onClick={() => saveStock(p)}
                        >
                          저장
                        </button>
                      </div>
                    ) : (
                      <>
                        <button className="text-button" onClick={() => edit(p)}>
                          수정
                        </button>
                        <button
                          className="text-button delete"
                          onClick={() => {
                            setError("");
                            setDeleting(p);
                          }}
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredProducts.length && (
            <p className="empty-state">검색된 상품이 없습니다.</p>
          )}
        </div>
      )}
      <p className="admin-footnote">
        Flask 서버에 저장되는 데모 관리 화면입니다. 주문접수 → 배송준비 → 배송중 →
        배송완료 순서로 처리하며, 배송 전 취소 시 재고가 복원됩니다.
      </p>
      <Modal show={!!editing} onClose={() => setEditing(null)} size="lg">
        <ModalHeader>
          {products.some((p) => p.id === editing?.id)
            ? "상품 수정"
            : "상품 등록"}
        </ModalHeader>
        <ModalBody>
          {editing && (
            <form className="product-form" onSubmit={submit}>
              <label>
                상품명
                <input
                  name="name"
                  required
                  maxLength={80}
                  pattern=".*\S.*"
                  defaultValue={editing.name}
                />
              </label>
              <div className="form-grid">
                <label>
                  카테고리
                  <select name="category" defaultValue={editing.category}>
                    {categories.slice(1).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  라벨
                  <select name="label" defaultValue={editing.label ?? ""}>
                    <option value="">없음</option>
                    <option>NEW</option>
                    <option>BEST</option>
                  </select>
                </label>
                <label>
                  판매가 (원)
                  <input
                    name="price"
                    type="number"
                    min="1"
                    max="100000000"
                    step="1"
                    required
                    defaultValue={editing.price}
                  />
                </label>
                <label>
                  정상가 (선택)
                  <input
                    name="originalPrice"
                    type="number"
                    min="1"
                    max="100000000"
                    step="1"
                    defaultValue={editing.originalPrice ?? ""}
                  />
                </label>
                <label>
                  재고 수량
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    required
                    defaultValue={editing.stock}
                  />
                </label>
              </div>
              <label>
                상품 설명
                <textarea
                  name="description"
                  required
                  maxLength={2000}
                  rows={3}
                  defaultValue={editing.description}
                />
              </label>
              <label>
                이미지 (로컬 경로 · HTTPS URL · Unsplash ID)
                <input
                  name="image"
                  required
                  pattern="(https://.+|/images/.+|photo-.+)"
                  defaultValue={editing.image}
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditing(null)}
                >
                  취소
                </button>
                <button type="submit" className="primary-button">
                  저장하기
                </button>
              </div>
            </form>
          )}
        </ModalBody>
      </Modal>
      <Modal show={!!deleting} onClose={() => setDeleting(null)} size="md">
        <ModalHeader>상품 삭제</ModalHeader>
        <ModalBody>
          <p>
            ‘{deleting?.name}’ 상품을 삭제하시겠어요? 장바구니에서도 제거되며,
            기존 주문 기록은 유지됩니다.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={() => setDeleting(null)}
            >
              취소
            </button>
            <button
              className="danger-button"
              onClick={async () => {
                if (!deleting) return;
                const result = await onDelete(deleting.id);
                setError(result ?? "");
                if (!result) setDeleting(null);
              }}
            >
              삭제하기
            </button>
          </div>
        </ModalBody>
      </Modal>
      <Modal
        show={!!activeOrder}
        onClose={() => setSelectedOrder(null)}
        size="3xl"
      >
        <ModalHeader>주문 상세</ModalHeader>
        <ModalBody>
          {activeOrder && <OrderDetail order={activeOrder} />}
        </ModalBody>
      </Modal>
      <Modal
        show={!!pendingStatus}
        onClose={() => setPendingStatus(null)}
        size="md"
      >
        <ModalHeader>주문 상태 변경</ModalHeader>
        <ModalBody>
          <p>주문을 ‘{pendingStatus?.status}’ 상태로 변경하시겠어요?</p>
          {pendingStatus?.status === "취소" && (
            <p className="field-help">
              취소하면 주문 상품의 재고가 복원됩니다. 취소한 주문은 되돌릴 수
              없습니다.
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={() => setPendingStatus(null)}
            >
              닫기
            </button>
            <button
              className="primary-button"
              onClick={async () => {
                if (pendingStatus)
                  if (await onStatus(pendingStatus.id, pendingStatus.status)) return;
                setPendingStatus(null);
              }}
            >
              변경하기
            </button>
          </div>
        </ModalBody>
      </Modal>
    </main>
  );
}
