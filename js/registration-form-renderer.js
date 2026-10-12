// Builds the .reg-form DOM tree from a registrationForm block and wires up
// the exact same step-navigation/validation UX as the original hand-written
// swim-camp.html <script> — generalized to an arbitrary number of steps and
// fields instead of the old hardcoded 3-step version. See that file's git
// history (or docs/campaign-page-system-spec.md) for the original reference.
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { renderBlock } from "./block-renderer.js";

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 標籤文字加上必填星號提示，讓填表人事先知道哪些欄位一定要填，不用等到按下一步失敗才知道
function labelHtml(text, required) {
  return esc(text) + (required ? ' <span class="req-mark">*</span>' : "");
}

function renderOptionsGroup(field) {
  const wrap = el("div", "plan-options");
  // HTML 原生的 checkbox required 語意是「這一個框一定要勾」，不是「這組裡至少勾一個」——
  // 用在多選（checkbox）上會變成強迫每個選項都要打勾。radio（單選）則沒有這個問題，瀏覽器
  // 原生就懂「同一個 name 底下選一個就好」。所以多選改成自訂驗證，見 validateStep()。
  if (field.type === "multiSelect" && field.required) {
    wrap.dataset.multiRequired = field.name;
  }
  field.options.forEach((opt) => {
    const label = el("label", "plan-option");
    const input = document.createElement("input");
    input.type = field.type === "multiSelect" ? "checkbox" : "radio";
    input.name = field.name;
    input.value = opt.value;
    if (field.required && field.type !== "multiSelect") input.required = true;
    label.appendChild(input);
    label.appendChild(el("span", "po-main", esc(opt.label)));
    if (field.withPricing && opt.price) label.appendChild(el("span", "po-price", esc(opt.price)));
    if (field.withPricing && opt.perk) label.appendChild(el("span", "po-perk", esc(opt.perk)));
    wrap.appendChild(label);
  });
  return wrap;
}

function renderField(field) {
  if (field.type === "singleSelect" || field.type === "multiSelect") {
    if (field.label) {
      const row = el("div", "form-row");
      row.appendChild(el("label", null, labelHtml(field.label, field.required)));
      row.appendChild(renderOptionsGroup(field));
      return row;
    }
    return renderOptionsGroup(field);
  }
  if (field.type === "checkbox") {
    const label = el("label", "plan-option");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = field.name;
    input.value = "已同意";
    if (field.required) input.required = true;
    label.appendChild(input);
    label.appendChild(el("span", "po-main", esc(field.label)));
    return label;
  }
  if (field.type === "dropdown") {
    const row = el("div", "form-row");
    row.appendChild(el("label", null, labelHtml(field.label, field.required)));
    const select = document.createElement("select");
    select.name = field.name;
    if (field.required) select.required = true;
    field.options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    });
    row.appendChild(select);
    return row;
  }
  const row = el("div", "form-row");
  row.appendChild(el("label", null, labelHtml(field.label, field.required)));
  const input = document.createElement(field.type === "textarea" ? "textarea" : "input");
  if (field.type !== "textarea") input.type = field.inputType || "text";
  input.name = field.name;
  if (field.required) input.required = true;
  if (field.placeholder) input.placeholder = field.placeholder;
  row.appendChild(input);
  return row;
}

function renderFieldList(fields) {
  const frag = document.createDocumentFragment();
  // An item list may mix form fields with ordinary content blocks (a
  // paragraph, an image, a note) added by the admin between fields — items
  // saved before this existed have no itemType and are treated as fields.
  (fields || []).forEach((item) => {
    frag.appendChild(item.itemType === "content" ? renderBlock(item) : renderField(item));
  });
  return frag;
}

function renderStep(step, stepIndex, totalSteps) {
  const div = el("div", "reg-step" + (stepIndex === 0 ? " is-active" : ""));
  div.dataset.step = String(step.stepNumber);
  if (step.heading) div.appendChild(el("h5", null, esc(step.heading)));

  // 條款清單要先讓人讀完，同意勾選框（存在 step.fields 裡）才接在下面 ——
  // 對應原本 swim-camp.html 的順序：ol.terms-list 在前，label.plan-option 在後。
  if (step.termsList) {
    const ol = el("ol", "terms-list");
    step.termsList.forEach((t) => ol.appendChild(el("li", null, esc(t))));
    div.appendChild(ol);
  }

  if (step.fields && step.fields.length) div.appendChild(renderFieldList(step.fields));

  if (step.conditionalGroups) {
    step.conditionalGroups.forEach((g) => {
      const group = el("div", "plan-fields");
      group.dataset.planFor = g.showWhen.equals;
      group.dataset.showField = g.showWhen.fieldName;
      group.hidden = true;
      if (g.heading) group.appendChild(el("h5", null, esc(g.heading)));
      if (g.note) group.appendChild(el("p", "detail-note-inline", esc(g.note)));
      group.appendChild(renderFieldList(g.fields));
      div.appendChild(group);
    });
  }

  if (step.note) div.appendChild(el("p", "detail-note-inline", esc(step.note)));

  const nav = el("div", "reg-nav");
  if (stepIndex > 0) {
    nav.style.justifyContent = "space-between";
    const prev = el("button", "btn btn-text reg-prev", "← 上一步");
    prev.type = "button";
    nav.appendChild(prev);
  }
  if (stepIndex < totalSteps - 1) {
    const next = el("button", "btn btn-primary reg-next", "下一步");
    next.type = "button";
    if (stepHasRequiredChoice(step)) next.disabled = true;
    nav.appendChild(next);
  } else {
    const submit = el("button", "btn btn-primary", "送出報名");
    submit.type = "submit";
    nav.appendChild(submit);
  }
  div.appendChild(nav);
  return div;
}

// Mirrors the original's exact gating rule: the "next" button starts
// disabled if the step has a required radio-style field (only step 1's
// plan-select in the original), enabled on any radio change.
function stepHasRequiredChoice(step) {
  return (step.fields || []).some((f) => f.type === "singleSelect" && f.required);
}

export function renderRegistrationForm(block, { db, pageSlug }) {
  const form = document.createElement("form");
  form.className = "reg-form";
  form.dataset.formId = block.formId || "";
  form.noValidate = true;

  const totalSteps = block.steps.length;
  const indicator = el("div", "reg-steps-indicator", `步驟 <b class="reg-step-now">1</b> / <span class="reg-step-total">${totalSteps}</span>`);
  form.appendChild(indicator);

  block.steps.forEach((step, i) => form.appendChild(renderStep(step, i, totalSteps)));

  const successStep = el("div", "reg-step");
  successStep.dataset.step = "success";
  const successInner = el("div", "reg-success");
  successInner.appendChild(el("div", "check", "✓"));
  successInner.appendChild(el("h5", null, esc(block.successMessage?.heading || "報名資料已送出！")));
  successInner.appendChild(el("p", null, esc(block.successMessage?.body || "")));
  successStep.appendChild(successInner);
  const errorBox = el("div", "detail-note-inline", "");
  errorBox.hidden = true;
  // insertAdjacentElement("beforebegin", ...) needs the target to already
  // have a parent — successStep isn't attached to `form` yet at this point,
  // so that call was silently failing and the error box never made it into
  // the page at all. Append both directly to `form` instead.
  form.appendChild(errorBox);
  form.appendChild(successStep);

  wireInteractions(form, { db, pageSlug, errorBox });
  return form;
}

function wireInteractions(form, { db, pageSlug, errorBox }) {
  const steps = Array.from(form.querySelectorAll(".reg-step"));
  const indicatorNow = form.querySelector(".reg-step-now");
  const data = {};

  function goToStep(stepName) {
    steps.forEach((s) => s.classList.remove("is-active"));
    const target = form.querySelector(`.reg-step[data-step="${stepName}"]`);
    if (target) target.classList.add("is-active");
    if (indicatorNow && stepName !== "success") indicatorNow.textContent = stepName;

    // Generalized version of the original's Step-1→2 conditional-group
    // toggle: for the step we're entering, show only the .plan-fields group
    // whose data-showField/data-planFor matches the currently accumulated
    // answer for that field.
    if (target) {
      target.querySelectorAll(".plan-fields").forEach((group) => {
        const selected = form.querySelector(`[name="${group.dataset.showField}"]:checked`);
        const value = selected ? selected.value : "";
        group.hidden = group.dataset.planFor !== value;
      });
    }
  }

  function validateStep(step) {
    const fields = step.querySelectorAll("input[required], textarea[required], select[required]");
    for (const field of fields) {
      if (field.closest("[hidden]")) continue;
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    // 必填的多選欄位：至少要勾一個（不能用原生 required，理由見 renderOptionsGroup 註解）
    const multiGroups = step.querySelectorAll("[data-multi-required]");
    for (const group of multiGroups) {
      if (group.closest("[hidden]")) continue;
      const name = group.dataset.multiRequired;
      if (group.querySelector(`input[name="${name}"]:checked`)) continue;
      const first = group.querySelector(`input[name="${name}"]`);
      if (first) {
        first.setCustomValidity("請至少勾選一個選項");
        first.reportValidity();
        first.setCustomValidity("");
      }
      return false;
    }
    return true;
  }

  form.querySelectorAll('input[type="radio"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const step = radio.closest(".reg-step");
      const nextBtn = step && step.querySelector(".reg-next");
      if (nextBtn) nextBtn.disabled = false;
    });
  });

  form.querySelectorAll(".reg-next").forEach((btn) => {
    btn.addEventListener("click", () => {
      const currentStep = btn.closest(".reg-step");
      if (!validateStep(currentStep)) return;
      goToStep(String(Number(currentStep.dataset.step) + 1));
    });
  });

  form.querySelectorAll(".reg-prev").forEach((btn) => {
    btn.addEventListener("click", () => {
      const currentStep = btn.closest(".reg-step");
      goToStep(String(Number(currentStep.dataset.step) - 1));
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const currentStep = form.querySelector(".reg-step.is-active");
    if (!validateStep(currentStep)) return;

    // FormData collapses repeated names to the last value, which is correct
    // for radios/single fields but would silently drop multiSelect
    // checkboxes sharing one name — collect those into arrays instead.
    const formData = new FormData(form);
    const multiNames = new Set(
      Array.from(form.querySelectorAll('input[type="checkbox"]'))
        .map((i) => i.name)
        .filter((name, _, all) => all.filter((n) => n === name).length > 1)
    );
    for (const name of multiNames) data[name] = formData.getAll(name);
    formData.forEach((value, key) => { if (!multiNames.has(key)) data[key] = value; });

    const submitBtn = currentStep.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await addDoc(collection(db, "submissions"), {
        pageSlug,
        formId: form.dataset.formId,
        data,
        submittedAt: serverTimestamp(),
        status: "new",
        userAgent: navigator.userAgent,
      });
      goToStep("success");
    } catch (err) {
      errorBox.hidden = false;
      errorBox.textContent = "送出失敗，請確認網路連線後再試一次；若持續發生，請直接透過 LINE 聯絡我們。";
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
