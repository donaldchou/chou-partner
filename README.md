# 周家夥伴平台 CHOU Partner

農場的客戶管理、遊覽車採果預約、團購業者管理平台。Next.js 16（App Router）+ Tailwind CSS 4 + Mongoose 9 / MongoDB Atlas。

## 環境變數（`.env.local`）

| 變數 | 必填 | 說明 |
| --- | --- | --- |
| `MONGODB_URI` | ✓ | MongoDB Atlas 連線字串 |
| `BLOB_READ_WRITE_TOKEN` | ✓ | Vercel Blob（public store），存名片、照片、宅配單檔案 |
| `GEMINI_API_KEY` | | 名片 AI 辨識、無表格 Word 的 AI 整理；沒設定時名片辨識回傳示範資料 |
| `GEMINI_MODEL` | | 預設 `gemini-3.6-flash`，失敗時自動改用 `gemini-3.5-flash-lite` |

```bash
npm run dev   # http://localhost:3000
```

## 架構

```
src/lib/mongodb.ts       共用連線 connectDB()（global 快取，hot reload 不會重複連線）
src/models/              Mongoose schema：customer / tour（agency、booking）/ group-buy / file
src/lib/collections.ts   API 集合名稱 ↔ Model、排序、篩選、搜尋欄位
src/lib/repo.ts          通用 CRUD 與各集合的寫入規則
src/lib/blob.ts          Vercel Blob 上傳；資料更新／刪除時自動刪掉不再使用的檔案
src/lib/importer.ts      Word / MDB 解析、欄位對應、匯入合併
src/lib/store.ts         前端資料快取（啟動載入 /api/db，寫入時樂觀更新）
```

照片與檔案存在 Vercel Blob，MongoDB 只存檔案網址（`cardImage`、`people[].photos`、`backups[].fileUrl`）；資料更新或刪除時，不再使用的 Blob 檔案會自動刪除。

所有文件使用字串 `_id`，API 輸出時轉成 `id`；訂購紀錄、領隊/司機、團購品項等子文件內嵌在主文件中，保留前端的 `id`。

## 資料集合

| 集合 | 內容 | 規則 |
| --- | --- | --- |
| `customers` | 客戶 + 內嵌歷年訂購紀錄 `orders[].items[]` | 自動維護 `phoneDigits`（只留數字的電話）供搜尋與匯入比對 |
| `agencies` | 旅行社 + 內嵌領隊/司機 `people[]`（多張照片） | 移除領隊/司機時，預約中的引用自動清空 |
| `bookings` | 採果預約 | 旅行社必須存在；`leaderId`/`driverId` 必須是該旅行社對應角色的人；縣市限定 22 縣市 |
| `groupBuys` | 團購 + 品項、合作紀錄、收件人、宅配單備份 | 結團日期不可早於開團日期 |


## API

### 通用 CRUD（`<collection>` = customers / agencies / bookings / groupBuys）

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/db` | 一次取得全部資料 |
| GET | `/api/<collection>?q=&from=&to=&欄位=值` | 列表；`q` 多關鍵字搜尋（空白分隔），`from`/`to` 日期區間 |
| POST | `/api/<collection>` | 新增 |
| GET | `/api/<collection>/<id>` | 單筆 |
| PUT | `/api/<collection>/<id>` | 整筆儲存（不存在時建立，回 201） |
| DELETE | `/api/<collection>/<id>` | 刪除；旅行社有預約時需 `?cascade=true`，否則 409 |

可篩選欄位：customers `source`；bookings `agencyId`、`status`、`county`；groupBuys `status`、`shippingMode`。

### 專屬功能

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| POST | `/api/upload` | multipart `file`、`folder`（cards / people / shipping）→ 上傳到 Vercel Blob，回傳 `{ url, name, size, contentType }`；單檔 4MB |
| POST | `/api/ocr/business-card` | `{ url }`（名片的 Blob 網址）→ 名片欄位；`mock: true` 表示未設定 Gemini |
| POST | `/api/import/parse` | multipart `file`、`kind`=word\|mdb、`table`（MDB 資料表）→ 預覽列，標記既有客戶 |
| POST | `/api/import/commit` | `{ source, rows }` → 依電話合併客戶；重複的訂購紀錄自動略過 |
| POST | `/api/seed` | 放入示範資料（只在資料庫完全沒資料時可用） |
| GET | `/api/health` | 資料庫連線檢查 |

錯誤一律回 `{ error: "中文訊息" }`：驗證錯誤 400、找不到 404、衝突 409、檔案太大 413、格式不支援 415。

### 匯入的欄位對應

Word 表格第一列、MDB 資料表欄位名稱只要包含以下字詞就會自動對應：姓名/客戶/訂購人/收件人、公司/單位、電話/手機、地址、日期/訂購日期、產品/品名/商品、規格/包裝、數量、單價/售價、金額/小計（沒有單價時用金額 ÷ 數量）。日期支援 `2024/1/8`、`2024-01-08`、`20240108`、民國年 `112/11/05`。
