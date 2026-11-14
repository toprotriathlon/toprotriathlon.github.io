// 後台「管理者」：新增／移除可以登入後台的帳號。
// 管理者名單存在 Firestore 的 admins/{uid}（文件有存在 = 有後台權限，見 firestore 規則的 isAdmin()）。
// 新增流程：用第二個 Firebase app 實例建立登入帳號（不會把目前登入的人登出）→ 寫入 admins/{uid}
// → 寄「設定密碼」信給對方。移除只會拿掉後台權限，登入帳號本身仍留在 Firebase Authentication。
import { getApp, initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth } from "../../js/firebase-config.js";

const RULES_HINT =
  "沒有權限寫入管理者名單。請先到 Firebase 主控台更新 Firestore 規則：把 admins 那段的 allow write 改成 if isAdmin()（作法見 docs/campaign-page-system-spec.md 第 5 節）。";

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (b) => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 56]).join("");
}

export default {
  props: {
    db: { type: Object, required: true },
    user: { type: Object, required: true },
  },
  data() {
    return { admins: [], loading: true, adding: false, email: "", msg: "", err: "" };
  },
  async mounted() {
    await this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      try {
        const snap = await getDocs(collection(this.db, "admins"));
        this.admins = snap.docs.map((d) => ({ uid: d.id, email: d.data().email || "（未記錄 Email）" }));
      } catch (e) {
        this.err = "讀取失敗：" + (e.message || e);
      }
      this.loading = false;
    },
    async addAdmin() {
      this.msg = "";
      this.err = "";
      const email = this.email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        this.err = "請輸入正確的 Email。";
        return;
      }
      this.adding = true;
      let secondary;
      let uid = "";
      try {
        // 用另一個 app 實例建立帳號，避免目前登入的管理者被登出
        secondary = initializeApp(getApp().options, "create-admin-" + Date.now());
        const sAuth = getAuth(secondary);
        const cred = await createUserWithEmailAndPassword(sAuth, email, randomPassword());
        uid = cred.user.uid;
        await signOut(sAuth);

        await setDoc(doc(this.db, "admins", uid), {
          email,
          addedAt: serverTimestamp(),
          addedBy: this.user.email || "",
        });
        let mailed = true;
        try {
          await sendPasswordResetEmail(auth, email);
        } catch (_) {
          mailed = false;
        }
        this.msg = mailed
          ? `已新增 ${email}。設定密碼的信已寄出，請對方收信（含垃圾信件匣）設定密碼後登入。`
          : `已新增 ${email}，但設定密碼的信寄送失敗。請對方在登入頁點「忘記密碼」自行設定。`;
        this.email = "";
        await this.load();
      } catch (e) {
        if (e.code === "auth/email-already-in-use") {
          this.err = "這個 Email 已經有登入帳號了。目前無法直接從這裡授權既有帳號，請到 Firebase 主控台 Authentication 找到該帳號複製 UID，再到 Firestore 的 admins 新增一筆文件（文件 ID 就是 UID）。";
        } else if (e.code === "permission-denied" && uid) {
          this.err = `登入帳號已建立（UID：${uid}），但寫入管理者名單被拒絕。${RULES_HINT}更新規則後，到 Firestore 的 admins 新增一筆文件，文件 ID 填上面的 UID，或請我協助補完。`;
        } else if (e.code === "auth/weak-password" || e.code === "auth/invalid-email") {
          this.err = "Email 格式不正確。";
        } else {
          this.err = "新增失敗：" + (e.message || e);
        }
      } finally {
        if (secondary) { try { await deleteApp(secondary); } catch (_) { /* ignore */ } }
        this.adding = false;
      }
    },
    async removeAdmin(a) {
      this.msg = "";
      this.err = "";
      if (a.uid === this.user.uid) return;
      if (this.admins.length <= 1) return;
      if (!confirm(`確定要移除 ${a.email} 的後台權限嗎？\n（對方的登入帳號仍存在，只是不能再進後台）`)) return;
      try {
        await deleteDoc(doc(this.db, "admins", a.uid));
        this.msg = `已移除 ${a.email} 的後台權限。`;
        await this.load();
      } catch (e) {
        this.err = e.code === "permission-denied" ? RULES_HINT : "移除失敗：" + (e.message || e);
      }
    },
  },
  template: `
    <div>
      <div class="admin-editor-head">
        <div>
          <h2>設定・管理者</h2>
          <p class="sub">可以登入這個後台的帳號。新增時輸入對方的 Email，系統會建立帳號並寄「設定密碼」的信給對方。</p>
        </div>
      </div>

      <div class="admin-error" v-if="err">{{ err }}</div>
      <div class="admin-notice" v-if="msg">{{ msg }}</div>

      <div class="admin-panel">
        <div class="admin-panel-title">新增管理者</div>
        <form class="admin-add-admin" @submit.prevent="addAdmin">
          <div class="form-row">
            <label>Email</label>
            <input type="email" v-model="email" required placeholder="name@example.com" autocomplete="off" />
          </div>
          <button type="submit" class="btn btn-primary" :disabled="adding">{{ adding ? '新增中…' : '新增' }}</button>
        </form>
      </div>

      <div class="admin-panel">
        <div class="admin-panel-title">目前的管理者</div>
        <div v-if="loading">載入中…</div>
        <div class="admin-admin-row" v-for="a in admins" :key="a.uid">
          <span>{{ a.email }} <span class="admin-badge" v-if="a.uid === user.uid">你</span></span>
          <button class="admin-icon-btn" @click="removeAdmin(a)" :disabled="a.uid === user.uid || admins.length <= 1" title="移除後台權限">🗑</button>
        </div>
      </div>
    </div>
  `,
};
