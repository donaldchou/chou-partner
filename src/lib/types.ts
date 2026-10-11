import type {
  BACKUP_KINDS,
  BOOKING_STATUSES,
  BUYING_POWERS,
  CUSTOMER_SOURCES,
  GROUP_BUY_STATUSES,
  PERSON_ROLES,
  SHIPPING_MODES,
} from "./enums";

export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];

export interface OrderItem {
  product: string;
  spec: string;
  qty: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  date: string; // YYYY-MM-DD
  items: OrderItem[];
  note?: string;
}

export interface Customer {
  id: string;
  company: string;
  name: string;
  title?: string;
  phone: string;
  email?: string;
  address: string;
  lineName?: string;
  note?: string;
  cardImage?: string;
  source: CustomerSource;
  createdAt: string;
  orders: Order[];
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
  /** 業者提供的檔案（Vercel Blob 網址） */
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

export interface AppState {
  customers: Customer[];
  agencies: Agency[];
  bookings: Booking[];
  groupBuys: GroupBuy[];
}
