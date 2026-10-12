> ⚠️ **本文件已被取代**：實際採用的是 `docs/campaign-page-system-spec.md` 描述的方案（Firebase 而非本文件建議的 Supabase；後台跟前台放在同一個 repo 的 `admin.html`，而非本文件規劃的獨立 `topro-admin` 專案）。本文件保留僅供歷史參考——第 2 節的 `team_schedule`／`monthly_events`／`courses`／`carousel_slides`／`site_settings` 資料表構想，其範圍已被新文件的「Phase 3+」章節吸收（改用 Firestore collection，欄位名稱可能有調整），尚未實作。

# TO PRO 後台管理系統 — 規格與需求說明（v1，已取代）

## 0. 文件目的
現在的 `topro` 專案是純靜態網站（HTML/CSS/JS，無伺服器、無資料庫），內容更新（團練行事曆、當月活動、課程資訊、輪播圖等）都要直接改程式碼。本文件規劃一個**獨立的後台管理系統**，讓非工程人員可以透過網頁介面管理這些內容，並讓前台可以動態讀取，而不需要每次改版都動 HTML。

---

## 1. 系統架構總覽

```
┌─────────────────────┐        讀取 API         ┌──────────────────────┐
│  前台（本專案）        │ ───────────────────▶  │  後台（新專案）          │
│  index.html           │                        │  管理介面（登入後可編輯） │
│  linkinbio.html       │                        │  API（讀 / 寫）         │
│  swim-camp.html 等    │                        │  資料庫                │
│  純靜態 HTML/CSS/JS   │                        │  圖片儲存（輪播圖等）    │
└─────────────────────┘                        └──────────────────────┘
```

- **前台（本專案，`topro`）**：維持現有靜態架構與視覺設計，新增「頁面載入時打 API 抓資料」的邏輯，取代現在寫死在 `<script>` 裡的資料陣列。
- **後台（新專案，暫名 `topro-admin`）**：獨立部署，包含管理介面、API、資料庫、圖片儲存。

**建議技術選型**：Supabase（Postgres + Auth + Storage + 自動產生 REST API）。理由：不用自己刻登入/資料庫/圖片上傳這些基礎建設，能把心力放在管理介面本身，開發時間可大幅縮短。若團隊更熟悉 Firebase 也可以，架構概念相同。

---

## 2. 資料模型（Data Model）

### 2.1 `team_schedule`（團練行事曆）
對應 `linkinbio.html` 目前的 `teamScheduleData`。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | 主鍵 |
| date | date | 場次日期 |
| time | text | 集合時間，如 `19:00` |
| title | text | 場次名稱，如「間歇跑 700m × 6–8 組」 |
| location | text | 地點 |
| sort_order | int | 排序 |
| updated_at | timestamp | |

### 2.2 `monthly_events`（當月活動）
欄位結構同 `team_schedule`。可以合併成同一張表加 `category` 欄位（`team` / `monthly`），或維持兩張獨立的表——建議先合併成一張表 + `category`，減少維護的資料表數量。

### 2.3 `courses`（課程資訊卡片）
對應「跑步課程」「游泳課程」下拉裡的方框卡片，以及「加入官方 LINE」「加入 TOPRO 社群」這類獨立連結列。

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | |
| section | text | `running` / `swim` / `standalone`（獨立連結列） |
| label | text | 顯示文字，如「新一期跑班」 |
| link_type | text | `internal_page`（連到本專案頁面）／`external_url` |
| link_value | text | `swim-camp.html` 或完整網址 |
| is_wide | bool | 是否為整列（如「加入 TOPRO 社群」） |
| sort_order | int | |
| is_active | bool | 是否顯示 |

### 2.4 `carousel_slides`（輪播畫面）

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid | |
| page | text | 顯示在哪個頁面，如 `index` / `linkinbio` |
| image_url | text | 圖片網址（存在 Supabase Storage） |
| title | text | 選填，疊加文字標題 |
| subtitle | text | 選填 |
| link_url | text | 選填，點擊後跳轉 |
| sort_order | int | |
| is_active | bool | |

### 2.5 `feature_flags`（前台功能開關）

| 欄位 | 型別 | 說明 |
|---|---|---|
| key | text (主鍵) | 如 `show_team_schedule`、`show_monthly_events`、`show_swim_courses`、`show_running_courses`、`show_carousel_linkinbio` |
| enabled | bool | |
| description | text | 給後台使用者看的說明文字 |

### 2.6 `site_settings`（全域設定）
key/value 形式，存放像 LINE 官方帳號連結、IG/Threads 連結、社群連結等目前寫死在 HTML 裡的網址。

| 欄位 | 型別 |
|---|---|
| key | text（主鍵），如 `line_official_url`、`community_url` |
| value | text |

### 2.7 使用者權限
若用 Supabase Auth，使用者帳號本身不需要自建資料表；若需要角色分級（例如「只能編行事曆，不能改功能開關」），另建 `admin_roles` 表存 user_id ↔ role 對應。**這點需要跟你確認實際需求（見第 8 節待確認事項）。**

---

## 3. API 規格

### 3.1 公開唯讀 API（前台使用，不需登入）
| Method | Endpoint | 說明 |
|---|---|---|
| GET | `/api/team-schedule` | 依 sort_order 排序回傳 |
| GET | `/api/monthly-events` | |
| GET | `/api/courses?section=running` | |
| GET | `/api/carousel?page=linkinbio` | 只回傳 `is_active=true` 的 |
| GET | `/api/feature-flags` | 回傳 key/enabled 對照表 |
| GET | `/api/site-settings` | 回傳 key/value 對照表 |

### 3.2 後台管理 API（需登入）
每張表對應標準 CRUD（`POST` 新增／`PUT` 編輯／`DELETE` 刪除／`PATCH` 排序），另外：
- `POST /api/upload-image`：輪播圖片上傳，回傳圖片網址

若採用 Supabase，上述端點多數可由其自動產生的 REST API + Row Level Security（RLS）規則直接達成，公開讀取用「anon key + RLS 只允許 SELECT」、後台寫入用「登入後的 session + RLS 允許該角色 CRUD」，不需要額外手刻一層後端程式。

---

## 4. 後台管理介面（Admin Panel）功能清單
1. 登入頁（Email/密碼，或串 Google 登入）
2. 儀表板首頁（各資料表筆數、最近更新時間）
3. 團練行事曆管理：清單／新增／編輯／刪除／拖曳排序
4. 當月活動管理：同上
5. 課程資訊管理：跑步／游泳課程卡片文字、連結、排序、啟用開關
6. 輪播畫面管理：上傳圖片、設定標題／副標／連結、排序、啟用開關，並可預覽
7. 功能開關管理：切換前台各區塊顯示／隱藏（例如暫時關閉「當月活動」）
8. 網站基本設定：LINE／IG／Threads／社群連結等網址維護

---

## 5. 前台整合方式（本專案要做的事）

現況（以 `linkinbio.html` 為例）：
```js
var teamScheduleData = [
  { date: '2026-07-07', time: '19:00', title: '間歇跑 700m × 6–8 組', desc: '桃園三民運動公園' },
  ...
];
renderCardScheduleList(document.getElementById('teamScheduleList'), teamScheduleData, 'team');
```

改為：
```js
fetch('https://<your-supabase-project>.supabase.co/rest/v1/team_schedule?select=*&order=sort_order', {
  headers: { apikey: PUBLIC_ANON_KEY }
})
  .then(function (res) { return res.json(); })
  .then(function (data) {
    renderCardScheduleList(document.getElementById('teamScheduleList'), data, 'team');
  })
  .catch(function () {
    // fallback：抓不到資料時顯示預設內容或錯誤提示，避免整塊空白
  });
```

**注意事項**：
- 功能開關（`feature_flags`）要在對應區塊的渲染邏輯外面包一層判斷：flag 為 `false` 就不渲染/不顯示該 `.lib-item`。
- fetch 失敗（後台掛掉、網路問題）時要有 fallback，不能讓整頁空白或報錯，建議保留一份極簡的預設資料當退路。
- 輪播元件目前網站上還沒有對應的 HTML/CSS，需要另外設計（第 8 節待確認事項會問清楚要放哪裡、長怎樣）。

---

## 6. 專案分工建議
- **本專案（`topro`）**：不改變現有頁面結構與視覺設計，只新增「fetch API + 渲染」的邏輯，以及功能開關判斷式、輪播元件（新元件）。
- **新專案（`topro-admin`）**：管理介面 + 資料庫 + Storage，獨立部署（例如 Vercel/Netlify 前端 + Supabase 後端）。兩個專案透過 API 溝通，彼此獨立部署、獨立版本控制。

---

## 7. 開發階段建議（Roadmap）
| 階段 | 內容 |
|---|---|
| Phase 1 | Supabase 專案建立、資料表 schema 建立、寫入現有的範例資料做測試 |
| Phase 2 | 後台管理介面：先做「團練行事曆」「當月活動」的 CRUD，驗證登入與寫入流程 |
| Phase 3 | 前台串接 API，取代 `linkinbio.html` 裡寫死的 `teamScheduleData`／`monthlyEventData` |
| Phase 4 | 課程資訊卡片、網站基本設定串接 |
| Phase 5 | 輪播畫面管理 + 前台輪播元件設計與串接 |
| Phase 6 | 功能開關系統（後台切換 + 前台判斷式） |
| Phase 7 | 測試、上線 |

---

## 8. 待確認事項（Open Questions）
在開始開發前，建議先確認以下問題：

1. **使用者範圍**：後台只有你自己用，還是有其他小編／教練也要登入？需不需要角色權限分級（例如誰能改功能開關、誰只能編行事曆）？
2. **輪播畫面位置**：預計出現在哪個頁面？`index.html` 首頁最上方？`linkinbio.html` 頭像下方？目前這兩個頁面都還沒有輪播元件的 HTML/CSS，需要另外設計版型。
3. **功能開關的顆粒度**：是整個區塊開關（如「團練行事曆」整個顯示/隱藏），還是要細到單一筆資料（如某一場團練）？
4. **圖片規格**：輪播圖片的建議尺寸、檔案大小上限、格式（jpg/png/webp）？
5. **雲端服務偏好與預算**：是否已有偏好的服務（Supabase／Firebase／其他）？是否有預算限制？
6. **是否需要多語系**：目前內容都是繁中，未來是否要支援英文版？

這些問題的答案會直接影響資料表設計與後台介面規劃，建議在啟動 `topro-admin` 專案開發前先討論清楚。
