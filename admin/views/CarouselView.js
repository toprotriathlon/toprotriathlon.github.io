// 後台「輪播圖」：管理 linkinbio 頁面最上方的輪播照片。
// 資料存在 Firestore 的 carousel_slides。照片在瀏覽器裡縮小後以 data URL 直接存進文件，
// 這樣不需要啟用 Firebase Storage（Storage 需要付費方案）。
// 上傳時一律從中心裁成固定尺寸 1360×816（5:3，跟公開頁面的輪播框一致），後台沒有其他可調整的設定。
import { collection, getDocs, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { newId } from "../utils.js";

const MAX_SLIDES = 8;
const OUT_W = 1360; // 輸出尺寸，比例 5:3
const OUT_H = 816;
const MAX_DATA_URL = 800 * 1024; // 單張上限，Firestore 單一文件上限是 1MB
const CURRENT_PHOTOS = [
  { src: "assets/carousel/carousel-1.jpg" },
  { src: "assets/carousel/carousel-2.jpg" },
  { src: "assets/carousel/carousel-3.jpg" },
];

const RULES_HINT =
  "沒有權限讀寫資料。請先到 Firebase 主控台更新 Firestore 規則，開放 carousel_slides（作法見 docs/campaign-page-system-spec.md 第 5 節）。";

async function toDataUrl(blob) {
  const bmp = await createImageBitmap(blob);
  // 以中心為準，裁成 5:3 再縮放到固定尺寸（等同公開頁面 object-fit: cover 的效果）
  const targetRatio = OUT_W / OUT_H;
  let sw = bmp.width;
  let sh = bmp.height;
  if (sw / sh > targetRatio) sw = Math.round(sh * targetRatio);
  else sh = Math.round(sw / targetRatio);
  const sx = Math.round((bmp.width - sw) / 2);
  const sy = Math.round((bmp.height - sh) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  canvas.getContext("2d").drawImage(bmp, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
  let q = 0.82;
  let out = canvas.toDataURL("image/jpeg", q);
  while (out.length > MAX_DATA_URL && q > 0.4) {
    q -= 0.1;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}

export default {
  props: { db: { type: Object, required: true } },
  data() {
    return { slides: [], removed: [], loading: true, saving: false, working: false, seeded: false, msg: "", err: "", dirty: false, MAX_SLIDES };
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
        const snap = await getDocs(collection(this.db, "carousel_slides"));
        this.slides = snap.docs
          .map((d) => {
            const x = d.data();
            return { id: d.id, key: d.id, order: x.order ?? 0, image: x.image || "" };
          })
          .sort((a, b) => a.order - b.order);
        this.removed = [];
        this.dirty = false;
        this.seeded = false;
        // 資料庫還是空的：直接顯示網站目前的內建照片，不需要再按匯入
        if (!this.slides.length) {
          try {
            this.slides = await this.loadBuiltIn();
            this.seeded = this.slides.length > 0;
          } catch (_) { /* 讀不到內建照片就維持空白 */ }
        }
      } catch (e) {
        this.err = this.explain(e);
      }
      this.loading = false;
    },
    async addFiles(e) {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      this.err = "";
      this.working = true;
      for (const file of files) {
        if (this.slides.length >= MAX_SLIDES) {
          this.err = `最多 ${MAX_SLIDES} 張，多的已略過。`;
          break;
        }
        try {
          const image = await toDataUrl(file);
          this.slides.push({ id: null, key: newId("c"), image });
          this.dirty = true;
        } catch (_) {
          this.err = `「${file.name}」無法讀取，請改用 JPG 或 PNG。`;
        }
      }
      this.working = false;
    },
    // 讀取網頁內建的照片（assets/carousel/），轉成跟上傳照片相同的格式
    async loadBuiltIn() {
      const out = [];
      for (const p of CURRENT_PHOTOS) {
        const res = await fetch(p.src);
        if (!res.ok) throw new Error("讀不到 " + p.src);
        out.push({ id: null, key: newId("c"), image: await toDataUrl(await res.blob()) });
      }
      return out;
    },
    remove(i) {
      if (!confirm("確定要刪除這張照片嗎？（按下「儲存變更」後才會真的刪除）")) return;
      const s = this.slides[i];
      if (s.id) this.removed.push(s.id);
      this.slides.splice(i, 1);
      this.dirty = true;
    },
    async save() {
      this.msg = "";
      this.err = "";
      this.saving = true;
      try {
        const batch = writeBatch(this.db);
        this.slides.forEach((s, i) => {
          const ref = s.id ? doc(this.db, "carousel_slides", s.id) : doc(collection(this.db, "carousel_slides"));
          batch.set(ref, { order: i, image: s.image, alt: "TO PRO 活動照片 " + (i + 1), updatedAt: serverTimestamp() });
        });
        for (const id of this.removed) batch.delete(doc(this.db, "carousel_slides", id));
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
          <h2>輪播圖</h2>
          <p class="sub">顯示在 linkinbio 頁面最上方，依上傳順序每 4 秒自動切換。只要上傳照片即可，系統會自動從中心裁成固定尺寸（橫向 5:3），建議上傳橫向照片，人物放在畫面中間。</p>
        </div>
        <div class="admin-toolbar">
          <label class="btn btn-outline" :class="{ 'is-disabled': working || slides.length >= MAX_SLIDES }" style="cursor:pointer;">
            + 新增照片
            <input type="file" accept="image/*" multiple hidden @change="addFiles" :disabled="working || slides.length >= MAX_SLIDES" />
          </label>
          <button class="btn btn-primary" @click="save" :disabled="saving || loading || working || !dirty">{{ saving ? '儲存中…' : '儲存變更' }}</button>
        </div>
      </div>

      <div class="admin-error" v-if="err">{{ err }}</div>
      <div class="admin-notice" v-if="msg">{{ msg }}</div>
      <div class="admin-dirty-banner" v-if="dirty">有尚未儲存的變更。</div>
      <p class="sub" v-if="working">處理照片中…</p>
      <div class="admin-notice" v-if="seeded">目前顯示的是網站內建的內容，還沒有存進資料庫。修改後按「儲存變更」，之後就改由後台管理。</div>

      <div v-if="loading">載入中…</div>
      <template v-else>
        <div class="admin-slide-card" v-for="(s, i) in slides" :key="s.key">
          <div class="admin-slide-thumb">
            <img :src="s.image" alt="" />
          </div>
          <div class="admin-slide-fields"><p class="sub">第 {{ i + 1 }} 張</p></div>
          <div class="admin-slide-actions">
            <button class="admin-icon-btn" @click="remove(i)" title="刪除">🗑</button>
          </div>
        </div>
      </template>
    </div>
  `,
};
