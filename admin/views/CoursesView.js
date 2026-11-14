// 後台「課程連結」：編輯 linkinbio 頁面「跑步課程」「游泳課程」兩個下拉選單裡的按鈕。
// 每個按鈕有名稱和連結（通常是 Google 表單的分享連結）。資料存在 Firestore 的 course_cards。
import { collection, getDocs, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { newId } from "../utils.js";

const GROUPS = [
  { id: "running", label: "跑步課程" },
  { id: "swim", label: "游泳課程" },
];

// 資料庫還是空的時候，後台直接顯示這 4 個目前網站上的按鈕
const SAMPLES = [
  { group: "running", label: "新一期跑班", url: "running-plan.html" },
  { group: "running", label: "客製化課程", url: "event-page.html?slug=customize-running-camp" },
  { group: "swim", label: "新一期游泳班", url: "event-page.html?slug=swim-camp" },
  { group: "swim", label: "客製化課程", url: "custom-course.html" },
];

const RULES_HINT =
  "沒有權限讀寫資料。請先到 Firebase 主控台更新 Firestore 規則，開放 course_cards（作法見 docs/campaign-page-system-spec.md 第 5 節）。";

// 允許 https:// 網址，或網站內的相對路徑（例如 running-plan.html）；擋掉 javascript: 之類的
function validUrl(u) {
  const v = (u || "").trim();
  if (!v) return false;
  if (/^https?:\/\/\S+$/i.test(v)) return true;
  return !/^[a-z][a-z0-9+.-]*:/i.test(v) && !/\s/.test(v);
}

export default {
  props: { db: { type: Object, required: true } },
  data() {
    return { items: [], removed: [], loading: true, saving: false, seeded: false, msg: "", err: "", dirty: false, GROUPS };
  },
  async mounted() {
    await this.load();
  },
  methods: {
    explain(e) {
      return e && e.code === "permission-denied" ? RULES_HINT : "發生錯誤：" + (e && e.message ? e.message : e);
    },
    inGroup(g) {
      return this.items.filter((x) => x.group === g);
    },
    async load() {
      this.loading = true;
      this.err = "";
      try {
        const snap = await getDocs(collection(this.db, "course_cards"));
        this.items = snap.docs
          .map((d) => {
            const x = d.data();
            return { id: d.id, key: d.id, group: x.group, order: x.order ?? 0, label: x.label || "", url: x.url || "" };
          })
          .sort((a, b) => a.order - b.order);
        this.removed = [];
        this.dirty = false;
        this.seeded = false;
        // 資料庫還是空的：直接顯示網站目前的按鈕，不需要再按匯入
        if (!this.items.length) {
          this.items = SAMPLES.map((x) => ({ id: null, key: newId("k"), ...x }));
          this.seeded = true;
        }
      } catch (e) {
        this.err = this.explain(e);
      }
      this.loading = false;
    },
    add(g) {
      this.items.push({ id: null, key: newId("k"), group: g, label: "", url: "" });
      this.dirty = true;
    },
    remove(item) {
      if (!confirm("確定要刪除「" + (item.label || "這個按鈕") + "」嗎？（按下「儲存變更」後才會真的刪除）")) return;
      if (item.id) this.removed.push(item.id);
      this.items.splice(this.items.indexOf(item), 1);
      this.dirty = true;
    },
    move(item, dir) {
      const same = this.inGroup(item.group);
      const target = same[same.indexOf(item) + dir];
      if (!target) return;
      const a = this.items.indexOf(item);
      const b = this.items.indexOf(target);
      [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
      this.dirty = true;
    },
    async save() {
      this.msg = "";
      this.err = "";
      for (const it of this.items) {
        if (!it.label.trim()) {
          this.err = "每個按鈕都需要填「名稱」。";
          return;
        }
        if (!validUrl(it.url)) {
          this.err = `「${it.label}」的連結格式不對。請貼上完整網址，例如 https://forms.gle/xxxx`;
          return;
        }
      }
      this.saving = true;
      try {
        const batch = writeBatch(this.db);
        for (const g of GROUPS) {
          this.inGroup(g.id).forEach((it, i) => {
            const ref = it.id ? doc(this.db, "course_cards", it.id) : doc(collection(this.db, "course_cards"));
            batch.set(ref, { group: g.id, order: i, label: it.label.trim(), url: it.url.trim(), updatedAt: serverTimestamp() });
          });
        }
        for (const id of this.removed) batch.delete(doc(this.db, "course_cards", id));
        await batch.commit();
        await this.load();
        this.msg = "已儲存，公開頁面重新整理後就會更新。";
      } catch (e) {
        this.err = this.explain(e);
      }
      this.saving = false;
    },
  },
  template: `
    <div>
      <div class="admin-editor-head">
        <div>
          <h2>課程連結</h2>
          <p class="sub">編輯 linkinbio 頁面「跑步課程」「游泳課程」下拉選單裡的按鈕。連結請貼 Google 表單的分享連結（例如 https://forms.gle/xxxx），訪客按下去會在新分頁開啟。</p>
        </div>
        <div class="admin-toolbar">
          <button class="btn btn-primary" @click="save" :disabled="saving || loading || !dirty">{{ saving ? '儲存中…' : '儲存變更' }}</button>
        </div>
      </div>

      <div class="admin-error" v-if="err">{{ err }}</div>
      <div class="admin-notice" v-if="msg">{{ msg }}</div>
      <div class="admin-dirty-banner" v-if="dirty">有尚未儲存的變更。</div>
      <div class="admin-notice" v-if="seeded">目前顯示的是網站內建的內容，還沒有存進資料庫。修改後按「儲存變更」，之後就改由後台管理。</div>

      <div v-if="loading">載入中…</div>
      <template v-else>
        <div class="admin-panel" v-for="g in GROUPS" :key="g.id">
          <div class="admin-panel-title">{{ g.label }}</div>
          <p class="sub" v-if="!inGroup(g.id).length">這一區目前沒有按鈕，公開頁面會顯示「即將開放」。</p>
          <div class="admin-course-row" v-for="it in inGroup(g.id)" :key="it.key">
            <div class="form-row">
              <label>按鈕名稱</label>
              <input type="text" v-model="it.label" @input="dirty = true" placeholder="例如：新一期跑班" />
            </div>
            <div class="form-row">
              <label>連結（Google 表單網址）</label>
              <input type="text" v-model="it.url" @input="dirty = true" placeholder="https://forms.gle/..." />
            </div>
            <div class="admin-slide-actions">
              <button class="admin-icon-btn" @click="move(it, -1)" title="上移">▲</button>
              <button class="admin-icon-btn" @click="move(it, 1)" title="下移">▼</button>
              <button class="admin-icon-btn" @click="remove(it)" title="刪除">🗑</button>
            </div>
          </div>
          <button class="btn btn-outline" @click="add(g.id)">+ 新增按鈕</button>
        </div>
      </template>
    </div>
  `,
};
