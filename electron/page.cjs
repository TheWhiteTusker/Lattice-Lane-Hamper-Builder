// Inline status pages (starting, offline, update progress) as data: URLs.
module.exports = (title, body) =>
  "data:text/html;charset=utf-8," +
  encodeURIComponent(`<!DOCTYPE html><html><head><title>${title}</title><style>
    body{font-family:"Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;
      height:100vh;margin:0;background:#faf9f6;color:#2c332d}
    .card{background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.06);
      text-align:center;max-width:420px}
    h2{margin-top:0;color:#54655b} p{color:#666;font-size:14px;line-height:1.5}
    button{background:#54655b;color:#fff;border:0;padding:10px 24px;font-size:14px;font-weight:600;
      border-radius:6px;cursor:pointer;margin-top:16px}
  </style></head><body><div class="card">${body}</div></body></html>`);
