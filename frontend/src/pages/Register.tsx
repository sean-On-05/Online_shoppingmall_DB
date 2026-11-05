import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";

export default function Register() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== form.get("confirmPassword")) {
      setError("비밀번호 확인이 일치하지 않습니다."); return;
    }
    pending.current = true; setBusy(true); setError("");
    try {
      await api("/users", "POST", {
        username: String(form.get("username")).trim(),
        name: String(form.get("name")).trim(), password,
        email: String(form.get("email")).trim(),
        phone: String(form.get("phone")).trim(),
        address: String(form.get("address")).trim(),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "회원가입에 실패했습니다.");
    } finally { pending.current = false; setBusy(false); }
  }
  return <main className="inner-page login-page container">
    <div className="login-intro"><span className="eyebrow">JOIN SSU MALL</span><h1>숭실의 일상을<br />함께해요.</h1><p>나만의 계정으로 굿즈와 주문을 관리하세요.</p></div>
    <section className="login-card">
      <h2>{done ? "회원가입 완료" : "회원가입"}</h2>
      {done ? <><p role="status">계정이 생성되었습니다. 로그인 후 이용해 주세요.</p><a className="primary-button" href="#/login">로그인하기</a></> : <>
        <p>모든 항목을 입력해 주세요.</p>
        <form className="product-form" onSubmit={submit}>
          <label>아이디<input name="username" required minLength={4} maxLength={30} pattern="[A-Za-z0-9_]{4,30}" autoComplete="username" placeholder="영문·숫자·밑줄 4~30자" /></label>
          <label>이름<input name="name" required maxLength={50} autoComplete="name" /></label>
          <label>이메일<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="example@email.com" /></label>
          <label>전화번호<input name="phone" type="tel" required maxLength={20} autoComplete="tel" placeholder="010-1234-5678" /></label>
          <label>주소<input name="address" required maxLength={200} autoComplete="street-address" placeholder="기본 주소와 상세 주소를 입력하세요" /></label>
          <label>비밀번호<input name="password" type="password" required minLength={8} maxLength={100} autoComplete="new-password" placeholder="8~100자" /></label>
          <label>비밀번호 확인<input name="confirmPassword" type="password" required minLength={8} maxLength={100} autoComplete="new-password" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "가입 중…" : "회원가입"}</button>
        </form>
        <a className="text-button" href="#/login">이미 계정이 있나요? 로그인</a>
      </>}
    </section>
  </main>;
}
