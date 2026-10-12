# TO PRO 桃園鐵人三項俱樂部 — 官方網站

這是一個純 HTML/CSS/JS 的靜態網站，可直接部署到 GitHub Pages，不需要任何框架或建置工具。

## 檔案結構

```
topro-site/
├── index.html          首頁
├── about.html           關於我們
├── programs.html        課程項目
├── team.html             教練介紹
├── contact.html          聯絡我們 / 表單
├── linkinbio.html        一頁式連結頁（取代 Portaly／Linktree，適合放 IG 個人簡介連結）
├── event-page.html       活動頁面通用樣板（?slug=... 從 Firestore 動態讀取內容，例：event-page.html?slug=swim-camp）
├── event.html             行事曆/活動的輕量詳情頁（從網址參數帶資料，非後台管理範圍）
├── admin.html             後台管理登入頁（需要 Firebase 帳號才能進入）
├── admin/                 後台程式（Vue 3，CDN 引入、無建置流程）
├── css/style.css         全站樣式（色彩、字體都在這裡設定）
├── css/linkinbio.css      linkinbio／event-page／admin 家族頁面專屬樣式
├── css/admin.css          後台介面樣式
├── js/main.js             手機選單、滾動動畫、聯絡表單
├── js/firebase-config.js  Firebase 初始化設定（跑 scripts/setup-firebase.sh 產生）
├── js/event-page.js、block-renderer.js、registration-form-renderer.js   活動頁面渲染引擎
├── scripts/               一次性設定/匯入用的腳本（不是網站執行時載入的檔案）
├── docs/campaign-page-system-spec.md   後台系統完整規格
└── assets/favicon.svg    網站小圖示（文字版，建議換成正式 Logo）
```

## linkinbio.html 是什麼？

這是仿造 Linktree / Portaly 的「一頁式連結頁」，把社群連結（LINE、IG、Threads）、各項課程報名表單、以及本月團練時間表整理成單一頁面，適合放在 Instagram 個人簡介的連結欄位，取代目前使用的 Portaly 頁面。

部署到 GitHub Pages 後，這頁的網址會是：
```
https://toprotriathlon.github.io/linkinbio.html
```
把這個網址貼到 IG 個人簡介的連結欄位即可。

裡面的報名表單連結、社群連結已經直接使用您 Portaly 頁面上的真實連結；每月的團練時間表請記得依當月實際場次更新（已用 ✏️ 提醒標註）。

## 第一步：申請 GitHub 帳號並建立 Repository

1. 前往 https://github.com/join 註冊帳號（若還沒有）。
2. 登入後點右上角「+」→「New repository」。
3. **Repository name** 有兩種命名方式：
   - 命名為 `你的帳號名稱.github.io` → 網站會是 `https://你的帳號名稱.github.io/`（品牌官網建議用這個）
   - 命名為其他名稱，例如 `topro-website` → 網站會是 `https://你的帳號名稱.github.io/topro-website/`
4. 設為 **Public**，勾選「Add a README file」可以先不勾（我們已經有了），建立完成。

## 第二步：把網站檔案上傳上去

**方法 A：網頁介面上傳（最簡單，不需要指令）**
1. 進入剛建立的 repository 頁面。
2. 點「Add file」→「Upload files」。
3. 把 `topro-site` 資料夾內「所有檔案與資料夾」拖進去（保持資料夾結構：index.html 要在最外層，不要整個 topro-site 資料夾一起上傳）。
4. 下方填寫 commit 訊息（例如：`first commit`），點「Commit changes」。

**方法 B：使用 Git 指令**
```bash
cd topro-site
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/你的帳號名稱/你的repo名稱.git
git push -u origin main
```

## 第三步：開啟 GitHub Pages

1. 進入 repository 的「Settings」頁籤。
2. 左側選單點「Pages」。
3. 在「Build and deployment」→「Source」選擇「Deploy from a branch」。
4. Branch 選擇 `main`，資料夾選擇 `/ (root)`，按「Save」。
5. 等待 1–2 分鐘，頁面上方會顯示網站網址，例如：
   `https://你的帳號名稱.github.io/` 或 `https://你的帳號名稱.github.io/你的repo名稱/`

## 需要您替換的內容（已在網站內用「✏️ 提醒」標註）

| 項目 | 位置 |
|---|---|
| 品牌 Logo | 目前是文字版 Logo（`TO`+`PRO`），Logo 圖檔準備好後我可以直接幫您換成圖片 |
| 教練照片、姓名、證照、比賽經歷 | `team.html` |
| 課程時間、地點、費用、報名連結 | `programs.html`（`立即報名` 按鈕的 `href="#"` 請換成 Google 表單連結） |
| IG / LINE / Threads 連結 | 所有頁面的 footer，以及 `contact.html` |
| 聯絡信箱 | `js/main.js` 內的 `your-email@example.com` |
| 地圖位置 | `contact.html` 內的 Google Maps 嵌入連結 |
| 品牌數字（團練場次、學員人數等） | `index.html`、`about.html` 的數字區塊 |

## 表單說明

`contact.html` 的表單目前是純前端，送出後會開啟使用者的信箱 App，把內容夾帶到郵件中寄給您（因為 GitHub Pages 沒有後端伺服器）。若想要「直接收到表單通知」而不是靠使用者手動寄信，建議之後串接：
- **Google 表單**（最簡單，直接把連結放上去或用 iframe 嵌入）
- **Formspree**（https://formspree.io，免費方案可直接收表單到信箱）

有需要的話我可以幫您接上其中一種。

## 後台管理系統（活動頁面 + 報名表單）

`swim-camp.html` 這類活動頁面正在改成可以透過後台（`admin.html`）編輯的版本，資料存在 Firebase。第一次設定 Firebase 專案（建立資料庫、登入帳號、圖片空間）不需要自己一步步在主控台裡摸索，執行：

```bash
./scripts/setup-firebase.sh
```

這支腳本會逐步打開對應的 Firebase 主控台頁面、告訴您要點哪裡、貼上哪段安全規則，並在最後自動把設定值寫進 `js/firebase-config.js`。詳細規劃見 `docs/campaign-page-system-spec.md`。

## 本機預覽

不需要任何伺服器，直接用瀏覽器打開 `index.html` 即可預覽（部分瀏覽器可能會擋 iframe 地圖，正式上線到 GitHub Pages 後就會正常顯示）。
