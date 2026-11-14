# TO PRO 活動頁面系統 — 規格說明

取代 `docs/backend-admin-spec-v1-superseded.md`。技術改用 Firebase（原文件建議 Supabase），架構改成同一個 repo 裡的 `admin.html`（原文件規劃獨立的 `topro-admin` 專案）。原文件規劃的行事曆／課程卡片／輪播圖／網站設定範圍被保留在本文件的「Phase 3+」章節，尚未實作。

## 0. 現況

活動頁面（如原本的 `swim-camp.html`）不再是各自獨立的 HTML 檔案，改由一個通用樣板 `event-page.html?slug=...` 從 Firestore 讀取內容並動態渲染。內容由「後台可編輯的區塊」組成，非工程人員可透過 `admin.html` 建立/編輯頁面與報名表單，不需要改程式碼。

## 1. 系統架構

```
┌──────────────────────────┐        Firebase SDK        ┌──────────────────────┐
│  公開頁面（本 repo，靜態）    │ ─────────────────────────▶  │  Firebase             │
│  event-page.html?slug=...  │                             │  Firestore（資料）      │
│  linkinbio.html 等          │                             │  Auth（登入）           │
├──────────────────────────┤        Firebase SDK        │  Storage（圖片）        │
│  後台（本 repo，同網域）      │ ─────────────────────────▶  └──────────────────────┘
│  admin.html（需登入）        │
└──────────────────────────┘
```

前台與後台是同一個 GitHub Pages 部署裡的兩個獨立進入點，不是分開部署的兩個專案。沒有自建伺服器——公開頁面與後台都直接用瀏覽器端的 Firebase SDK 存取 Firestore／Auth／Storage，存取控制交給 Firestore/Storage 安全規則（見第 5 節）。

**技術棧**：Firestore（資料庫）、Firebase Auth Email/Password（登入）。本階段不使用 Cloud Functions（沒有寄信/通知功能），維持免費的 Spark 方案。後台介面用 Vue 3（CDN ESM 引入，無建置流程）；公開頁面維持零框架的原生 JS。

**圖片：Firebase Storage 已改成選用**。Firebase 現在要求專案升級到計量付費的 Blaze 方案才能啟用 Storage（即使實際用量在免費額度內、帳單是 $0，也需要先綁信用卡）。`scripts/setup-firebase.sh` 的 Storage 那個階段可以直接跳過；後台的圖片區塊（`ImageEditor`）新增了「貼上圖片網址」欄位，可以改用任何免費圖床（Google Drive 公開分享連結、Imgur 等）貼連結進去，不需要升級方案。上傳按鈕的程式碼保留著，之後若升級到 Blaze 就能直接使用，不用改程式。

## 2. Firestore 資料模型

### `pages/{slug}`（文件 ID＝slug，例如 `swim-camp`）
```
{
  slug, title, metaDescription,
  status: "draft" | "published",
  draftVersion:     { header: {eyebrow,title,quote}, blocks: [...], updatedAt },
  publishedVersion: { header: {...}, blocks: [...], updatedAt } | null,
  createdAt, updatedAt, createdBy, updatedBy
}
```

草稿與已發布內容存在同一份文件裡（刻意簡化，見第 5 節「已知限制」）。

**區塊型別**，對應到 `css/linkinbio.css` 既有的 class，沒有另外發明新樣式：

| type | 對應既有 class | 主要欄位 |
|---|---|---|
| `richtext` | `.detail-copy p` | `paragraphs: [string]`（支援 `**粗體**`） |
| `list` | `.detail-arrow-list` / `.detail-check-list` / `.detail-info-list` / `.detail-number-list`（依 `variant`） | `variant: arrow\|check\|star\|number, heading?, items: [string]` |
| `image` | 新增 `<img>`，空白時沿用 `.detail-image-placeholder` | `url, alt, caption?` |
| `pricing` | `.pricing-cards` / `.pricing-card`（+`.featured`）/ `.pc-title` / `.pc-price` / `.pc-perk` | `heading?, cards: [{title,price,priceSuffix,perk,featured}]` |
| `note` | `.detail-note-inline` | `text` |
| `tags` | `.detail-tags` | `text` |
| `heading` | `.detail-h` | `text` |
| `registrationForm` | `.reg-form` / `.reg-step` / `.plan-options` / `.plan-option` / `.form-row` / `.form-two` / `.terms-list` | 見下 |

`registrationForm` 區塊：`steps: [{ id, stepNumber, heading?, fields?, conditionalGroups?, termsList?, note? }]`。欄位型別：`text | textarea | singleSelect | multiSelect | dropdown | date | checkbox`；`singleSelect` 可加 `withPricing` 讓每個選項附價格/贈品說明（取代舊版寫死的方案選擇）。`conditionalGroups` 用 `showWhen: {fieldName, equals}` 依前一步的答案決定要不要顯示，對應原本 `swim-camp.html` 的 `.plan-fields[data-plan-for]` 機制。本階段沒有檔案上傳欄位型別。

**`fields` 陣列可以混合「表單欄位」與「內容區塊」**：每個項目用 `itemType: "field" | "content"` 區分（沒有這個欄位的舊資料，視同 `"field"`，向下相容）。`itemType: "content"` 的項目直接沿用頁面區塊的資料格式（`richtext`／`image`／`note`／`heading`／`list`，見上表），可以插在欄位中間——例如「填完姓名電話後，插入一張課表圖片，再繼續填偏好時段」。後台編輯器（`FieldListEditor`）支援上移/下移排序，讓欄位跟內容區塊可以自由交錯；公開頁面渲染時直接重用 `block-renderer.js` 的 `renderBlock()`，不用另外寫一套邏輯。

### `submissions/{autoId}`
```
{ pageSlug, formId, data: {扁平 key/value}, submittedAt: serverTimestamp(), status: "new", userAgent? }
```
目前只寫入、不提供後台列表畫面（Phase 2 再做，schema 已預留）。

### `admins/{uid}`
`{ email, addedAt }` — 文件存在與否就是唯一的授權依據，Firestore／Storage 規則都靠這個判斷，不寫死特定 UID，之後要加第二個教練/小編帳號只要多加一份文件。

### 保留名稱、尚未建立（Phase 3+，見第 6 節）
`schedule_items`、`course_cards`、`carousel_slides`、`site_settings`

## 3. 公開頁面渲染

- `event-page.html` — 通用樣板，讀取 `?slug=`，抓 `pages/{slug}` 的 `publishedVersion` 渲染；找不到或未發布時顯示「找不到此頁面」。
- `js/event-page.js` — 進入點：讀 slug、抓資料、呼叫渲染。
- `js/block-renderer.js` — `renderBlock(block)`，每種 type 對應一段 DOM 產生邏輯，輸出跟原本 `swim-camp.html` 完全相同的 class 結構。
- `js/registration-form-renderer.js` — 從 `registrationForm` 區塊的 `steps[]` 產生 `.reg-form` DOM，並重現原本手寫在 `swim-camp.html` 裡的步驟導覽/驗證邏輯（`goToStep`/`validateStep`/依答案顯示欄位群組），只是從寫死 3 步驟改成支援任意步驟數。送出時寫入 Firestore `submissions`。

## 4. 後台（`admin.html`）

- `admin/app.js` 為根元件：Firebase Auth 登入狀態、6 個側邊欄分區（`admin/nav.js`），查詢字串路由（`admin.html?view=pages&slug=swim-camp`，跟 `event.html` 既有的查詢字串模式一致）。
- 編輯方式是結構化清單（新增區塊 → 選型別 → 填表單 → 上移/下移排序），不是拖拉式視覺編輯器。
- `admin/views/PagesListView.js`、`PageEditorView.js`、`admin/components/blockEditors.js`（7 種簡單區塊）、`RegistrationFormEditor.js`（表單建構器，含步驟/條件群組/欄位/選項的巢狀編輯）。
- 「儲存草稿」寫入 `draftVersion`；「發布」把草稿複製進 `publishedVersion` 並跳確認視窗；頁面上方有「有未發布的變更」提示（比對草稿與已發布內容是否一致）。
- 圖片：`admin/components/blockEditors.js` 的 `ImageEditor` 預設用「貼上圖片網址」；若專案已升級 Blaze，也可以用檔案上傳直接傳到 Firebase Storage（`pages/{slug}/{blockId}-{filename}`），沒有裁切工具。
- 側邊欄的「報名紀錄／行事曆／課程卡片／輪播圖／網站設定」目前顯示「即將推出」，先保留位置，見第 6 節。

## 5. 安全規則

**Firestore**（實際部署的規則見 `scripts/setup-firebase.sh`）：訪客可讀已發布頁面、只能新增（不能讀取/列表）報名資料；後台帳號（`admins/{uid}` 有文件）可讀寫頁面（含草稿）、可讀報名名單，並可在後台「管理者」頁籤新增／移除其他管理者（`admins/{uid}` 允許 `isAdmin()` 寫入）。`schedule_items`（行事曆）、`carousel_slides`（輪播圖）與 `course_cards`（課程連結按鈕）：任何人可讀（公開頁面要顯示）、只有後台帳號可寫。`site_settings` 目前全部拒絕讀寫（尚未建立功能，避免留下未預期的開放權限）。

**已知限制**：草稿與已發布內容存在同一份 Firestore 文件裡，規則沒辦法做欄位層級的過濾——頁面一旦發布過一次，之後在後台編輯中的草稿內容技術上可以被直接查詢資料庫的人讀到（雖然公開頁面本身不會顯示草稿）。這是經確認可接受的簡化（草稿內容本來就打算公開，不是敏感資訊），如果之後真的需要「草稿內容只有登入才能讀到」的保證，需要拆成 `pages/{slug}/draft/current` 與 `pages/{slug}/published/current` 兩個子集合。

**Storage（選用）**：若有啟用，任何人可讀圖片；只有 `admins/{uid}` 存在的登入使用者可以上傳（用 `firestore.exists()` 跨服務規則；若專案版本不支援，退回「任何登入使用者皆可上傳」，見 `scripts/setup-firebase.sh` 裡的備案規則）。

## 6. Roadmap

| 階段 | 內容 | 狀態 |
|---|---|---|
| Phase 1 | `pages`/`submissions`/`admins` collection、後台區塊編輯器、報名表單建構器、公開渲染引擎、`swim-camp` 轉為第一個範例頁面 | 完成 |
| Phase 2 | 後台「報名紀錄」列表畫面（`submissions` 已經在寫入，只差瀏覽介面） | 未開始 |
| Phase 3 | `schedule_items`（用 `group` 欄位區分 `monthly`／`team`）+ 後台「當月特別活動」「團練行事曆」管理；`linkinbio.html` 優先讀資料庫，讀不到或資料庫為空時退回寫死的 `teamScheduleData`／`monthlyEventData` | 完成 |
| Phase 4 | `course_cards`（對應「跑步課程／游泳課程」下拉裡的按鈕，欄位 `group`／`label`／`url`／`order`；`url` 通常是 Google 表單連結）+ 後台「課程連結」管理；資料庫為空時前台退回 HTML 內建的 4 個按鈕。「加入 LINE／社群」獨立連結列尚未做 | 部分完成 |
| Phase 5 | `site_settings`（LINE／IG／Threads 等網址）+ 後台「網站設定」管理 | 未開始 |
| Phase 6 | `carousel_slides` + 前台輪播元件 + 後台「輪播圖」管理。照片在瀏覽器縮小後以 data URL 存進 Firestore 文件（不需要 Storage／Blaze 方案），上傳時從中心裁成固定 1360×816（5:3），後台只能上傳與刪除、沒有其他設定；資料庫為空時退回 HTML 內建的照片 | 完成 |
| Phase 7+ | 報名通知（Email/LINE）— 需要 Cloud Functions，屆時要從 Spark 升級到 Blaze 付費方案 | 未開始，非必要 |

Phase 3–6 全部沿用同一個 Firebase 專案／同一個 `admin.html`，只是新增 collection 與側邊欄分區，不是另開一套後台系統。

## 7. 設定與開發工具

- `scripts/setup-firebase.sh` — 互動式精靈，建立 Firebase 專案、部署安全規則、建立管理員帳號，最後寫出 `js/firebase-config.js`。
- `scripts/seed-swim-camp.mjs` + `scripts/seed/swim-camp.json` — 把 `swim-camp` 頁面的完整內容（含報名表單）匯入 Firestore，避免在主控台介面手動輸入這麼深的巢狀資料。
