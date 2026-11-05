import { useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import type { Page } from "./components/Navbar";
import Footer from "./components/Footer";
import Icon from "./components/Icon";
import Home from "./pages/Home";
import Cart from "./pages/Cart";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyPage from "./pages/MyPage";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import type { ShopState, ShippingInfo } from "./domain";
import { canManageShop, loginDestination, type SessionUser } from "./auth";
import { api } from "./api";
export default function App() {
  const [hash, setHash] = useState(location.hash);
  const [shop, setShop] = useState<ShopState>({ products: [], items: [], orders: [] });
  const [user, setUser] = useState<SessionUser | null>(null);
  const [query, setQuery] = useState("");
  const pendingSearch = useRef<string | null>(null);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const busy = useRef(false);
  const path = hash.split("?")[0].replace(/^#/, "") || "/";
  const isAdmin = path === "/admin" || path.startsWith("/admin/");
  const page: Page = isAdmin
    ? "admin"
    : path === "/cart"
      ? "cart"
      : path === "/"
        ? "home"
        : "other";
  const collection =
    new URLSearchParams(hash.split("?")[1]).get("collection") ?? "";
  useEffect(() => {
    const change = () => {
      setHash(location.hash);
      setQuery(pendingSearch.current ?? "");
      pendingSearch.current = null;
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    async function load() {
      try {
        const session = await api<{ user: SessionUser | null }>("/session");
        setUser(session.user);
        setShop(await api<ShopState>("/shop"));
        setReady(true);
      } catch (e) { setLoadError(e instanceof Error ? e.message : "서버 연결 실패"); }
    }
    void load();
  }, []);
  async function perform(url: string, method: string, data?: unknown, message = "") {
    if (busy.current) return "이전 요청을 처리 중입니다.";
    busy.current = true;
    try {
      const result = await api<ShopState & { orderId?: string }>(url, method, data);
      setShop(result);
      if (message) setToast(message);
      if (result.orderId) location.hash = `#/orders/${result.orderId}?complete=1`;
      return null;
    } catch (e) {
      const message = e instanceof Error ? e.message : "요청 실패";
      setToast(message); return message;
    } finally { busy.current = false; }
  }
  function add(id: number, quantity = 1) {
    return perform(`/cart/items/${id}`, "PUT", { increment: quantity }, "장바구니에 담았어요.");
  }
  async function login(username: string, password: string) {
    try {
      const result = await api<ShopState & { user: SessionUser }>("/session", "POST", { username, password });
      setUser(result.user); setShop(result);
      location.hash = `#${loginDestination(result.user, new URLSearchParams(hash.split("?")[1]).get("returnTo"))}`;
      return null;
    } catch (e) { return e instanceof Error ? e.message : "로그인 실패"; }
  }
  async function logout() {
    try {
      await api("/session", "DELETE");
      setUser(null); setShop({products: [], items: [], orders: []});
      location.hash = "#/";
      setShop(await api<ShopState>("/shop"));
      return true;
    } catch (e) { setToast(e instanceof Error ? e.message : "로그아웃 실패"); return false; }
  }
  async function switchAccount() {
    if (await logout()) location.hash = `#/login?returnTo=${encodeURIComponent(path)}`;
  }
  function checkout(shipping: ShippingInfo) {
    return perform("/orders", "POST", shipping, "주문이 접수되었어요.");
  }
  useEffect(() => {
    if (ready && isAdmin && !user)
      location.hash = `#/login?returnTo=${encodeURIComponent(path)}`;
  }, [ready, isAdmin, user, path]);
  let content;
  if (isAdmin)
    content = canManageShop(user) ? (
      <Admin
        products={shop.products}
        orders={shop.orders}
        section={path.split("/")[2] ?? "products"}
        onLogout={logout}
        onSave={(p) =>
          perform(shop.products.some(x => x.id === p.id) ? `/products/${p.id}` : "/products", shop.products.some(x => x.id === p.id) ? "PUT" : "POST", p, "상품을 저장했어요.")
        }
        onDelete={(id) =>
          perform(`/products/${id}`, "DELETE", undefined, "상품을 삭제했어요.")
        }
        onStatus={(id, status) =>
          perform(
            `/orders/${id}`, "PATCH", { status }, "주문 상태를 변경했어요.",
          )
        }
      />
    ) : user ? (
      <main className="inner-page empty-state container">
        <Icon name="bag" size={40} />
        <h1>관리자 권한이 필요한 페이지입니다.</h1>
        <p>현재 고객 계정으로 로그인되어 있습니다.</p>
        <div className="center-actions">
          <a className="secondary-button" href="#/">
            쇼핑 계속하기
          </a>
          <button className="primary-button" onClick={switchAccount}>
            다른 계정으로 로그인
          </button>
        </div>
      </main>
    ) : (
      <Login onLogin={login} />
    );
  else if (path === "/mypage")
    content = <MyPage key={user?.id ?? "guest"} user={user} />;
  else if (path === "/register")
    content = user ? <main className="inner-page container"><h1>이미 로그인되어 있습니다.</h1><a href="#/">쇼핑 계속하기</a></main> : <Register />;
  else if (path === "/login")
    content = user ? (
      <main className="inner-page empty-state container">
        <span className="eyebrow">WELCOME TO SSU MALL</span>
        <h1>{user.displayName}님, 로그인되어 있어요.</h1>
        <p>
          {canManageShop(user) ? "관리자 계정" : "고객 계정"} · {user.username}
        </p>
        <div className="center-actions">
          <a className="secondary-button" href="#/">
            쇼핑 계속하기
          </a>
          {canManageShop(user) && (
            <a className="primary-button" href="#/admin">
              관리자 화면
            </a>
          )}
          <button className="secondary-button" onClick={switchAccount}>
            다른 계정으로 로그인
          </button>
        </div>
      </main>
    ) : (
      <Login onLogin={login} />
    );
  else if (path === "/")
    content = (
      <Home
        products={shop.products}
        query={query}
        collection={collection}
        onAdd={add}
      />
    );
  else if (path === "/cart")
    content = (
      <Cart
        products={shop.products}
        items={shop.items}
        onQuantity={(id, quantity) =>
          perform(`/cart/items/${id}`, "PUT", { quantity })
        }
      />
    );
  else if (/^\/products\/\d+$/.test(path))
    content = (
      <ProductDetail
        key={path}
        product={shop.products.find((p) => p.id === Number(path.split("/")[2]))}
        inCart={
          shop.items.find((i) => i.productId === Number(path.split("/")[2]))
            ?.quantity ?? 0
        }
        onAdd={add}
      />
    );
  else if (path === "/checkout")
    content = (
      <Checkout
        products={shop.products}
        items={shop.items}
        onSubmit={checkout}
      />
    );
  else if (path === "/orders" || path.startsWith("/orders/"))
    content = (
      <Orders
        orders={shop.orders}
        orderId={path.split("/")[2]}
        complete={
          new URLSearchParams(hash.split("?")[1]).get("complete") === "1"
        }
      />
    );
  else
    content = (
      <main className="inner-page empty-state container">
        <h1>페이지를 찾을 수 없어요.</h1>
        <a href="#/" className="hero-button">
          홈으로 돌아가기
        </a>
      </main>
    );
  return (
    <>
      <Navbar
        page={page}
        collection={collection}
        count={shop.items.reduce((sum, i) => sum + i.quantity, 0)}
        query={query}
        user={user}
        onLogout={logout}
        onSearch={(value) => {
          if (page !== "home") {
            pendingSearch.current = value;
            location.hash = "#/";
            setHash("#/");
          }
          setQuery(value);
        }}
      />
      {!ready ? <main className="inner-page container"><p role="status">{loadError || "서버에서 불러오는 중…"}</p>{loadError && <button onClick={() => location.reload()}>다시 시도</button>}</main> : content}
      <Footer />
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {toast}
          <button
            className="icon-button"
            aria-label="알림 닫기"
            onClick={() => setToast("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </>
  );
}
