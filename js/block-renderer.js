// Renders a page's `blocks` array into the exact DOM structure/classes that
// swim-camp.html used to hand-write, using only classes already defined in
// css/linkinbio.css — no new CSS is introduced here.

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Minimal **bold** markdown support for the few <strong> spans the original
// marketing copy used — admin-authored content only (never public-submitted
// content), so this is a trusted-content convenience, not a public input path.
function mdToHtml(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

const LIST_VARIANT_CLASS = { arrow: "detail-arrow-list", check: "detail-check-list", star: "detail-info-list", number: "detail-number-list" };

function renderRichText(block) {
  const wrap = el("div", "detail-copy");
  block.paragraphs.forEach((p) => {
    if (!p) return;
    wrap.appendChild(el("p", null, mdToHtml(p)));
  });
  return wrap;
}

function renderList(block) {
  const frag = document.createDocumentFragment();
  if (block.heading) frag.appendChild(el("h5", "detail-h", escapeHtml(block.heading)));
  const ul = el("ul", LIST_VARIANT_CLASS[block.variant] || "detail-arrow-list");
  block.items.forEach((item) => {
    if (!item) return;
    // First line is the main item text; any following lines render as a
    // smaller, muted description underneath (admin enters this by pressing
    // Enter inside the item field — no schema change, just a convention).
    const [main, ...rest] = item.split("\n");
    const desc = rest.join("\n").trim();
    const html = mdToHtml(main) + (desc ? `<span class="list-item-desc">${mdToHtml(desc)}</span>` : "");
    ul.appendChild(el("li", null, html));
  });
  frag.appendChild(ul);
  return frag;
}

function renderImage(block) {
  if (!block.url) {
    return el("div", "detail-image-placeholder", `${escapeHtml(block.alt || "圖片")}${block.caption ? `<br><span style="font-size:11.5px;">${escapeHtml(block.caption)}</span>` : ""}`);
  }
  const frag = document.createDocumentFragment();
  const img = document.createElement("img");
  img.src = block.url;
  img.alt = block.alt || "";
  img.style.cssText = "width:100%;border-radius:12px;display:block;margin-bottom:6px;";
  frag.appendChild(img);
  if (block.caption) frag.appendChild(el("p", null, escapeHtml(block.caption))).className = "detail-note-inline";
  return frag;
}

function renderPricing(block) {
  const frag = document.createDocumentFragment();
  if (block.heading) frag.appendChild(el("h5", "detail-h", escapeHtml(block.heading)));
  const wrap = el("div", "pricing-cards");
  block.cards.forEach((c) => {
    const card = el("div", "pricing-card" + (c.featured ? " featured" : ""));
    card.appendChild(el("div", "pc-title", escapeHtml(c.title)));
    card.appendChild(el("div", "pc-price", `${escapeHtml(c.price)}${c.priceSuffix ? `<span>${escapeHtml(c.priceSuffix)}</span>` : ""}`));
    if (c.perk) card.appendChild(el("div", "pc-perk", escapeHtml(c.perk)));
    wrap.appendChild(card);
  });
  frag.appendChild(wrap);
  return frag;
}

function renderNote(block) {
  return el("p", "detail-note-inline", escapeHtml(block.text).replace(/\n/g, "<br>"));
}

function renderTags(block) {
  return el("div", "detail-tags", escapeHtml(block.text));
}

function renderHeading(block) {
  return el("h5", "detail-h", escapeHtml(block.text));
}

// registrationForm is rendered by registration-form-renderer.js (it needs a
// db handle to wire up submission, unlike the other block types which are
// pure markup). This module exposes a hook the caller fills in.
let registrationFormRenderer = null;
export function setRegistrationFormRenderer(fn) { registrationFormRenderer = fn; }

export function renderBlock(block) {
  switch (block.type) {
    case "richtext": return renderRichText(block);
    case "list": return renderList(block);
    case "image": return renderImage(block);
    case "pricing": return renderPricing(block);
    case "note": return renderNote(block);
    case "tags": return renderTags(block);
    case "heading": return renderHeading(block);
    case "registrationForm":
      if (!registrationFormRenderer) throw new Error("registrationFormRenderer not set — call setRegistrationFormRenderer() first");
      return registrationFormRenderer(block);
    default:
      console.warn("Unknown block type, skipping:", block.type);
      return document.createDocumentFragment();
  }
}

export function renderPage(container, pageData) {
  container.innerHTML = "";
  const header = pageData.header || {};
  const headerWrap = el("div", "detail-content");
  if (header.eyebrow) headerWrap.appendChild(el("span", "detail-eyebrow", escapeHtml(header.eyebrow)));
  if (header.title) headerWrap.appendChild(el("h4", null, escapeHtml(header.title)));
  if (header.quote) headerWrap.appendChild(el("p", "detail-quote", escapeHtml(header.quote)));
  container.appendChild(headerWrap);

  (pageData.blocks || []).forEach((block) => {
    if (block.type === "registrationForm") {
      // registration form is NOT wrapped in .detail-content — it's a sibling
      // <form>, matching the original swim-camp.html structure.
      container.appendChild(renderBlock(block));
    } else {
      const target = container.lastElementChild && container.lastElementChild.classList.contains("detail-content")
        ? container.lastElementChild
        : container.appendChild(el("div", "detail-content"));
      target.appendChild(renderBlock(block));
    }
  });
}
