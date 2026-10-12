import { createApp } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db, storage } from "../js/firebase-config.js";
import { NAV_SECTIONS } from "./nav.js";
import LoginView from "./views/LoginView.js";
import PagesListView from "./views/PagesListView.js";
import PageEditorView from "./views/PageEditorView.js";

function readRoute() {
  const params = new URLSearchParams(location.search);
  return { view: params.get("view") || "pages", slug: params.get("slug") || "" };
}

const App = {
  components: { LoginView, PagesListView, PageEditorView },
  data() {
    const route = readRoute();
    return {
      authChecked: false,
      user: null,
      isAdmin: false,
      loginError: "",
      loginNotice: "",
      showPwd: false,
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
    async logout() { await signOut(auth); },
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
        <div class="admin-user">
          已登入
          <button @click="showPwd = !showPwd">變更密碼</button>
          <button @click="logout">登出</button>
          <form v-if="showPwd" class="admin-pwd" @submit.prevent="changePassword">
            <input type="password" v-model="pwd.current" placeholder="目前密碼" required autocomplete="current-password" />
            <input type="password" v-model="pwd.next" placeholder="新密碼（至少 6 字元）" required autocomplete="new-password" />
            <button type="submit">更新密碼</button>
            <div v-if="pwd.msg">{{ pwd.msg }}</div>
            <div v-if="pwd.err" class="admin-pwd-err">{{ pwd.err }}</div>
          </form>
        </div>
      </aside>
      <main class="admin-main">
        <template v-if="view === 'pages'">
          <PageEditorView v-if="slug" :db="db" :storage="storage" :slug="slug" @back="navigate('pages')" />
          <PagesListView v-else :db="db" @open="openPage" />
        </template>
        <div v-else>
          <h2>即將推出</h2>
          <p class="sub">這個功能還沒開放。</p>
        </div>
      </main>
    </div>
  `,
};

createApp(App).mount("#app");
