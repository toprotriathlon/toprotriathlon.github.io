// 「隱藏／顯示這個下拉選單」的管理鈕，給 linkinbio 頁面上的每個下拉選單用。
// 設定存在 Firestore 的 course_cards/_menu_visibility（{ group: "_menu", hidden: { running: true, ... } }），
// 借用 course_cards 這個已經開放公開讀取、後台可寫的 collection，不需要另外更新 Firestore 規則。
// 按下去馬上生效，不需要再按「儲存變更」。
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const MENU_DOC = "_menu_visibility";

export default {
  props: {
    db: { type: Object, required: true },
    menuId: { type: String, required: true }, // running | custom | swim | monthly | team
  },
  data() {
    return { hidden: false, loading: true, saving: false, err: "" };
  },
  async mounted() {
    try {
      const snap = await getDoc(doc(this.db, "course_cards", MENU_DOC));
      this.hidden = !!(snap.exists() && snap.data().hidden && snap.data().hidden[this.menuId]);
    } catch (e) {
      this.err = "讀取失敗：" + (e && e.message ? e.message : e);
    }
    this.loading = false;
  },
  methods: {
    async toggle() {
      const next = !this.hidden;
      this.saving = true;
      this.err = "";
      try {
        await setDoc(
          doc(this.db, "course_cards", MENU_DOC),
          { group: "_menu", hidden: { [this.menuId]: next }, updatedAt: serverTimestamp() },
          { merge: true }
        );
        this.hidden = next;
      } catch (e) {
        this.err = e && e.code === "permission-denied" ? "沒有權限寫入設定。" : "發生錯誤：" + (e && e.message ? e.message : e);
      }
      this.saving = false;
    },
  },
  template: `
    <span class="admin-menu-toggle">
      <span class="admin-menu-state" :class="{ off: hidden }">{{ loading ? '…' : (hidden ? '前台已隱藏' : '前台顯示中') }}</span>
      <button type="button" class="btn btn-outline" @click="toggle" :disabled="loading || saving">
        {{ saving ? '處理中…' : (hidden ? '重新顯示這個下拉選單' : '隱藏這個下拉選單') }}
      </button>
      <span class="admin-menu-err" v-if="err">{{ err }}</span>
    </span>
  `,
};
