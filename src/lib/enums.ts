// 前端型別與 Mongoose schema 共用的選項清單
/** 客戶從哪些通路來過（可多個） */
export const CUSTOMER_SOURCES = ["網站", "電話", "LINE", "現場", "名片", "團購", "旅行社"] as const;export const GENDERS = ["", "F", "M"] as const;
export const PHONE_TYPES = ["手機", "市話"] as const;
/** 標記無效客戶的原因 */
export const INVALID_REASONS = ["測試資料", "垃圾資料", "重複客戶", "聯絡不到", "其他"] as const;

/** 訂單 */
export const ORDER_CHANNELS = ["網站", "電話", "LINE", "現場", "團購", "旅行社"] as const;
export const BRANDS = ["", "donald", "kaki", "bigfarm"] as const;
export const BRAND_LABELS: Record<(typeof BRANDS)[number], string> = {
  "": "",
  donald: "水蜜桃網站",
  kaki: "甜柿網站",
  bigfarm: "bigfarm 網站",
};
export const ORDER_STATUSES = ["新訂單", "處理中", "已出貨", "已完成", "已取消"] as const;
export const PAYMENT_METHODS = ["", "貨到付款", "信用卡", "ATM轉帳", "現金", "其他"] as const;
export const PAYMENT_STATUSES = ["未付款", "待匯款", "已付款", "貨到收款", "部分付款", "已退款"] as const;
export const DELIVERY_SLOTS = ["", "早上08~12點", "中午12~18點", "晚上18~22點"] as const;
export const SHIPMENT_STATUSES = ["待出貨", "已出貨", "已送達", "退件"] as const;
export const LEGACY_SOURCES = ["mdb", "word"] as const;
export const PERSON_ROLES = ["領隊", "司機"] as const;
export const BOOKING_STATUSES = ["已預約", "已到場", "已取消"] as const;
export const BUYING_POWERS = ["高", "中", "低"] as const;
export const SHIPPING_MODES = ["provided", "generate"] as const;
export const GROUP_BUY_STATUSES = ["洽談中", "進行中", "已出貨", "已結案"] as const;
export const BACKUP_KINDS = ["業者提供", "系統產生"] as const;

export const COUNTIES = [
  "基隆市",
  "台北市",
  "新北市",
  "桃園市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "台中市",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "台南市",
  "高雄市",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "台東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
] as const;
