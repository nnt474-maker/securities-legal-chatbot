# Tư vấn pháp lý chứng khoán | Securities Legal Assistant

Chatbot tư vấn pháp lý chứng khoán song ngữ Anh/Việt, xây dựng bằng Next.js 14 (App Router), proxy qua Vercel API Route đến n8n webhook.

---

## Deploy lên Vercel — Từng bước

### Bước 1 — Cài Node.js (nếu chưa có)

Tải về tại https://nodejs.org (phiên bản LTS). Kiểm tra:

```bash
node -v   # v18 hoặc cao hơn
npm -v
```

---

### Bước 2 — Cài dependencies

```bash
cd "UI chatbot"
npm install
```

---

### Bước 3 — Chạy thử local

Tạo file `.env.local` từ mẫu:

```bash
cp .env.example .env.local
```

Mở `.env.local` và đặt đúng URL webhook n8n:

```
N8N_WEBHOOK_URL=https://n8n.phs.vn/webhook/38baa206-c5ba-4445-bed4-b33e7e4431f4/chat
```

Chạy dev server:

```bash
npm run dev
```

Mở trình duyệt tại http://localhost:3000 để kiểm tra.

---

### Bước 4 — Tạo GitHub repository mới

1. Đăng nhập https://github.com
2. Nhấn **+** → **New repository**
3. Đặt tên, ví dụ: `securities-legal-chatbot`
4. Để **Private** (khuyến nghị vì chứa webhook URL)
5. **Không** tích "Add a README file"
6. Nhấn **Create repository**

---

### Bước 5 — Push code lên GitHub

Trong terminal, từ thư mục dự án:

```bash
git init
git add .
git commit -m "Initial commit: securities legal chatbot"
git branch -M main
git remote add origin https://github.com/TEN_BAN_CUA_BAN/securities-legal-chatbot.git
git push -u origin main
```

> Thay `TEN_BAN_CUA_BAN` bằng username GitHub của bạn.

---

### Bước 6 — Deploy lên Vercel

1. Truy cập https://vercel.com và đăng nhập (có thể dùng tài khoản GitHub)
2. Nhấn **Add New** → **Project**
3. Chọn repository `securities-legal-chatbot` vừa tạo → **Import**
4. Framework sẽ tự nhận là **Next.js** — giữ nguyên mọi cài đặt
5. Mở phần **Environment Variables**, thêm:
   - **Name:** `N8N_WEBHOOK_URL`
   - **Value:** `https://n8n.phs.vn/webhook/38baa206-c5ba-4445-bed4-b33e7e4431f4/chat`
6. Nhấn **Deploy**

Sau ~1-2 phút, Vercel sẽ cấp URL dạng `https://securities-legal-chatbot.vercel.app`.

---

### Bước 7 — Cập nhật code sau này

Mỗi khi sửa code, chỉ cần push lên GitHub — Vercel tự động re-deploy:

```bash
git add .
git commit -m "mô tả thay đổi"
git push
```

---

## Cấu trúc dự án

```
├── app/
│   ├── api/chat/route.ts   # Proxy API Route → n8n webhook
│   ├── globals.css         # Global styles + markdown styles
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ChatInterface.tsx   # Toàn bộ UI chat (client component)
├── .env.example            # Mẫu biến môi trường
├── .gitignore
├── next.config.js
├── package.json
├── README.md
└── tsconfig.json
```

## Biến môi trường

| Tên | Mô tả | Ví dụ |
|-----|-------|-------|
| `N8N_WEBHOOK_URL` | URL webhook n8n (server-side only) | `https://n8n.phs.vn/webhook/...` |

> **Lưu ý:** Biến này **không** có prefix `NEXT_PUBLIC_` nên chỉ được đọc ở server. Trình duyệt không bao giờ nhìn thấy URL này.

## Tính năng

- Toggle ngôn ngữ **Tiếng Việt / English**, lưu vào `localStorage`
- Proxy `/api/chat` che giấu webhook URL khỏi trình duyệt
- Render **Markdown** trong câu trả lời của bot (in đậm, danh sách, bảng, code)
- **Suggestion chips**: các dòng `• gợi ý` trong response tự động thành button có thể click
- Loading animation 3 chấm khi chờ n8n
- Timeout 60 giây cho RAG pipeline
- Responsive, dùng tốt trên điện thoại
