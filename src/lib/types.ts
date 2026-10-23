import type {
  BACKUP_KINDS,
  BOOKING_STATUSES,
  BUYING_POWERS,
  BRANDS,
  CUSTOMER_SOURCES,
  DELIVERY_SLOTS,
  GENDERS,
  INVALID_REASONS,
  LEGACY_SOURCES,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PHONE_TYPES,
  SHIPMENT_STATUSES,
  GROUP_BUY_STATUSES,
  PERSON_ROLES,
  SHIPPING_MODES,
} from "./enums";

export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];
export type OrderChannel = (typeof ORDER_CHANNELS)[number];
export type Brand = (typeof BRANDS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface Phone {
  number: string;
  /** 只留數字，用來比對同一位客戶 */
  digits: string;
  type: (typeof PHONE_TYPES)[number];
}

export interface Address {
  zip: string;
  address: string;
  lastUsedAt?: string;
}

export interface CustomerStats {
  orderCount: number;
  totalSpent: number;
  firstOrderAt: string;
  lastOrderAt: string;
  lastProduct: string;
}

/** 客戶：一人一筆，以電話去重；訂單在 orders 集合 */
export interface Customer {
  id: string;
  name: string;
  company: string;
  title?: string;
  gender: (typeof GENDERS)[number];
  phones: Phone[];
  emails: string[];
  lineName?: string;
  addresses: Address[];
  sources: CustomerSource[];
  tags: string[];
  stats: CustomerStats;
  cardImage?: string;
  note?: string;
  createdAt: string;
  /** 標記為無效；null 或沒有 = 有效客戶 */
  invalid?: CustomerInvalid | null;
  /** 疑似無效清單裡已確認是正常客戶 */
  suspectChecked?: boolean;
  /** API 算出的疑似無效原因（不存資料庫） */
  suspectReasons?: string[];
}

export interface CustomerInvalid {
  reason: (typeof INVALID_REASONS)[number];
  note: string;
  at: string;
  by: string;
}

export interface OrderItem {
  sku?: string;
  product: string;
  spec: string;
  qty: number;
  /** 下單當時的單價 */
  unitPrice: number;
  subtotal: number;
}

export interface OrderExtra {
  name: string;
  desc?: string;
  amount: number;
}

export interface Package {
  trackingNo: string;
  boxes: number;
  collectAmount?: number;
  labelUrl?: string;
  printedAt?: string;
}

/** 收件人與出貨：一張訂單可以寄到多個地址 */
export interface Shipment {
  id: string;
  recipient: { name: string; phone: string; phone2?: string; zip?: string; address: string };
  items: { sku?: string; product?: string; spec: string; qty: number }[];
  deliverySlot?: (typeof DELIVERY_SLOTS)[number];
  requestedShipDate?: string;
  shippedAt?: string;
  carrier?: string;
  packages: Package[];
  status: (typeof SHIPMENT_STATUSES)[number];
}

export interface Payment {
  method: PaymentMethod;
  status: PaymentStatus;
  codFee: number;
  paidAmount?: number;
  paidAt?: string;
  reports: { text: string; photoUrl?: string; reportedAt?: string }[];
}

export interface OrderAmounts {
  items: number;
  extras: number;
  codFee: number;
  shipping: number;
  adjust: number;
  total: number;
}

export interface Legacy {
  source: (typeof LEGACY_SOURCES)[number];
  file: string;
  /** 去重鍵，重複匯入不會產生重複訂單 */
  key: string;
  rawText?: string;
  parsedBy: "rule" | "ai";
  needsReview: boolean;
  reviewReasons?: string[];
  importedAt?: string;
}

export interface Order {
  id: string;
  orderNo: string;
  channel: OrderChannel;
  brand: Brand;
  season: number;
  customerId: string;
  buyer: { name: string; phone: string; phone2?: string; email?: string; gender?: string };
  referrer?: string;
  orderedAt: string; // YYYY-MM-DDTHH:mm
  items: OrderItem[];
  extras: OrderExtra[];
  shipments: Shipment[];
  payment: Payment;
  amounts: OrderAmounts;
  status: OrderStatus;
  processedAt?: string;
  note?: string;
  internalNote?: string;
  legacy?: Legacy;
}

export interface Product {
  id: string; // sku
  brand: Brand;
  category: string;
  name: string;
  spec: string;
  pieces?: number;
  weight?: string;
  description?: string;
  prices: { season: number; listPrice: number; salePrice: number }[];
  active: boolean;
}
export type PersonRole = (typeof PERSON_ROLES)[number];

export interface Person {
  id: string;
  role: PersonRole;
  name: string;
  phone: string;
  lineName?: string;
  photos: string[];
}

export interface Agency {
  id: string;
  name: string;
  contactName?: string;
  phone: string;
  address?: string;
  lineName?: string;
  cardImage?: string;
  note?: string;
  createdAt: string;
  people: Person[];
}

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type BuyingPower = (typeof BUYING_POWERS)[number];

export interface Booking {
  id: string;
  agencyId: string;
  datetime: string; // YYYY-MM-DDTHH:mm
  headcount: number;
  leaderId?: string;
  driverId?: string;
  plate: string;
  county: string;
  buyingPower: BuyingPower;
  buyingPowerNote?: string;
  status: BookingStatus;
  revenue?: number;
  note?: string;
}

export interface GroupBuyItem {
  id: string;
  product: string;
  spec: string;
  price: number;
  qty: number;
}

export interface CoopNote {
  id: string;
  date: string;
  content: string;
}

export interface Recipient {
  id: string;
  name: string;
  phone: string;
  address: string;
  content: string;
  qty: number;
  note?: string;
}

export interface ShippingBackup {
  id: string;
  kind: (typeof BACKUP_KINDS)[number];
  fileName: string;
  createdAt: string;
  count?: number;
  /** 系統產生時保留當下的收件人快照，可重新列印 / 下載 */
  rows?: Recipient[];
  /** 業者提供的檔案（ll3 主機網址 "ll3:..."） */
  fileUrl?: string;
}

export type ShippingMode = (typeof SHIPPING_MODES)[number];
export type GroupBuyStatus = (typeof GROUP_BUY_STATUSES)[number];

export interface GroupBuy {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  address: string;
  lineName?: string;
  cardImage?: string;
  startDate: string;
  endDate: string;
  status: GroupBuyStatus;
  items: GroupBuyItem[];
  coopNotes: CoopNote[];
  shippingMode: ShippingMode;
  recipients: Recipient[];
  backups: ShippingBackup[];
  createdAt: string;
}

/** 前端一次載入的資料（客戶與訂單量大，改用分頁 API） */
export interface AppState {
  products: Product[];
  agencies: Agency[];
  bookings: Booking[];
  groupBuys: GroupBuy[];
}
