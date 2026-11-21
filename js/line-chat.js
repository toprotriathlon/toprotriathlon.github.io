(function () {
  var LINE_URL = 'https://lin.ee/U78PTTR';
  if (document.getElementById('line-chat')) return;

  var css = '' +
    '.line-chat{position:fixed;right:20px;bottom:20px;z-index:9999;display:flex;align-items:center;flex-direction:row-reverse;gap:12px;text-decoration:none}' +
    '.line-chat-btn{width:60px;height:60px;border-radius:50%;background:rgba(107,114,128,.6);backdrop-filter:blur(4px);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.25);font:700 12px/1.1 "Noto Sans TC",sans-serif;transition:transform .2s}' +
    '.line-chat-btn svg{width:26px;height:26px;margin-bottom:2px}' +
    '.line-chat:hover .line-chat-btn,.line-chat:focus-visible .line-chat-btn{transform:scale(1.08)}' +
    '.line-chat-bubble{position:relative;max-width:220px;padding:12px 16px;border-radius:14px;background:#fff;color:#333;font:500 14px/1.5 "Noto Sans TC",sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.2);opacity:0;visibility:hidden;transform:translateX(8px);transition:opacity .2s,transform .2s,visibility .2s}' +
    '.line-chat-bubble:after{content:"";position:absolute;right:-6px;top:50%;margin-top:-6px;width:12px;height:12px;background:#fff;transform:rotate(45deg)}' +
    '.line-chat:hover .line-chat-bubble,.line-chat:focus-visible .line-chat-bubble{opacity:1;visibility:visible;transform:none}' +
    '@media(max-width:600px){.line-chat{right:14px;bottom:14px}.line-chat-btn{width:54px;height:54px}.line-chat-bubble{display:none}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var a = document.createElement('a');
  a.id = 'line-chat';
  a.className = 'line-chat';
  a.href = LINE_URL;
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'CHAT - 加入 LINE 官方帳號');
  a.innerHTML =
    '<span class="line-chat-btn"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 5.82 2 10.5c0 4.2 3.7 7.7 8.7 8.4.34.07.8.23.92.52.1.26.07.67.03.93l-.15.9c-.04.26-.2 1.02.9.56 1.1-.46 5.9-3.48 8.05-5.96C21.9 13.7 22 12.2 22 10.5 22 5.82 17.52 2 12 2z"/></svg>CHAT</span>' +
    '<span class="line-chat-bubble">有任何問題嗎？點我加入 LINE，和教練聊聊吧</span>';
  document.body.appendChild(a);
})();
