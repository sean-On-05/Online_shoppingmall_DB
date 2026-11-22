import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import { validateShipping, type ShippingInfo } from "../domain";
import { emptyShipping } from "../shippingDraft";
import ShippingFields from "./ShippingFields";

export default function DefaultAddress() {
  const [address, setAddress] = useState<ShippingInfo>(emptyShipping);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await api<{ address: ShippingInfo | null }>(
          "/me/default-address",
        );
        if (active) {
          setAddress(result.address ?? emptyShipping());
          setSaved(result.address !== null);
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "기본 배송지를 불러오지 못했습니다.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [retry]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError("");
    setMessage("");
    try {
      validateShipping(address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "배송 정보를 확인해 주세요.");
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const result = await api<{ address: ShippingInfo; message: string }>(
        "/me/default-address",
        "PUT",
        address,
      );
      setAddress(result.address);
      setSaved(true);
      setMessage(result.message);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "기본 배송지 저장에 실패했습니다.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (
      pending.current ||
      !window.confirm(
        "기본 배송지를 삭제하시겠어요? 기존 주문의 배송 정보는 유지됩니다.",
      )
    )
      return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ message: string }>(
        "/me/default-address",
        "DELETE",
      );
      setAddress(emptyShipping());
      setSaved(false);
      setMessage(result.message);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "기본 배송지 삭제에 실패했습니다.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className="default-address-section"
      aria-labelledby="default-address-title"
    >
      <h2 id="default-address-title">기본 배송지</h2>
      <p className="field-help">
        개인정보의 주소와 별도로 저장되며, 주문서에서 불러올 수 있습니다.
      </p>
      {loading ? (
        <p role="status">기본 배송지를 불러오는 중…</p>
      ) : (
        <>
          <form className="product-form" onSubmit={save}>
            <ShippingFields
              value={address}
              disabled={busy}
              onChange={(field, value) =>
                setAddress((current) => ({ ...current, [field]: value }))
              }
            />
            <div className="shipping-actions">
              <button className="primary-button" type="submit" disabled={busy}>
                {busy
                  ? "처리 중…"
                  : saved
                    ? "기본 배송지 수정"
                    : "기본 배송지 등록"}
              </button>
              {saved && (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  기본 배송지 삭제
                </button>
              )}
            </div>
          </form>
          {error && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setRetry((value) => value + 1)}
            >
              저장된 배송지 다시 조회
            </button>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
