import { useState } from "react";
import { money, productImage, type Product } from "../data";
import Icon from "../components/Icon";
export default function ProductDetail({
  product,
  inCart,
  onAdd,
}: {
  product?: Product;
  inCart: number;
  onAdd: (id: number, quantity: number) => Promise<string | null>;
}) {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  if (!product)
    return (
      <main className="inner-page empty-state container">
        <h1>상품을 찾을 수 없어요.</h1>
        <p>판매가 종료되었거나 삭제된 상품입니다.</p>
        <a className="hero-button" href="#/">
          굿즈 둘러보기
        </a>
      </main>
    );
  const available = Math.min(99 - inCart, product.stock - inCart);
  async function add(buy = false) {
    if (!product) return;
    const result = await onAdd(product.id, quantity);
    setError(result ?? "");
    if (buy && !result) location.hash = "#/checkout";
  }
  return (
    <main className="inner-page container">
      <nav className="breadcrumb" aria-label="현재 위치">
        <a href="#/">전체 굿즈</a>
        <span>/</span>
        <span>{product.category}</span>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <section className="detail-layout">
        <div className="detail-image">
          <img src={productImage(product.image)} alt={product.name} />
          <span>SSU CAMPUS COLLECTION · DESIGN CONCEPT</span>
        </div>
        <div className="detail-copy">
          <span className="eyebrow">SOONGSIL UNIVERSITY GOODS</span>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <div className="detail-price">
            {product.originalPrice && (
              <b>
                {Math.round((1 - product.price / product.originalPrice) * 100)}%
              </b>
            )}
            <strong>{money(product.price)}</strong>
            {product.originalPrice && <del>{money(product.originalPrice)}</del>}
          </div>
          <dl className="detail-specs">
            <div>
              <dt>컬렉션</dt>
              <dd>SSU Mall · {product.category}</dd>
            </div>
            <div>
              <dt>배송</dt>
              <dd>3,000원 · 5만원 이상 무료배송</dd>
            </div>
            <div>
              <dt>판매 상태</dt>
              <dd>
                {product.stock === 0 ? (
                  <span className="status-pill soldout">품절</span>
                ) : (
                  `재고 ${product.stock}개`
                )}
              </dd>
            </div>
          </dl>
          <div className="quantity-line">
            <span>구매 수량</span>
            <div className="quantity">
              <button
                aria-label="구매 수량 줄이기"
                disabled={quantity <= 1}
                onClick={() => setQuantity(quantity - 1)}
              >
                −
              </button>
              <span>{quantity}</span>
              <button
                aria-label="구매 수량 늘리기"
                disabled={quantity >= available}
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </button>
            </div>
          </div>
          {inCart > 0 && (
            <p className="field-help">
              장바구니에 이미 {inCart}개 담겨 있어요.
            </p>
          )}
          <div className="detail-total">
            <span>상품 합계</span>
            <strong>{money(product.price * quantity)}</strong>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="detail-actions">
            <button
              className="secondary-button"
              disabled={available < quantity}
              onClick={() => add()}
            >
              <Icon name="bag" size={18} />
              장바구니 담기
            </button>
            <button
              className="primary-button"
              disabled={available < quantity}
              onClick={() => add(true)}
            >
              {product.stock === 0 ? "품절된 상품" : "바로 주문하기"}
              <Icon name="arrow" size={18} />
            </button>
          </div>
          {product.stock > 0 && available < quantity && (
            <p className="form-error">
              추가 구매 가능한 수량이 부족합니다. 장바구니 수량을 확인해 주세요.
            </p>
          )}
          <p className="field-help">
            프로토타입용 굿즈 시안입니다. 실제 결제와 배송은 진행되지 않습니다.
          </p>
        </div>
      </section>
      <section className="detail-information">
        <h2>숭실의 순간을 일상으로.</h2>
        <p>
          캠퍼스의 자부심을 담아, 함께 입고 매일 쓰고 오래 간직하는 굿즈를
          제안합니다.
        </p>
        <div>
          <article>
            <h3>상품 안내</h3>
            <p>
              이미지와 가격은 디자인 시안입니다. 실제 제작 시 소재·사이즈·구성
              안내가 추가됩니다.
            </p>
          </article>
          <article>
            <h3>배송 · 교환 안내</h3>
            <p>
              데모 배송비는 3,000원이며, 상품 금액 5만원 이상은 무료배송으로
              계산됩니다.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
