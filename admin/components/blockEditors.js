// Editor forms for the 7 "simple" block types (everything except
// registrationForm, which lives in RegistrationFormEditor.js because of its
// size). Each component takes the block object as `modelValue` and emits
// `update:modelValue` with an updated copy — standard v-model pattern, used
// from PageEditorView with `v-model="block"`.
import { clone, newId } from "../utils.js";

function textListMixinTemplate(itemLabel) {
  return `
    <div v-for="(item, i) in local.items" :key="i" class="admin-list-row">
      <textarea v-model="local.items[i]" @input="emitUpdate" rows="2" :placeholder="'${itemLabel} ' + (i + 1) + '（換行後的內容會變成下面一行較小的說明文字）'"></textarea>
      <button type="button" class="admin-icon-btn" @click="removeItem(i)" title="刪除">✕</button>
    </div>
    <button type="button" class="admin-mini-btn" @click="addItem">+ 新增一項</button>
  `;
}

export const RichTextEditor = {
  props: { modelValue: { type: Object, required: true } },
  emits: ["update:modelValue"],
  data() {
    return { local: clone(this.modelValue) };
  },
  watch: { modelValue: { deep: true, handler(v) { this.local = clone(v); } } },
  methods: {
    emitUpdate() { this.$emit("update:modelValue", clone(this.local)); },
    addPara() { this.local.paragraphs.push(""); this.emitUpdate(); },
    removePara(i) { this.local.paragraphs.splice(i, 1); this.emitUpdate(); },
  },
  template: `
    <div>
      <span class="admin-inline-label">段落文字（可用 **文字** 讓部分文字變粗體）</span>
      <div v-for="(p, i) in local.paragraphs" :key="i" class="admin-list-row">
        <textarea v-model="local.paragraphs[i]" @input="emitUpdate" rows="2"></textarea>
        <button type="button" class="admin-icon-btn" @click="removePara(i)" title="刪除">✕</button>
      </div>
      <button type="button" class="admin-mini-btn" @click="addPara">+ 新增段落</button>
    </div>
  `,
};

export const ListEditor = {
  props: { modelValue: { type: Object, required: true } },
  emits: ["update:modelValue"],
  data() {
    return { local: clone(this.modelValue) };
  },
  watch: { modelValue: { deep: true, handler(v) { this.local = clone(v); } } },
  methods: {
    emitUpdate() { this.$emit("update:modelValue", clone(this.local)); },
    addItem() { this.local.items.push(""); this.emitUpdate(); },
    removeItem(i) { this.local.items.splice(i, 1); this.emitUpdate(); },
  },
  template: `
    <div>
      <span class="admin-inline-label">樣式</span>
      <div class="admin-radio-row" v-for="v in [['arrow','▸ 箭頭'],['check','☑ 打勾'],['star','✦ 星號'],['number','① 帶圈數字（適合有順序的步驟說明）']]" :key="v[0]">
        <input type="radio" :id="'variant-' + local.id + '-' + v[0]" :value="v[0]" v-model="local.variant" @change="emitUpdate" />
        <label :for="'variant-' + local.id + '-' + v[0]">{{ v[1] }}</label>
      </div>
      <div class="form-row">
        <label>標題（選填）</label>
        <input type="text" v-model="local.heading" @input="emitUpdate" />
      </div>
      <span class="admin-inline-label">清單項目（可用 **文字** 讓部分文字變粗體）</span>
      ${textListMixinTemplate("項目")}
    </div>
  `,
};

export const ImageEditor = {
  props: { modelValue: { type: Object, required: true }, storage: { type: Object, required: true }, pageSlug: { type: String, required: true } },
  emits: ["update:modelValue"],
  data() {
    return { local: clone(this.modelValue), uploading: false, uploadError: "" };
  },
  watch: { modelValue: { deep: true, handler(v) { this.local = clone(v); } } },
  methods: {
    emitUpdate() { this.$emit("update:modelValue", clone(this.local)); },
    async handleFile(e) {
      const file = e.target.files[0];
      if (!file) return;
      this.uploading = true;
      this.uploadError = "";
      let task;
      try {
        const { ref, uploadBytesResumable, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js");
        const path = `pages/${this.pageSlug}/${this.local.id}-${file.name}`;
        task = uploadBytesResumable(ref(this.storage, path), file);
        // If Storage was never enabled for this project (e.g. skipped during
        // setup because it requires the paid Blaze plan), the SDK call can
        // hang on a long network timeout instead of failing fast — leaving
        // the spinner stuck forever with no feedback. Race against a fixed
        // timeout so the admin always gets a clear result either way.
        const TIMEOUT_MS = 15000;
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
        );
        const upload = new Promise((resolve, reject) => task.on("state_changed", null, reject, resolve));
        await Promise.race([upload, timeout]);
        this.local.url = await getDownloadURL(task.snapshot.ref);
        this.emitUpdate();
      } catch (err) {
        if (task) { try { task.cancel(); } catch { /* already settled */ } }
        this.uploadError = "上傳失敗，很可能是這個專案還沒啟用 Storage（需要升級到 Blaze 方案才能用）。請改用上面「貼上圖片網址」的方式。";
      } finally {
        this.uploading = false;
      }
    },
  },
  template: `
    <div>
      <div class="form-row">
        <label>或直接貼上圖片網址（免費圖床，例如 Google Drive 公開分享連結、Imgur 等，複製圖片網址貼在這裡）</label>
        <input type="text" v-model="local.url" @input="emitUpdate" placeholder="https://..." />
      </div>
      <div class="form-row">
        <label>上傳檔案（需要專案升級到 Blaze 方案才能用，見 docs/campaign-page-system-spec.md）</label>
        <input type="file" accept="image/*" @change="handleFile" :disabled="uploading" />
      </div>
      <p v-if="uploading" class="sub">上傳中…</p>
      <div class="admin-error" v-if="uploadError">{{ uploadError }}</div>
      <img v-if="local.url" :src="local.url" style="max-width:220px;border-radius:8px;display:block;margin-bottom:12px;" />
      <p class="sub" v-else>尚未設定圖片，公開頁面會顯示虛線佔位框。</p>
      <div class="form-row">
        <label>替代文字（給螢幕閱讀器／SEO 用，簡短描述這張圖）</label>
        <input type="text" v-model="local.alt" @input="emitUpdate" />
      </div>
      <div class="form-row">
        <label>圖說（選填）</label>
        <input type="text" v-model="local.caption" @input="emitUpdate" />
      </div>
    </div>
  `,
};

export const PricingEditor = {
  props: { modelValue: { type: Object, required: true } },
  emits: ["update:modelValue"],
  data() {
    return { local: clone(this.modelValue) };
  },
  watch: { modelValue: { deep: true, handler(v) { this.local = clone(v); } } },
  methods: {
    emitUpdate() { this.$emit("update:modelValue", clone(this.local)); },
    addCard() {
      this.local.cards.push({ id: newId("pc"), title: "", price: "", priceSuffix: "", perk: "", featured: false });
      this.emitUpdate();
    },
    removeCard(i) { this.local.cards.splice(i, 1); this.emitUpdate(); },
  },
  template: `
    <div>
      <div class="form-row">
        <label>標題（選填）</label>
        <input type="text" v-model="local.heading" @input="emitUpdate" />
      </div>
      <div v-for="(c, i) in local.cards" :key="c.id" class="admin-subgroup">
        <div class="admin-list-row">
          <input type="text" v-model="c.title" @input="emitUpdate" placeholder="方案名稱，例：單堂課程" />
          <button type="button" class="admin-icon-btn" @click="removeCard(i)" title="刪除">✕</button>
        </div>
        <div class="admin-list-row">
          <input type="text" v-model="c.price" @input="emitUpdate" placeholder="價格，例：$750" />
          <input type="text" v-model="c.priceSuffix" @input="emitUpdate" placeholder="單位後綴，例：／堂（選填）" />
        </div>
        <div class="admin-list-row">
          <input type="text" v-model="c.perk" @input="emitUpdate" placeholder="附加贈品說明（選填）" />
        </div>
        <label class="admin-radio-row">
          <input type="checkbox" v-model="c.featured" @change="emitUpdate" /> 醒目樣式（用來強調推薦方案）
        </label>
      </div>
      <button type="button" class="admin-mini-btn" @click="addCard">+ 新增方案卡片</button>
    </div>
  `,
};

export const NoteEditor = {
  props: { modelValue: { type: Object, required: true } },
  emits: ["update:modelValue"],
  data() {
    return { local: clone(this.modelValue) };
  },
  watch: { modelValue: { deep: true, handler(v) { this.local = clone(v); } } },
  methods: { emitUpdate() { this.$emit("update:modelValue", clone(this.local)); } },
  template: `
    <div class="form-row">
      <label>提示文字（換行會自動變成分行顯示）</label>
      <textarea v-model="local.text" @input="emitUpdate" rows="3"></textarea>
    </div>
  `,
};

export const TagsEditor = {
  props: { modelValue: { type: Object, required: true } },
  emits: ["update:modelValue"],
  data() {
    return { local: clone(this.modelValue) };
  },
  watch: { modelValue: { deep: true, handler(v) { this.local = clone(v); } } },
  methods: { emitUpdate() { this.$emit("update:modelValue", clone(this.local)); } },
  template: `
    <div class="form-row">
      <label>標籤文字（例：自由選課 × 課程多元 × 泳姿調整）</label>
      <input type="text" v-model="local.text" @input="emitUpdate" />
    </div>
  `,
};

export const HeadingEditor = {
  props: { modelValue: { type: Object, required: true } },
  emits: ["update:modelValue"],
  data() {
    return { local: clone(this.modelValue) };
  },
  watch: { modelValue: { deep: true, handler(v) { this.local = clone(v); } } },
  methods: { emitUpdate() { this.$emit("update:modelValue", clone(this.local)); } },
  template: `
    <div class="form-row">
      <label>標題文字</label>
      <input type="text" v-model="local.text" @input="emitUpdate" />
    </div>
  `,
};
