import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

async function source(path) {
  const text = await readFile(new URL(path, import.meta.url), "utf8");
  return import(
    `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(text)).toString("base64")}`
  );
}
const { canPay, orderActions } = await source("../src/domain.ts");
const { paymentRequest, orderActionRequest } = await source(
  "../src/orderRequests.ts",
);
const { api } = await source("../src/api.ts");
const order = {
  status: "주문접수",
  paymentStatus: "대기",
  shippingStatus: null,
  shipping: { address: "서울" },
};

test("unpaid and failed orders allow retry but no shipment", () => {
  for (const paymentStatus of ["대기", "실패"]) {
    const value = { ...order, paymentStatus };
    assert.equal(canPay(value), true);
    assert.deepEqual(orderActions(value), ["취소"]);
  }
});
test("paid orders can register shipment or cancel, but cannot pay twice", () => {
  const value = { ...order, paymentStatus: "완료" };
  assert.equal(canPay(value), false);
  assert.deepEqual(orderActions(value), ["배송준비", "취소"]);
  assert.deepEqual(orderActions({ ...value, shipping: { address: "" } }), [
    "취소",
  ]);
});
test("shipping proceeds sequentially and disallows cancellation", () => {
  for (const [shippingStatus, actions] of [
    ["배송준비", ["배송중"]],
    ["배송중", ["배송완료"]],
    ["배송완료", []],
  ]) {
    const value = {
      ...order,
      status: "처리중",
      paymentStatus: "완료",
      shippingStatus,
    };
    assert.deepEqual(orderActions(value), actions);
    assert.equal(canPay(value), false);
  }
});
test("cancelled and completed orders have no actions even after failed payment", () => {
  for (const status of ["취소", "완료"]) {
    const value = { ...order, status, paymentStatus: "실패" };
    assert.equal(canPay(value), false);
    assert.deepEqual(orderActions(value), []);
  }
});
test("requests use payment and shipment endpoints with the required bodies", () => {
  assert.deepEqual(paymentRequest("SSU-1", false, "계좌이체"), {
    path: "/orders/SSU-1/payment",
    method: "POST",
    data: { success: false, paymentMethod: "계좌이체" },
  });
  assert.deepEqual(paymentRequest("SSU-1", true, "카드").data, {
    success: true,
    paymentMethod: "카드",
  });
  assert.deepEqual(orderActionRequest("SSU-1", "배송준비"), {
    path: "/orders/SSU-1/shipment",
    method: "POST",
    data: {},
  });
  for (const status of ["배송중", "배송완료"])
    assert.deepEqual(orderActionRequest("SSU-1", status), {
      path: "/orders/SSU-1/shipment",
      method: "PATCH",
      data: { status },
    });
  assert.deepEqual(orderActionRequest("SSU-1", "취소"), {
    path: "/orders/SSU-1",
    method: "PATCH",
    data: { status: "취소" },
  });
});
test("API sends session cookies and preserves backend error messages", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/orders/SSU-1/shipment");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.body, "{}");
    return new Response(
      JSON.stringify({ message: "이미 배송 등록이 완료된 주문입니다." }),
      { status: 409 },
    );
  });
  const request = orderActionRequest("SSU-1", "배송준비");
  await assert.rejects(
    api(request.path, request.method, request.data),
    /이미 배송 등록이 완료된 주문입니다/,
  );
});
