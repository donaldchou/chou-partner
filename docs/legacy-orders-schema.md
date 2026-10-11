# 歷年訂購資料分析與 MongoDB 欄位設計

分析日期：2026-10-11　資料來源：`db_test_file/`（含個資，已加入 .gitignore，不上傳）

> 本文件只描述結構與統計，範例資料皆為虛構。
>
> **實作狀態（2026-10-12）**：已依本設計建立 `customers` / `orders` / `products`，並匯入 12,405 筆網站訂單與 1,626 筆電話訂單（客戶 9,908 位，待確認 707 筆）。實作與設計的差異：日期時間存成台灣當地時間字串（`YYYY-MM-DDTHH:mm`）而不是 Date；Word 因未設定 Gemini 且免費額度不足，改用規則解析，不確定的標記待確認；`20060331donald_products.mdb` 測試訂單已排除。

---

## 1. 資料來源分析

### 1.1 網站訂單（Access MDB，43 個檔案）

舊網站（ASP + Access）每年一個資料庫，所有檔案結構幾乎相同：

| 資料表 | 內容 | 說明 |
| --- | --- | --- |
| `Order_Nm` | 訂單主檔（一筆 = 一張訂單） | 訂購人資料、收件地址、付款方式、處理狀態 |
| `Order_Ns` | 訂單明細（一筆 = 一個品項） | 以 `orderid` 對應 `Order_Nm` |
| `product` | 當年產品與價格 | 3–5 個規格，每年價格不同 |
| `admin` | 後台帳號密碼（明碼） | **不匯入** |
| `Order_Suda` 等 7 張 | 只在最新的 `donald_products.mdb`、`kaki.mdb` | 速達託運單、匯款回報、加購品、運費調整 |

**三個網站（品牌）**

| 檔名 | 品項 | 產品代碼 |
| --- | --- | --- |
| `2006.mdb`～`2025.mdb`、`donald_products.mdb` | 水蜜桃 | `BO-N001`～`BO-N005`（12/10/8/6/5 粒裝） |
| `20xxkaki.mdb`、`kaki.mdb` | 甜柿 | `KA-N010/N008/N006/N005` |
| `20xxbigfarm_products.mdb`、`bigfarm_products.mdb` | 水蜜桃（另一個網站） | `PEACH-12/10/08/06/05` |

**重複的檔案（匯入時要排除，否則訂單會重複）**

| 檔案 | 與誰重複 |
| --- | --- |
| `20070528donald_products.mdb` | 等於 `2006.mdb`（多 19 筆 7 月底訂單，其餘相同） |
| `20080525donald_products.mdb` | 等於 `2007.mdb`（多 1 筆） |
| `20080728donald_products.mdb` | `2008.mdb` 的前半季 |
| `20060331donald_products.mdb` | 15 筆全在 2006-03-31 同一天，早於正式開賣（04-21），疑似測試訂單，請確認 |
| `2018kaki.mdb` | 與 `2017kaki.mdb` 完全相同 |
| `kaki.mdb.2017` | 1 筆，包含在 `2017kaki.mdb` |
| `2010kaki.mdb` | 包含在 `2011kaki.mdb` |

→ 一律用「網站 + orderid + 下單時間」去重。去重後共 **12,395 筆訂單、9,206 支不同電話（1,747 位回購客，最多一人 36 次）**，時間從 2006-04 到 2026-10。

`*_guestbook.mdb` 是網站留言板（留言、會員帳密），不是訂單，**不匯入**。

**`Order_Nm` 欄位實際內容**

| 欄位 | 內容 | 觀察 |
| --- | --- | --- |
| `orderid` | 訂單編號（Currency 型別，如 `123.0000`） | 每個檔案從 1 起算，**跨年會重複**，`2010`、`2013`、`2015` 接續前一年 |
| `id` | 流水號 | 無業務意義 |
| `username` | 訂購人姓名 | 124 筆含 HTML 字元碼（`&#37129;` → 鄉），要解碼 |
| `sex` | `F` / `M` | 1 筆 `male` |
| `e_mail` | Email | 必填，但有些是亂填 |
| `phone` / `phone2` | 手機 / 市話 | 格式混雜：`0912345678`、`02-2345678`、`0912-345-678`；`phone2` 60% 空白 |
| `zip` | 郵遞區號 | 3 碼為主，32% 空白，少數 5–6 碼 |
| `addr` | 收件地址 | 網站訂單收件人 = 訂購人 |
| `time` | 下單時間 | Access 存的是台灣時間，匯入時不要做時區換算 |
| `arrtime` | 希望到貨時段 | 固定 3 種：`早上08~12點`、`中午12~18點`、`晚上18~22點` |
| `paymethod` | 付款方式 | `貨到付款` 51%、`刷卡繳費` 28%、`匯款或ATM轉帳` 20% |
| `paymoney` | **貨到付款手續費**（不是運費） | 線上付款都是 0；貨到付款約每 3 盒 30 元（30/60/90…） |
| `schedule` | 處理狀態 | `已送出貨品` 86%、`新訂單---等待處理`、`處理訂單中`、`訂單等待處理`、`訂購者取消此筆訂單` |
| `processtime` | 最後處理時間 | 10% 空白 |
| `memo` | 訂購人備註 | 55% 空白；常見指定出貨日（如「6/20出貨」） |
| `suda_*` | 速達託運單號、PDF、列印時間 | 只有 2026 年的訂單有 |

**`Order_Ns` 欄位**

| 欄位 | 內容 | 觀察 |
| --- | --- | --- |
| `prono` | 產品代碼 | 對應當年 `product.productid` |
| `dis_price` | **下單當時的單價** | 1,155 筆與 product 表售價不同（季中調價），以這個為準 |
| `qty` | 盒數（文字型別） | 1–2 盒佔 77% |

**資料品質問題**

- 約 10 筆是 SQL injection 攻擊留下的垃圾訂單（`paymethod`、`prono` 含 `' AND 2*3*8=6*8`、`sleep(` 等），匯入時排除。
- 38 筆明細找不到對應的訂單主檔（訂單被刪除後殘留），略過。
- 1 筆 `paymethod` 是亂碼（Big5 編碼錯誤），歸類為「其他」。

### 1.2 電話訂單（Word，4 個檔案）

`訂單 20230514.docx`、`20240508`、`20250526`、`20260515`，每個檔案是一整季的電話／LINE 訂單，**沒有表格，是自由格式的文字**：

```
王小明                       ← 訂購人（可能加公司、「line ○○」、「(○○指送)」）
0912345678                   ← 手機
02-2345678                   ← 市話（可有可無）
台北市大安區○○路12號         ← 地址（可能有郵遞區號開頭）
8粒裝*2盒                    ← 規格 × 數量（寫法很多：8粒*2、8顆裝2盒、一盒10粒裝…）
600*2+60=1260               ← 金額算式（單價 × 數量 + 運費）
6/15寄                       ← 預計寄出日（年份取自檔名）
****ATM，已收到付款1260      ← 付款方式與狀態
---------------------        ← 分隔線
```

| 檔案 | 筆數 | 有電話 | 有地址 | 多個收件地址 | 有寄出日 | 提到 LINE |
| --- | --- | --- | --- | --- | --- | --- |
| 20230514 | 461 | 449 | 450 | 7 | 123 | 8 |
| 20240508 | 456 | 414 | 443 | 65 | 314 | 156 |
| 20250526 | 402 | 364 | 375 | 99 | 319 | 158 |
| 20260515 | 348 | 328 | 336 | 63 | 242 | 179 |

**觀察**

- **一張訂單可能寄給多個收件人**（2025 年約 25%）：一人付款，分送親友或客戶，每個地址各自有盒數。
- 有時有欄位標籤（`姓名：`、`電話：`、`寄送地址：`、`收件人：`），越新的檔案越多；舊的大多沒有標籤。
- 付款狀態：`貨到付款 1260`、`ATM，已收到付款`、`已匯款`、`待匯款`、`已收款`、`現場已付清`、`○○已付，待結清`。
- 代訂／介紹：「(曾○○指送)」「line ○○訂單」「○○贈」。
- 除了水蜜桃、甜柿，也有加購：水蜜桃乾、李子、果醬、高麗菜。
- 規格寫法超過 50 種，數量可能寫在規格行或金額算式裡。

→ 規則解析只能處理一部分，**建議用 AI（Gemini）把每一筆整理成結構化資料**，並保留原文供人工核對。

---

## 2. MongoDB 設計

### 2.1 整體結構

```
customers  客戶（以電話去重，一人一筆）
orders     訂單（網站、電話、LINE、團購…所有通路統一）── customerId → customers
products   產品規格與歷年價格
（既有）agencies / bookings / groupBuys 不變
```

和目前版本的差異：訂單從 `customers.orders[]` **拆成獨立的 `orders` 集合**。理由如下：

- 共 1.4 萬筆以上的訂單，需要依年份、通路、狀態、品項查詢和統計。
- 一張訂單會有多個收件人，以及付款、出貨、託運單號等資訊。
- 回購客最多 36 張訂單，內嵌在客戶文件裡會越來越大。

### 2.2 `customers` 客戶

| 欄位 | 型別 | 說明 / 來源 |
| --- | --- | --- |
| `_id` | string | |
| `name` | string | 姓名（HTML 字元碼解碼後） |
| `company` | string | 公司 / 單位 |
| `title` | string | 職稱 |
| `gender` | `"F" \| "M" \| ""` | MDB `sex` |
| `phones` | `[{ number, digits, type: "手機"\|"市話", primary }]` | `digits` 只留數字，建索引用來去重與搜尋 |
| `emails` | `[string]` | MDB `e_mail` |
| `lineName` | string | Word「line ○○」 |
| `addresses` | `[{ zip, address, label, lastUsedAt }]` | 歷年用過的收件地址，去重 |
| `sources` | `[ "網站" \| "電話" \| "LINE" \| "名片" \| "團購" \| "旅行社" ]` | 從哪些通路來過 |
| `tags` | `[string]` | 例：`回購客`、`企業客戶`、`甜柿客` |
| `stats` | `{ orderCount, totalSpent, firstOrderAt, lastOrderAt, lastProduct }` | 匯入／新增訂單時重算，方便排序與篩選 |
| `cardImage` | string | 名片（Vercel Blob 網址） |
| `note` | string | |
| `createdAt` / `updatedAt` | Date | |

索引：`phones.digits`、`name`、`company`、`stats.lastOrderAt`

**去重規則**：任一支電話的 `digits` 相同就視為同一人；沒有電話時用「姓名 + 地址」比對，並標記 `needsReview`。

### 2.3 `orders` 訂單

| 欄位 | 型別 | 說明 / 來源 |
| --- | --- | --- |
| `_id` | string | |
| `orderNo` | string | 顯示用編號，例 `W-BO-2021-0123`（網站-品牌-年-原 orderid）、`P-2025-0042`（電話） |
| `channel` | `"網站" \| "電話" \| "LINE" \| "團購" \| "旅行社" \| "現場"` | |
| `brand` | `"donald" \| "kaki" \| "bigfarm" \| ""` | 網站來源（水蜜桃站／甜柿站／bigfarm 站） |
| `season` | number | 產季年份（例 2025），供年度統計 |
| `customerId` | string | 訂購人／付款人 → customers |
| `buyer` | `{ name, phone, phone2, email, gender }` | 下單當下的訂購人資料快照（客戶資料之後改了也不影響舊訂單） |
| `referrer` | string | 代訂人／介紹人（Word「○○指送」「line ○○訂單」） |
| `orderedAt` | Date | MDB `time`；Word 用檔名日期 |
| `items` | `[OrderItem]` | 見下表 |
| `extras` | `[{ name, desc, amount }]` | 加購：水蜜桃乾、果醬、李子…（MDB `Order_Extra`） |
| `shipments` | `[Shipment]` | 收件人與出貨，一張訂單可多筆，見下表 |
| `payment` | `Payment` | 見下表 |
| `amounts` | `{ items, extras, codFee, shipping, adjust, total }` | `total` = 品項 + 加購 + 手續費 + 運費 + 調整 |
| `status` | `"新訂單" \| "處理中" \| "已出貨" \| "已完成" \| "已取消"` | MDB `schedule` 對應 |
| `processedAt` | Date | MDB `processtime` |
| `note` | string | 訂購人備註（MDB `memo`、Word 其他行） |
| `internalNote` | string | 內部備註 |
| `legacy` | `Legacy` | 匯入來源，見下表 |
| `createdAt` / `updatedAt` | Date | |

索引：`customerId + orderedAt`、`season + channel`、`status`、`shipments.trackingNo`、`legacy.key`（unique，防止重複匯入）

**OrderItem**

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `sku` | string | 產品代碼（`BO-N003`），電話訂單可空白 |
| `product` | string | 品項：水蜜桃 / 甜柿 / 水蜜桃乾 / 李子… |
| `spec` | string | 規格：8 粒裝 |
| `qty` | number | 盒數 |
| `unitPrice` | number | **下單當時的單價**（MDB `dis_price`） |
| `subtotal` | number | `qty × unitPrice` |

**Shipment（收件人／出貨）**

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | string | |
| `recipient` | `{ name, phone, phone2, zip, address }` | 網站訂單 = 訂購人；Word 多地址訂單每個地址一筆 |
| `items` | `[{ sku, spec, qty }]` | 這個地址寄哪些（單一收件人時與訂單品項相同） |
| `deliverySlot` | `"早上08~12點" \| "中午12~18點" \| "晚上18~22點" \| ""` | MDB `arrtime` |
| `requestedShipDate` | string `YYYY-MM-DD` | Word「6/15寄」、MDB 備註裡的指定日期 |
| `shippedAt` | Date | 實際出貨 |
| `carrier` | string | 黑貓 / 郵局 / 速達… |
| `packages` | `[{ trackingNo, boxes, collectAmount, labelUrl, printedAt }]` | MDB `Order_Suda`：一個地址可能分好幾箱，各有託運單號 |
| `status` | `"待出貨" \| "已出貨" \| "已送達" \| "退件"` | |

**Payment**

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `method` | `"貨到付款" \| "信用卡" \| "ATM轉帳" \| "現金" \| "其他"` | MDB `paymethod`、Word 付款行 |
| `status` | `"未付款" \| "待匯款" \| "已付款" \| "部分付款" \| "已退款"` | Word「已收到付款／待匯款」；MDB `Pay_Status` |
| `codFee` | number | 貨到付款手續費（MDB `paymoney`） |
| `paidAmount` | number | |
| `paidAt` | Date | |
| `reports` | `[{ text, photoUrl, reportedAt }]` | 客戶匯款回報（MDB `Pay_Report`，截圖存 Vercel Blob） |

**Legacy（匯入追蹤）**

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `source` | `"mdb" \| "word"` | |
| `file` | string | 原始檔名 |
| `key` | string | 去重鍵：MDB `brand:orderid:下單時間`；Word `檔名:序號` |
| `rawText` | string | Word 原文（一筆的完整文字），供人工核對 |
| `parsedBy` | `"rule" \| "ai"` | |
| `needsReview` | boolean | 解析有疑慮時標記，例如沒電話、金額算不出來、AI 不確定 |
| `importedAt` | Date | |

### 2.4 `products` 產品

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `_id` / `sku` | string | `BO-N003`、`KA-N008`、`PEACH-08` |
| `brand` | string | donald / kaki / bigfarm |
| `category` | string | 水蜜桃 / 甜柿 / 加工品 |
| `name` | string | 水蜜桃-8粒裝 |
| `pieces` | number | 每盒粒數 |
| `size` | string | 中型 / 大 / 特大 |
| `weight` | string | 每盒重量說明（MDB `note02`） |
| `description` | string | |
| `prices` | `[{ season, listPrice, salePrice }]` | 每年的價格（MDB `oriprice` / `newprice`） |
| `active` | boolean | |

---

## 3. 欄位對應

### 3.1 MDB → MongoDB

| MDB | MongoDB |
| --- | --- |
| 檔名 `2021.mdb` / `2021kaki.mdb` / `bigfarm` | `orders.brand`、`orders.season` |
| `Order_Nm.orderid` | `orders.legacy.key`、`orders.orderNo` |
| `username`、`sex`、`e_mail`、`phone`、`phone2` | `orders.buyer.*`，並合併到 `customers` |
| `zip`、`addr` | `orders.shipments[0].recipient`、`customers.addresses[]` |
| `time` | `orders.orderedAt` |
| `arrtime` | `orders.shipments[0].deliverySlot` |
| `paymethod` | `orders.payment.method`（刷卡繳費 → 信用卡；匯款或ATM轉帳 → ATM轉帳） |
| `paymoney` | `orders.payment.codFee`、`orders.amounts.codFee` |
| `schedule` | `orders.status`（已送出貨品 → 已出貨；訂購者取消此筆訂單 → 已取消；新訂單/等待處理 → 新訂單；處理訂單中 → 處理中） |
| `processtime` | `orders.processedAt` |
| `memo` | `orders.note` |
| `Order_Ns.prono`、`dis_price`、`qty` | `orders.items[]`（`product`、`spec` 由產品代碼查當年 product 表） |
| `Order_Suda.*` | `orders.shipments[0].packages[]` |
| `Pay_Report`、`Pay_Status` | `orders.payment.reports[]`、`orders.payment.status` |
| `Order_Extra` | `orders.extras[]` |
| `Order_ExtraShip.ship_adj` | `orders.amounts.adjust` |
| `product.*` | `products`（依 sku 合併，每年一筆價格） |

### 3.2 Word → MongoDB

| Word 內容 | MongoDB |
| --- | --- |
| 檔名日期 `訂單 20250526` | `orders.season = 2025`、`orders.orderedAt`（無個別日期時） |
| 第一行姓名（含公司、line、指送） | `orders.buyer.name`、`customers.company`、`customers.lineName`、`orders.referrer` |
| 電話 | `orders.buyer.phone`、`customers.phones[]` |
| 每個地址 | `orders.shipments[]`（多地址時各一筆，括號內的盒數與收件人放進該筆） |
| 規格 × 數量 | `orders.items[]`、`shipments[].items` |
| 金額算式 | `orders.amounts`（AI 解析，算式原文留在 `legacy.rawText`） |
| `6/15寄` | `shipments[].requestedShipDate`（年份取自檔名） |
| 付款行 | `orders.payment.method`、`status`、`paidAmount` |
| 其他文字 | `orders.note` |
| 整段原文 | `orders.legacy.rawText` |

---

## 4. 範例文件（虛構資料）

```json
// customers
{
  "_id": "c_8f3k2",
  "name": "王小明",
  "company": "",
  "gender": "M",
  "phones": [{ "number": "0912-345-678", "digits": "0912345678", "type": "手機", "primary": true }],
  "emails": ["wang@example.com"],
  "lineName": "",
  "addresses": [{ "zip": "106", "address": "台北市大安區範例路 1 號", "label": "", "lastUsedAt": "2025-06-02T10:15:00" }],
  "sources": ["網站", "電話"],
  "tags": ["回購客"],
  "stats": { "orderCount": 5, "totalSpent": 6850, "firstOrderAt": "2019-05-20T09:00:00", "lastOrderAt": "2025-06-02T10:15:00", "lastProduct": "水蜜桃 8 粒裝" }
}

// orders（網站訂單）
{
  "_id": "o_2025_bo_123",
  "orderNo": "W-BO-2025-0123",
  "channel": "網站",
  "brand": "donald",
  "season": 2025,
  "customerId": "c_8f3k2",
  "buyer": { "name": "王小明", "phone": "0912345678", "phone2": "", "email": "wang@example.com", "gender": "M" },
  "orderedAt": "2025-06-02T10:15:00",
  "items": [{ "sku": "BO-N003", "product": "水蜜桃", "spec": "8粒裝", "qty": 2, "unitPrice": 650, "subtotal": 1300 }],
  "extras": [],
  "shipments": [{
    "id": "s1",
    "recipient": { "name": "王小明", "phone": "0912345678", "zip": "106", "address": "台北市大安區範例路 1 號" },
    "items": [{ "sku": "BO-N003", "spec": "8粒裝", "qty": 2 }],
    "deliverySlot": "早上08~12點",
    "requestedShipDate": "",
    "carrier": "黑貓",
    "packages": [{ "trackingNo": "123456789012", "boxes": 2, "collectAmount": 1330 }],
    "status": "已出貨"
  }],
  "payment": { "method": "貨到付款", "status": "已付款", "codFee": 30, "paidAmount": 1330 },
  "amounts": { "items": 1300, "extras": 0, "codFee": 30, "shipping": 0, "adjust": 0, "total": 1330 },
  "status": "已出貨",
  "legacy": { "source": "mdb", "file": "2025.mdb", "key": "donald:123:2025-06-02T10:15", "parsedBy": "rule", "needsReview": false }
}

// orders（電話訂單，一人付款寄兩個地址）
{
  "orderNo": "P-2025-0042",
  "channel": "電話",
  "season": 2025,
  "customerId": "c_x91",
  "buyer": { "name": "陳大華", "phone": "0933111222" },
  "referrer": "",
  "items": [{ "product": "水蜜桃", "spec": "8粒裝", "qty": 12, "unitPrice": 650, "subtotal": 7800 }],
  "shipments": [
    { "id": "s1", "recipient": { "name": "林先生", "address": "台北市中正區範例路 1 號" }, "items": [{ "spec": "8粒裝", "qty": 10 }], "requestedShipDate": "2025-06-10" },
    { "id": "s2", "recipient": { "name": "張經理", "address": "桃園市龜山區範例街 2 號" }, "items": [{ "spec": "8粒裝", "qty": 2 }], "requestedShipDate": "2025-06-10" }
  ],
  "payment": { "method": "ATM轉帳", "status": "待匯款" },
  "amounts": { "items": 7800, "shipping": 0, "total": 7800 },
  "legacy": { "source": "word", "file": "訂單 20250526.docx", "key": "訂單 20250526.docx:3", "rawText": "（原文）", "parsedBy": "ai", "needsReview": true }
}
```

---

## 5. 匯入建議

1. **先匯入產品**：從各年度 `product` 表建立 `products`，價格依年份放進 `prices[]`。
2. **MDB 訂單**：只讀去重後的 40 個檔案，排除 SQL injection 垃圾資料與孤兒明細，解碼 HTML 字元碼，電話正規化後合併客戶。可以完全用規則轉換，不需要 AI。
3. **Word 訂單**：依分隔線切開，每筆送 AI 解析成上面的 Order 格式，保留原文；沒電話、金額對不起來、多地址的訂單標記 `needsReview`，在平台上提供「待確認」清單人工核對。
4. **重算客戶統計**：全部匯入後，依 `orders` 重算 `customers.stats` 與 `tags`（回購客等）。
5. 匯入程式用 `legacy.key` 做唯一索引，重複執行不會產生重複訂單。
