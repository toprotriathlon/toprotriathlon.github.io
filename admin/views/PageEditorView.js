import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { clone, moveItem, defaultBlock, BLOCK_TYPE_LABELS } from "../utils.js";
import { RichTextEditor, ListEditor, ImageEditor, PricingEditor, NoteEditor, TagsEditor, HeadingEditor } from "../components/blockEditors.js";
import { RegistrationFormEditor } from "../components/RegistrationFormEditor.js";

const EDITORS = {
  richtext: "RichTextEditor",
  list: "ListEditor",
  image: "ImageEditor",
  pricing: "PricingEditor",
  note: "NoteEditor",
  tags: "TagsEditor",
  heading: "HeadingEditor",
  registrationForm: "RegistrationFormEditor",
};

function blockPreview(block) {
  switch (block.type) {
    case "richtext": return (block.paragraphs[0] || "（空白）").slice(0, 60);
    case "list": return block.heading || `${block.items.length} 個項目`;
    case "image": return block.alt || (block.url ? "圖片" : "尚未上傳圖片");
    case "pricing": return block.heading || `${block.cards.length} 個方案`;
    case "note": return (block.text || "（空白）").slice(0, 60);
    case "tags": return block.text || "（空白）";
    case "heading": return block.text || "（空白）";
    case "registrationForm": return `${block.steps.length} 個步驟的報名表單`;
    default: return "";
  }
}

export default {
  components: { RichTextEditor, ListEditor, ImageEditor, PricingEditor, NoteEditor, TagsEditor, HeadingEditor, RegistrationFormEditor },
  props: {
    db: { type: Object, required: true },
    storage: { type: Object, required: true },
    slug: { type: String, required: true },
  },
  emits: ["back"],
  data() {
    return {
      loading: true,
      saving: false,
      publishing: false,
      showPublishConfirm: false,
      page: null,       // raw Firestore doc data
      draft: null,       // { header, blocks } — local working copy of draftVersion
      openBlockId: null,
      addingBlockAt: null, // index to insert at, or null
      blockTypeLabels: BLOCK_TYPE_LABELS,
    };
  },
  computed: {
    isDirty() {
      if (!this.page || !this.draft) return false;
      const draftJson = JSON.stringify({ header: this.draft.header, blocks: this.draft.blocks });
      const publishedJson = this.page.publishedVersion
        ? JSON.stringify({ header: this.page.publishedVersion.header, blocks: this.page.publishedVersion.blocks })
        : null;
      return draftJson !== publishedJson;
    },
  },
  watch: {
    draft: { handler() { this.sendPreview(); }, deep: true },
  },
  async mounted() {
    this._onMsg = (e) => {
      if (e.origin === location.origin && e.data && e.data.type === "preview-ready") this.sendPreview();
    };
    window.addEventListener("message", this._onMsg);
    await this.load();
  },
  beforeUnmount() { window.removeEventListener("message", this._onMsg); },
  methods: {
    sendPreview() {
      const frame = this.$refs.previewFrame;
      if (!frame || !frame.contentWindow || !this.draft) return;
      frame.contentWindow.postMessage(
        { type: "preview", data: JSON.parse(JSON.stringify({ header: this.draft.header, blocks: this.draft.blocks })) },
        location.origin
      );
    },
    editorFor(type) { return EDITORS[type]; },
    preview: blockPreview,
    async load() {
      this.loading = true;
      const snap = await getDoc(doc(this.db, "pages", this.slug));
      this.page = snap.data();
      this.draft = clone(this.page.draftVersion);
      this.loading = false;
    },
    updateBlock(i, updated) { this.draft.blocks[i] = updated; },
    addBlock(type) {
      const insertAt = this.addingBlockAt === null ? this.draft.blocks.length : this.addingBlockAt;
      const block = defaultBlock(type);
      this.draft.blocks.splice(insertAt, 0, block);
      this.openBlockId = block.id;
      this.addingBlockAt = null;
    },
    removeBlock(i) {
      if (!confirm("確定要刪除這個區塊嗎？")) return;
      this.draft.blocks.splice(i, 1);
    },
    moveBlock(i, dir) { this.draft.blocks = moveItem(this.draft.blocks, i, dir); },
    toggleBlock(id) { this.openBlockId = this.openBlockId === id ? null : id; },
    async saveDraft() {
      this.saving = true;
      await updateDoc(doc(this.db, "pages", this.slug), {
        title: this.draft.header.title || this.page.title,
        draftVersion: { header: this.draft.header, blocks: this.draft.blocks, updatedAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
        updatedBy: "admin",
      });
      await this.load();
      this.saving = false;
    },
    async confirmPublish() {
      this.publishing = true;
      await updateDoc(doc(this.db, "pages", this.slug), {
        status: "published",
        publishedVersion: { header: this.draft.header, blocks: this.draft.blocks, updatedAt: serverTimestamp() },
        draftVersion: { header: this.draft.header, blocks: this.draft.blocks, updatedAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
        updatedBy: "admin",
      });
      await this.load();
      this.publishing = false;
      this.showPublishConfirm = false;
    },
  },
  template: `
    <div v-if="loading">載入中…</div>
    <div v-else class="admin-editor-layout">
      <div class="admin-editor-col">
      <div class="admin-editor-head">
        <div>
          <a href="#" class="admin-link" @click.prevent="$emit('back')">← 返回活動頁面列表</a>
          <h2 style="margin-top:8px;">{{ page.title }}</h2>
          <p class="sub">
            <span class="admin-status" :class="page.status">{{ page.status === 'published' ? '已發布' : '草稿' }}</span>
            ・公開網址：event-page.html?slug={{ slug }}
          </p>
        </div>
        <div class="admin-toolbar">
          <button class="btn btn-outline" @click="saveDraft" :disabled="saving">{{ saving ? '儲存中…' : '儲存草稿' }}</button>
          <button class="btn btn-primary" @click="showPublishConfirm = true" :disabled="publishing">發布</button>
        </div>
      </div>

      <div class="admin-dirty-banner" v-if="isDirty">有尚未發布的變更 — 訪客目前看到的仍是上一次發布的內容。</div>

      <div class="admin-panel">
        <div class="admin-panel-title">頁面標題區塊</div>
        <div class="form-row">
          <label>Eyebrow 小標</label>
          <input type="text" v-model="draft.header.eyebrow" />
        </div>
        <div class="form-row">
          <label>標題</label>
          <input type="text" v-model="draft.header.title" />
        </div>
        <div class="form-row">
          <label>引言（選填）</label>
          <input type="text" v-model="draft.header.quote" />
        </div>
      </div>

      <div v-for="(block, i) in draft.blocks" :key="block.id" class="admin-block-card">
        <div class="admin-block-head" @click="toggleBlock(block.id)">
          <span class="admin-block-type">{{ blockTypeLabels[block.type] }}</span>
          <span class="admin-block-preview">{{ preview(block) }}</span>
          <div class="admin-block-actions" @click.stop>
            <button class="admin-icon-btn" @click="moveBlock(i, -1)" :disabled="i === 0" title="上移">▲</button>
            <button class="admin-icon-btn" @click="moveBlock(i, 1)" :disabled="i === draft.blocks.length - 1" title="下移">▼</button>
            <button class="admin-icon-btn" @click="toggleBlock(block.id)" title="編輯">✎</button>
            <button class="admin-icon-btn" @click="removeBlock(i)" title="刪除">🗑</button>
          </div>
        </div>
        <div class="admin-block-body" v-show="openBlockId === block.id">
          <component
            :is="editorFor(block.type)"
            :model-value="block"
            @update:model-value="updateBlock(i, $event)"
            :storage="storage"
            :page-slug="slug"
          />
        </div>
      </div>

      <div class="admin-panel">
        <div class="admin-panel-title">+ 新增區塊</div>
        <div class="admin-add-block">
          <button v-for="(label, type) in blockTypeLabels" :key="type" @click="addBlock(type)">{{ label }}</button>
        </div>
      </div>

      <div class="admin-modal-overlay" v-if="showPublishConfirm" @click.self="showPublishConfirm = false">
        <div class="admin-modal">
          <h3>確定要發布嗎？</h3>
          <p>此操作將讓目前草稿內容立即對外顯示在 event-page.html?slug={{ slug }}。</p>
          <div class="admin-modal-actions">
            <button class="btn btn-text" @click="showPublishConfirm = false">取消</button>
            <button class="btn btn-primary" @click="confirmPublish" :disabled="publishing">{{ publishing ? '發布中…' : '確定發布' }}</button>
          </div>
        </div>
      </div>
      </div>
      <aside class="admin-preview-col">
        <div class="admin-preview-title">即時預覽（未儲存的變更也會顯示）</div>
        <iframe ref="previewFrame" src="admin-preview.html" class="admin-preview-frame" @load="sendPreview"></iframe>
      </aside>
    </div>
  `,
};
