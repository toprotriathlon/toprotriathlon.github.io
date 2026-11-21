// 後台選擇照片後跳出的裁切視窗：拖曳照片移動位置、滑桿／滾輪／雙指縮放，自由決定要保留哪一塊。
// 裁切框的比例固定（跟前台顯示的比例一致），所以裁出來的圖放到前台不會再被二次裁切。
// 用法：const dataUrl = await cropImage(file, { outW: 800, outH: 450, maxBytes: 300 * 1024 });
//       回傳 JPEG data URL；使用者按取消則回傳 null；檔案讀不到會 throw。

export function cropImage(file, { outW, outH, maxBytes = 800 * 1024, title = "選擇要保留的範圍" }) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("圖片無法讀取"));
    };
    img.onload = () => open(img);
    img.src = url;

    function open(img) {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      const MAX_ZOOM = 4;

      const overlay = document.createElement("div");
      overlay.className = "crop-overlay";
      overlay.innerHTML = `
        <div class="crop-dialog" role="dialog" aria-modal="true" aria-label="${title}">
          <div class="crop-title">${title}</div>
          <div class="crop-stage" style="aspect-ratio:${outW} / ${outH}"></div>
          <p class="crop-hint">拖曳照片調整位置，用下方滑桿（或滾輪、雙指）縮放。亮的區域就是前台會顯示的範圍。</p>
          <div class="crop-zoom"><span>縮小</span><input type="range" min="1" max="${MAX_ZOOM}" step="0.01" value="1" aria-label="縮放"><span>放大</span></div>
          <div class="crop-actions">
            <button type="button" class="btn btn-outline crop-cancel">取消</button>
            <button type="button" class="btn btn-primary crop-ok">使用這個範圍</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const stage = overlay.querySelector(".crop-stage");
      const slider = overlay.querySelector("input[type=range]");
      img.className = "crop-img";
      img.draggable = false;
      stage.appendChild(img);

      let W = 0, H = 0, s0 = 1, z = 1, x = 0, y = 0;

      const clamp = () => {
        const s = s0 * z;
        x = Math.min(0, Math.max(W - nw * s, x));
        y = Math.min(0, Math.max(H - nh * s, y));
      };
      const render = () => {
        clamp();
        const s = s0 * z;
        img.style.width = nw * s + "px";
        img.style.height = nh * s + "px";
        img.style.transform = `translate(${x}px, ${y}px)`;
        slider.value = z;
      };
      // 以舞台上的某一點（px）為中心縮放，讓那一點底下的畫面位置不變
      const zoomAt = (nextZ, px, py) => {
        nextZ = Math.min(MAX_ZOOM, Math.max(1, nextZ));
        const s = s0 * z;
        const ix = (px - x) / s; // 該點對應的原圖座標
        const iy = (py - y) / s;
        z = nextZ;
        const s2 = s0 * z;
        x = px - ix * s2;
        y = py - iy * s2;
        render();
      };
      const layout = () => {
        const r = stage.getBoundingClientRect();
        if (!r.width) return;
        const keepCenter = W ? { cx: (W / 2 - x) / (s0 * z), cy: (H / 2 - y) / (s0 * z) } : null;
        W = r.width;
        H = r.height;
        s0 = Math.max(W / nw, H / nh);
        if (keepCenter) {
          x = W / 2 - keepCenter.cx * s0 * z;
          y = H / 2 - keepCenter.cy * s0 * z;
        } else {
          x = (W - nw * s0) / 2; // 一開始置中
          y = (H - nh * s0) / 2;
        }
        render();
      };
      layout();
      window.addEventListener("resize", layout);

      // 拖曳／雙指縮放
      const pts = new Map();
      let pinchDist = 0;
      stage.addEventListener("pointerdown", (e) => {
        stage.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        }
      });
      stage.addEventListener("pointermove", (e) => {
        const p = pts.get(e.pointerId);
        if (!p) return;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        p.x = e.clientX;
        p.y = e.clientY;
        if (pts.size === 1) {
          x += dx;
          y += dy;
          render();
        } else if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const r = stage.getBoundingClientRect();
          if (pinchDist) zoomAt(z * (d / pinchDist), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
          pinchDist = d;
        }
      });
      const up = (e) => {
        pts.delete(e.pointerId);
        pinchDist = 0;
      };
      stage.addEventListener("pointerup", up);
      stage.addEventListener("pointercancel", up);
      stage.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const r = stage.getBoundingClientRect();
          zoomAt(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top);
        },
        { passive: false }
      );
      slider.addEventListener("input", () => zoomAt(parseFloat(slider.value), W / 2, H / 2));

      const close = (result) => {
        window.removeEventListener("resize", layout);
        document.removeEventListener("keydown", onKey);
        overlay.remove();
        URL.revokeObjectURL(url);
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === "Escape") close(null);
      };
      document.addEventListener("keydown", onKey);
      overlay.querySelector(".crop-cancel").addEventListener("click", () => close(null));
      overlay.querySelector(".crop-ok").addEventListener("click", () => {
        const s = s0 * z;
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        canvas.getContext("2d").drawImage(img, -x / s, -y / s, W / s, H / s, 0, 0, outW, outH);
        let q = 0.85;
        let out = canvas.toDataURL("image/jpeg", q);
        while (out.length > maxBytes && q > 0.4) {
          q -= 0.1;
          out = canvas.toDataURL("image/jpeg", q);
        }
        close(out);
      });
    }
  });
}
