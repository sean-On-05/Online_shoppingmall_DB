import Icon from "./Icon";
export default function HeroSection() {
  return (
    <section className="hero campus-hero">
      <div className="campus-hero-inner container">
        <div className="campus-hero-copy">
          <span className="hero-kicker">
            <span /> SOONGSIL UNIVERSITY GOODS COLLECTION
          </span>
          <h1>
            나의 캠퍼스,
            <br />
            나의 <em>숭실.</em>
          </h1>
          <p>
            함께 입고, 매일 쓰고, 오래 간직하는.
            <br />
            숭실의 순간을 일상으로 가져오세요.
          </p>
          <a
            href="#products"
            className="hero-button"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("products")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            숭실 굿즈 만나보기 <Icon name="arrow" size={18} />
          </a>
          <div className="hero-footnote">
            <strong>SSU Mall</strong>
            <span>WEAR YOUR PRIDE. CARRY YOUR CAMPUS.</span>
          </div>
        </div>
        <div
          className="campus-showcase"
          aria-label="숭실대학교 굿즈 디자인 시안"
        >
          <span className="showcase-word" aria-hidden="true">
            SOONGSIL
          </span>
          <div className="showcase-orbit" />
          <div className="showcase-main">
            <span className="showcase-tag">THE CAMPUS ESSENTIAL</span>
            <img
              src="/images/goods/varsity.svg"
              alt="네이비와 아이보리 배색의 숭실 바시티 재킷 디자인 시안"
              fetchPriority="high"
            />
            <div>
              <span>SSU CLASSIC VARSITY</span>
              <strong>우리의 캠퍼스 룩.</strong>
            </div>
          </div>
          <div className="showcase-small showcase-tote">
            <img
              src="/images/goods/tote.svg"
              alt="SSU 로고 에코백 디자인 시안"
            />
            <span>CARRY SSU EVERYWHERE ↗</span>
          </div>
          <div className="showcase-stamp" aria-hidden="true">
            SOONGSIL
            <br />
            <strong>1897</strong>
            <br />
            CAMPUS GOODS
          </div>
          <span className="showcase-caption">
            BLUE IN OUR EVERYDAY. <span>SSU COLLECTION / 01</span>
          </span>
        </div>
      </div>
    </section>
  );
}
