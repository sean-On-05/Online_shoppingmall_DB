import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { money, productImage, type Product, type CartItem } from "../data";
import { shippingFee, type ShippingInfo } from "../domain";
import Icon from "../components/Icon";
export default function Checkout({
  products,
  items,
  onSubmit,
}: {
  products: Product[];
  items: CartItem[];
  onSubmit: (shipping: ShippingInfo) => Promise<string | null>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const rows = items.flatMap((i) => {
    const product = products.find((p) => p.id === i.productId);
    return product ? [{ ...i, product }] : [];
  });
  const invalid =
    rows.length !== items.length ||
    rows.some((r) => r.quantity > r.product.stock);
  const subtotal = rows.reduce(
    (sum, r) => sum + r.quantity * r.product.price,
    0,
  );
  const fee = shippingFee(subtotal);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const shipping: ShippingInfo = {
      recipient: String(form.get("recipient")).trim(),
      phone: String(form.get("phone")).trim(),
      postalCode: String(form.get("postalCode")).trim(),
      address: String(form.get("address")).trim(),
      addressDetail: String(form.get("addressDetail")).trim(),
      memo: String(form.get("memo")).trim(),
    };
    const result = await onSubmit(shipping);
    if (result) {
      setError(result);
      submitting.current = false;
      setBusy(false);
    }
  }
  if (!rows.length)
    return (
      <main className="inner-page empty-state container">
        <Icon name="bag" size={40} />
        <h1>주문할 상품이 없어요.</h1>
        <a className="hero-button" href="#/">
          굿즈 둘러보기
        </a>
      </main>
    );
  return (
    <main className="inner-page container">
      <span className="eyebrow">ONE STEP CLOSER TO YOUR CAMPUS</span>
      <h1>주문서 작성</h1>
      <p className="page-description">
        주문 정보를 확인하고 배송받을 곳을 입력해 주세요.
      </p>
      <div className="demo-note checkout-demo">
        데모 주문입니다. 테스트용 정보를 입력해 주세요. 실제 결제·배송은
        진행되지 않으며 입력 정보는 서버에 저장됩니다.
      </div>
      <form className="checkout-layout" onSubmit={submit}>
        <div>
          <section className="checkout-section">
            <h2>
              주문 상품 <span>{rows.length}</span>
            </h2>
            {rows.map((r) => (
              <div key={r.productId} className="checkout-product">
                <img src={productImage(r.product.image)} alt={r.product.name} />
                <div>
                  <a href={`#/products/${r.productId}`}>{r.product.name}</a>
                  <p>
                    {money(r.product.price)} · {r.quantity}개
                  </p>
                  {r.quantity > r.product.stock && (
                    <p className="form-error">
                      재고 부족 · 현재 {r.product.stock}개
                    </p>
                  )}
                </div>
                <strong>{money(r.quantity * r.product.price)}</strong>
              </div>
            ))}
            <a className="text-button" href="#/cart">
              장바구니 수정하기 →
            </a>
          </section>
          <section className="checkout-section">
            <h2>배송 정보</h2>
            <div className="form-grid product-form">
              <label>
                받는 분
                <input
                  name="recipient"
                  required
                  maxLength={50}
                  autoComplete="shipping name"
                  placeholder="테스트 수령인"
                />
              </label>
              <label>
                연락처
                <input
                  name="phone"
                  type="tel"
                  required
                  maxLength={20}
                  autoComplete="shipping tel"
                  placeholder="010-0000-0000"
                />
              </label>
              <label>
                우편번호
                <input
                  name="postalCode"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  maxLength={5}
                  autoComplete="shipping postal-code"
                  placeholder="숫자 5자리"
                />
              </label>
              <label className="form-full">
                기본 주소
                <input
                  name="address"
                  required
                  maxLength={200}
                  autoComplete="shipping address-line1"
                  placeholder="도로명 또는 지번 주소"
                />
              </label>
              <label className="form-full">
                상세 주소 (선택)
                <input
                  name="addressDetail"
                  maxLength={100}
                  autoComplete="shipping address-line2"
                  placeholder="동·호수 등"
                />
              </label>
              <label className="form-full">
                배송 요청사항 (선택)
                <textarea
                  name="memo"
                  maxLength={200}
                  rows={3}
                  placeholder="배송 시 요청사항을 남겨 주세요."
                />
              </label>
            </div>
          </section>
          <section className="checkout-section">
            <h2>결제 수단</h2>
            <label className="demo-payment">
              <input type="radio" checked readOnly /> 데모 결제{" "}
              <span>금액 청구 없음</span>
            </label>
            <p className="field-help">
              카드·계좌 정보 없이 주문 흐름만 체험합니다.
            </p>
          </section>
        </div>
        <aside className="order-summary checkout-summary">
          <h2>결제 예정 금액</h2>
          <dl>
            <div>
              <dt>상품 금액</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            <div>
              <dt>배송비</dt>
              <dd>{fee ? money(fee) : "무료"}</dd>
            </div>
            <div className="total">
              <dt>총 주문 금액</dt>
              <dd>{money(subtotal + fee)}</dd>
            </div>
          </dl>
          <label className="checkout-agreement">
            <input type="checkbox" required />{" "}
            <span>주문 내용과 데모 주문 안내를 확인했습니다.</span>
          </label>
          {(error || invalid) && (
            <p className="form-error" role="alert">
              {error ||
                "재고가 부족한 상품이 있습니다. 장바구니 수량을 수정해 주세요."}
            </p>
          )}
          <button
            className="primary-button"
            type="submit"
            disabled={busy || invalid}
          >
            {busy ? "주문 처리 중…" : `${money(subtotal + fee)} 데모 주문`}
            <Icon name="arrow" size={17} />
          </button>
          <small>주문 접수 시 재고가 차감됩니다.</small>
        </aside>
      </form>
    </main>
  );
}
