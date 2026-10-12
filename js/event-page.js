import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { renderPage, setRegistrationFormRenderer } from "./block-renderer.js";
import { renderRegistrationForm } from "./registration-form-renderer.js";

const container = document.getElementById("event-page-content");
const params = new URLSearchParams(location.search);
const slug = params.get("slug");

setRegistrationFormRenderer((block) => renderRegistrationForm(block, { db, pageSlug: slug }));

function showState(html) {
  container.innerHTML = `<div class="detail-content"><p class="detail-quote">${html}</p></div>`;
}

async function init() {
  if (!slug) {
    showState("找不到此頁面（網址缺少 ?slug=）");
    return;
  }
  showState("載入中…");
  try {
    const snap = await getDoc(doc(db, "pages", slug));
    if (!snap.exists() || !snap.data().publishedVersion) {
      showState("找不到此頁面，或此頁面尚未發布。");
      return;
    }
    const page = snap.data();
    document.title = `${page.title}｜TO PRO 桃園鐵人三項俱樂部`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && page.metaDescription) metaDesc.setAttribute("content", page.metaDescription);
    renderPage(container, page.publishedVersion);
  } catch (err) {
    // A draft-only (unpublished) page is denied by the security rules before
    // we even get to check publishedVersion — that's expected, not a real
    // error, so show the same friendly message as the not-found case.
    if (err.code === "permission-denied") {
      showState("找不到此頁面，或此頁面尚未發布。");
      return;
    }
    console.error(err);
    showState("載入時發生錯誤，請重新整理頁面再試一次。");
  }
}

init();
