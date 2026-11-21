// 後台「課程連結」：編輯 linkinbio 頁面「跑步課程」「客製化課程」「游泳課程」兩個下拉選單裡的按鈕。
// 每個按鈕有名稱和連結（通常是 Google 表單的分享連結）。資料存在 Firestore 的 course_cards。
import { collection, getDocs, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { newId } from "../utils.js";
import { cropImage } from "../components/imageCropper.js";
import MenuVisibilityToggle, { MENU_DOC } from "../components/MenuVisibilityToggle.js";

// 後台新增的下拉選單清單存在這份文件：{ group: "_menus", list: [{ id, label }] }（前台排在游泳課程之後）
const MENUS_DOC = "_custom_menus";

const GROUPS = [
  { id: "running", label: "專業跑步課程" },
  { id: "custom", label: "客製化課程" },
  { id: "swim", label: "游泳課程" },
];

// 資料庫還是空的時候，後台直接顯示目前網站上的按鈕
const SAMPLES = [
  { group: "running", label: "跑者專項肌力訓練(課程可分開報名)", url: "running-plan.html", image: "assets/courses/run-strength.jpg", status: "open" },
  { group: "running", label: "Vol. 19 一四常訓跑班·臺北", url: "running-plan.html", image: "assets/courses/run-taipei-vol19.jpg", status: "full" },
  { group: "running", label: "Vol. 02 五常訓跑班·板橋", url: "running-plan.html", image: "assets/courses/run-banqiao-vol02.jpg", status: "full" },
  { group: "custom", label: "跑步課程", url: "event-page.html?slug=customize-running-camp" },
  { group: "custom", label: "游泳課程", url: "custom-course.html" },
  { group: "swim", label: "新一期游泳班", url: "event-page.html?slug=swim-camp", image: "assets/courses/swim-camp.jpg", status: "open" },
];

const OUT_W = 800; // 封面圖固定 16:9 橫式，跟前台顯示的比例一致
const OUT_H = 450;
const MAX_DATA_URL = 300 * 1024; // 每張封面上限，Firestore 單一文件上限是 1MB

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
  components: { MenuVisibilityToggle },
  props: { db: { type: Object, required: true } },
  data() {
    return { GROUPS, items: [], menus: [], names: {}, deleted: [], order: [], removed: [], loading: true, saving: false, seeded: false, msg: "", err: "", dirty: false };
  },
  computed: {
    // 內建的三個 + 後台自己新增的
    allGroups() {
      const base = [...GROUPS.filter((g) => !this.deleted.includes(g.id)).map((g) => ({ ...g, label: (this.names[g.id] || "").trim() || g.label, defaultLabel: g.label, builtin: true })), ...this.menus]; // menus 直接用原物件，名稱欄位才能雙向綁定
      // 依後台排好的順序排列；不在順序清單裡的（例如剛新增的）排在最後，維持原本相對順序
      const idx = (g) => {
        const i = this.order.indexOf(g.id);
        return i < 0 ? this.order.length + base.indexOf(g) : i;
      };
      return base.slice().sort((a, b) => idx(a) - idx(b));
    },
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
        const menuSnap = snap.docs.find((d) => d.id === MENUS_DOC);
        // 內建三個下拉選單改過的名稱：{ running: "...", custom: "...", swim: "..." }；沒改過就用預設
        this.order = menuSnap && Array.isArray(menuSnap.data().order) ? [...menuSnap.data().order] : [];
        this.deleted = menuSnap && Array.isArray(menuSnap.data().deleted) ? [...menuSnap.data().deleted] : [];
        // 先放入預設名稱，輸入框才會直接顯示原有的標題文字，而不是空白
        this.names = { ...Object.fromEntries(GROUPS.map((g) => [g.id, g.label])), ...(menuSnap && menuSnap.data().labels ? menuSnap.data().labels : {}) };
        this.menus = menuSnap ? (menuSnap.data().list || []).filter((m) => m && m.id).map((m) => ({ id: m.id, label: m.label || "", builtin: false })) : [];
        this.items = snap.docs
          .filter((d) => d.id !== MENU_DOC && d.id !== MENUS_DOC)
          .map((d) => {
            const x = d.data();
            return { id: d.id, key: d.id, group: x.group, order: x.order ?? 0, label: x.label || "", url: x.url || "", image: x.image || "", status: x.status || "", pageOn: !!x.pageOn, pageTitle: x.pageTitle || "", pageText: x.pageText || "", ctaLabel: x.ctaLabel || "" };
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
    // 只留下跟預設名稱不同、且不是空白的名稱
    cleanNames() {
      const out = {};
      for (const g of GROUPS) {
        const v = (this.names[g.id] || "").trim();
        if (v && v !== g.label) out[g.id] = v;
      }
      return out;
    },
    // 目前畫面上的順序（含已刪除的內建選單，放在最後），存進資料庫給前台用
    currentOrder() {
      return [...this.allGroups.map((g) => g.id), ...this.deleted];
    },
    moveGroup(g, dir) {
      const ids = this.allGroups.map((x) => x.id);
      const i = ids.indexOf(g.id);
      const j = i + dir;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      this.order = [...ids, ...this.deleted];
      this.dirty = true;
    },
    removeBuiltin(g) {
      const n = this.inGroup(g.id).length;
      if (!confirm(`確定要刪除下拉選單「${g.label}」嗎？${n ? `裡面的 ${n} 張卡片也會一起刪除。` : ""}（按下「儲存變更」後才會真的刪除，之後可以在最下方還原空的選單）`)) return;
      this.inGroup(g.id).forEach((it) => {
        if (it.id) this.removed.push(it.id);
      });
      this.items = this.items.filter((x) => x.group !== g.id);
      this.deleted.push(g.id);
      this.dirty = true;
    },
    restoreBuiltin(id) {
      this.deleted = this.deleted.filter((x) => x !== id);
      this.dirty = true;
    },
    addMenu() {
      const name = (prompt("新下拉選單的名稱（會顯示在前台按鈕上）") || "").trim();
      if (!name) return;
      this.menus.push({ id: newId("m"), label: name, builtin: false });
      this.dirty = true;
    },
    removeMenu(m) {
      const n = this.inGroup(m.id).length;
      if (!confirm(`確定要刪除下拉選單「${m.label}」嗎？${n ? `裡面的 ${n} 張卡片也會一起刪除。` : ""}（按下「儲存變更」後才會真的刪除）`)) return;
      this.inGroup(m.id).forEach((it) => {
        if (it.id) this.removed.push(it.id);
      });
      this.items = this.items.filter((x) => x.group !== m.id);
      this.menus.splice(this.menus.indexOf(m), 1);
      this.dirty = true;
    },
    add(g) {
      this.items.push({ id: null, key: newId("k"), group: g, label: "", url: "", image: "", status: "closed", pageOn: false, pageTitle: "", pageText: "", ctaLabel: "" });
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
    async pickImage(item, e) {
      const file = (e.target.files || [])[0];
      e.target.value = "";
      if (!file) return;
      this.err = "";
      try {
        // 跳出裁切視窗，讓使用者自己決定保留照片的哪一塊；按取消就不更動
        const out = await cropImage(file, { outW: OUT_W, outH: OUT_H, maxBytes: MAX_DATA_URL });
        if (out) {
          item.image = out;
          this.dirty = true;
        }
      } catch (_) {
        this.err = `「${file.name}」無法讀取，請改用 JPG 或 PNG。`;
      }
    },
    setStatus(item, v) {
      item.status = v;
      this.dirty = true;
    },
    async save() {
      this.msg = "";
      this.err = "";
      if (this.menus.some((m) => !m.label.trim())) {
        this.err = "每個下拉選單都需要填「名稱」。";
        return;
      }
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
        for (const g of this.allGroups) {
          this.inGroup(g.id).forEach((it, i) => {
            const ref = it.id ? doc(this.db, "course_cards", it.id) : doc(collection(this.db, "course_cards"));
            batch.set(ref, { group: g.id, order: i, label: it.label.trim(), url: it.url.trim(), image: (it.image || "").trim(), status: it.status || "", pageOn: !!it.pageOn, pageTitle: (it.pageTitle || "").trim(), pageText: (it.pageText || "").trim(), ctaLabel: (it.ctaLabel || "").trim(), updatedAt: serverTimestamp() });
          });
        }
        batch.set(doc(this.db, "course_cards", MENUS_DOC), { group: "_menus", list: this.menus.map((m) => ({ id: m.id, label: m.label.trim() })), labels: this.cleanNames(), deleted: this.deleted, order: this.currentOrder(), updatedAt: serverTimestamp() });
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
          <p class="sub">編輯 linkinbio 頁面「跑步課程」「客製化課程」「游泳課程」下拉選單裡的按鈕。連結請貼 Google 表單的分享連結（例如 https://forms.gle/xxxx），訪客按下去會在新分頁開啟。</p>
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
        <div class="admin-panel" v-for="(g, gi) in allGroups" :key="g.id">
          <div class="admin-panel-title admin-menu-name" v-if="g.builtin">
            <input type="text" v-model="names[g.id]" @input="dirty = true" :placeholder="g.defaultLabel" aria-label="下拉選單名稱" />
            <span class="admin-group-move"><button type="button" class="admin-icon-btn" @click="moveGroup(g, -1)" :disabled="gi === 0" title="往上移">▲</button><button type="button" class="admin-icon-btn" @click="moveGroup(g, 1)" :disabled="gi === allGroups.length - 1" title="往下移">▼</button></span>
            <button type="button" class="btn btn-outline" @click="removeBuiltin(g)">刪除這個下拉選單</button>
          </div>
          <div class="admin-panel-title admin-menu-name" v-else>
            <input type="text" v-model="g.label" @input="dirty = true" placeholder="下拉選單名稱" aria-label="下拉選單名稱" />
            <span class="admin-group-move"><button type="button" class="admin-icon-btn" @click="moveGroup(g, -1)" :disabled="gi === 0" title="往上移">▲</button><button type="button" class="admin-icon-btn" @click="moveGroup(g, 1)" :disabled="gi === allGroups.length - 1" title="往下移">▼</button></span>
            <button type="button" class="btn btn-outline" @click="removeMenu(g)">刪除這個下拉選單</button>
          </div>
          <menu-visibility-toggle :db="db" :menu-id="g.id" />
          <p class="sub" v-if="!inGroup(g.id).length">這一區目前沒有卡片，公開頁面會顯示「即將開放」。</p>
          <div class="admin-course-row" v-for="it in inGroup(g.id)" :key="it.key">
            <div class="form-row">
              <label>按鈕名稱</label>
              <input type="text" v-model="it.label" @input="dirty = true" placeholder="例如：新一期跑班" />
            </div>
            <div class="form-row">
              <label>報名連結（Google 表單網址）</label>
              <input type="text" v-model="it.url" @input="dirty = true" placeholder="https://forms.gle/..." />
            </div>
            <div class="form-row">
              <label>封面照片（選填，選好照片後可自己拖曳、縮放選擇要保留的範圍）</label>
              <div class="admin-cover-edit">
                <img v-if="it.image" :src="it.image" alt="" class="admin-cover-thumb" />
                <label class="btn btn-outline admin-cover-btn">
                  {{ it.image ? '更換照片' : '上傳照片' }}
                  <input type="file" accept="image/*" hidden @change="pickImage(it, $event)" />
                </label>
                <button v-if="it.image" type="button" class="btn btn-outline admin-cover-btn" @click="it.image = ''; dirty = true">移除照片</button>
              </div>
            </div>
            <div class="form-row">
              <label>狀態標籤</label>
              <div class="admin-status-toggle">
                <button type="button" :class="{ on: it.status === 'open' }" @click="setStatus(it, 'open')">報名中</button>
                <button type="button" :class="{ on: it.status === 'full' }" @click="setStatus(it, 'full')">已額滿</button>
                <button type="button" :class="{ on: !it.status || it.status === 'closed' }" @click="setStatus(it, 'closed')">未開放</button>
              </div>
            </div>
            <div class="form-row">
              <label class="admin-check"><input type="checkbox" v-model="it.pageOn" @change="dirty = true" /> 點卡片開啟站內「課程內頁」（一張圖＋一段文字＋報名按鈕）</label>
            </div>
            <template v-if="it.pageOn">
              <div class="form-row">
                <label>內頁標題（顯示在圖片上方，不填就用上面的「按鈕名稱」）</label>
                <input type="text" v-model="it.pageTitle" @input="dirty = true" :placeholder="it.label || '例如：Vol. 19 一四常訓跑班'" />
              </div>
              <div class="form-row">
                <label>內頁文字（按 Enter 換行）</label>
                <textarea rows="6" v-model="it.pageText" @input="dirty = true" placeholder="直接輸入課程介紹文字…"></textarea>
                <p class="sub" v-if="!it.image">內頁的圖片就是上面的「封面照片」，請先上傳。</p>
              </div>
              <div class="form-row">
                <label>報名按鈕文字</label>
                <input type="text" v-model="it.ctaLabel" @input="dirty = true" placeholder="我要報名" />
              </div>
            </template>
            <div class="admin-slide-actions">
              <button class="admin-icon-btn" @click="move(it, -1)" title="上移">▲</button>
              <button class="admin-icon-btn" @click="move(it, 1)" title="下移">▼</button>
              <button class="admin-icon-btn" @click="remove(it)" title="刪除">🗑</button>
            </div>
          </div>
          <button class="btn btn-outline" @click="add(g.id)">+ 新增卡片</button>
        </div>
        <button class="btn btn-outline admin-add-menu" @click="addMenu">+ 新增下拉選單</button>
        <div class="admin-restore" v-if="deleted.length">
          <span class="sub">已刪除的下拉選單：</span>
          <button type="button" class="btn btn-outline" v-for="g in GROUPS.filter((x) => deleted.includes(x.id))" :key="g.id" @click="restoreBuiltin(g.id)">還原「{{ g.label }}」</button>
        </div>
      </template>
    </div>
  `,
};
