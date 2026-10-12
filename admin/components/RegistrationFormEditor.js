// Editor for the registrationForm block type — the most complex block since
// it nests steps → (fields | conditionalGroups | termsList) → fields → options.
// All sub-pieces are local components in this one file for locality (they're
// only ever used here).
import { clone, newId, moveItem, FIELD_TYPE_LABELS, defaultField, defaultBlock } from "../utils.js";
import { RichTextEditor, ImageEditor, NoteEditor, HeadingEditor, ListEditor } from "./blockEditors.js";

// A step's / conditional group's item list can hold form fields AND ordinary
// content blocks (paragraphs, images, notes, headings, lists) interleaved —
// e.g. a note + image sitting between two form fields, matching how the
// original swim-camp.html page mixed marketing copy into the middle of its
// registration steps. Content items reuse the exact same block shapes and
// editors as page-level blocks (see blockEditors.js) rather than duplicating
// a second editor for the same thing.
const CONTENT_TYPE_LABELS = { richtext: "文字段落", image: "圖片", note: "提示訊息框", heading: "標題", list: "條列清單" };
const CONTENT_EDITORS = { richtext: "RichTextEditor", image: "ImageEditor", note: "NoteEditor", heading: "HeadingEditor", list: "ListEditor" };
// Items saved before this feature existed have no itemType — treat those as
// plain form fields (the only kind that existed at the time).
function itemKind(item) { return item.itemType === "content" ? "content" : "field"; }

const OptionsEditor = {
  props: { field: { type: Object, required: true } },
  emits: ["change"],
  methods: {
    addOption() {
      // Defensive: a field that reached this editor via older data (saved
      // before this bug was fixed) may still have no `options` array yet.
      if (!this.field.options) this.field.options = [];
      this.field.options.push({ id: newId("o"), label: "", value: "", price: "", perk: "" });
      this.$emit("change");
    },
    removeOption(i) { this.field.options.splice(i, 1); this.$emit("change"); },
  },
  template: `
    <div class="admin-subgroup">
      <span class="admin-inline-label">選項</span>
      <div v-for="(o, i) in field.options" :key="o.id" class="admin-list-row" style="flex-direction:column;align-items:stretch;">
        <div class="admin-list-row">
          <input type="text" v-model="o.label" @input="$emit('change')" placeholder="選項文字（訪客看到的）" />
          <input type="text" v-model="o.value" @input="$emit('change')" placeholder="選項值（存進資料庫用，建議跟文字一致）" />
          <button type="button" class="admin-icon-btn" @click="removeOption(i)" title="刪除">✕</button>
        </div>
        <div class="admin-list-row" v-if="field.withPricing">
          <input type="text" v-model="o.price" @input="$emit('change')" placeholder="價格，例：$3,500" />
          <input type="text" v-model="o.perk" @input="$emit('change')" placeholder="附加贈品說明（選填）" />
        </div>
      </div>
      <button type="button" class="admin-mini-btn" @click="addOption">+ 新增選項</button>
    </div>
  `,
};

const FieldEditor = {
  components: { OptionsEditor },
  props: { field: { type: Object, required: true } },
  emits: ["change", "remove"],
  computed: {
    hasOptions() { return ["singleSelect", "multiSelect", "dropdown"].includes(this.field.type); },
  },
  methods: {
    onTypeChange() {
      // Fields default to type "text" with no `options` array. Switching to
      // an options-based type needs that array created on the spot, or the
      // options editor below has nothing to render into and "+ 新增選項"
      // silently fails (pushing onto undefined).
      if (this.hasOptions && !this.field.options) {
        this.field.options = [{ id: `o-${Date.now().toString(36)}`, label: "", value: "" }];
        if (this.field.withPricing === undefined) this.field.withPricing = false;
      }
      this.$emit("change");
    },
  },
  template: `
    <div class="admin-subgroup">
      <div class="admin-list-row">
        <select v-model="field.type" @change="onTypeChange">
          <option v-for="(label, t) in { text: '單行文字', textarea: '多行文字', singleSelect: '單選', multiSelect: '多選', dropdown: '下拉選單', date: '日期', checkbox: '勾選同意' }" :key="t" :value="t">{{ label }}</option>
        </select>
        <button type="button" class="admin-icon-btn" @click="$emit('remove')" title="刪除欄位">✕</button>
      </div>
      <div class="admin-list-row">
        <input type="text" v-model="field.label" @input="$emit('change')" placeholder="欄位標籤（訪客看到的問題文字）" />
      </div>
      <div class="admin-list-row">
        <input type="text" v-model="field.name" @input="$emit('change')" placeholder="欄位代稱（英文/數字，存進資料庫用，例：phone）" />
        <label class="admin-radio-row" style="flex-shrink:0;">
          <input type="checkbox" v-model="field.required" @change="$emit('change')" /> 必填
        </label>
      </div>
      <div class="admin-list-row" v-if="field.type === 'text'">
        <select v-model="field.inputType" @change="$emit('change')">
          <option value="text">一般文字</option>
          <option value="tel">電話</option>
          <option value="email">Email</option>
        </select>
      </div>
      <label class="admin-radio-row" v-if="hasOptions && field.type === 'singleSelect'">
        <input type="checkbox" v-model="field.withPricing" @change="$emit('change')" /> 每個選項附價格與贈品（用於方案選擇）
      </label>
      <OptionsEditor v-if="hasOptions" :field="field" @change="$emit('change')" />
    </div>
  `,
};

const FieldListEditor = {
  components: { FieldEditor, RichTextEditor, ImageEditor, NoteEditor, HeadingEditor, ListEditor },
  props: {
    fields: { type: Array, required: true },
    storage: { type: Object, required: true },
    pageSlug: { type: String, required: true },
  },
  emits: ["change"],
  data() { return { contentTypeLabels: CONTENT_TYPE_LABELS }; },
  methods: {
    itemKind,
    contentEditor(item) { return CONTENT_EDITORS[item.type]; },
    addField() { this.fields.push({ itemType: "field", ...defaultField("text") }); this.$emit("change"); },
    addContent(type) { this.fields.push({ itemType: "content", ...defaultBlock(type) }); this.$emit("change"); },
    removeItem(i) { this.fields.splice(i, 1); this.$emit("change"); },
    moveItemAt(i, dir) { this.fields.splice(0, this.fields.length, ...moveItem(this.fields, i, dir)); this.$emit("change"); },
    updateContent(i, updated) { this.fields[i] = { itemType: "content", ...updated }; this.$emit("change"); },
  },
  template: `
    <div>
      <div v-for="(item, i) in fields" :key="item.id" style="position:relative;">
        <div class="admin-list-row" style="justify-content:flex-end;gap:4px;margin-bottom:4px;">
          <button type="button" class="admin-icon-btn" @click="moveItemAt(i, -1)" :disabled="i === 0" title="上移">▲</button>
          <button type="button" class="admin-icon-btn" @click="moveItemAt(i, 1)" :disabled="i === fields.length - 1" title="下移">▼</button>
        </div>
        <FieldEditor v-if="itemKind(item) === 'field'" :field="item" @change="$emit('change')" @remove="removeItem(i)" />
        <div v-else class="admin-subgroup">
          <div class="admin-list-row" style="justify-content:space-between;">
            <span class="admin-block-type">內容區塊・{{ contentTypeLabels[item.type] }}</span>
            <button type="button" class="admin-icon-btn" @click="removeItem(i)" title="刪除">✕</button>
          </div>
          <component
            :is="contentEditor(item)"
            :model-value="item"
            @update:model-value="updateContent(i, $event)"
            :storage="storage"
            :page-slug="pageSlug"
          />
        </div>
      </div>
      <div class="admin-toolbar" style="margin-top:8px;flex-wrap:wrap;gap:6px;">
        <button type="button" class="admin-mini-btn" @click="addField">+ 新增欄位</button>
        <button type="button" class="admin-mini-btn" v-for="(label, type) in contentTypeLabels" :key="type" @click="addContent(type)">+ {{ label }}</button>
      </div>
    </div>
  `,
};

const ConditionalGroupEditor = {
  components: { FieldListEditor },
  props: {
    group: { type: Object, required: true },
    storage: { type: Object, required: true },
    pageSlug: { type: String, required: true },
  },
  emits: ["change", "remove"],
  template: `
    <div class="admin-subgroup">
      <div class="admin-list-row">
        <input type="text" v-model="group.showWhen.fieldName" @input="$emit('change')" placeholder="觸發欄位代稱，例：swim-plan" />
        <input type="text" v-model="group.showWhen.equals" @input="$emit('change')" placeholder="等於這個選項值時才顯示" />
        <button type="button" class="admin-icon-btn" @click="$emit('remove')" title="刪除整組">✕</button>
      </div>
      <p class="sub" style="margin:-4px 0 10px;">填的「選項值」要跟前面某個單選欄位的「選項值」完全一樣，例如「單堂課程｜$750」。</p>
      <div class="form-row">
        <label>這組欄位的標題（選填）</label>
        <input type="text" v-model="group.heading" @input="$emit('change')" />
      </div>
      <div class="form-row">
        <label>這組欄位上方的提示文字（選填，若需要更長的說明或圖片，可以改用下方「+ 文字段落／+ 圖片」新增內容區塊）</label>
        <input type="text" v-model="group.note" @input="$emit('change')" />
      </div>
      <FieldListEditor :fields="group.fields" :storage="storage" :page-slug="pageSlug" @change="$emit('change')" />
    </div>
  `,
};

const StepEditor = {
  components: { FieldListEditor, ConditionalGroupEditor },
  props: {
    step: { type: Object, required: true },
    storage: { type: Object, required: true },
    pageSlug: { type: String, required: true },
  },
  emits: ["change"],
  methods: {
    addConditionalGroups() {
      if (!this.step.conditionalGroups) this.step.conditionalGroups = [];
      this.step.conditionalGroups.push({ id: newId("cg"), showWhen: { fieldName: "", equals: "" }, heading: "", note: "", fields: [] });
      this.$emit("change");
    },
    removeGroup(i) { this.step.conditionalGroups.splice(i, 1); this.$emit("change"); },
    addTerms() { if (!this.step.termsList) this.step.termsList = [""]; this.$emit("change"); },
    addTermItem() { this.step.termsList.push(""); this.$emit("change"); },
    removeTermItem(i) { this.step.termsList.splice(i, 1); this.$emit("change"); },
  },
  template: `
    <div>
      <div class="form-row">
        <label>步驟標題（選填）</label>
        <input type="text" v-model="step.heading" @input="$emit('change')" />
      </div>

      <div class="admin-panel" style="background:#F9FAFB;">
        <div class="admin-panel-title">一般欄位（不依前面答案改變）</div>
        <FieldListEditor :fields="step.fields || (step.fields = [])" :storage="storage" :page-slug="pageSlug" @change="$emit('change')" />
      </div>

      <div class="admin-panel" style="background:#F9FAFB;">
        <div class="admin-panel-title">依前面答案顯示不同欄位群組</div>
        <div v-if="step.conditionalGroups">
          <ConditionalGroupEditor v-for="(g, i) in step.conditionalGroups" :key="g.id" :group="g" :storage="storage" :page-slug="pageSlug" @change="$emit('change')" @remove="removeGroup(i)" />
          <button type="button" class="admin-mini-btn" @click="addConditionalGroups">+ 再新增一組條件欄位</button>
        </div>
        <button type="button" class="admin-mini-btn" v-else @click="addConditionalGroups">+ 新增條件欄位群組</button>
      </div>

      <div class="admin-panel" style="background:#F9FAFB;">
        <div class="admin-panel-title">條款清單（例如報名注意事項）</div>
        <div v-if="step.termsList">
          <div v-for="(t, i) in step.termsList" :key="i" class="admin-list-row">
            <textarea v-model="step.termsList[i]" @input="$emit('change')" rows="2"></textarea>
            <button type="button" class="admin-icon-btn" @click="removeTermItem(i)" title="刪除">✕</button>
          </div>
          <button type="button" class="admin-mini-btn" @click="addTermItem">+ 新增條款項目</button>
        </div>
        <button type="button" class="admin-mini-btn" v-else @click="addTerms">+ 新增條款清單</button>
      </div>

      <div class="form-row">
        <label>步驟下方的提示文字（選填）</label>
        <input type="text" v-model="step.note" @input="$emit('change')" />
      </div>
    </div>
  `,
};

export const RegistrationFormEditor = {
  components: { StepEditor },
  props: {
    modelValue: { type: Object, required: true },
    storage: { type: Object, required: true },
    pageSlug: { type: String, required: true },
  },
  emits: ["update:modelValue"],
  data() {
    return { local: clone(this.modelValue) };
  },
  watch: { modelValue: { deep: true, handler(v) { this.local = clone(v); } } },
  methods: {
    emitUpdate() { this.$emit("update:modelValue", clone(this.local)); },
    addStep() {
      const n = this.local.steps.length + 1;
      this.local.steps.push({ id: newId("step"), stepNumber: n, heading: "", fields: [] });
      this.emitUpdate();
    },
    removeStep(i) {
      this.local.steps.splice(i, 1);
      this.local.steps.forEach((s, idx) => { s.stepNumber = idx + 1; });
      this.emitUpdate();
    },
  },
  template: `
    <div>
      <div class="form-row">
        <label>表單代稱（formId，寫進報名資料裡，方便日後篩選）</label>
        <input type="text" v-model="local.formId" @input="emitUpdate" />
      </div>

      <div v-for="(step, i) in local.steps" :key="step.id" class="admin-panel">
        <div class="admin-panel-title">步驟 {{ step.stepNumber }}
          <button type="button" class="admin-icon-btn" style="float:right;" @click="removeStep(i)" title="刪除步驟" :disabled="local.steps.length <= 1">✕</button>
        </div>
        <StepEditor :step="step" :storage="storage" :page-slug="pageSlug" @change="emitUpdate" />
      </div>
      <button type="button" class="admin-mini-btn" @click="addStep">+ 新增步驟</button>

      <div class="admin-panel">
        <div class="admin-panel-title">送出成功後顯示的訊息</div>
        <div class="form-row">
          <label>標題</label>
          <input type="text" v-model="local.successMessage.heading" @input="emitUpdate" />
        </div>
        <div class="form-row">
          <label>內文</label>
          <textarea v-model="local.successMessage.body" @input="emitUpdate" rows="2"></textarea>
        </div>
      </div>
    </div>
  `,
};
