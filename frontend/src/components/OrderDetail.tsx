import { money, productImage } from "../data";
import type { Order } from "../domain";
export const orderDate = (value: string) =>
  new Date(value).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function OrderDetail({ order }: { order: Order }) {
  return (
    <div className="order-detail">
      <div className="order-meta">
        <div>
          <span className="field-help">주문번호</span>
          <strong>{order.id}</strong>
        </div>
        <span
          className={`status-pill ${order.status === "취소" ? "soldout" : ""}`}
        >
          주문 {order.status}
        </span>
      </div>
      <p className="field-help">
        {orderDate(order.createdAt)} · 결제 수단: {order.payment ?? "미선택"}
      </p>
      <p>
        결제 {order.paymentStatus} · 배송 {order.shippingStatus ?? "미등록"}
      </p>
      <div className="order-lines">
        {order.items.map((i) => (
          <div className="checkout-product" key={i.productId}>
            <img src={productImage(i.image)} alt={i.name} />
            <div>
              <strong>{i.name}</strong>
              <p>
                {money(i.price)} · {i.quantity}개
              </p>
            </div>
            <strong>{money(i.price * i.quantity)}</strong>
          </div>
        ))}
      </div>
      <div className="order-info-grid">
        <section>
          <h3>배송 정보</h3>
          {order.shipping?.address ? (
            <dl className="detail-specs">
              <div>
                <dt>받는 분</dt>
                <dd>{order.shipping.recipient}</dd>
              </div>
              <div>
                <dt>연락처</dt>
                <dd>{order.shipping.phone}</dd>
              </div>
              <div>
                <dt>주소</dt>
                <dd>
                  ({order.shipping.postalCode}) {order.shipping.address}{" "}
                  {order.shipping.addressDetail}
                </dd>
              </div>
              <div>
                <dt>요청사항</dt>
                <dd>{order.shipping.memo || "없음"}</dd>
              </div>
            </dl>
          ) : (
            <p>저장된 배송 정보가 없습니다.</p>
          )}
        </section>
        <section>
          <h3>주문 금액</h3>
          <dl className="detail-specs">
            <div>
              <dt>상품 금액</dt>
              <dd>{money(order.subtotal)}</dd>
            </div>
            <div>
              <dt>배송비</dt>
              <dd>{order.shippingFee ? money(order.shippingFee) : "무료"}</dd>
            </div>
            <div>
              <dt>총 주문 금액</dt>
              <dd>
                <strong>{money(order.total)}</strong>
              </dd>
            </div>
          </dl>
        </section>
      </div>
      {order.status === "취소" && (
        <p className="demo-note">
          취소된 주문입니다. 상품 재고가 복원되었으며, 데모 주문이므로 실제
          환불은 발생하지 않습니다.
        </p>
      )}
    </div>
  );
}
