import { useState } from "react";
import HeroSection from "../components/HeroSection";
import ProductCard from "../components/ProductCard";
import Icon from "../components/Icon";
import { categories, type Product } from "../data";
export default function Home({
  products,
  query,
  collection,
  onAdd,
}: {
  products: Product[];
  query: string;
  collection: string;
  onAdd: (id: number) => void;
}) {
  const [category, setCategory] = useState("전체");
  const [sort, setSort] = useState("recommended");
  const [limit, setLimit] = useState(8);
  const filtered = products
    .filter(
      (p) =>
        (category === "전체" || p.category === category) &&
        p.name.toLowerCase().includes(query.toLowerCase()) &&
        (collection === "new"
          ? p.label === "NEW"
          : collection === "best"
            ? p.label === "BEST"
            : collection === "sale"
              ? !!p.originalPrice
              : true),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : b.id * Number(sort === "new") - a.id * Number(sort === "new"),
    );
  return (
    <main>
      <HeroSection />
      <section className="benefits container" aria-label="쇼핑 혜택">
        <div>
          <Icon name="truck" size={25} />
          <p>
            <strong>캠퍼스 밖에서도, 숭실과 함께</strong>
            <span>5만원 이상 구매 시 배송비는 저희가</span>
          </p>
        </div>
        <div>
          <Icon name="box" size={25} />
          <p>
            <strong>입고, 쓰고, 간직하는 숭실</strong>
            <span>과잠부터 문구까지, 나만의 캠퍼스 컬렉션</span>
          </p>
        </div>
        <div>
          <Icon name="leaf" size={25} />
          <p>
            <strong>소중한 사람에게, 숭실 한 조각</strong>
            <span>입학과 졸업, 특별한 순간을 위한 선물</span>
          </p>
        </div>
      </section>
      <section className="product-section container" id="products">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR CAMPUS ESSENTIALS</span>
            <h2>
              {query
                ? `‘${query}’ 검색 결과`
                : collection === "new"
                  ? "새롭게 만나는 숭실 굿즈"
                  : collection === "best"
                    ? "숭실인의 베스트 픽"
                    : collection === "sale"
                      ? "가볍게 만나는 캠퍼스 굿즈"
                      : "매일 함께하는, 나의 숭실"}
            </h2>
            <p>강의실부터 일상까지. 숭실의 색을 담은 굿즈를 만나보세요.</p>
          </div>
          <span className="collection-note">
            MADE FOR YOUR CAMPUS DAYS <Icon name="arrow" size={18} />
          </span>
        </div>
        <div className="product-toolbar">
          <div className="category-tabs" aria-label="상품 카테고리">
            {categories.map((c) => (
              <button
                key={c}
                className={category === c ? "selected" : ""}
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(c);
                  setLimit(8);
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="sort-label">
            <span>{filtered.length}개의 상품</span>
            <select
              aria-label="상품 정렬"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recommended">추천순</option>
              <option value="new">최신순</option>
              <option value="low">낮은 가격순</option>
              <option value="high">높은 가격순</option>
            </select>
          </label>
        </div>
        {filtered.length ? (
          <div className="product-grid">
            {filtered.slice(0, limit).map((p) => (
              <ProductCard key={p.id} product={p} onAdd={onAdd} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Icon name="search" size={36} />
            <h3>검색된 상품이 없어요.</h3>
            <p>다른 검색어나 카테고리를 선택해 보세요.</p>
          </div>
        )}
        {filtered.length > limit && (
          <button
            className="outline-button load-more"
            onClick={() => setLimit(limit + 8)}
          >
            상품 더 보기 <Icon name="arrow" size={16} />
          </button>
        )}
      </section>
      <section className="story-banner container">
        <div>
          <span className="eyebrow">THE SOONGSIL COLLECTION</span>
          <h2>시작의 설렘도, 함께한 추억도.</h2>
          <p>
            새내기의 첫 과잠부터 졸업을 기념하는 선물까지, 숭실의 순간을
            간직하세요.
          </p>
        </div>
        <span className="story-signature">
          Always SSU,
          <br />
          wherever you go.
        </span>
      </section>
    </main>
  );
}
