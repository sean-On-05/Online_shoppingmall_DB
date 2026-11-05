import { useState } from "react";
import type { Product } from "../data";
import { money, productImage } from "../data";
import Icon from "./Icon";
export default function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (id: number) => void;
}) {
  const [liked, setLiked] = useState(false);
  return (
    <article className="product-card">
      <div className="product-image">
        <a
          className="product-image-link"
          href={`#/products/${product.id}`}
          aria-label={`${product.name} 상세 보기`}
        >
          <img
            src={productImage(product.image)}
            alt={product.name}
            loading="lazy"
          />
        </a>
        {product.stock === 0 && (
          <span className="soldout-overlay">SOLD OUT</span>
        )}
        {product.label && (
          <span
            className={`product-label ${product.label === "NEW" ? "new" : ""}`}
          >
            {product.label}
          </span>
        )}
        <button
          className={`favorite icon-button ${liked ? "liked" : ""}`}
          aria-label={`${product.name} 찜${liked ? " 취소" : "하기"}`}
          aria-pressed={liked}
          onClick={() => setLiked(!liked)}
        >
          <Icon name="heart" size={19} />
        </button>
        <button
          className="add-to-cart"
          disabled={product.stock === 0}
          onClick={() => onAdd(product.id)}
        >
          <Icon name="bag" size={16} />{" "}
          {product.stock === 0 ? "품절" : "장바구니 담기"}
        </button>
      </div>
      <div className="product-info">
        <span className="product-category">{product.category}</span>
        <h3>
          <a href={`#/products/${product.id}`}>{product.name}</a>
        </h3>
        <div className="product-price">
          {product.originalPrice && (
            <b>
              {Math.round((1 - product.price / product.originalPrice) * 100)}%
            </b>
          )}
          <strong>{money(product.price)}</strong>
          {product.originalPrice && <del>{money(product.originalPrice)}</del>}
        </div>
        <div className="product-rating">
          <small>SSU CAMPUS COLLECTION</small>
        </div>
      </div>
    </article>
  );
}
