import { money } from "../data";
import type { Order } from "../domain";
import OrderDetail, { orderDate } from "../components/OrderDetail";
import Icon from "../components/Icon";
export default function Orders({
  orders,
  orderId,
  complete,
}: {
  orders: Order[];
  orderId?: string;
  complete: boolean;
}) {
  const order = orders.find((o) => o.id === orderId);
  if (orderId && !order)
    return (
      <main className="inner-page empty-state container">
        <h1>주문을 찾을 수 없어요.</h1>
        <p>현재 사용자에게 연결된 주문만 확인할 수 있습니다.</p>
        <a className="hero-button" href="#/orders">
          주문 내역 보기
        </a>
      </main>
    );
  return (
    <main className="inner-page container">
      {order ? (
        <>
          <a className="breadcrumb" href="#/orders">
            ← 주문 내역으로
          </a>
          {complete && (
            <div className="order-success">
              <span>
                <Icon name="check" size={30} />
              </span>
              <span className="eyebrow">THANK YOU FOR YOUR ORDER</span>
              <h1>숭실의 일상이 곧 함께할 거예요.</h1>
              <p>
                데모 주문이 접수되었습니다. 실제 결제와 배송은 진행되지
                않습니다.
              </p>
            </div>
          )}
          {!complete && (
            <>
              <span className="eyebrow">YOUR ORDER DETAILS</span>
              <h1>주문 상세</h1>
            </>
          )}
          <OrderDetail order={order} />
          <div className="center-actions">
            <a className="secondary-button" href="#/orders">
              주문 내역 보기
            </a>
            <a className="primary-button" href="#/">
              쇼핑 계속하기 <Icon name="arrow" size={16} />
            </a>
          </div>
        </>
      ) : (
        <>
          <span className="eyebrow">YOUR CAMPUS MOMENTS</span>
          <h1>주문 내역</h1>
          <p className="page-description">
            현재 사용자의 데모 주문을 확인할 수 있어요.
          </p>
          {orders.length ? (
            <div className="customer-orders">
              {orders.map((o) => (
                <a
                  className="customer-order-card"
                  key={o.id}
                  href={`#/orders/${o.id}`}
                >
                  <div>
                    <span className="field-help">{orderDate(o.createdAt)}</span>
                    <span
                      className={`status-pill ${o.status === "취소" ? "soldout" : ""}`}
                    >
                      {o.status}
                    </span>
                  </div>
                  <strong>
                    {o.items[0]?.name}
                    {o.items.length > 1 ? ` 외 ${o.items.length - 1}종` : ""}
                  </strong>
                  <p>{o.id}</p>
                  <div>
                    <b>{money(o.total)}</b>
                    <span>주문 상세 보기 →</span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Icon name="box" size={42} />
              <h2>아직 주문 내역이 없어요.</h2>
              <p>나의 일상을 채울 숭실 굿즈를 만나보세요.</p>
              <a href="#/" className="hero-button">
                굿즈 둘러보기
              </a>
            </div>
          )}
        </>
      )}
    </main>
  );
}
