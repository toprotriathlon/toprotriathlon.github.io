// Single source of truth for the admin sidebar. Sections with enabled:false
// render as a disabled nav item with a "即將推出" badge — this reserves the
// information architecture for docs/campaign-page-system-spec.md's later
// phases without building unused screens now.
//
// 「活動頁面」(pages) 的編輯器程式碼仍完整保留（PagesListView / PageEditorView），
// 只是先在側邊欄標成「即將推出」；要重新開放時把 enabled 改回 true 即可。
// 「管理者」不在這個清單，改由側邊欄左下角的齒輪（設定）進入，見 admin/app.js。
export const NAV_SECTIONS = [
  { id: "monthly", label: "當月特別活動", enabled: true },
  { id: "team", label: "團練行事曆", enabled: true },
  { id: "carousel", label: "輪播圖", enabled: true },
  { id: "courses", label: "課程連結", enabled: true },
  { id: "pages", label: "活動頁面", enabled: false },
  { id: "submissions", label: "報名紀錄", enabled: false },
  { id: "settings", label: "網站設定", enabled: false },
];
