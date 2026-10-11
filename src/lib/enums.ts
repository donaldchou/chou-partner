// 前端型別與 Mongoose schema 共用的選項清單
export const CUSTOMER_SOURCES = ["名片", "手動", "Word匯入", "MDB匯入"] as const;
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
