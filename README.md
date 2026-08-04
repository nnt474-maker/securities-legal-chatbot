# PHS Legal Chatbot UI

Giao diện chatbot pháp lý chứng khoán (VI/EN) — deploy lên Vercel, kết nối tới n8n.

Webhook đã được nối sẵn trong `app.jsx` (`WEBHOOK_URL`) — người dùng mở link là dùng được luôn, **không cần** dán URL hay bấm cài đặt.

## Các tab trên topbar

| Tab | Nội dung |
|---|---|
| **Trợ lý pháp lý** | Chat RAG trên kho văn bản (n8n + Supabase pgvector) |
| **Hỏi chuyên viên** | Gửi câu hỏi khó cho chuyên viên Khối Pháp lý + tra kết quả theo email |
| **Bản tin pháp lý** | Nhúng iframe trang bản tin của Khối Pháp lý (`BULLETIN_URL` = Cloudflare Worker `phs-legal`, dữ liệu D1 `phs_legal_bulletin`) |
| **Biểu mẫu** | Teller Portal — nhập 10 biểu mẫu PHS, xuất Word ngay trên trình duyệt |

Tab **Bản tin pháp lý** và **Biểu mẫu** đều lazy-load (chỉ nạp iframe lần đầu mở tab) và
giữ nguyên state khi chuyển tab qua lại. Cùng nguồn dữ liệu bản tin đó, kernel n8n trả lời
được các câu "cập nhật pháp luật tháng…" — xem `Legal Update – Fetch Bulletin API`
trong workflow `1PwqDtcknum39E1a`.

## Tab "Biểu mẫu" (Teller Portal)

Tab Biểu mẫu là
app Teller Portal build sẵn, nằm trong thư mục `forms/` và nhúng qua iframe cùng domain;
chuyển tab qua lại **không mất** hội thoại đang chat lẫn dữ liệu form đang nhập.

Nguồn của Teller Portal ở repo riêng: `C:\Users\ACER\Downloads\Teller portal`.
Khi sửa portal, build lại và đồng bộ vào đây:

```bash
cd "C:\Users\ACER\Downloads\Teller portal"
npm run sync:chatbot   # build với base /forms/ rồi copy vào forms/ ở đây
```

Deploy như cũ (thư mục này lên Vercel) — `forms/` đi kèm luôn, không cần cấu hình thêm.

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
- ⏳ **Tiến trình khi chờ** — nhãn giai đoạn xoay vòng (phân tích → tra cứu → đối chiếu → kiểm chứng → soạn) + thanh quét + đồng hồ mm:ss; sau 90s hiện dòng trấn an (câu khó có thể chạy vài phút)
- 🏷️ **Tô sáng trích dẫn pháp lý** — "Điều 42", "155/2020/NĐ-CP", "17/VBHN-BTC"… tự thành chip vàng trong câu trả lời
- 🔍 **Tooltip nội dung điều/khoản** — rê chuột (desktop) hoặc chạm (mobile) vào trích dẫn dạng "Điều 120, khoản 3 Luật 67/VBHN-VPQH" để xem ngay nội dung điều/khoản đó, tra từ kho văn bản qua RPC read-only trên Supabase (anon key công khai, RLS bật, không lộ service key). Chỉ bọc trích dẫn khi map được tên luật; luật ngoài kho giữ nguyên chip thường. Esc / click ra ngoài để đóng.
- 📊 **Số liệu kho ở màn hình chào** — đếm tăng dần khi mở; sửa hằng `CORPUS` đầu `app.jsx` khi nạp thêm văn bản
- ✨ **Màn hình chào động** — nền aurora màu thương hiệu, watermark §, nội dung vào theo nhịp (tự tắt khi hệ điều hành bật giảm chuyển động)
- 🔘 **Clickable suggestions** — câu hỏi ban đầu + câu hỏi gợi ý sau mỗi câu trả lời đều click được
- 🙋 **CTA "Hỏi chuyên viên" nổi bật** — dải viền vàng ngay dưới câu trả lời của bot và **trên** khối câu hỏi gợi ý (`.escalate-cta`), cộng thêm một lối vào trên màn hình chào (`.welcome-ask`). Trước 08-2026 nút này là một action-btn nhỏ nằm cuối cùng nên hầu như không ai bấm.
- 📰 **Tab Bản tin pháp lý** — bản tin hằng ngày của Khối Pháp lý ngay trong app, và chatbot trả lời câu hỏi cập nhật pháp luật từ đúng nguồn đó
- 💾 **Persistent session** — sessionId + lịch sử lưu trong localStorage
- 📋 **Copy answer** — hover vào tin nhắn bot
- ⚡ **Markdown rendering** — bot có thể trả lời với format đầy đủ
