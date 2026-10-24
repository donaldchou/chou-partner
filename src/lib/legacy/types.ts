import type { Address, CustomerSource, Order, Phone, Product } from "../types";

/** 匯入用的訂單：還沒對應到客戶，附上建立／合併客戶需要的資料 */
export interface ImportOrder extends Omit<Order, "id" | "customerId" | "legacy"> {
  legacy: NonNullable<Order["legacy"]>;
  customerHint: {
    name: string;
    company?: string;
    gender?: "" | "F" | "M";
    phones: Phone[];
    emails: string[];
    lineName?: string;
    address?: Address;
    source: CustomerSource;
    /** 訂購者沒留電話：依姓名找同一批匯入、同樣沒電話的客戶 */
    matchByName?: boolean;
  };
}

export interface ParseResult {
  orders: ImportOrder[];
  products: Product[];
  /** 排除的資料：攻擊留下的垃圾訂單、找不到主檔的明細…（只記數量與原因） */
  skipped: { reason: string; count: number }[];
}
