import { useState } from "react";
import Icon from "./Icon";
import { canManageShop, type SessionUser } from "../auth";
export type Page = "home" | "cart" | "admin" | "other";
interface Props {
  page: Page;
  collection: string;
  count: number;
  query: string;
  user: SessionUser | null;
  onLogout: () => void;
  onSearch: (query: string) => void;
}
export default function Navbar({
  page,
  collection,
  count,
  query,
  user,
  onLogout,
  onSearch,
}: Props) {
  const [open, setOpen] = useState(false);
  const activeCollection = ["new", "best", "sale"].includes(collection)
    ? collection
    : "";
  const isActive = (value: string) =>
    page === "home" && activeCollection === value;
  return (
    <>
      <div className="announcement">
        숭실을 담은 일상, SSU Mall{" "}
        <span>캠퍼스 굿즈 컬렉션 · 5만원 이상 무료배송</span>
        <Icon name="arrow" size={14} />
      </div>
      <header className="site-header">
        <div className="header-inner container">
          <a href="#/" className="logo" aria-label="SSU Mall 홈">
            SSU<span> Mall</span>
          </a>
          <nav
            className={open ? "main-nav is-open" : "main-nav"}
            aria-label="주 메뉴"
          >
            <a
              href="#/"
              className={isActive("") ? "active" : ""}
              aria-current={isActive("") ? "page" : undefined}
              onClick={() => {
                onSearch("");
                setOpen(false);
              }}
            >
              전체 굿즈
            </a>
            <a
              href="#/?collection=new"
              className={isActive("new") ? "active" : ""}
              aria-current={isActive("new") ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              신상품 <i />
            </a>
            <a
              href="#/?collection=best"
              className={isActive("best") ? "active" : ""}
              aria-current={isActive("best") ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              베스트
            </a>
            <a
              href="#/?collection=sale"
              className={isActive("sale") ? "active" : ""}
              aria-current={isActive("sale") ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              시즌 세일 <span>SALE</span>
            </a>
          </nav>
          <div className="header-actions">
            <label className="search">
              <input
                aria-label="상품 검색"
                placeholder="나만의 숭실 굿즈 찾기"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
              />
              <Icon name="search" size={18} />
            </label>
            <a
              href="#/cart"
              className="cart-link"
              aria-label={`장바구니 ${count}개`}
            >
              <Icon name="bag" size={23} />
              <b>{count}</b>
            </a>
            <a className="admin-link" href="#/mypage">
              마이페이지
            </a>
            {canManageShop(user) && (
              <a className="admin-link" href="#/admin">
                관리자
              </a>
            )}
            {user ? (
              <>
                <span className="account-name">{user.displayName}님</span>
                <button
                  className="admin-link account-logout"
                  onClick={onLogout}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <a className="admin-link" href="#/login">
                  로그인
                </a>
                <a className="admin-link" href="#/register">
                  회원가입
                </a>
              </>
            )}
            <button
              className="mobile-menu icon-button"
              aria-label="메뉴 열기"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
