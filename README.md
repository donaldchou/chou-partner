# CHOU 農場平台｜客戶管理系統

農場的客戶管理、遊覽車採果預約、團購業者管理平台。Next.js 16（App Router）+ Tailwind CSS 4 + Mongoose 9 / MongoDB Atlas。

## 環境變數（`.env.local`）

| 變數 | 必填 | 說明 |
| --- | --- | --- |
| `MONGODB_URI` | ✓ | MongoDB Atlas 連線字串 |
| `BLOB_READ_WRITE_TOKEN` | ✓ | Vercel Blob（public store），存名片、照片、宅配單檔案 |
| `JWT_SECRET` | ✓ | 登入 JWT 的簽章密鑰（至少 32 個字元的隨機字串）；部署到 Vercel 時也要設定 |
| `ADMIN_CODE` | ✓ | 後台驗證碼；輸入正確後 1 小時內所有需要驗證碼的功能都不用再輸入 |
| `GEMINI_API_KEY` | | 名片 AI 辨識、無表格 Word 的 AI 整理；沒設定時名片辨識回傳示範資料 |
| `GEMINI_MODEL` | | 預設 `gemini-3.6-flash`，失敗時自動改用 `gemini-3.5-flash-lite` |

```bash
npm run dev                             # http://localhost:3000
npm run import:legacy -- --dry-run      # 試跑歷年訂單匯入（不寫入）
npm run import:legacy                   # 匯入 db_test_file/mdb 與 db_test_file/word（重複執行不會重複）
```

## 登入與權限

整個網站都要登入（`src/proxy.ts`）。Email + 密碼（bcrypt 雜湊存在 `users` 集合），登入後 JWT（HS256，密鑰 `JWT_SECRET`）存在 HttpOnly cookie，7 天有效；同一個 Email 連續輸錯 5 次鎖 15 分鐘。

| 身分 | 權限 |
| --- | --- |
| 管理者 `admin` | 新增、修改、刪除所有資料；使用後台（`/admin`：帳號管理、所有資料） |
| 一般使用者 `user` | 只能查看 |

每個 API 都會回資料庫確認帳號狀態，後台停用帳號或改身分會立刻生效。至少要保留一位啟用中的管理者，不能停用、降級或刪除自己。

**驗證碼**：後台（`/admin`）除了管理者身分還要輸入驗證碼（`ADMIN_CODE`）。輸入正確後發一個綁定登入者、1 小時有效的 HttpOnly 解鎖 cookie，期間所有需要驗證碼的功能都不用再輸入，頁面上顯示倒數，也可以「立即上鎖」；連續輸錯 5 次鎖 15 分鐘。新增需要驗證碼的功能：API 呼叫 `requireUnlocked()`，頁面用 `<CodeGate>` 包住內容、標題旁放 `<UnlockTimer />`，並加到 `src/components/unlock.tsx` 的 `CODE_PAGES`。

沒有註冊頁。第一個管理者用命令列建立（密碼只從環境變數讀，不會寫進檔案；帳號已存在時不會覆蓋）：

```powershell
$env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="********"; npm run create-admin
npm run create-admin -- --reset-password    # 忘記密碼時重設
```

## 架構

```
src/lib/mongodb.ts         共用連線 connectDB()（global 快取，hot reload 不會重複連線）
src/models/                Mongoose schema：customer / order / product / tour（agency、booking）/ group-buy
src/lib/customers-repo.ts  客戶：分頁搜尋（含買過的品項）、合併重複客戶、刪除
src/lib/orders-repo.ts     訂單：分頁搜尋、自動編號、金額重算、儀表板統計
src/lib/customer-stats.ts  依訂單重算客戶的訂單數、累計金額、回購客標籤
src/lib/legacy/            歷年資料匯入：mdb.ts（舊網站）、word.ts（電話訂單規則解析）、importer.ts（合併寫入）
src/lib/collections.ts     通用 CRUD 的集合：products / agencies / bookings / groupBuys
src/lib/blob.ts            Vercel Blob 上傳；資料更新／刪除時自動刪掉不再使用的檔案
src/lib/store.ts           前端：小集合啟動時載入 /api/db；客戶與訂單用分頁 API
scripts/import-legacy.ts   命令列匯入
```

照片與檔案存在 Vercel Blob，MongoDB 只存檔案網址；所有文件使用字串 `_id`，API 輸出時轉成 `id`。日期時間一律存台灣當地時間字串（`YYYY-MM-DD`、`YYYY-MM-DDTHH:mm`）。

資料設計與歷年資料分析見 [docs/legacy-orders-schema.md](docs/legacy-orders-schema.md)。

## 資料集合

| 集合 | 內容 | 規則 |
| --- | --- | --- |
| `customers` | 客戶：多支電話（`phones[].digits` 去重）、多個地址、來源通路、標籤、`stats` | `stats` 與「回購客」標籤由訂單自動重算 |
| `orders` | 訂單：品項、加購、多個收件人 `shipments[]`（含託運單號）、付款、金額、匯入來源 `legacy` | 小計與總金額由後端重算；`legacy.key` 唯一，防止重複匯入；匯入原文不能修改 |
| `products` | 產品代碼、規格、各產季價格 `prices[]` | |
| `agencies` | 旅行社 + 內嵌領隊/司機 `people[]`（多張照片） | 移除領隊/司機時，預約中的引用自動清空 |
| `bookings` | 採果預約 | 旅行社必須存在；領隊/司機必須是該旅行社對應角色的人 |
| `groupBuys` | 團購 + 品項、合作紀錄、收件人、宅配單備份 | 結團日期不可早於開團日期 |

## API

### 客戶與訂單

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/customers?q=&source=&tag=&sort=recent\|orders\|spent\|name\|created&page=&limit=&withOrders=1` | 分頁搜尋；`q` 比對姓名、公司、電話（可不打 -）、地址、LINE，以及買過的品項規格 |
| POST | `/api/customers` | 新增 |
| GET / PUT / DELETE | `/api/customers/<id>` | 單筆（含全部訂單）／儲存／刪除（有訂單需 `?cascade=true`） |
| POST | `/api/customers/<id>/merge` | `{ from }`：把重複客戶併入，訂單一起移過來 |
| GET | `/api/orders?q=&season=&channel=&status=&brand=&payStatus=&review=1&customerId=&sort=new\|old&page=&limit=` | 分頁搜尋，回傳 `amount`（符合條件的金額合計） |
| POST | `/api/orders` | 新增（沒有 `orderNo` 時自動編號，例如 `T-2026-0042`） |
| GET / PUT / DELETE | `/api/orders/<id>` | 單筆（含客戶）／儲存／刪除；之後自動重算客戶統計 |
| GET | `/api/stats` | 儀表板：客戶數、回購客、各產季營收、本季各通路、待處理／待匯款／待確認 |

### 其他

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/db` | 一次取得小集合（products / agencies / bookings / groupBuys） |
| GET / POST / PUT / DELETE | `/api/<collection>[/<id>]` | 上述小集合的通用 CRUD；旅行社有預約時刪除需 `?cascade=true` |
| POST | `/api/upload` | multipart `file`、`folder` → Vercel Blob，回傳 `{ url, name, size, contentType }`；單檔 4MB |
| POST | `/api/ocr/business-card` | `{ url }` → 名片欄位；`mock: true` 表示未設定 Gemini |
| POST | `/api/import/parse` | multipart `file`、`kind`=mdb\|word → 統計與前 200 筆預覽（不寫入） |
| POST | `/api/import/commit` | 同上 → 寫入；已匯入的略過，客戶依電話合併 |
| GET | `/api/health` | 資料庫連線檢查 |
| POST | `/api/auth/login` | `{ email, password }` → 設定登入 cookie |
| POST | `/api/auth/logout` | 清除登入 cookie |
| GET | `/api/auth/me` | 目前登入的使用者 |
| GET / POST / DELETE | `/api/unlock` | 解鎖到期時間／輸入驗證碼 `{ code }`／立即上鎖（管理者） |
| GET / POST | `/api/admin/users` | 帳號列表／新增（管理者） |
| PATCH / DELETE | `/api/admin/users/<id>` | 修改姓名、身分、啟用、重設密碼／刪除（管理者） |
| GET | `/api/admin/data[/<collection>[/<id>]]` | 各集合筆數／列表／單筆完整內容（管理者） |
| DELETE | `/api/admin/data/<collection>/<id>` | 刪除（客戶連訂單、旅行社連預約，需 `?cascade=true`） |

讀取需要登入（401），新增、修改、刪除、上傳、匯入需要管理者（403）。

錯誤一律回 `{ error: "中文訊息" }`：驗證錯誤 400、找不到 404、衝突 409、檔案太大 413、格式不支援 415。