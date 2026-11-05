export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main container">
        <div className="footer-brand">
          <a href="#/" className="logo">
            SSU<span> Mall</span>
          </a>
          <p>
            캠퍼스의 자부심을 일상으로.
            <br />
            숭실을 담은 작은 물건, 오래 남을 우리 이야기.
          </p>
          <span>SOONGSIL UNIVERSITY · SINCE 1897</span>
        </div>
        <div>
          <h3>SHOP</h3>
          <a href="#/">전체 굿즈</a>
          <a href="#/?collection=new">신상품</a>
          <a href="#/?collection=best">베스트</a>
          <a href="#/orders">주문 내역</a>
        </div>
        <div>
          <h3>INFORMATION</h3>
          <p>배송 · 교환 안내</p>
          <p>5만원 이상 무료배송</p>
          <p>수령 후 7일 이내 교환·반품</p>
        </div>
        <div className="footer-customer">
          <h3>CUSTOMER CARE</h3>
          <strong>숭실 굿즈에 관한 이야기</strong>
          <p>평일 10:00 – 17:00 · 주말 및 공휴일 휴무</p>
          <span>숭실대학교 굿즈 쇼핑몰 콘셉트 · 비공식 프로토타입</span>
        </div>
      </div>
      <div className="footer-bottom container">
        <span>© {new Date().getFullYear()} SSU Mall. All rights reserved.</span>
        <span>상품 이미지와 가격은 디자인 시안입니다.</span>
      </div>
    </footer>
  );
}
