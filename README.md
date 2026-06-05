# PHS Legal Chatbot UI

Giao diện chatbot pháp lý chứng khoán (VI/EN) — deploy lên Vercel, kết nối tới n8n.

Webhook đã được nối sẵn trong `app.jsx` (`WEBHOOK_URL`) — người dùng mở link là dùng được luôn, **không cần** dán URL hay bấm cài đặt.

## Triển khai lên Vercel (qua GitHub)

1. Đưa **nội dung thư mục này** (các file `index.html`, `app.jsx`, `styles.css`, `vercel.json`…) lên một repo GitHub — để chúng nằm ở gốc repo, không lồng trong thư mục con.
2. Vào https://vercel.com/new → **Import** repo đó → **Deploy**. Không cần chọn framework, không cần build command (đây là static site thuần).
3. ~30 giây sau có link `https://ten-app.vercel.app` — gửi cho ai cũng dùng được, nhiều người nhắn cùng lúc không bị lẫn hội thoại (mỗi trình duyệt một sessionId riêng).
4. Từ giờ mỗi lần `git push` là Vercel tự deploy lại.

> **Mỗi người chỉ gửi được 1 câu mỗi lượt**: ô nhập và nút gửi bị khoá trong lúc bot đang trả lời, xong câu đó mới mở lại.
>
> **Gọi thẳng tới n8n** (không qua proxy) vì câu hỏi pháp lý nặng có thể chạy hơn 60s — vượt giới hạn serverless của Vercel gói free, còn trình duyệt thì chờ được. n8n đã mở sẵn CORS nên gọi thẳng từ domain Vercel không bị chặn.
>
> *Lưu ý bảo mật:* link webhook nằm trong mã nguồn phía trình duyệt nên ai cũng xem được. Endpoint hiện không có khoá. Nếu cần siết, bật **Header Auth** ở n8n và khi đó phải chuyển sang gọi qua một proxy có gắn token (mình hỗ trợ thêm khi bạn cần).

## Định dạng request gửi tới n8n

```json
POST <webhook>
Content-Type: application/json
{
  "chatInput": "<câu hỏi của user>",
  "sessionId": "sess_xxxxx",
  "session_id": "sess_xxxxx",
  "lang": "vi" | "en",
  "message": "<câu hỏi của user>"
}
```

Tất cả các tên trường phổ biến đều được gửi để tương thích với n8n Chat Trigger và Code node của bạn (workflow đang đọc `chatInput` / `session_id` / `lang`).

## Định dạng response mà UI hiểu

UI sẽ tự động trích `answer` và `suggestions` từ nhiều shape khác nhau:

```json
{ "output": "...markdown...", "suggestions": ["...", "..."] }
// hoặc
{ "answer": "...", "related": ["...", "..."] }
// hoặc chỉ text — UI sẽ thử parse block "Có thể bạn quan tâm:" cuối câu trả lời
```

Hỗ trợ markdown: **bold**, *italic*, `code`, headings, lists, links, blockquotes.

## Tính năng

- 🇻🇳 / 🇬🇧 **Song ngữ** — toggle VI/EN trên header
- 💭 **Typing indicator** — dấu "..." nhảy + label "Đang tra cứu văn bản"
- 🔘 **Clickable suggestions** — câu hỏi ban đầu + câu hỏi gợi ý sau mỗi câu trả lời đều click được
- 💾 **Persistent session** — sessionId + lịch sử lưu trong localStorage
- 📋 **Copy answer** — hover vào tin nhắn bot
- ⚡ **Markdown rendering** — bot có thể trả lời với format đầy đủ
