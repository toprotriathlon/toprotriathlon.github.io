// Single source of truth for the admin sidebar. Sections with enabled:false
// render as a disabled nav item with a "即將推出" badge — this reserves the
// information architecture for docs/campaign-page-system-spec.md's later
// phases (行事曆／課程卡片／輪播圖／網站設定／報名紀錄) without building
// unused screens now.
export const NAV_SECTIONS = [
  { id: "pages", label: "活動頁面", enabled: true },
  { id: "submissions", label: "報名紀錄", enabled: false },
  { id: "schedule", label: "行事曆", enabled: false },
  { id: "courses", label: "課程卡片", enabled: false },
  { id: "carousel", label: "輪播圖", enabled: false },
  { id: "settings", label: "網站設定", enabled: false },
];
