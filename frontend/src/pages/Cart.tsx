import { money, productImage, type CartItem, type Product } from "../data";
import Icon from "../components/Icon";
export default function Cart({
  products,
  items,
  onQuantity,
}: {
  products: Product[];
  items: CartItem[];
  onQuantity: (id: number, quantity: number) => void;
}) {
  const rows = items.flatMap((item) => {
    const product = products.find((p) => p.id === item.productId);
    return product ? [{ ...item, product }] : [];
  });
  const total = rows.reduce(
    (sum, row) => sum + row.product.price * row.quantity,
    0,
  );
  const shipping = total >= 50000 || total === 0 ? 0 : 3000;
  return (
    <main className="inner-page container">
      <span className="eyebrow">YOUR CAMPUS COLLECTION</span>
      <h1>
        장바구니 <span className="muted">({rows.length})</span>
      </h1>
      <p className="page-description">
        마음에 담은 숭실 굿즈, 이제 일상에서 함께해요.
      </p>
      {rows.length ? (
        <div className="cart-layout">
          <div className="cart-list">
            {rows.map((row) => (
              <article className="cart-row" key={row.productId}>
                <img
                  src={productImage(row.product.image)}
                  alt={row.product.name}
                />
                <div className="cart-detail">
                  <span className="product-category">
                    {row.product.category}
                  </span>
                  <h2>
                    <a href={`#/products/${row.productId}`}>
                      {row.product.name}
                    </a>
                  </h2>
                  {row.quantity > row.product.stock && (
                    <p className="form-error">
                      재고 부족 · 현재 {row.product.stock}개
                    </p>
                  )}
                  <strong>{money(row.product.price)}</strong>
                  <div className="quantity">
                    <button
                      aria-label={`${row.product.name} 수량 줄이기`}
                      disabled={row.quantity <= 1}
                      onClick={() =>
                        onQuantity(row.productId, row.quantity - 1)
                      }
                    >
                      −
                    </button>
                    <span>{row.quantity}</span>
                    <button
                      aria-label={`${row.product.name} 수량 늘리기`}
                      disabled={row.quantity >= Math.min(99, row.product.stock)}
                      onClick={() =>
                        onQuantity(row.productId, row.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  className="icon-button"
                  aria-label={`${row.product.name} 삭제`}
                  onClick={() => onQuantity(row.productId, 0)}
                >
                  <Icon name="close" />
                </button>
                <strong className="row-total">
                  {money(row.product.price * row.quantity)}
                </strong>
              </article>
            ))}
          </div>
          <aside className="order-summary">
            <h2>주문 예상 금액</h2>
            <dl>
              <div>
                <dt>상품 금액</dt>
                <dd>{money(total)}</dd>
              </div>
              <div>
                <dt>배송비</dt>
                <dd>{shipping ? money(shipping) : "무료"}</dd>
              </div>
              <div className="total">
                <dt>총 결제 금액</dt>
                <dd>{money(total + shipping)}</dd>
              </div>
            </dl>
            <p>
              {shipping
                ? `${money(50000 - total)} 더 담으면 무료배송이에요.`
                : "무료배송 혜택이 적용되었어요."}
            </p>
            <a className="primary-button" href="#/checkout">
              주문서 작성하기 <Icon name="arrow" size={17} />
            </a>
            <small>프로토타입 · 실제 결제는 진행되지 않습니다.</small>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="bag" size={42} />
          <h2>장바구니가 비어 있어요.</h2>
          <p>함께하고 싶은 숭실 굿즈를 찾아보세요.</p>
          <a className="hero-button" href="#/">
            쇼핑하러 가기 <Icon name="arrow" size={18} />
          </a>
        </div>
      )}
    </main>
  );
}
