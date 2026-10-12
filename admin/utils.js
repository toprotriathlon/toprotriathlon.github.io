// Small shared helpers used across the admin app. No framework dependency.

export function newId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Move array[index] up or down by one, returning a new array (Vue reactivity
// friendly — callers assign the result back rather than mutating in place).
export function moveItem(array, index, direction) {
  const next = clone(array);
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// Default payload for each block type, used when the admin adds a new block.
export function defaultBlock(type) {
  const id = newId("b");
  switch (type) {
    case "richtext":
      return { id, type, paragraphs: [""] };
    case "list":
      return { id, type, variant: "arrow", heading: "", items: [""] };
    case "image":
      return { id, type, url: "", alt: "", caption: "" };
    case "pricing":
      return { id, type, heading: "", cards: [{ id: newId("pc"), title: "", price: "", priceSuffix: "", perk: "", featured: false }] };
    case "note":
      return { id, type, text: "" };
    case "tags":
      return { id, type, text: "" };
    case "heading":
      return { id, type, text: "" };
    case "registrationForm":
      return {
        id, type, formId: "",
        steps: [{ id: newId("step"), stepNumber: 1, heading: "", fields: [] }],
        successMessage: { heading: "報名資料已送出！", body: "" },
      };
    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}

export const BLOCK_TYPE_LABELS = {
  richtext: "文字段落",
  list: "條列清單",
  image: "圖片",
  pricing: "價格方案卡片",
  note: "提示訊息框",
  tags: "標籤條",
  heading: "區塊標題",
  registrationForm: "報名表單",
};

export const FIELD_TYPE_LABELS = {
  text: "單行文字",
  textarea: "多行文字",
  singleSelect: "單選",
  multiSelect: "多選",
  dropdown: "下拉選單",
  date: "日期",
  checkbox: "勾選同意",
};

export function defaultField(type) {
  const id = newId("f");
  const base = { id, type, name: "", label: "", required: false };
  if (type === "singleSelect" || type === "multiSelect" || type === "dropdown") {
    return { ...base, options: [{ id: newId("o"), label: "", value: "" }], withPricing: false };
  }
  if (type === "text") return { ...base, inputType: "text" };
  return base;
}
