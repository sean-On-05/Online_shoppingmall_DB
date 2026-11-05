import { initialProducts, type Product } from "./data";
import { orderStatuses, type ShopState, type Order } from "./domain";
export const STORE_KEY = "ssu-mall-store-v2";
function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const p = value as Product;
  return (
    Number.isSafeInteger(p.id) &&
    typeof p.name === "string" &&
    typeof p.category === "string" &&
    typeof p.image === "string" &&
    Number.isInteger(p.price) &&
    p.price > 0 &&
    Number.isInteger(p.stock) &&
    p.stock >= 0 &&
    typeof p.description === "string"
  );
}
function isOrder(value: unknown): value is Order {
  if (!value || typeof value !== "object") return false;
  const o = value as Order;
  return (
    typeof o.id === "string" &&
    typeof o.createdAt === "string" &&
    orderStatuses.includes(o.status) &&
    Number.isFinite(o.total) &&
    Number.isFinite(o.subtotal) &&
    Number.isFinite(o.shippingFee) &&
    Array.isArray(o.items) &&
    o.items.every(
      (i) =>
        i &&
        Number.isSafeInteger(i.productId) &&
        typeof i.name === "string" &&
        typeof i.image === "string" &&
        Number.isFinite(i.price) &&
        Number.isInteger(i.quantity) &&
        i.quantity > 0,
    ) &&
    !!o.shipping &&
    [
      "recipient",
      "phone",
      "postalCode",
      "address",
      "addressDetail",
      "memo",
    ].every(
      (key) => typeof o.shipping[key as keyof typeof o.shipping] === "string",
    )
  );
}
export function loadShop(): ShopState {
  const fallback = {
    products: initialProducts.map((p) => ({ ...p })),
    items: [],
    orders: [],
  };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ShopState;
      if (
        !Array.isArray(parsed.products) ||
        !parsed.products.every(isProduct) ||
        !Array.isArray(parsed.orders) ||
        !parsed.orders.every(isOrder) ||
        !Array.isArray(parsed.items)
      )
        return fallback;
      return {
        ...parsed,
        items: parsed.items.filter(
          (i) =>
            i &&
            Number.isInteger(i.quantity) &&
            i.quantity > 0 &&
            i.quantity <= 99 &&
            parsed.products.some((p) => p.id === i.productId),
        ),
      };
    }
    // Preserve previous goods edits; add stock/description to the old schema.
    const oldProducts: unknown = JSON.parse(
      localStorage.getItem("ssu-mall-goods-v1") ?? "null",
    );
    if (Array.isArray(oldProducts)) {
      const products = oldProducts
        .map((value) => {
          const p = value as Product;
          const seed = initialProducts.find((seed) => seed.id === p?.id);
          return {
            ...p,
            stock: p?.stock ?? seed?.stock ?? 20,
            description:
              p?.description ??
              seed?.description ??
              "SSU Mall 캠퍼스 굿즈 컬렉션입니다.",
          };
        })
        .filter(isProduct);
      const oldItems: unknown = JSON.parse(
        localStorage.getItem("ssu-mall-cart-v1") ?? "[]",
      );
      return {
        products,
        orders: [],
        items: Array.isArray(oldItems)
          ? oldItems.filter(
              (i) =>
                i &&
                Number.isInteger(i.quantity) &&
                i.quantity > 0 &&
                i.quantity <= 99 &&
                products.some((p) => p.id === i.productId),
            )
          : [],
      };
    }
  } catch {
    return fallback;
  }
  return fallback;
}
