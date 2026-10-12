// 後台編輯器內嵌的即時預覽：接收編輯器用 postMessage 傳來的草稿，
// 用跟前台 event-page.html 完全相同的 renderPage() 畫出來。
import { renderPage, setRegistrationFormRenderer } from "./block-renderer.js";
import { renderRegistrationForm } from "./registration-form-renderer.js";

const container = document.getElementById("event-page-content");

// 預覽不連資料庫；報名表單只顯示樣子，擋掉送出，避免預覽時寫入真實報名資料
setRegistrationFormRenderer((block) => renderRegistrationForm(block, { db: null, pageSlug: "preview" }));
document.addEventListener("submit", (e) => {
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);

window.addEventListener("message", (e) => {
  if (e.origin !== location.origin || !e.data || e.data.type !== "preview") return;
  const scrollY = window.scrollY;
  try {
    renderPage(container, e.data.data);
  } catch (err) {
    console.error(err);
  }
  window.scrollTo(0, scrollY);
});

parent.postMessage({ type: "preview-ready" }, location.origin);
