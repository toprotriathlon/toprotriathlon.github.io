// 後台「當月特別活動」與「團練行事曆」共用的編輯畫面。
// 資料存在 Firestore 的 schedule_items，用 group 欄位區分（'monthly' | 'team'）。
// 公開頁 linkinbio.html 讀同一個 collection 來顯示。
import { collection, getDocs, query, where, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { newId } from "../utils.js";

// 第一次使用、資料庫還是空的時候，後台直接顯示目前網站上正在顯示的內容
const SAMPLES = {
  team: [
    { date: "2026-07-07", time: "19:00", title: "間歇跑 700m × 6–8 組", desc: "桃園三民運動公園" },
    { date: "2026-07-11", time: "05:30", title: "長距離跑 12–15K", desc: "蘆興景觀埤塘生態公園" },
    { date: "2026-07-12", time: "06:00", title: "北海岸看海路線・約騎 80K", desc: "詳細集合地點另行公布" },
    { date: "2026-07-31", time: "20:15", title: "游泳團練", desc: "桃園市立游泳池" },
  ],
  monthly: [
    { date: "2026-07-05", time: "07:15", title: "TO PRO × Loop Café 編織 × 咖啡跑", desc: "Loop Cafe 路譜咖啡" },
    { date: "2026-07-25", time: "07:45", title: "Bætter × TO PRO 桃園女子跑聚", desc: "肉球尼尼 Meatball Nini" },
  ],
};

const RULES_HINT =
  "沒有權限讀寫資料。請先到 Firebase 主控台更新 Firestore 規則，開放 schedule_items（作法見 docs/campaign-page-system-spec.md 第 5 節）。";

// 報名連結是選填：留空就用活動詳情頁；有填的話必須是 https:// 網址
function validOptionalUrl(u) {
  const v = (u || "").trim();
  return !v || /^https?:\/\/\S+$/i.test(v);
}

function byDateTime(a, b) {
  return (a.date + " " + a.time).localeCompare(b.date + " " + b.time);
}

export default {
  props: {
    db: { type: Object, required: true },
    group: { type: String, required: true },
    title: { type: String, required: true },
  },
  data() {
    return { items: [], removed: [], loading: true, saving: false, seeded: false, msg: "", err: "", dirty: false };
  },
  async mounted() {
    await this.load();
  },
  methods: {
    explain(e) {
      return e && e.code === "permission-denied" ? RULES_HINT : "發生錯誤：" + (e && e.message ? e.message : e);
    },
    async load() {
      this.loading = true;
      this.err = "";
      try {
        const snap = await getDocs(query(collection(this.db, "schedule_items"), where("group", "==", this.group)));
        this.items = snap.docs
          .map((d) => {
            const x = d.data();
            return { id: d.id, key: d.id, date: x.date || "", time: x.time || "", title: x.title || "", desc: x.desc || "", url: x.url || "" };
          })
          .sort(byDateTime);
        this.removed = [];
        this.dirty = false;
        this.seeded = false;
        // 資料庫還是空的：直接顯示網站目前的內容，不需要再按匯入
        if (!this.items.length) {
          this.items = SAMPLES[this.group].map((x) => ({ id: null, key: newId("s"), ...x }));
          this.seeded = true;
        }
      } catch (e) {
        this.err = this.explain(e);
      }
      this.loading = false;
    },
    add() {
      this.items.push({ id: null, key: newId("s"), date: "", time: "", title: "", desc: "", url: "" });
      this.dirty = true;
    },
    remove(i) {
      if (!confirm("確定要刪除這一筆嗎？（按下「儲存變更」後才會真的刪除）")) return;
      const it = this.items[i];
      if (it.id) this.removed.push(it.id);
      this.items.splice(i, 1);
      this.dirty = true;
    },
    sortNow() {
      this.items.sort(byDateTime);
    },
    async save() {
      this.msg = "";
      this.err = "";
      for (const it of this.items) {
        if (!it.date || !it.title.trim()) {
          this.err = "每一筆都需要填「日期」和「名稱」。";
          return;
        }
        if (!validOptionalUrl(it.url)) {
          this.err = `「${it.title}」的報名連結格式不對。請貼上完整網址，例如 https://forms.gle/xxxx，或留空。`;
          return;
        }
      }
      this.saving = true;
      try {
        const batch = writeBatch(this.db);
        for (const it of this.items) {
          const ref = it.id ? doc(this.db, "schedule_items", it.id) : doc(collection(this.db, "schedule_items"));
          batch.set(ref, {
            group: this.group,
            date: it.date,
            time: it.time || "",
            title: it.title.trim(),
            desc: (it.desc || "").trim(),
            url: (it.url || "").trim(),
            updatedAt: serverTimestamp(),
          });
        }
        for (const id of this.removed) batch.delete(doc(this.db, "schedule_items", id));
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
          <h2>{{ title }}</h2>
          <p class="sub">顯示在 linkinbio 頁面的「{{ title }}」下拉選單，依日期排序。</p>
        </div>
        <div class="admin-toolbar">
          <button class="btn btn-outline" @click="add" :disabled="loading">+ 新增一筆</button>
          <button class="btn btn-primary" @click="save" :disabled="saving || loading || !dirty">{{ saving ? '儲存中…' : '儲存變更' }}</button>
        </div>
      </div>

      <div class="admin-error" v-if="err">{{ err }}</div>
      <div class="admin-notice" v-if="msg">{{ msg }}</div>
      <div class="admin-dirty-banner" v-if="dirty">有尚未儲存的變更。</div>
      <div class="admin-notice" v-if="seeded">目前顯示的是網站內建的內容，還沒有存進資料庫。修改後按「儲存變更」，之後就改由後台管理。</div>

      <div v-if="loading">載入中…</div>
      <template v-else>
        <div class="admin-sched-row" v-for="(it, i) in items" :key="it.key">
          <div class="form-row">
            <label>日期</label>
            <input type="date" v-model="it.date" @input="dirty = true" @change="sortNow" />
          </div>
          <div class="form-row">
            <label>時間</label>
            <input type="time" v-model="it.time" @input="dirty = true" />
          </div>
          <div class="form-row admin-sched-title">
            <label>名稱</label>
            <input type="text" v-model="it.title" @input="dirty = true" placeholder="例如：間歇跑 700m × 6–8 組" />
          </div>
          <div class="form-row admin-sched-desc">
            <label>地點／備註</label>
            <input type="text" v-model="it.desc" @input="dirty = true" placeholder="例如：桃園三民運動公園" />
          </div>
          <button class="admin-icon-btn" @click="remove(i)" title="刪除">🗑</button>
          <div class="form-row admin-sched-url">
            <label>報名連結（Google 表單網址，選填；留空則開啟活動詳情頁）</label>
            <input type="text" v-model="it.url" @input="dirty = true" placeholder="https://forms.gle/..." />
          </div>
        </div>
      </template>
    </div>
  `,
};
