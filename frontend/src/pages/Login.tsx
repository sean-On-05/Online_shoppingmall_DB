import { useState } from "react";
import type { FormEvent } from "react";
import Icon from "../components/Icon";
export default function Login({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<string | null>;
}) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = await onLogin(
        String(form.get("username")).trim(),
        String(form.get("password")),
      );
    setError(message ?? "");
  }
  return (
    <main className="inner-page login-page container">
      <div className="login-intro">
        <span className="eyebrow">WELCOME TO SSU MALL</span>
        <h1>
          나의 캠퍼스를
          <br />
          일상으로 만나는 곳.
        </h1>
        <p>SSU Mall에서 나만의 숭실 굿즈를 만나보세요.</p>
        <div className="login-mark" aria-hidden="true">
          SSU<span> Mall</span>
        </div>
      </div>
      <section className="login-card">
        <span className="login-icon">
          <Icon name="bag" size={25} />
        </span>
        <h2>로그인</h2>
        <p>SSU Mall 계정으로 로그인해 주세요.</p>
        <form className="product-form" onSubmit={submit}>
          <label>
            아이디
            <input
              name="username"
              autoComplete="username"
              placeholder="아이디를 입력하세요"
              required
              maxLength={80}
              onChange={() => setError("")}
            />
          </label>
          <label>
            비밀번호
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
              required
              maxLength={100}
              onChange={() => setError("")}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit">
            로그인 <Icon name="arrow" size={17} />
          </button>
        </form>
        <a className="text-button" href="#/register">계정이 없나요? 회원가입</a>
        <a className="text-button" href="#/">
          ← 쇼핑몰로 돌아가기
        </a>
      </section>
    </main>
  );
}
