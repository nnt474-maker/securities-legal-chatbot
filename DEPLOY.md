> **CẬP NHẬT (bản hiện tại):** UI đã **bỏ nút Settings** và **nối thẳng** tới webhook
> `https://n8n.phs.vn/webhook/PHS-legal-chat` (khai báo trong `app.jsx` → `WEBHOOK_URL`).
> Người dùng mở link là dùng được ngay, không cần dán URL. Phần "Giải pháp B — proxy"
> bên dưới chỉ áp dụng *nếu sau này bạn bật Header Auth cho n8n* — và lưu ý proxy
> serverless của Vercel gói free cắt ở 60s, trong khi câu hỏi pháp lý nặng có thể chạy
> lâu hơn, nên mặc định ta gọi thẳng. Cách deploy gọn nhất: xem `README.md`.

# Deploy lên Vercel — Hướng dẫn từ A → Z

## 🚀 Cách 1: Drag & Drop (nhanh nhất, 60 giây)

1. **Tải project về máy** (hoặc bạn đã có sẵn folder này).
2. Mở [vercel.com/new](https://vercel.com/new) → đăng nhập (GitHub / GitLab / Email đều được).
3. Kéo & thả thư mục chứa các file (`index.html`, `app.jsx`, `styles.css`, `vercel.json`) vào khu vực **"Deploy"**.
4. Vercel sẽ tự nhận đây là static site → bấm **Deploy**. Không cần chọn framework, không cần build command.
5. ~30 giây sau, bạn nhận được URL dạng `https://your-project.vercel.app`.
6. Mở URL → bấm icon ⚙️ trên top bar → dán **n8n Webhook URL** → Lưu. Xong.

## 🚀 Cách 2: Vercel CLI

```bash
npm install -g vercel
cd path/to/this-folder
vercel               # lần đầu: chọn scope, accept default settings
vercel --prod        # deploy production
```

## 🚀 Cách 3: Qua GitHub (khuyến nghị cho production)

Đây là cách tốt nhất vì có git history, rollback, preview deploys cho mỗi pull request.

1. Tạo repo mới trên GitHub: `phs-legal-chatbot`.
2. Push code lên:
   ```bash
   cd path/to/this-folder
   git init
   git add .
   git commit -m "initial deploy"
   git remote add origin https://github.com/USER/phs-legal-chatbot.git
   git push -u origin main
   ```
3. Trên [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → chọn repo vừa tạo.
4. Bấm Deploy. Từ giờ mỗi lần `git push` là Vercel tự deploy lại.

---

# 🏭 Đưa lên Production cho người dùng thật

UI hiện tại đã chạy được, nhưng để dùng thật ngoài team, cần xử lý thêm vài thứ:

## 1️⃣ Bảo mật webhook n8n (QUAN TRỌNG)

**Vấn đề:** Hiện tại user phải tự dán webhook URL vào Settings. Nếu bạn muốn user mở app là dùng được luôn, bạn cần **hardcode webhook URL**. Nhưng webhook URL n8n đang là _public_ — ai biết URL đều spam được.

**Giải pháp A — Đơn giản (cho POC nội bộ):**

Trong `app.jsx`, sửa:
```jsx
const DEFAULT_WEBHOOK = "https://your-n8n.example.com/webhook/xxx";
```
Rồi xóa nút Settings nếu không cần.

**Giải pháp B — Production (khuyến nghị):**

Tạo một **Vercel Serverless Function** làm proxy để giấu webhook URL + thêm rate limit + auth:

```js
// File: api/chat.js (Vercel sẽ tự nhận đây là API route)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Rate limit đơn giản theo IP (production nên dùng Upstash/Vercel KV)
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  // TODO: gắn rate-limiter ở đây

  // (Optional) Yêu cầu API key từ frontend
  // if (req.headers["x-api-key"] !== process.env.PUBLIC_API_KEY) {
  //   return res.status(401).json({ error: "unauthorized" });
  // }

  try {
    const r = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // n8n có thể bật Header Auth — gắn ở đây
        "Authorization": "Bearer " + process.env.N8N_AUTH_TOKEN,
      },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: "upstream_error", message: e.message });
  }
}
```

Sau đó trong `app.jsx`, đổi:
```jsx
const DEFAULT_WEBHOOK = "/api/chat";  // Gọi proxy của chính domain
```

Trên Vercel → Project → Settings → **Environment Variables**:
- `N8N_WEBHOOK_URL` = URL webhook thật của bạn
- `N8N_AUTH_TOKEN` = token nếu n8n bật Header Auth

## 2️⃣ Cấu hình n8n cho production

Trong n8n **Chat Trigger node** (hoặc Webhook node bạn đang dùng):
- ✅ **Method:** POST
- ✅ **Authentication:** Header Auth — đặt token, đừng để Public
- ✅ **Respond:** "When Last Node Finishes" (để UI nhận được response)
- ✅ **Response Body:** JSON, ví dụ:
  ```json
  {
    "output": "{{ $json.answer }}",
    "suggestions": "{{ $json.related_questions }}"
  }
  ```
- ✅ **CORS:** thêm domain Vercel của bạn vào "Allowed Origins" (nếu n8n hỗ trợ), hoặc đi qua Vercel proxy như trên.

## 3️⃣ Custom domain

Trên Vercel → Project → **Domains** → Add → nhập domain bạn muốn (vd `legal.phs.vn`).
Vercel sẽ chỉ cho bạn DNS records cần trỏ. Sau khi DNS update (5–60 phút), HTTPS auto cấp.

## 4️⃣ Analytics & Monitoring

Bật **Vercel Analytics** (free tier có sẵn) để theo dõi traffic, latency, errors.

Thêm vào `<head>` của `index.html`:
```html
<script defer src="/_vercel/insights/script.js"></script>
```
Hoặc dùng Plausible, Posthog tùy bạn.

## 5️⃣ Build optimizations (optional)

UI hiện đang dùng Babel in-browser — chậm hơn ~200ms lần load đầu. Khi vào production thực sự, bạn có thể:
- Pre-compile JSX bằng Vite/esbuild → bundle ra `app.js` tĩnh
- Hoặc giữ nguyên Babel cho đơn giản (cho chatbot này thì OK, traffic không cao)

---

# ✅ Checklist trước khi launch

- [ ] Webhook n8n đã có authentication (không để public)
- [ ] Tạo `/api/chat.js` proxy trên Vercel để giấu webhook URL
- [ ] Test gửi tin nhắn cả VI và EN
- [ ] Test các câu hỏi gợi ý (click được)
- [ ] Test follow-up suggestions sau câu trả lời (click được)
- [ ] Test typing indicator hiển thị
- [ ] Test trên mobile
- [ ] Custom domain (nếu cần)
- [ ] Thêm rate limiter (Vercel KV / Upstash)
- [ ] Bật Analytics

---

# 🐛 Troubleshooting

**"Failed to fetch" khi gửi tin nhắn**
→ CORS hoặc webhook chưa đúng. Mở DevTools → Console → xem chi tiết lỗi. Nếu là CORS, dùng `/api/chat.js` proxy.

**Bot không trả lời, chỉ thấy typing dots mãi**
→ n8n đang trả về sai format hoặc không respond. Check n8n executions log. UI cần response trong vòng ~30s.

**Suggestions không hiện sau câu trả lời**
→ n8n trả về phải có field `suggestions` (array of strings) hoặc bot tự ghi `**Câu hỏi liên quan:**\n- q1\n- q2` cuối câu trả lời, UI sẽ tự parse.

**Mobile bị vỡ layout**
→ Đã có responsive ở 880px và 480px. Nếu vẫn lỗi, gửi screenshot.

---

# 📁 Cấu trúc thư mục

```
.
├── index.html                       # Entry point (fintech UI)
├── app.jsx                          # React app
├── styles.css                       # Fintech styles
├── vercel.json                      # Vercel config
├── Legal Chatbot — Editorial.html   # Phiên bản editorial (backup)
├── styles-editorial.css
├── app-editorial.jsx
├── DEPLOY.md                        # File này
└── README.md
```
