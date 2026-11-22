import { useEffect, useReducer, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "flowbite-react";
import { money, productImage, type Product, type CartItem } from "../data";
import { shippingFee, validateShipping, type ShippingInfo } from "../domain";
import Icon from "../components/Icon";
import ShippingFields from "../components/ShippingFields";
import { api } from "../api";
import {
  createShippingDraft,
  hasShippingInput,
  shippingDraftReducer,
} from "../shippingDraft";
export default function Checkout({
  userId,
  products,
  items,
  onSubmit,
}: {
  userId: string | null;
  products: Product[];
  items: CartItem[];
  onSubmit: (shipping: ShippingInfo) => Promise<string | null>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [draft, dispatch] = useReducer(
    shippingDraftReducer,
    undefined,
    createShippingDraft,
  );
  const [defaultAddress, setDefaultAddress] = useState<ShippingInfo | null>(
    null,
  );
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressNotice, setAddressNotice] = useState("");
  const [addressRetry, setAddressRetry] = useState(0);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const initialLookupDone = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function load() {
      setAddressLoading(true);
      setAddressError("");
      try {
        const result = await api<{ address: ShippingInfo | null }>(
          "/me/default-address",
        );
        if (!active) return;
        setDefaultAddress(result.address);
        if (!initialLookupDone.current && !submitting.current) {
          dispatch({ type: "automatic", address: result.address });
        }
      } catch (e) {
        if (active)
          setAddressError(
            e instanceof Error
              ? e.message
              : "기본 배송지를 불러오지 못했습니다.",
          );
      } finally {
        if (active) {
          initialLookupDone.current = true;
          setAddressLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [userId, addressRetry]);

  function loadDefaultAddress() {
    if (!defaultAddress || busy) return;
    if (hasShippingInput(draft.values)) {
      setReplaceConfirm(true);
      return;
    }
    applyDefaultAddress();
  }

  function applyDefaultAddress() {
    if (!defaultAddress || busy) return;
    dispatch({ type: "replace", address: defaultAddress });
    setReplaceConfirm(false);
    setAddressNotice(
      "기본 배송지를 불러왔습니다. 주문서에서 수정해도 기본 배송지는 변경되지 않습니다.",
    );
  }
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
    const shipping = Object.fromEntries(
      Object.entries(draft.values).map(([key, value]) => [key, value.trim()]),
    ) as unknown as ShippingInfo;
    try {
      validateShipping(shipping);
    } catch (e) {
      setError(e instanceof Error ? e.message : "배송 정보를 확인해 주세요.");
      return;
    }
    submitting.current = true;
    setBusy(true);
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
            <div className="shipping-section-heading">
              <h2>배송 정보</h2>
              {userId && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={addressLoading || !defaultAddress || busy}
                  onClick={loadDefaultAddress}
                >
                  {addressLoading ? "조회 중…" : "기본 배송지 불러오기"}
                </button>
              )}
            </div>
            {userId && !addressLoading && !addressError && !defaultAddress && (
              <p className="field-help">
                등록된 기본 배송지가 없습니다.{" "}
                <a href="#/mypage">마이페이지에서 등록하기</a>
              </p>
            )}
            {addressError && (
              <p className="form-error" role="alert">
                {addressError}{" "}
                <button
                  type="button"
                  className="text-button"
                  disabled={addressLoading || busy}
                  onClick={() => setAddressRetry((value) => value + 1)}
                >
                  다시 조회
                </button>
              </p>
            )}
            {addressNotice && (
              <p className="field-help" role="status">
                {addressNotice}
              </p>
            )}
            <ShippingFields
              value={draft.values}
              disabled={busy}
              onChange={(field, value) =>
                dispatch({ type: "edit", field, value })
              }
            />
          </section>
          <section className="checkout-section">
            <h2>주문 후 모의 결제</h2>
            <p className="field-help">
              주문 접수 후 주문 상세에서 결제 수단을 선택하고 모의 결제를
              진행합니다. 실제 금액은 청구되지 않습니다.
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
            {busy ? "주문 처리 중…" : `${money(subtotal + fee)} 주문 접수`}
            <Icon name="arrow" size={17} />
          </button>
          <small>주문 접수 시 재고가 차감됩니다.</small>
        </aside>
      </form>
      <Modal
        show={replaceConfirm}
        onClose={() => setReplaceConfirm(false)}
        size="md"
      >
        <ModalHeader>기본 배송지 불러오기</ModalHeader>
        <ModalBody>
          <p>입력한 배송 정보를 기본 배송지로 바꾸시겠어요?</p>
          <p className="field-help">현재 주문서의 배송 정보만 변경됩니다.</p>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setReplaceConfirm(false)}
          >
            취소
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={applyDefaultAddress}
          >
            기본 배송지로 교체
          </button>
        </ModalFooter>
      </Modal>
    </main>
  );
}
