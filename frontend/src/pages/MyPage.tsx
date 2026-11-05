import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { SessionUser } from "../auth";
import type { Order } from "../domain";
import { api } from "../api";
import { money } from "../data";
import { orderDate } from "../components/OrderDetail";

interface Profile { username: string; name: string; email: string; phone: string; address: string }

export default function MyPage({ user }: { user: SessionUser | null }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    if (!user) return;
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const [p, o] = await Promise.all([api<Profile>("/me"), api<Order[]>("/me/orders")]);
        if (active) { setProfile(p); setOrders(o); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "불러오기에 실패했습니다."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [user, retry]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || pending.current) return;
    pending.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const updated = await api<Profile>("/me", "PATCH", { email: profile.email, phone: profile.phone, address: profile.address });
      setProfile(updated); setMessage("개인정보를 저장했습니다.");
    } catch (e) { setError(e instanceof Error ? e.message : "저장에 실패했습니다."); }
    finally { pending.current = false; setSaving(false); }
  }
  return <main className="inner-page container mypage">
    <span className="eyebrow">MY SSU MALL</span><h1>마이페이지</h1>
    <p className="page-description">개인정보와 주문 내역을 관리하세요.</p>
    {!user ? <section className="checkout-section"><h2>로그인 후 이용해 주세요.</h2><p>개인정보와 회원 주문 내역을 확인할 수 있어요.</p><div className="mypage-links"><a className="primary-button" href="#/login?returnTo=%2Fmypage">로그인</a><a className="secondary-button" href="#/orders">비회원 주문 내역</a></div></section> : <>
      {loading && <p role="status">내 정보를 불러오는 중…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !profile && <button className="secondary-button" onClick={() => setRetry(retry + 1)}>다시 시도</button>}
      {!loading && profile && <div className="mypage-grid">
        <section className="checkout-section" id="profile-section"><h2>개인정보 관리</h2><p>{profile.name}님 · {profile.username}</p>
          <form className="product-form" onSubmit={save}>
            <label>이메일<input type="email" required maxLength={254} autoComplete="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} /></label>
            <label>전화번호<input type="tel" required maxLength={20} autoComplete="tel" placeholder="010-1234-5678" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></label>
            <label>주소<input required maxLength={200} autoComplete="street-address" value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} /></label>
            <p className="field-help">주소를 수정해도 기존 주문의 배송지는 변경되지 않습니다.</p>
            {message && <p role="status">{message}</p>}
            <button className="primary-button" disabled={saving}>{saving ? "저장 중…" : "개인정보 저장"}</button>
          </form>
        </section>
        <section className="checkout-section" id="order-section"><h2>나의 주문 내역 <small>({orders.length}건)</small></h2>
          {orders.length ? <div className="customer-orders">{orders.map(o => <a className="customer-order-card" key={o.id} href={`#/orders/${o.id}`}><div><span className="field-help">{orderDate(o.createdAt)}</span><span className="status-pill">{o.status}</span></div><strong>{o.items[0]?.name}{o.items.length > 1 ? ` 외 ${o.items.length - 1}종` : ""}</strong><p>{o.id}</p><div><b>{money(o.total)}</b><span>상세 보기 →</span></div></a>)}</div> : <p>아직 주문 내역이 없어요.</p>}
        </section>
      </div>}
    </>}
  </main>;
}
