import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export default {
  props: { db: { type: Object, required: true } },
  emits: ["open"],
  data() {
    return { pages: [], loading: true, creating: false, newSlug: "", newTitle: "", createError: "" };
  },
  async mounted() {
    await this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      const snap = await getDocs(collection(this.db, "pages"));
      this.pages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      this.loading = false;
    },
    async createPage() {
      this.createError = "";
      const slug = this.newSlug.trim();
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        this.createError = "網址代稱（slug）只能用小寫英文字母、數字與連字號，例如 winter-run-camp";
        return;
      }
      const existing = await getDoc(doc(this.db, "pages", slug));
      if (existing.exists()) {
        this.createError = "這個網址代稱已經被使用了，換一個試試";
        return;
      }
      const now = serverTimestamp();
      await setDoc(doc(this.db, "pages", slug), {
        slug,
        title: this.newTitle.trim() || slug,
        metaDescription: "",
        status: "draft",
        draftVersion: { header: { eyebrow: "", title: this.newTitle.trim() || slug, quote: "" }, blocks: [], updatedAt: now },
        publishedVersion: null,
        createdAt: now,
        updatedAt: now,
        createdBy: "admin",
        updatedBy: "admin",
      });
      this.creating = false;
      this.newSlug = "";
      this.newTitle = "";
      await this.load();
      this.$emit("open", slug);
    },
  },
  template: `
    <div>
      <div class="admin-editor-head">
        <div>
          <h2>活動頁面</h2>
          <p class="sub">每一頁對應公開頁面的 event-page.html?slug=...</p>
        </div>
        <button class="btn btn-primary" @click="creating = true" v-if="!creating">+ 新增頁面</button>
      </div>

      <div class="admin-panel" v-if="creating">
        <div class="admin-panel-title">新增活動頁面</div>
        <div class="admin-error" v-if="createError">{{ createError }}</div>
        <div class="form-row">
          <label>頁面標題</label>
          <input type="text" v-model="newTitle" placeholder="例：冬季路跑訓練營" />
        </div>
        <div class="form-row">
          <label>網址代稱（slug，之後不能改）</label>
          <input type="text" v-model="newSlug" placeholder="例：winter-run-camp" />
        </div>
        <div class="admin-toolbar">
          <button class="btn btn-primary" @click="createPage">建立</button>
          <button class="btn btn-text" @click="creating = false; createError = ''">取消</button>
        </div>
      </div>

      <p v-if="loading">載入中…</p>
      <table class="admin-table" v-else>
        <thead><tr><th>標題</th><th>網址代稱</th><th>狀態</th><th></th></tr></thead>
        <tbody>
          <tr v-for="p in pages" :key="p.id">
            <td>{{ p.title }}</td>
            <td>{{ p.slug }}</td>
            <td>
              <span class="admin-status" :class="p.status">{{ p.status === 'published' ? '已發布' : '草稿' }}</span>
            </td>
            <td><a href="#" class="admin-link" @click.prevent="$emit('open', p.slug)">編輯 →</a></td>
          </tr>
          <tr v-if="!pages.length"><td colspan="4">還沒有任何頁面，點右上角「+ 新增頁面」開始</td></tr>
        </tbody>
      </table>
    </div>
  `,
};
