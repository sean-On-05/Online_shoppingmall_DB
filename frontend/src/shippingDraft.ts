import type { ShippingInfo } from "./domain";

export const emptyShipping = (): ShippingInfo => ({
  recipient: "",
  phone: "",
  postalCode: "",
  address: "",
  addressDetail: "",
  memo: "",
});
export const hasShippingInput = (shipping: ShippingInfo) =>
  Object.values(shipping).some((value) => value.trim().length > 0);

export interface ShippingDraft {
  values: ShippingInfo;
  edited: boolean;
  autoAttempted: boolean;
}
type Action =
  | { type: "edit"; field: keyof ShippingInfo; value: string }
  | { type: "automatic"; address: ShippingInfo | null }
  | { type: "replace"; address: ShippingInfo };

export const createShippingDraft = (): ShippingDraft => ({
  values: emptyShipping(),
  edited: false,
  autoAttempted: false,
});

export function shippingDraftReducer(
  state: ShippingDraft,
  action: Action,
): ShippingDraft {
  if (action.type === "edit")
    return {
      ...state,
      edited: true,
      values: { ...state.values, [action.field]: action.value },
    };
  if (action.type === "replace")
    return { ...state, edited: true, values: { ...action.address } };
  if (state.autoAttempted) return state;
  // Even typing and then clearing a field counts as user editing. A late
  // response must not overwrite that choice, and can only apply once per entry.
  return {
    ...state,
    autoAttempted: true,
    values:
      !state.edited && !hasShippingInput(state.values) && action.address
        ? { ...action.address }
        : state.values,
  };
}
