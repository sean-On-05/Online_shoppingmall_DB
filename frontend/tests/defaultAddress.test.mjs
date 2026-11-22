import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const source = await readFile(
  new URL("../src/shippingDraft.ts", import.meta.url),
  "utf8",
);
const {
  createShippingDraft,
  shippingDraftReducer: reduce,
  hasShippingInput,
} = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`
);
const saved = {
  recipient: "기본 수령인",
  phone: "01012345678",
  postalCode: "06978",
  address: "기본 주소",
  addressDetail: "101호",
  memo: "문 앞",
};

test("first default address fills an untouched checkout once", () => {
  const state = reduce(createShippingDraft(), {
    type: "automatic",
    address: saved,
  });
  assert.deepEqual(state.values, saved);
  assert.notEqual(state.values, saved);
  assert.equal(state.autoAttempted, true);
  assert.equal(
    reduce(state, {
      type: "automatic",
      address: { ...saved, address: "다른 주소" },
    }),
    state,
  );
});

test("a late lookup never overwrites user typing", async () => {
  let resolveLookup;
  const lookup = new Promise((resolve) => {
    resolveLookup = resolve;
  });
  let state = createShippingDraft();
  const completion = lookup.then((address) => {
    state = reduce(state, { type: "automatic", address });
  });
  state = reduce(state, { type: "edit", field: "recipient", value: "입력 중" });
  resolveLookup(saved);
  await completion;
  assert.equal(state.values.recipient, "입력 중");
  assert.equal(state.values.address, "");
});

test("typing then clearing still prevents automatic replacement", () => {
  let state = reduce(createShippingDraft(), {
    type: "edit",
    field: "phone",
    value: "010",
  });
  state = reduce(state, { type: "edit", field: "phone", value: "" });
  assert.equal(hasShippingInput(state.values), false);
  assert.deepEqual(
    reduce(state, { type: "automatic", address: saved }).values,
    state.values,
  );
});

test("missing defaults and guest initial state remain empty", () => {
  const initial = createShippingDraft();
  assert.equal(hasShippingInput(initial.values), false);
  const state = reduce(initial, { type: "automatic", address: null });
  assert.deepEqual(state.values, initial.values);
  assert.equal(reduce(state, { type: "automatic", address: saved }), state);
});

test("explicit replacement copies the default without modifying saved data", () => {
  const snapshot = structuredClone(saved);
  let state = reduce(createShippingDraft(), {
    type: "replace",
    address: saved,
  });
  state = reduce(state, {
    type: "edit",
    field: "address",
    value: "이번 주문만 변경",
  });
  assert.equal(state.values.address, "이번 주문만 변경");
  assert.deepEqual(saved, snapshot);
  assert.equal(hasShippingInput(state.values), true);
});

test("a fresh checkout entry has its own automatic fill lifecycle", () => {
  const previous = reduce(createShippingDraft(), {
    type: "edit",
    field: "memo",
    value: "이전 주문",
  });
  const current = reduce(createShippingDraft(), {
    type: "automatic",
    address: saved,
  });
  assert.equal(previous.values.memo, "이전 주문");
  assert.deepEqual(current.values, saved);
});
