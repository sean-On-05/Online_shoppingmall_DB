import type { CartItem, Product } from "./data";
export const orderStatuses = [
  "주문접수",
  "배송준비",
  "배송중",
  "배송완료",
  "취소",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export interface ShippingInfo {
  recipient: string;
  phone: string;
  postalCode: string;
  address: string;
  addressDetail: string;
  memo: string;
}
export interface OrderLine {
  productId: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
}
export interface Order {
  id: string;
  createdAt: string;
  items: OrderLine[];
  shipping: ShippingInfo;
  subtotal: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  payment: "데모 결제";
}
export interface ShopState {
  products: Product[];
  items: CartItem[];
  orders: Order[];
}
export const shippingFee = (subtotal: number) =>
  subtotal === 0 || subtotal >= 50000 ? 0 : 3000;
export function updateCart(
  state: ShopState,
  productId: number,
  quantity: number,
): ShopState {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99)
    throw new Error("수량은 0~99 사이의 정수로 입력해 주세요.");
  if (quantity === 0)
    return {
      ...state,
      items: state.items.filter((i) => i.productId !== productId),
    };
  const product = state.products.find((p) => p.id === productId);
  if (!product) throw new Error("판매가 종료된 상품입니다.");
  if (quantity > product.stock)
    throw new Error(`${product.name}의 남은 재고는 ${product.stock}개입니다.`);
  return {
    ...state,
    items: state.items.some((i) => i.productId === productId)
      ? state.items.map((i) =>
          i.productId === productId ? { ...i, quantity } : i,
        )
      : [...state.items, { productId, quantity }],
  };
}
export function validateShipping(shipping: ShippingInfo) {
  if (!shipping.recipient.trim() || shipping.recipient.length > 50)
    throw new Error("받는 분 이름을 1~50자로 입력해 주세요.");
  if (!/^0\d{8,10}$/.test(shipping.phone.replace(/[\s-]/g, "")))
    throw new Error("연락처 형식을 확인해 주세요.");
  if (!/^\d{5}$/.test(shipping.postalCode))
    throw new Error("우편번호는 숫자 5자리로 입력해 주세요.");
  if (!shipping.address.trim() || shipping.address.length > 200)
    throw new Error("배송 주소를 1~200자로 입력해 주세요.");
}
export function placeOrder(
  state: ShopState,
  shipping: ShippingInfo,
  id: string,
  createdAt: string,
): ShopState {
  if (state.orders.some((o) => o.id === id))
    throw new Error("이미 접수된 주문입니다.");
  if (!state.items.length)
    throw new Error("장바구니에 상품을 먼저 담아 주세요.");
  validateShipping(shipping);
  const seen = new Set<number>();
  const lines = state.items.map((item) => {
    if (seen.has(item.productId))
      throw new Error("장바구니 상품이 중복되었습니다. 다시 담아 주세요.");
    seen.add(item.productId);
    const product = state.products.find((p) => p.id === item.productId);
    if (!product)
      throw new Error(
        "판매가 종료된 상품이 있습니다. 장바구니를 확인해 주세요.",
      );
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99 ||
      item.quantity > product.stock
    )
      throw new Error(
        `${product.name}의 수량을 확인해 주세요. 남은 재고: ${product.stock}개`,
      );
    return {
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: item.quantity,
    };
  });
  const subtotal = lines.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const fee = shippingFee(subtotal);
  const order: Order = {
    id,
    createdAt,
    items: lines,
    shipping: { ...shipping },
    subtotal,
    shippingFee: fee,
    total: subtotal + fee,
    status: "주문접수",
    payment: "데모 결제",
  };
  return {
    products: state.products.map((p) => ({
      ...p,
      stock: p.stock - (lines.find((i) => i.productId === p.id)?.quantity ?? 0),
    })),
    items: [],
    orders: [order, ...state.orders],
  };
}
export function nextStatuses(status: OrderStatus): OrderStatus[] {
  if (status === "주문접수") return ["배송준비", "취소"];
  if (status === "배송준비") return ["배송중", "취소"];
  if (status === "배송중") return ["배송완료"];
  return [];
}
export function changeOrderStatus(
  state: ShopState,
  orderId: string,
  status: OrderStatus,
): ShopState {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("주문을 찾을 수 없습니다.");
  if (order.status === status) return state;
  if (!nextStatuses(order.status).includes(status))
    throw new Error("허용되지 않는 주문 상태 변경입니다.");
  return {
    ...state,
    orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    products:
      status === "취소"
        ? state.products.map((p) => ({
            ...p,
            stock:
              p.stock +
              (order.items.find((i) => i.productId === p.id)?.quantity ?? 0),
          }))
        : state.products,
  };
}
export function saveProduct(state: ShopState, product: Product): ShopState {
  if (!product.name.trim() || product.name.length > 80)
    throw new Error("상품명을 1~80자로 입력해 주세요.");
  if (
    !Number.isInteger(product.price) ||
    product.price < 1 ||
    product.price > 100000000
  )
    throw new Error("판매가를 올바르게 입력해 주세요.");
  if (
    !Number.isInteger(product.stock) ||
    product.stock < 0 ||
    product.stock > 100000
  )
    throw new Error("재고는 0~100,000 사이의 정수로 입력해 주세요.");
  if (
    product.originalPrice !== undefined &&
    (!Number.isInteger(product.originalPrice) ||
      product.originalPrice <= product.price ||
      product.originalPrice > 100000000)
  )
    throw new Error("정상가는 판매가보다 큰 금액으로 입력해 주세요.");
  return {
    ...state,
    products: state.products.some((p) => p.id === product.id)
      ? state.products.map((p) => (p.id === product.id ? { ...product } : p))
      : [{ ...product }, ...state.products],
  };
}
export function deleteProduct(state: ShopState, productId: number): ShopState {
  if (
    state.orders.some(
      (o) =>
        o.status !== "취소" &&
        o.status !== "배송완료" &&
        o.items.some((i) => i.productId === productId),
    )
  )
    throw new Error(
      "진행 중인 주문에 포함된 상품은 삭제할 수 없습니다. 재고를 0으로 변경해 판매를 중지해 주세요.",
    );
  return {
    ...state,
    products: state.products.filter((p) => p.id !== productId),
    items: state.items.filter((i) => i.productId !== productId),
  };
}
