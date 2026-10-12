// TO PRO 桃園鐵人三項俱樂部 — main.js

document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.body.classList.toggle('nav-open');
    });
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => document.body.classList.remove('nav-open'));
    });
  }

  // Scroll reveal
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  // Simple contact form handler (static site — opens mail client with the message)
  const form = document.querySelector('#contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = data.get('name') || '';
      const email = data.get('email') || '';
      const interest = data.get('interest') || '';
      const message = data.get('message') || '';
      const body = encodeURIComponent(
        `姓名：${name}\n信箱：${email}\n有興趣的項目：${interest}\n\n訊息：\n${message}`
      );
      // TODO：請將 your-email@example.com 換成 TO PRO 的實際聯絡信箱，
      // 或改用 Google 表單 / Formspree 等服務接收表單資料（GitHub Pages 無後端）。
      window.location.href = `mailto:your-email@example.com?subject=${encodeURIComponent('TO PRO 諮詢／報名：' + name)}&body=${body}`;
    });
  }
});
