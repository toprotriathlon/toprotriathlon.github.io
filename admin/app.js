import { createApp } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db, storage } from "../js/firebase-config.js";
import { NAV_SECTIONS } from "./nav.js";
import LoginView from "./views/LoginView.js";
import PagesListView from "./views/PagesListView.js";
import PageEditorView from "./views/PageEditorView.js";
import ScheduleView from "./views/ScheduleView.js";
import CarouselView from "./views/CarouselView.js";
import CoursesView from "./views/CoursesView.js";
import AdminsView from "./views/AdminsView.js";

function readRoute() {
  const params = new URLSearchParams(location.search);
  return { view: params.get("view") || "monthly", slug: params.get("slug") || "" };
}

const App = {
  components: { LoginView, PagesListView, PageEditorView, ScheduleView, CarouselView, CoursesView, AdminsView },
  data() {
    const route = readRoute();
    return {
      authChecked: false,
      user: null,
      isAdmin: false,
      loginError: "",
      loginNotice: "",
      showPwd: false,
      menuOpen: false,
      pwd: { current: "", next: "", msg: "", err: "" },
      view: route.view,
      slug: route.slug,
      db, storage,
      NAV_SECTIONS,
    };
  },
  mounted() {
    onAuthStateChanged(auth, async (u) => {
      this.user = u;
      if (u) {
        const adminDoc = await getDoc(doc(db, "admins", u.uid));
        this.isAdmin = adminDoc.exists();
      } else {
        this.isAdmin = false;
      }
      this.authChecked = true;
    });
    // 點選單以外的地方、或按 Esc，就收起設定選單
    document.addEventListener("click", () => { this.menuOpen = false; });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { this.menuOpen = false; this.showPwd = false; } });
    window.addEventListener("popstate", () => {
      const route = readRoute();
      this.view = route.view;
      this.slug = route.slug;
    });
  },
  methods: {
    navigate(view, slug) {
      this.view = view;
      this.slug = slug || "";
      const url = new URL(location.href);
      url.searchParams.set("view", view);
      if (slug) url.searchParams.set("slug", slug); else url.searchParams.delete("slug");
      history.pushState({}, "", url);
    },
    async login(email, password) {
      this.loginError = "";
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (e) {
        this.loginError = "登入失敗，請確認 Email 與密碼是否正確。";
      }
    },
    async resetPassword(email) {
      this.loginError = ""; this.loginNotice = "";
      if (!email) { this.loginError = "請先在上方輸入 Email。"; return; }
      try {
        await sendPasswordResetEmail(auth, email);
      } catch (e) { /* 不洩漏帳號是否存在 */ }
      this.loginNotice = "若此 Email 有註冊，重設密碼信已寄出，請檢查信箱（含垃圾信件匣）。";
    },
    async changePassword() {
      const p = this.pwd; p.msg = ""; p.err = "";
      if (p.next.length < 6) { p.err = "新密碼至少 6 個字元。"; return; }
      try {
        const cred = EmailAuthProvider.credential(this.user.email, p.current);
        await reauthenticateWithCredential(this.user, cred);
        await updatePassword(this.user, p.next);
        p.msg = "密碼已更新。"; p.current = ""; p.next = "";
      } catch (e) { p.err = "目前密碼不正確，或登入已逾時，請重新登入後再試。"; }
    },
    openAdmins() { this.menuOpen = false; this.navigate("admins"); },
    openPassword() { this.menuOpen = false; this.pwd = { current: "", next: "", msg: "", err: "" }; this.showPwd = true; },
    closePassword() { this.showPwd = false; this.pwd = { current: "", next: "", msg: "", err: "" }; },
    async logout() { this.menuOpen = false; await signOut(auth); },
    openPage(slug) { this.navigate("pages", slug); },
  },
  template: `
    <div v-if="!authChecked"></div>
    <LoginView v-else-if="!user || !isAdmin" :error="loginError || (user && !isAdmin ? '此帳號沒有後台管理權限。' : '')" @login="login" @reset="resetPassword" :notice="loginNotice" />
    <div class="admin-shell" v-else>
      <aside class="admin-sidebar">
        <div class="brand">TO PRO 後台</div>
        <div class="brand-sub">{{ user.email }}</div>
        <nav class="admin-nav">
          <button
            v-for="s in NAV_SECTIONS" :key="s.id"
            class="admin-nav-item"
            :class="{ 'is-active': view === s.id, 'is-disabled': !s.enabled }"
            @click="s.enabled && navigate(s.id)"
          >
            {{ s.label }}
            <span class="admin-badge" v-if="!s.enabled">即將推出</span>
          </button>
        </nav>
        <div class="admin-settings">
          <div class="admin-menu" v-if="menuOpen" @click.stop>
            <div class="admin-menu-user">{{ user.email }}</div>
            <button @click="openAdmins">管理者</button>
            <button @click="openPassword">變更密碼</button>
            <button class="is-danger" @click="logout">登出</button>
          </div>
          <button class="admin-gear" :class="{ 'is-active': menuOpen || view === 'admins' }" @click.stop="menuOpen = !menuOpen" aria-label="設定" :aria-expanded="menuOpen">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>設定</span>
          </button>
        </div>
      </aside>
      <div class="admin-modal-overlay" v-if="showPwd" @click.self="closePassword">
        <form class="admin-modal" @submit.prevent="changePassword">
          <h3>變更密碼</h3>
          <div class="form-row">
            <label>目前密碼</label>
            <input type="password" v-model="pwd.current" required autocomplete="current-password" />
          </div>
          <div class="form-row">
            <label>新密碼（至少 6 個字元）</label>
            <input type="password" v-model="pwd.next" required autocomplete="new-password" />
          </div>
          <div class="admin-notice" v-if="pwd.msg">{{ pwd.msg }}</div>
          <div class="admin-error" v-if="pwd.err">{{ pwd.err }}</div>
          <div class="admin-modal-actions">
            <button type="button" class="btn btn-text" @click="closePassword">關閉</button>
            <button type="submit" class="btn btn-primary">更新密碼</button>
          </div>
        </form>
      </div>
      <main class="admin-main">
        <template v-if="view === 'pages'">
          <PageEditorView v-if="slug" :db="db" :storage="storage" :slug="slug" @back="navigate('pages')" />
          <PagesListView v-else :db="db" @open="openPage" />
        </template>
        <ScheduleView v-else-if="view === 'monthly'" key="monthly" :db="db" group="monthly" title="當月特別活動" />
        <ScheduleView v-else-if="view === 'team'" key="team" :db="db" group="team" title="團練行事曆" />
        <CarouselView v-else-if="view === 'carousel'" :db="db" />
        <CoursesView v-else-if="view === 'courses'" :db="db" />
        <AdminsView v-else-if="view === 'admins'" :db="db" :user="user" />
        <div v-else>
          <h2>即將推出</h2>
          <p class="sub">這個功能還沒開放。</p>
        </div>
      </main>
    </div>
  `,
};

createApp(App).mount("#app");
