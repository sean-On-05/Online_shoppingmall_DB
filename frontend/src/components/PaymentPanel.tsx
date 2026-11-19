import { useRef, useState } from "react";
import {
  canPay,
  paymentMethods,
  type Order,
  type PaymentMethod,
} from "../domain";

export default function PaymentPanel({
  order,
  onPayment,
}: {
  order: Order;
  onPayment: (
    id: string,
    success: boolean,
    method: PaymentMethod,
  ) => Promise<string | null>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("카드");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function pay(success: boolean) {
    if (pending.current || !canPay(order)) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      setError((await onPayment(order.id, success, method)) ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제 요청에 실패했습니다.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (order.status === "취소") return null;
  return (
    <section className="checkout-section payment-panel" aria-label="모의 결제">
      <h2>모의 결제</h2>
      <p role="status">
        {order.paymentStatus === "완료"
          ? "결제가 완료되었습니다."
          : order.paymentStatus === "실패"
            ? "결제에 실패했습니다. 같은 주문으로 다시 결제할 수 있습니다."
            : `결제 상태: ${order.paymentStatus}`}
      </p>
      {canPay(order) && (
        <>
          <p className="field-help">
            실제 금액은 청구되지 않습니다. 모의 결제 결과를 선택해 주세요.
          </p>
          <label>
            결제 수단{" "}
            <select
              value={method}
              disabled={busy}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {paymentMethods.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <div className="dialog-actions">
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => void pay(true)}
            >
              {busy
                ? "처리 중…"
                : order.paymentStatus === "실패"
                  ? "결제 재시도 (성공)"
                  : "모의 결제 성공"}
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => void pay(false)}
            >
              모의 결제 실패
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
