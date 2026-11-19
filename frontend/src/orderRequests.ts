import type { OrderAction, PaymentMethod } from "./domain";

export function paymentRequest(
  id: string,
  success: boolean,
  paymentMethod: PaymentMethod,
) {
  return {
    path: `/orders/${encodeURIComponent(id)}/payment`,
    method: "POST",
    data: { success, paymentMethod },
  };
}

export function orderActionRequest(id: string, action: OrderAction) {
  const path = `/orders/${encodeURIComponent(id)}`;
  if (action === "취소")
    return { path, method: "PATCH", data: { status: action } };
  if (action === "배송준비")
    return { path: `${path}/shipment`, method: "POST", data: {} };
  return {
    path: `${path}/shipment`,
    method: "PATCH",
    data: { status: action },
  };
}
