export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  image: string;
  label?: string;
  stock: number;
  description: string;
}
export interface CartItem {
  productId: number;
  quantity: number;
}
export const categories = ["전체", "의류", "가방", "리빙", "문구", "액세서리"];
export const money = (value: number) => `${value.toLocaleString("ko-KR")}원`;
export const initialProducts: Product[] = [
  {
    id: 101,
    stock: 30,
    description:
      "숭실의 색과 캠퍼스의 추억을 담은 SSU Mall 컬렉션입니다. 일상에서 가볍게 사용하고, 소중한 순간을 오래 간직하세요. 상품 이미지와 사양은 프로토타입용 디자인 시안입니다.",
    name: "숭실 클래식 바시티 재킷",
    category: "의류",
    price: 89000,
    originalPrice: 99000,
    image: "/images/goods/varsity.svg",
    label: "BEST",
  },
  {
    id: 102,
    stock: 20,
    description:
      "숭실의 색과 캠퍼스의 추억을 담은 SSU Mall 컬렉션입니다. 일상에서 가볍게 사용하고, 소중한 순간을 오래 간직하세요. 상품 이미지와 사양은 프로토타입용 디자인 시안입니다.",
    name: "SSU 캠퍼스 로고 후디",
    category: "의류",
    price: 59000,
    image: "/images/goods/hoodie.svg",
    label: "NEW",
  },
  {
    id: 103,
    stock: 45,
    description:
      "숭실의 색과 캠퍼스의 추억을 담은 SSU Mall 컬렉션입니다. 일상에서 가볍게 사용하고, 소중한 순간을 오래 간직하세요. 상품 이미지와 사양은 프로토타입용 디자인 시안입니다.",
    name: "숭실 1897 그래픽 티셔츠",
    category: "의류",
    price: 29000,
    image: "/images/goods/tshirt.svg",
    label: "BEST",
  },
  {
    id: 104,
    stock: 25,
    description:
      "숭실의 색과 캠퍼스의 추억을 담은 SSU Mall 컬렉션입니다. 일상에서 가볍게 사용하고, 소중한 순간을 오래 간직하세요. 상품 이미지와 사양은 프로토타입용 디자인 시안입니다.",
    name: "SSU 데일리 캔버스 에코백",
    category: "가방",
    price: 22000,
    originalPrice: 26000,
    image: "/images/goods/tote.svg",
    label: "BEST",
  },
  {
    id: 105,
    stock: 18,
    description:
      "숭실의 색과 캠퍼스의 추억을 담은 SSU Mall 컬렉션입니다. 일상에서 가볍게 사용하고, 소중한 순간을 오래 간직하세요. 상품 이미지와 사양은 프로토타입용 디자인 시안입니다.",
    name: "숭실 블루 세라믹 머그",
    category: "리빙",
    price: 16000,
    image: "/images/goods/mug.svg",
  },
  {
    id: 106,
    stock: 50,
    description:
      "숭실의 색과 캠퍼스의 추억을 담은 SSU Mall 컬렉션입니다. 일상에서 가볍게 사용하고, 소중한 순간을 오래 간직하세요. 상품 이미지와 사양은 프로토타입용 디자인 시안입니다.",
    name: "SSU 캠퍼스 하드커버 노트",
    category: "문구",
    price: 12000,
    image: "/images/goods/notebook.svg",
    label: "NEW",
  },
  {
    id: 107,
    stock: 7,
    description:
      "숭실의 색과 캠퍼스의 추억을 담은 SSU Mall 컬렉션입니다. 일상에서 가볍게 사용하고, 소중한 순간을 오래 간직하세요. 상품 이미지와 사양은 프로토타입용 디자인 시안입니다.",
    name: "숭실 이니셜 아크릴 키링",
    category: "액세서리",
    price: 8000,
    image: "/images/goods/keyring.svg",
    label: "NEW",
  },
  {
    id: 108,
    stock: 0,
    description:
      "숭실의 색과 캠퍼스의 추억을 담은 SSU Mall 컬렉션입니다. 일상에서 가볍게 사용하고, 소중한 순간을 오래 간직하세요. 상품 이미지와 사양은 프로토타입용 디자인 시안입니다.",
    name: "SSU 이니셜 볼캡",
    category: "액세서리",
    price: 25000,
    originalPrice: 29000,
    image: "/images/goods/cap.svg",
  },
];
export const productImage = (image: string) =>
  image.startsWith("https://") || image.startsWith("/images/")
    ? image
    : `https://images.unsplash.com/${image}?auto=format&fit=crop&w=700&q=85`;
