const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ============ CONFIG ============
// Webhook n8n cố định — nối thẳng, người dùng không phải dán URL hay mở cài đặt.
// Gọi thẳng (không qua proxy Vercel) vì câu hỏi pháp lý nặng có thể chạy hơn 60s,
// vượt giới hạn thời gian của serverless function gói free; trình duyệt thì chờ
// được. n8n đã mở CORS (phản hồi access-control-allow-origin theo Origin) nên
// gọi thẳng từ domain Vercel không bị chặn.
const WEBHOOK_URL = "https://n8n.phs.vn/webhook/PHS-legal-chat";
const APP_VERSION = "1.2.0";
// Tra cứu trích dẫn (tooltip điều/khoản) — gọi RPC read-only trên Supabase.
// Anon key là khóa CÔNG KHAI (publishable, RLS bật); service key không bao giờ ra frontend.
const SUPA_URL = "https://tuodyjkqexttioluwavi.supabase.co";
const SUPA_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1b2R5amtxZXh0dGlvbHV3YXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTAzNjUsImV4cCI6MjA3MTYyNjM2NX0.VMIbw3BKK5uj8r6825B2XLFV7wHahZ73jCjnjgrkMf8";
// Quy mô kho văn bản hiển thị ở màn hình chào + thanh trạng thái.
// Cập nhật tay khi nạp thêm văn bản (xem bảng legal_source_catalog).
const CORPUS = { docs: 70, chunks: 6352 };

const I18N = {
  vi: {
    appName: "PHS LEGAL",
    appSubtitle: "Securities Law Assistant · v" + APP_VERSION,
    crumbHome: "Trợ lý pháp lý",
    crumbActive: "Phiên hiện tại",
    welcomeBadge: "Trợ lý pháp lý",
    welcomeMeta: "Phú Hưng Securities · Q&A",
    welcomeTitleA: "Hỏi đáp pháp lý",
    welcomeTitleAccent: "chứng khoán",
    welcomeTitleB: "ngay lập tức.",
    welcomeBody: "Đặt câu hỏi về Luật Chứng khoán, Nghị định, Thông tư hoặc quy định nội bộ. Mọi câu trả lời được truy xuất từ văn bản pháp luật hiện hành.",
    suggestionsLabel: "Câu hỏi gợi ý",
    suggestionsCount: "06 chủ đề",
    suggestions: [
      "Điều kiện trở thành công ty đại chúng?",
      "Cổ đông lớn được định nghĩa như thế nào?",
      "Quy định về giao dịch ký quỹ (margin)?",
      "Người nội bộ phải công bố thông tin khi nào?",
      "Điều kiện niêm yết trên HOSE?",
      "Xử phạt hành vi giao dịch nội gián?",
    ],
    inputPlaceholder: "Nhập câu hỏi pháp lý của bạn…",
    thinking: "Đang tra cứu văn bản pháp luật",
    thinkingStages: [
      "Đang phân tích câu hỏi",
      "Đang tra cứu văn bản pháp luật",
      "Đang đối chiếu điều khoản liên quan",
      "Đang kiểm chứng căn cứ pháp lý",
      "Đang soạn câu trả lời",
    ],
    thinkingLong: "Câu hỏi phức tạp — hệ thống đang đối chiếu nhiều văn bản, có thể mất vài phút.",
    relatedLabel: "Câu hỏi liên quan",
    newChat: "Cuộc trò chuyện mới",
    history: "Lịch sử",
    settings: "Cài đặt",
    settingsTitle: "Kết nối n8n Webhook",
    settingsHint: "Dán URL webhook từ n8n Chat Trigger để kích hoạt chatbot.",
    webhookLabel: "Webhook URL",
    save: "Lưu",
    cancel: "Hủy",
    disclaimer: "Thông tin tham khảo, không thay thế tư vấn pháp lý chính thức.",
    enterHint: "để gửi",
    shiftEnter: "xuống dòng",
    error: "Không kết nối được tới máy chủ. Kiểm tra cấu hình webhook.",
    errorTimeout: "Câu hỏi này xử lý lâu hơn 5 phút nên đã dừng chờ. Bạn gửi lại câu hỏi — lần hỏi lại thường trả lời nhanh hơn.",
    notConfigured: "Chưa cấu hình webhook n8n. Mở Cài đặt để dán URL.",
    you: "Bạn",
    bot: "PHS Legal",
    botTag: "AI",
    send: "Gửi",
    copied: "Đã sao chép",
    copy: "Sao chép",
    sessionId: "Phiên",
    online: "Trực tuyến",
    offline: "Chưa kết nối",
    historyEmpty: "Chưa có cuộc trò chuyện nào. Đặt câu hỏi để bắt đầu.",
    newChatTitle: "Cuộc trò chuyện mới",
    untitled: "Không có tiêu đề",
    delete: "Xóa",
    confirmDelete: "Xóa cuộc trò chuyện này?",
    poweredBy: "Phú Hưng Securities · 2026",
    statusModel: "Bedrock Titan + RAG",
    statusEnv: "PROD",
    statusCorpus: "KHO",
    statDocs: "văn bản pháp luật",
    statChunks: "trích đoạn chỉ mục",
    statLangValue: "VI · EN",
    statLang: "song ngữ",
    badge20: "20 NĂM",
    tabChat: "Trợ lý pháp lý",
    tabForms: "Biểu mẫu",
    tabAsk: "Hỏi chuyên viên",
    escalateBtn: "Nhờ chuyên viên trả lời kỹ",
    escalateDone: "✓ Đã chuyển chuyên viên",
    askHeading: "Hỏi chuyên viên pháp chế",
    askLead: "Câu hỏi khó, cần đối chiếu nhiều văn bản? Gửi tại đây. Chuyên viên pháp chế PHS trực tiếp đọc và soạn câu trả lời — kết quả gửi vào email bạn nhập, đồng thời xem lại được ở mục tra cứu bên dưới.",
    askEmail: "Email nhận kết quả",
    askEmailPh: "ten.ban@phs.vn",
    askEmailNote: "Chỉ nhập một lần, lần sau máy tự nhớ.",
    askQuestion: "Câu hỏi của bạn",
    askQuestionPh: "Càng cụ thể càng tốt: tình huống, loại hình công ty, mốc thời gian, văn bản đang vướng…",
    askSubmit: "Gửi cho chuyên viên",
    askSending: "Đang gửi…",
    askOk: "Đã ghi nhận câu hỏi",
    askOkBody: "Mã câu hỏi của bạn",
    askOkHint: "Giữ mã này để đối chiếu. Khi chuyên viên trả lời, bạn nhận email và xem được ngay ở mục tra cứu bên dưới.",
    askAnother: "Gửi câu hỏi khác",
    errEmail: "Email chưa đúng định dạng.",
    errQuestion: "Câu hỏi cần ít nhất 10 ký tự để chuyên viên nắm được ngữ cảnh.",
    errRate: "Bạn đã gửi quá nhiều câu hỏi trong 24 giờ. Vui lòng thử lại sau.",
    errNet: "Không gửi được. Kiểm tra kết nối mạng rồi thử lại.",
    lookupHeading: "Tra cứu câu trả lời",
    lookupLead: "Nhập đúng email bạn đã dùng khi gửi câu hỏi.",
    lookupBtn: "Xem kết quả",
    lookupLoading: "Đang tra…",
    lookupEmpty: "Chưa có câu hỏi nào gửi từ email này.",
    stPending: "Đang chờ chuyên viên",
    stAnswered: "Đã trả lời",
    stRejected: "Không tiếp nhận",
    askedAt: "Gửi lúc",
    answeredAt: "Trả lời lúc",
    modalTitle: "Nhờ chuyên viên trả lời kỹ hơn",
    modalLead: "Câu hỏi sẽ được chuyển tới chuyên viên pháp chế PHS. Bạn có thể bổ sung ngữ cảnh trước khi gửi.",
    modalCancel: "Đóng",
  },
  en: {
    appName: "PHS LEGAL",
    appSubtitle: "Securities Law Assistant · v" + APP_VERSION,
    crumbHome: "Legal Assistant",
    crumbActive: "Current session",
    welcomeBadge: "Legal Assistant",
    welcomeMeta: "Phu Hung Securities · Q&A",
    welcomeTitleA: "Securities law",
    welcomeTitleAccent: "Q&A",
    welcomeTitleB: "in seconds.",
    welcomeBody: "Ask about the Securities Law, decrees, circulars, or internal regulations. Every answer is retrieved from current legal documents.",
    suggestionsLabel: "Suggested questions",
    suggestionsCount: "06 topics",
    suggestions: [
      "What are the conditions to become a public company?",
      "How is a major shareholder defined?",
      "Regulations on margin trading?",
      "When must insiders disclose information?",
      "Listing requirements on HOSE?",
      "Penalties for insider trading?",
    ],
    inputPlaceholder: "Ask a legal question…",
    thinking: "Searching legal documents",
    thinkingStages: [
      "Analyzing your question",
      "Searching legal documents",
      "Cross-checking related articles",
      "Verifying legal grounds",
      "Composing the answer",
    ],
    thinkingLong: "Complex question — the system is cross-checking multiple documents. This can take a few minutes.",
    relatedLabel: "Related questions",
    newChat: "New conversation",
    history: "History",
    settings: "Settings",
    settingsTitle: "Connect to n8n Webhook",
    settingsHint: "Paste the webhook URL from your n8n Chat Trigger to activate the bot.",
    webhookLabel: "Webhook URL",
    save: "Save",
    cancel: "Cancel",
    disclaimer: "For reference only. Not a substitute for formal legal advice.",
    enterHint: "to send",
    shiftEnter: "newline",
    error: "Couldn't reach the server. Check webhook configuration.",
    errorTimeout: "This question took longer than the 5-minute limit, so the wait was stopped. Please resend — retries usually complete faster.",
    notConfigured: "n8n webhook not configured. Open Settings to paste the URL.",
    you: "You",
    bot: "PHS Legal",
    botTag: "AI",
    send: "Send",
    copied: "Copied",
    copy: "Copy",
    sessionId: "Session",
    online: "Online",
    offline: "Not connected",
    historyEmpty: "No conversations yet. Ask a question to start.",
    newChatTitle: "New conversation",
    untitled: "Untitled",
    delete: "Delete",
    confirmDelete: "Delete this conversation?",
    poweredBy: "Phu Hung Securities · 2026",
    statusModel: "Bedrock Titan + RAG",
    statusEnv: "PROD",
    statusCorpus: "CORPUS",
    statDocs: "legal documents",
    statChunks: "indexed passages",
    statLangValue: "VI · EN",
    statLang: "bilingual",
    badge20: "20 YRS",
    tabChat: "Legal Assistant",
    tabForms: "Forms",
    tabAsk: "Ask an Expert",
    escalateBtn: "Ask an expert for a fuller answer",
    escalateDone: "✓ Sent to an expert",
    askHeading: "Ask a PHS legal counsel",
    askLead: "Difficult question that needs several documents cross-checked? Send it here. A PHS legal counsel reads it and writes the answer personally — the result goes to the email you enter and also shows up in the lookup section below.",
    askEmail: "Email for the answer",
    askEmailPh: "your.name@phs.vn",
    askEmailNote: "Enter once — it is remembered next time.",
    askQuestion: "Your question",
    askQuestionPh: "The more specific the better: the situation, type of company, deadlines, the document you are stuck on…",
    askSubmit: "Send to an expert",
    askSending: "Sending…",
    askOk: "Question received",
    askOkBody: "Your ticket code",
    askOkHint: "Keep this code for reference. When the counsel answers, you get an email and can read it in the lookup section below.",
    askAnother: "Send another question",
    errEmail: "That email address is not valid.",
    errQuestion: "The question needs at least 10 characters so the counsel has context.",
    errRate: "You have sent too many questions in 24 hours. Please try again later.",
    errNet: "Could not send. Check your connection and try again.",
    lookupHeading: "Look up an answer",
    lookupLead: "Enter the exact email you used when sending the question.",
    lookupBtn: "Show results",
    lookupLoading: "Looking up…",
    lookupEmpty: "No questions have been sent from this email yet.",
    stPending: "Waiting for counsel",
    stAnswered: "Answered",
    stRejected: "Not accepted",
    askedAt: "Sent",
    answeredAt: "Answered",
    modalTitle: "Ask an expert for a fuller answer",
    modalLead: "This question goes to a PHS legal counsel. You can add context before sending.",
    modalCancel: "Close",
  },
};

// ============ HELPERS ============
const genId = (prefix = "id") =>
  prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
const genSessionId = () => genId("sess");

const STORAGE = {
  webhook: "phs_legal_webhook",
  lang: "phs_legal_lang",
  conversations: "phs_legal_conversations_v2",
  activeId: "phs_legal_active_v2",
  escEmail: "phs_legal_esc_email",
};

// ============ HỎI CHUYÊN VIÊN (escalation) ============
// Câu hỏi người dùng thấy chưa thỏa đáng được ghi vào bảng legal_escalation.
// Chuyên viên pháp chế đọc, tự soạn câu trả lời rồi duyệt; n8n gửi mail.
// Anon key chỉ chạy được 2 RPC security-definer dưới đây — bảng bật RLS,
// đọc thẳng bảng trả về rỗng, và bản nháp chưa duyệt không bao giờ lộ ra.
async function supaRpc(fn, body) {
  const res = await fetch(SUPA_URL + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_ANON, Authorization: "Bearer " + SUPA_ANON },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

const escalationSubmit = (payload) => supaRpc("escalation_submit", { payload });
const escalationList = (email) => supaRpc("escalation_list", { p_email: email });

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

function escErrorText(code, t) {
  if (code === "invalid_email") return t.errEmail;
  if (code === "invalid_question") return t.errQuestion;
  if (code === "rate_limited") return t.errRate;
  return t.errNet;
}

// mdToHtml v2 (đợt 8) — parser theo DÒNG thay cho chuỗi regex cũ. Regex cũ có
// 4 điểm mù với markdown HỢP LỆ mà kernel hay xuất: (1) blockquote chết hẳn vì
// escape `>`→`&gt;` chạy trước rule tìm `>` thô; (2) `---`/bảng `|…|` không có
// rule nên lộ nguyên văn; (3) bullet thụt dưới "1." không được nhận → dính vào
// <p>, đồng thời <ol> bị cắt đôi và đánh số lại từ 1; (4) list đứng sát dòng
// text bị bọc nhầm vào <p>. Chỉ đổi khâu render; annotateCitations/tooltip
// (đợt 7) nhận HTML đầu ra như cũ, không đụng.
function mdInline(t) {
  return t
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function mdToHtml(src) {
  if (!src) return "";
  let s = String(src).replace(/\r\n?/g, "\n");
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fences = [];
  s = s.replace(/```([\s\S]*?)```/g, (_, c) => {
    fences.push("<pre><code>" + c.trim() + "</code></pre>");
    return "\u0000F" + (fences.length - 1) + "\u0000";
  });
  const RE_HR = /^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/;
  const RE_H = /^(#{1,4})\s+(.+)$/;
  const RE_OL = /^\s*(\d{1,3})[.)]\s+(.+)$/;
  const RE_UL = /^\s*[-•]\s+(.+)$/;
  const RE_BQ = /^\s*&gt;\s?(.*)$/;
  const RE_TSEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;
  const lines = s.split("\n");
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) { out.push("<p>" + para.map(mdInline).join("<br>") + "</p>"); para = []; }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }
    if (/^\u0000F\d+\u0000$/.test(line.trim())) { flush(); out.push(line.trim()); continue; }
    if (RE_HR.test(line)) { flush(); out.push("<hr>"); continue; }
    let m;
    if ((m = line.match(RE_H))) {
      flush();
      const lvl = Math.min(m[1].length + 1, 5);
      out.push("<h" + lvl + ">" + mdInline(m[2]) + "</h" + lvl + ">");
      continue;
    }
    if ((m = line.match(RE_BQ))) {
      flush();
      const buf = [m[1]];
      while (i + 1 < lines.length && (m = lines[i + 1].match(RE_BQ))) { buf.push(m[1]); i++; }
      out.push("<blockquote>" + buf.map(mdInline).join("<br>") + "</blockquote>");
      continue;
    }
    if (line.indexOf("|") >= 0 && line.split("|").length >= 3 && i + 1 < lines.length && RE_TSEP.test(lines[i + 1])) {
      flush();
      const cells = l => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(c => mdInline(c.trim()));
      let html = '<div class="md-table"><table><thead><tr>' + cells(line).map(c => "<th>" + c + "</th>").join("") + "</tr></thead><tbody>";
      i++;
      while (i + 1 < lines.length && lines[i + 1].trim() && lines[i + 1].indexOf("|") >= 0) {
        i++;
        html += "<tr>" + cells(lines[i]).map(c => "<td>" + c + "</td>").join("") + "</tr>";
      }
      out.push(html + "</tbody></table></div>");
      continue;
    }
    if (RE_OL.test(line) || RE_UL.test(line)) {
      flush();
      // Gom cả cụm list liền kề. Khi <ol> đang mở, mọi bullet (kể cả thụt 1 dấu
      // cách kiểu kernel) là <ul> lồng trong <li> hiện tại; số thứ tự giữ liên
      // tục, khối <ol> tách rời tiếp số cũ qua start.
      const firstOl = RE_OL.test(line);
      const items = [];
      let j = i;
      while (j < lines.length) {
        const om = lines[j].match(RE_OL);
        const um = om ? null : lines[j].match(RE_UL);
        if (om) { if (!firstOl) break; items.push({ o: true, n: parseInt(om[1], 10), t: om[2] }); }
        else if (um) items.push({ o: false, t: um[1] });
        else break;
        j++;
      }
      i = j - 1;
      if (!firstOl) {
        out.push("<ul>" + items.map(it => "<li>" + mdInline(it.t) + "</li>").join("") + "</ul>");
      } else {
        let html = "<ol" + (items[0].n > 1 ? ' start="' + items[0].n + '"' : "") + ">";
        let liOpen = false, subOpen = false;
        for (const it of items) {
          if (it.o) {
            if (subOpen) { html += "</ul>"; subOpen = false; }
            if (liOpen) html += "</li>";
            html += "<li>" + mdInline(it.t);
            liOpen = true;
          } else {
            if (!liOpen) { html += "<li>"; liOpen = true; }
            if (!subOpen) { html += "<ul>"; subOpen = true; }
            html += "<li>" + mdInline(it.t) + "</li>";
          }
        }
        if (subOpen) html += "</ul>";
        if (liOpen) html += "</li>";
        out.push(html + "</ol>");
      }
      continue;
    }
    para.push(line);
  }
  flush();
  return out.join("\n").replace(/\u0000F(\d+)\u0000/g, (_, n) => fences[+n]);
}

// Tô sáng trích dẫn pháp lý trong HTML đã render: "Điều 42", "Điều 8b khoản 2",
// "155/2020/NĐ-CP", "17/VBHN-BTC"… Chỉ xử lý phần chữ nằm ngoài thẻ HTML.
const LAW_REF_RE = /(\d+\/\d{4}\/(?:NĐ-CP|TT-BTC|TT-NHNN|QĐ-TTg|QH\d+|UBTVQH\d+)|\d+\/VBHN-[A-ZĐ]+|(?:Điều|điều|Article)\s+\d+[a-zđ]?(?:\s+[kK]hoản\s+\d+)?)/g;
function highlightLawRefs(html) {
  return String(html)
    .split(/(<[^>]*>)/)
    .map(seg => (seg.startsWith("<") ? seg : seg.replace(LAW_REF_RE, '<span class="law-ref">$1</span>')))
    .join("");
}

// ============ CITE TOOLTIP (đợt 7) ============
// Bọc trích dẫn "Điều X[, khoản Y][, điểm z] + tên luật" thành <span class="cite">
// có data-law/-article/-clause/-point; rê chuột / chạm thì popup nội dung điều đó
// từ kho documents qua RPC read-only `cite_lookup`. CHỈ bọc khi map được tên luật
// (qua alias tải từ `cite_aliases`) — không map được thì giữ chip vàng như cũ.

function citeNorm(s) {
  return String(s || "").toLowerCase()
    .normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/đ/g, "d")
    .replace(/[\/\\.,()\[\]‐‑–—-]+/g, " ")
    .replace(/\s+/g, " ").trim();
}
function citeLoose(n) {
  return (" " + n + " ").replace(/ so /g, " ").replace(/\s+/g, " ").trim();
}

let CITE_ALIAS_INDEX = null; // [{k: law_id_key, a: alias_norm, l: alias bỏ "số"}]
const CITE_CACHE = new Map();

function buildCiteIndex(laws) {
  const idx = [];
  (laws || []).forEach(law => {
    (law.a || []).forEach(alias => {
      if (typeof alias === "string" && alias.length >= 4) {
        idx.push({ k: law.k, a: alias, l: citeLoose(alias) });
      }
    });
  });
  CITE_ALIAS_INDEX = idx.length ? idx : null;
}

async function loadCiteAliases() {
  try {
    const cached = JSON.parse(localStorage.getItem("phs_cite_aliases_v1") || "null");
    if (cached && Date.now() - cached.ts < 86400000 && Array.isArray(cached.laws) && cached.laws.length) {
      buildCiteIndex(cached.laws);
      return;
    }
  } catch {}
  const res = await fetch(SUPA_URL + "/rest/v1/rpc/cite_aliases", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_ANON, Authorization: "Bearer " + SUPA_ANON },
    body: "{}",
  });
  if (!res.ok) throw new Error("aliases HTTP " + res.status);
  const laws = await res.json();
  try { localStorage.setItem("phs_cite_aliases_v1", JSON.stringify({ ts: Date.now(), laws })); } catch {}
  buildCiteIndex(laws);
}

// Tìm luật trong đoạn văn NGAY SAU trích dẫn (cửa sổ ~110 ký tự, cắt ở ranh giới câu).
// Alias xuất hiện sớm nhất thắng; hòa thì alias dài hơn thắng. Không thấy → null (không đoán).
function resolveCiteLaw(win) {
  if (!win || !CITE_ALIAS_INDEX) return null;
  const wN = " " + citeNorm(win) + " ";
  const wL = " " + citeLoose(citeNorm(win)) + " ";
  let best = null;
  for (const e of CITE_ALIAS_INDEX) {
    let idx = wN.indexOf(" " + e.a + " ");
    if (idx < 0 && e.l && e.l.length >= 4) idx = wL.indexOf(" " + e.l + " ");
    if (idx >= 0 && (!best || idx < best.idx || (idx === best.idx && e.a.length > best.len))) {
      best = { k: e.k, idx, len: e.a.length };
    }
  }
  return best ? best.k : null;
}

const RE_CITE_CORE = /(?:[Đđ]iểm\s+([a-zđ])\s*,?\s+)?(?:[Kk]hoản\s+(\d{1,3})\s*,?\s+)?(?:[Đđ]iều|Article)\s+(\d{1,3}[a-zđ]?)(?:\s*,?\s*[Kk]hoản\s+(\d{1,3}))?(?:\s*,?\s*[đĐ]iểm\s+([a-zđ])\b)?/g;

function escAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Phân tích HTML đã render: text nối liền xuyên qua thẻ (để "Điều 5 của *Quy chế…*"
// vẫn thấy tên luật nằm trong <em>), nhưng span chỉ chèn khi lõi trích dẫn nằm
// trọn trong MỘT đoạn text (không cắt ngang thẻ).
function annotateCitations(html, ledger) {
  const segs = String(html).split(/(<[^>]*>)/);
  if (!CITE_ALIAS_INDEX) return segs.map(s => (s.startsWith("<") ? s : s.replace(LAW_REF_RE, '<span class="law-ref">$1</span>'))).join("");
  const textSegs = [];
  let concat = "";
  segs.forEach((s, i) => {
    if (!s.startsWith("<")) {
      textSegs.push({ i, start: concat.length, len: s.length });
      concat += s;
    }
  });
  const perSeg = new Map(); // segIdx -> [{s,e,law,article,clause,point}] (offset cục bộ)
  let m;
  RE_CITE_CORE.lastIndex = 0;
  while ((m = RE_CITE_CORE.exec(concat))) {
    const article = m[3];
    const clause = m[2] || m[4] || null;
    const point = (m[1] || m[5] || null);
    const winRaw = concat.slice(m.index + m[0].length, m.index + m[0].length + 110);
    const win = winRaw.split(/[\n.;:)!?"“”…]/)[0];
    let law = resolveCiteLaw(win);
    if (!law && Array.isArray(ledger) && ledger.length) {
      // fallback sổ qa_log: chỉ nhận khi đúng MỘT luật trong sổ có điều này
      const cand = [...new Set(ledger.filter(e => e.a === String(article).toLowerCase()).map(e => e.k))];
      if (cand.length === 1) law = cand[0];
    }
    if (!law) continue;
    const seg = textSegs.find(ts => m.index >= ts.start && m.index + m[0].length <= ts.start + ts.len);
    if (!seg) continue; // lõi vắt ngang thẻ — bỏ, để highlight thường xử lý
    if (!perSeg.has(seg.i)) perSeg.set(seg.i, []);
    perSeg.get(seg.i).push({ s: m.index - seg.start, e: m.index + m[0].length - seg.start, law, article, clause, point });
  }
  const legacy = t => t.replace(LAW_REF_RE, '<span class="law-ref">$1</span>');
  return segs.map((s, i) => {
    if (s.startsWith("<")) return s;
    const hits = perSeg.get(i);
    if (!hits || !hits.length) return legacy(s);
    let out = "", pos = 0;
    hits.sort((a, b) => a.s - b.s);
    for (const h of hits) {
      if (h.s < pos) continue;
      out += legacy(s.slice(pos, h.s));
      out += '<span class="law-ref cite" data-law="' + escAttr(h.law) + '" data-article="' + escAttr(h.article) + '"' +
        (h.clause ? ' data-clause="' + escAttr(h.clause) + '"' : "") +
        (h.point ? ' data-point="' + escAttr(h.point) + '"' : "") +
        ' tabIndex="0">' + s.slice(h.s, h.e) + "</span>";
      pos = h.e;
    }
    out += legacy(s.slice(pos));
    return out;
  }).join("");
}

async function citeFetch(law, article, clause, point) {
  const key = [law, article, clause || "", point || ""].join("|");
  if (CITE_CACHE.has(key)) return CITE_CACHE.get(key);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(SUPA_URL + "/rest/v1/rpc/cite_lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_ANON, Authorization: "Bearer " + SUPA_ANON },
      body: JSON.stringify({ p_law: law, p_article: article, p_clause: clause || null, p_point: point || null }),
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    CITE_CACHE.set(key, data);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Sổ trích dẫn của CÂU TRẢ LỜI MỚI NHẤT trong session (kernel đã ghi ở qa_log).
// Dùng làm fallback CÓ CĂN CỨ cho trích dẫn không nêu tên luật trong câu chữ
// (vd "(Điều 32, khoản 2)" khi cả câu không nhắc "Luật Chứng khoán") — không đoán mò.
async function citeFetchLedger(sessionId) {
  if (!sessionId) return [];
  try {
    const res = await fetch(SUPA_URL + "/rest/v1/rpc/cite_session_citations", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_ANON, Authorization: "Bearer " + SUPA_ANON },
      body: JSON.stringify({ p_session: sessionId }),
    });
    if (!res.ok) return [];
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    const out = [];
    arr.forEach(e => {
      if (!e || !e.article) return;
      const k = e.law_code ? resolveCiteLaw(String(e.law_code)) : null;
      if (k) out.push({ k, a: String(e.article).toLowerCase() });
    });
    return out;
  } catch {
    return [];
  }
}

const CITE_TEXT = {
  vi: {
    loading: "Đang tra cứu…",
    notFound: "Chưa tra được nội dung này trong kho văn bản.",
    clauseMissing: "Chưa tách được đúng khoản — hiển thị đầu điều:",
    partial: "(trích một phần)",
    source: "Nguồn: kho văn bản PHS Legal",
  },
  en: {
    loading: "Looking up…",
    notFound: "This provision could not be found in the corpus.",
    clauseMissing: "Clause not isolated — showing the article:",
    partial: "(excerpt)",
    source: "Source: PHS Legal corpus",
  },
};
function citeText() {
  return document.documentElement.lang === "en" ? CITE_TEXT.en : CITE_TEXT.vi;
}

function ensureCitePop() {
  let el = document.getElementById("cite-pop");
  if (!el) {
    el = document.createElement("div");
    el.id = "cite-pop";
    el.className = "cite-pop";
    el.setAttribute("role", "tooltip");
    document.body.appendChild(el);
  }
  return el;
}

// Toàn bộ nội dung popup dựng bằng textContent — không innerHTML dữ liệu ngoài.
function renderCitePop(pop, state, T) {
  pop.textContent = "";
  const add = (cls, text) => {
    const d = document.createElement("div");
    d.className = cls;
    if (text != null) d.textContent = text;
    pop.appendChild(d);
    return d;
  };
  if (state.loading) { add("cite-pop-loading", T.loading); return; }
  const d = state.data;
  if (state.error || !d || d.found !== true) {
    add("cite-pop-notfound", T.notFound);
    if (d && d.law_display) add("cite-pop-foot", d.law_display);
    return;
  }
  let head = d.law_display + " · Điều " + d.article_no;
  if (d.clause_no) head += ", khoản " + d.clause_no;
  if (d.point_no) head += ", điểm " + d.point_no;
  add("cite-pop-head", head);
  if (d.article_title) add("cite-pop-title", d.article_title);
  if (d.clause_found === false) add("cite-pop-note", T.clauseMissing);
  add("cite-pop-body", d.excerpt || "");
  add("cite-pop-foot", T.source + (d.truncated ? " · " + T.partial : ""));
}

function positionCitePop(pop, anchor) {
  const r = anchor.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(380, vw - 24);
  pop.style.width = w + "px";
  pop.classList.add("is-open");
  const h = pop.offsetHeight;
  let top = r.bottom + 8;
  if (top + h > vh - 12 && r.top - h - 8 > 12) top = r.top - h - 8;
  let left = Math.min(Math.max(12, r.left), vw - w - 12);
  pop.style.top = Math.max(12, top) + "px";
  pop.style.left = left + "px";
}

function showCitePop(el) {
  const pop = ensureCitePop();
  const law = el.dataset.law, article = el.dataset.article;
  const clause = el.dataset.clause || null, point = el.dataset.point || null;
  if (!law || !article) return;
  const key = [law, article, clause || "", point || ""].join("|");
  pop.__key = key;
  pop.__anchor = el;
  const T = citeText();
  renderCitePop(pop, { loading: true }, T);
  positionCitePop(pop, el);
  citeFetch(law, article, clause, point)
    .then(d => { if (pop.__key !== key) return; renderCitePop(pop, { data: d }, T); positionCitePop(pop, el); })
    .catch(() => { if (pop.__key !== key) return; renderCitePop(pop, { error: true }, T); positionCitePop(pop, el); });
}

function hideCitePop() {
  const pop = document.getElementById("cite-pop");
  if (pop) { pop.classList.remove("is-open"); pop.__key = null; pop.__anchor = null; }
}

function extractSuggestions(data) {
  if (!data) return [];
  const candidates = [
    data.suggestions, data.related, data.followups, data.followUps,
    data.next_questions, data.relatedQuestions,
    data.output?.suggestions, data.data?.suggestions,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) {
      return c.map(x => (typeof x === "string" ? x : x?.text || x?.question || x?.label)).filter(Boolean).slice(0, 6);
    }
  }
  const text = data.output || data.answer || data.text || data.message || "";
  if (typeof text === "string") {
    const m = text.match(/(?:có thể bạn quan tâm|related questions|gợi ý câu hỏi|gợi ý tiếp theo|suggested questions?|câu hỏi liên quan)[:\s]*\n([\s\S]+?)(?:\n\n|$)/i);
    if (m) {
      return m[1].split(/\n/).map(l => l.replace(/^[-•\d.\s]+/, "").trim()).filter(Boolean).slice(0, 6);
    }
  }
  return [];
}

function extractAnswer(data) {
  if (typeof data === "string") return data;
  if (!data) return "";
  return (
    data.output || data.answer || data.text || data.message || data.response ||
    data.data?.output || data.data?.answer ||
    JSON.stringify(data)
  );
}

function stripSuggestionsBlock(text) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/(?:\n+)(?:\*\*)?(?:có thể bạn quan tâm|related questions|gợi ý câu hỏi|gợi ý tiếp theo|suggested questions?|câu hỏi liên quan)(?:\*\*)?[:\s]*\n[\s\S]+$/i, "").trim();
}

function titleFromMessage(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > 50 ? clean.slice(0, 50) + "…" : clean;
}

function formatRelative(ts, lang) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (lang === "vi") {
    if (m < 1) return "vừa xong";
    if (m < 60) return m + "p";
    if (h < 24) return h + "h";
    if (d < 7) return d + "ng";
  } else {
    if (m < 1) return "now";
    if (m < 60) return m + "m";
    if (h < 24) return h + "h";
    if (d < 7) return d + "d";
  }
  return new Date(ts).toLocaleDateString();
}

// ============ ICONS ============
const Icon = {
  Plus: () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  Settings: () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
  Send: () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  Trash: () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>,
  Menu: () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
  Shield: () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Arrow: () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>,
};

// ============ COMPONENTS ============
function TypingDots() {
  return <span className="typing"><span></span><span></span><span></span></span>;
}

// Thẻ chờ: nhãn giai đoạn xoay vòng theo pipeline thật (phân tích → tra cứu →
// đối chiếu → kiểm chứng → soạn), thanh tiến trình quét + đồng hồ mm:ss.
// Mốc thời gian là ước lượng hiển thị, không phải telemetry từ máy chủ.
function ThinkingCard({ t }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setSec(x => x + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const stages = t.thinkingStages;
  const stageIdx = Math.min(Math.floor(sec / 9), stages.length - 1);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return (
    <div className="msg-thinking">
      <div className="thinking-row">
        <TypingDots />
        <span className="thinking-label" key={stageIdx}>{stages[stageIdx]}…</span>
        <span className="thinking-tick">{mm}:{ss}</span>
      </div>
      <div className="progress-track"><div className="progress-bar"></div></div>
      {sec >= 90 && <div className="thinking-note">{t.thinkingLong}</div>}
    </div>
  );
}

function Message({ msg, t, onSuggestionClick, onEscalate }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  const copy = () => {
    navigator.clipboard?.writeText(msg.content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isUser) {
    return (
      <div className="msg msg-user">
        <div className="msg-bubble-user">{msg.content}</div>
      </div>
    );
  }

  return (
    <div className="msg msg-bot">
      <div className="msg-avatar">§</div>
      <div className="msg-body">
        <div className="msg-meta">
          <span className="msg-author">{t.bot}</span>
          <span className="msg-tag"><span className="msg-tag-dot"></span>{t.botTag}</span>
          {msg.timestamp && <span className="msg-time">{msg.timestamp}</span>}
        </div>

        {msg.loading ? (
          <ThinkingCard t={t} />
        ) : msg.error ? (
          <div className="msg-error">{msg.content}</div>
        ) : (
          <>
            <div className="msg-prose" dangerouslySetInnerHTML={{ __html: annotateCitations(mdToHtml(msg.content), msg.cites) }} />
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div className="related">
                <div className="related-label">{t.relatedLabel}</div>
                <div className="related-chips">
                  {msg.suggestions.map((s, i) => (
                    <button key={i} className="chip chip-related" onClick={() => onSuggestionClick(s)}>
                      <span className="chip-arrow">↗</span>
                      <span>{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msg.content && (
              <div className="msg-actions">
                <button className="action-btn" onClick={copy}>
                  {copied ? "✓ " + t.copied : t.copy}
                </button>
                {msg.escalatedCode ? (
                  <span className="action-done">{t.escalateDone} · {msg.escalatedCode}</span>
                ) : (
                  <button className="action-btn action-escalate" onClick={() => onEscalate(msg)}>
                    {t.escalateBtn}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Số đếm tăng dần khi mở màn hình chào (tôn trọng prefers-reduced-motion)
function useCountUp(target, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      return;
    }
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function StatCell({ value, label, lang }) {
  const n = useCountUp(value);
  return (
    <div className="stat">
      <div className="stat-value">{n.toLocaleString(lang === "vi" ? "vi-VN" : "en-US")}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Welcome({ t, lang, onSuggestion }) {
  return (
    <div className="welcome">
      <div className="aura aura-a"></div>
      <div className="aura aura-b"></div>
      <div className="welcome-mark" aria-hidden="true">§</div>

      <div className="welcome-header fx fx-1">
        <span className="welcome-tag">
          <span className="welcome-tag-dot"></span>
          {t.welcomeBadge}
        </span>
        <span className="welcome-meta">{t.welcomeMeta}</span>
      </div>
      <h1 className="welcome-title fx fx-2">
        {t.welcomeTitleA} <span className="accent">{t.welcomeTitleAccent}</span> {t.welcomeTitleB}
      </h1>
      <p className="welcome-body fx fx-3">{t.welcomeBody}</p>

      <div className="hero-stats fx fx-4">
        <StatCell value={CORPUS.docs} label={t.statDocs} lang={lang} />
        <StatCell value={CORPUS.chunks} label={t.statChunks} lang={lang} />
        <div className="stat">
          <div className="stat-value">{t.statLangValue}</div>
          <div className="stat-label">{t.statLang}</div>
        </div>
      </div>

      <div className="suggest-header fx fx-5">
        <div className="suggest-title">{t.suggestionsLabel}</div>
        <div className="suggest-count">{t.suggestionsCount}</div>
      </div>
      <div className="suggest-grid">
        {t.suggestions.map((s, i) => (
          <button
            key={i}
            className="suggest-card"
            style={{ animationDelay: (0.3 + i * 0.05).toFixed(2) + "s" }}
            onClick={() => onSuggestion(s)}
          >
            <span className="suggest-num">{String(i + 1).padStart(2, "0")}</span>
            <span className="suggest-text">{s}</span>
            <span className="suggest-arrow"><Icon.Arrow /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============ HỎI CHUYÊN VIÊN — form gửi ============
// Dùng chung cho tab "Hỏi chuyên viên" và modal bật từ dưới câu trả lời của bot.
function EscalateForm({ t, lang, presetQuestion, presetBotAnswer, sessionId, source, onDone, compact }) {
  const [email, setEmail] = useState(() => localStorage.getItem(STORAGE.escEmail) || "");
  const [question, setQuestion] = useState(presetQuestion || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");

  const submit = async () => {
    const mail = email.trim().toLowerCase();
    const q = question.trim();
    if (!EMAIL_RE.test(mail)) { setErr(t.errEmail); return; }
    if (q.length < 10) { setErr(t.errQuestion); return; }
    setErr("");
    setBusy(true);
    try {
      const r = await escalationSubmit({
        email: mail,
        question: q,
        lang,
        source: source || "ask_tab",
        bot_answer: presetBotAnswer || "",
        session_id: sessionId || "",
      });
      if (r && r.ok) {
        try { localStorage.setItem(STORAGE.escEmail, mail); } catch {}
        setCode(r.ticket_code);
        if (onDone) onDone(r.ticket_code, mail);
      } else {
        setErr(escErrorText(r && r.error, t));
      }
    } catch {
      setErr(t.errNet);
    } finally {
      setBusy(false);
    }
  };

  if (code) {
    return (
      <div className="esc-ok">
        <div className="esc-ok-title">{t.askOk}</div>
        <div className="esc-ok-label">{t.askOkBody}</div>
        <div className="esc-ok-code">{code}</div>
        <p className="esc-note">{t.askOkHint}</p>
        {!compact && (
          <button className="esc-btn esc-btn-ghost" onClick={() => { setCode(""); setQuestion(""); }}>
            {t.askAnother}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="esc-form">
      <label className="esc-label">{t.askEmail}</label>
      <input
        className="esc-input"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={ev => setEmail(ev.target.value)}
        placeholder={t.askEmailPh}
        disabled={busy}
      />
      <div className="esc-note">{t.askEmailNote}</div>

      <label className="esc-label">{t.askQuestion}</label>
      <textarea
        className="esc-textarea"
        value={question}
        onChange={ev => setQuestion(ev.target.value)}
        placeholder={t.askQuestionPh}
        rows={compact ? 5 : 7}
        disabled={busy}
      />

      {err && <div className="esc-err">{err}</div>}
      <button className="esc-btn" onClick={submit} disabled={busy}>
        {busy ? t.askSending : t.askSubmit}
      </button>
    </div>
  );
}

// ============ HỎI CHUYÊN VIÊN — tra cứu kết quả theo email ============
function EscalateLookup({ t, lang }) {
  const [email, setEmail] = useState(() => localStorage.getItem(STORAGE.escEmail) || "");
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = async () => {
    const mail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(mail)) { setErr(t.errEmail); return; }
    setErr("");
    setBusy(true);
    try {
      const data = await escalationList(mail);
      try { localStorage.setItem(STORAGE.escEmail, mail); } catch {}
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setErr(t.errNet);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { return "—"; }
  };

  const stateText = (s) => (s === "answered" ? t.stAnswered : s === "rejected" ? t.stRejected : t.stPending);

  return (
    <div className="esc-form">
      <label className="esc-label">{t.askEmail}</label>
      <div className="esc-row">
        <input
          className="esc-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={ev => setEmail(ev.target.value)}
          onKeyDown={ev => { if (ev.key === "Enter") load(); }}
          placeholder={t.askEmailPh}
          disabled={busy}
        />
        <button className="esc-btn esc-btn-inline" onClick={load} disabled={busy}>
          {busy ? t.lookupLoading : t.lookupBtn}
        </button>
      </div>

      {err && <div className="esc-err">{err}</div>}

      {rows && rows.length === 0 && <div className="esc-empty">{t.lookupEmpty}</div>}

      {rows && rows.length > 0 && (
        <div className="esc-list">
          {rows.map(r => {
            const isOpen = openId === r.ticket_code;
            const canOpen = r.state === "answered" && r.answer;
            return (
              <div key={r.ticket_code} className={"esc-item " + (isOpen ? "is-open" : "")}>
                <button
                  className="esc-item-head"
                  onClick={() => setOpenId(isOpen ? null : r.ticket_code)}
                  disabled={!canOpen}
                >
                  <span className={"esc-pill esc-pill-" + r.state}>{stateText(r.state)}</span>
                  <span className="esc-item-q">{r.question}</span>
                  <span className="esc-item-meta">
                    {r.ticket_code} · {t.askedAt} {fmt(r.created_at)}
                    {r.answered_at ? " · " + t.answeredAt + " " + fmt(r.answered_at) : ""}
                  </span>
                  {canOpen && <span className="esc-item-chev">{isOpen ? "−" : "+"}</span>}
                </button>
                {isOpen && canOpen && (
                  <div
                    className="esc-item-body msg-prose"
                    dangerouslySetInnerHTML={{ __html: annotateCitations(mdToHtml(r.answer), null) }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ HỎI CHUYÊN VIÊN — modal bật từ câu trả lời của bot ============
function EscalateModal({ t, lang, ctx, onClose, onSubmitted }) {
  useEffect(() => {
    if (!ctx) return undefined;
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [ctx, onClose]);

  if (!ctx) return null;

  return (
    <div className="esc-backdrop" onClick={onClose}>
      <div className="esc-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="esc-modal-head">
          <div className="esc-modal-title">{t.modalTitle}</div>
          <button className="esc-modal-x" onClick={onClose} aria-label={t.modalCancel}>×</button>
        </div>
        <p className="esc-note esc-note-lead">{t.modalLead}</p>
        <EscalateForm
          t={t}
          lang={lang}
          compact
          source="chat_feedback"
          presetQuestion={ctx.question}
          presetBotAnswer={ctx.botAnswer}
          sessionId={ctx.sessionId}
          onDone={(code) => onSubmitted(ctx.msgId, code)}
        />
      </div>
    </div>
  );
}

// ============ MAIN APP ============
function App() {
  const [lang, setLang] = useState(() => localStorage.getItem(STORAGE.lang) || "vi");
  const webhook = WEBHOOK_URL;
  const [conversations, setConversations] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE.conversations);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  });
  const [activeId, setActiveId] = useState(() => localStorage.getItem(STORAGE.activeId) || null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Tab "Biểu mẫu" (Teller Portal nhúng qua iframe cùng domain, thư mục forms/).
  // Iframe chỉ nạp lần đầu mở tab và giữ nguyên khi chuyển qua lại — không mất dữ liệu đang nhập.
  const [view, setView] = useState("chat");
  const [formsLoaded, setFormsLoaded] = useState(false);
  const openForms = () => { setFormsLoaded(true); setView("forms"); setSidebarOpen(false); };
  // Tab "Hỏi chuyên viên" — gửi câu hỏi khó cho chuyên viên pháp chế và tra kết quả theo email.
  const openAsk = () => { setView("ask"); setSidebarOpen(false); };
  const [escalateCtx, setEscalateCtx] = useState(null);
  const [now, setNow] = useState(new Date());
  const [citeReady, setCiteReady] = useState(false); // re-render tin nhắn khi alias tra cứu về

  const t = I18N[lang];
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Live clock for status bar
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  // Cite tooltip: tải alias luật (1 lần, cache 24h) + gắn listener hover/tap/Esc.
  // Tooltip là tăng cường — alias tải lỗi thì câu trả lời vẫn render bình thường.
  useEffect(() => {
    loadCiteAliases().then(() => setCiteReady(true)).catch(() => {});
    let hoverTimer = null, hideTimer = null;
    const isCite = e => (e.target && e.target.closest ? e.target.closest(".cite") : null);
    const onOver = e => {
      const c = isCite(e);
      if (!c) return;
      clearTimeout(hideTimer);
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => showCitePop(c), 150);
    };
    const onOut = e => {
      if (!isCite(e)) return;
      clearTimeout(hoverTimer);
      hideTimer = setTimeout(hideCitePop, 250);
    };
    const onClick = e => {
      const c = isCite(e);
      if (c) {
        e.preventDefault();
        const pop = document.getElementById("cite-pop");
        if (pop && pop.classList.contains("is-open") && pop.__anchor === c) hideCitePop();
        else showCitePop(c);
      } else if (!(e.target.closest && e.target.closest("#cite-pop"))) {
        hideCitePop();
      }
    };
    const onKey = e => { if (e.key === "Escape") hideCitePop(); };
    const pop = ensureCitePop();
    const popEnter = () => clearTimeout(hideTimer);
    const popLeave = () => { hideTimer = setTimeout(hideCitePop, 250); };
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    pop.addEventListener("mouseenter", popEnter);
    pop.addEventListener("mouseleave", popLeave);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      pop.removeEventListener("mouseenter", popEnter);
      pop.removeEventListener("mouseleave", popLeave);
      clearTimeout(hoverTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE.lang, lang);
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => { localStorage.setItem(STORAGE.conversations, JSON.stringify(conversations.slice(0, 50))); }, [conversations]);
  useEffect(() => { if (activeId) localStorage.setItem(STORAGE.activeId, activeId); }, [activeId]);

  const activeConv = useMemo(
    () => conversations.find(c => c.id === activeId) || null,
    [conversations, activeId]
  );
  const messages = activeConv?.messages || [];

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, activeId]);

  // Auto-resize
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 180) + "px";
    }
  }, [input]);

  const createConversation = () => {
    const id = genId("conv");
    const sid = genSessionId();
    const conv = {
      id,
      sessionId: sid,
      title: "",
      messages: [],
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    setConversations(c => [conv, ...c]);
    setActiveId(id);
    return conv;
  };

  const updateConversation = (id, patch) => {
    setConversations(cs => cs.map(c => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c));
  };

  // Bật modal "nhờ chuyên viên" cho một câu trả lời của bot: lấy câu hỏi người
  // dùng đặt ngay trước đó làm nội dung mặc định, kèm theo câu trả lời chưa đạt
  // để chuyên viên biết bot đã nói gì.
  const escalateFromMessage = (botMsg) => {
    const idx = messages.findIndex(m => m.id === botMsg.id);
    let q = "";
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") { q = messages[i].content || ""; break; }
    }
    setEscalateCtx({
      msgId: botMsg.id,
      question: q,
      botAnswer: botMsg.content || "",
      sessionId: activeConv?.sessionId || "",
    });
  };

  const markEscalated = (msgId, code) => {
    if (!activeConv) return;
    updateConversation(activeConv.id, {
      messages: messages.map(m => (m.id === msgId ? { ...m, escalatedCode: code } : m)),
    });
  };

  const newChat = () => {
    createConversation();
    setInput("");
    setSidebarOpen(false);
  };

  const deleteConversation = (id, e) => {
    e?.stopPropagation();
    if (!window.confirm(t.confirmDelete)) return;
    setConversations(cs => cs.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const switchTo = (id) => {
    setActiveId(id);
    setSidebarOpen(false);
  };

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    // Ensure active conversation
    let conv = activeConv;
    if (!conv) conv = createConversation();
    const convId = conv.id;
    const sessionId = conv.sessionId;

    const ts = new Date().toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" });
    const userMsg = { id: genId("u"), role: "user", content: text, timestamp: ts };
    const loadingMsg = { id: genId("b"), role: "bot", content: "", loading: true };

    // Title from first user message
    const isFirst = (conv.messages || []).length === 0;
    setConversations(cs => cs.map(c => c.id === convId ? {
      ...c,
      messages: [...(c.messages || []), userMsg, loadingMsg],
      title: c.title || (isFirst ? titleFromMessage(text) : c.title),
      updatedAt: Date.now(),
    } : c));

    setInput("");
    setSending(true);

    const finishWith = (patch) => {
      setConversations(cs => cs.map(c => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: (c.messages || []).map(m => m.id === loadingMsg.id ? { ...m, loading: false, ...patch } : m),
          updatedAt: Date.now(),
        };
      }));
    };

    // Câu pháp lý nặng đo được tới ~200s giờ nghẽn — chờ tối đa 300s rồi báo rõ, không để trình duyệt tự cắt mơ hồ.
    const FETCH_TIMEOUT_MS = 300000;
    const abortCtl = new AbortController();
    const fetchTimer = setTimeout(() => abortCtl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatInput: text,
          sessionId,
          session_id: sessionId,
          lang,
          message: text,
        }),
        signal: abortCtl.signal,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const ctype = res.headers.get("content-type") || "";
      const data = ctype.includes("application/json") ? await res.json() : await res.text();
      const rawAnswer = extractAnswer(data);
      const suggestions = extractSuggestions(data);
      const cleanAnswer = stripSuggestionsBlock(rawAnswer);
      const replyTs = new Date().toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" });
      finishWith({ content: cleanAnswer, suggestions, timestamp: replyTs });
      // Đợt 7b: lấy sổ trích dẫn kernel ghi ở qa_log (có thể ghi trễ vài giây → retry)
      // để bọc nốt các trích dẫn không nêu tên luật. Lỗi thì bỏ qua êm.
      const attachLedger = (tries) => {
        citeFetchLedger(sessionId).then(led => {
          if (led.length) {
            setConversations(cs => cs.map(c => c.id !== convId ? c : {
              ...c,
              messages: (c.messages || []).map(m => m.id === loadingMsg.id ? { ...m, cites: led } : m),
            }));
          } else if (tries > 0) {
            setTimeout(() => attachLedger(tries - 1), 2500);
          }
        }).catch(() => {});
      };
      attachLedger(2);
    } catch (e) {
      console.error(e);
      finishWith({ error: true, content: e && e.name === "AbortError" ? t.errorTimeout : t.error });
    } finally {
      clearTimeout(fetchTimer);
      setSending(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasMessages = messages.length > 0;
  const isOnline = !!webhook;

  // Sorted conversations
  const sortedConvs = useMemo(
    () => [...conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [conversations]
  );

  const timeStr = now.toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const activeShortSession = activeConv?.sessionId ? activeConv.sessionId.slice(-10) : "—";

  return (
    <div className={"app" + (view === "forms" ? " view-forms" : "") + (view === "ask" ? " view-ask" : "")} data-screen-label="Chat">
      {/* TOP BAR */}
      <header className="topbar">
        <div className="brand">
          <button className="mobile-toggle" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
            <Icon.Menu />
          </button>
          <div className="brand-mark">L</div>
          <div className="brand-text">
            <div className="brand-name">{t.appName}</div>
            <div className="brand-sub">{t.appSubtitle}</div>
          </div>
          <span className="badge-20y" title="20 năm Phú Hưng Securities">{t.badge20}</span>
        </div>
        <div className="topbar-main">
          <div className="view-tabs" role="tablist">
            <button
              className={"view-tab " + (view === "chat" ? "is-active" : "")}
              onClick={() => setView("chat")}
              role="tab"
              aria-selected={view === "chat"}
            >{t.tabChat}</button>
            <button
              className={"view-tab " + (view === "ask" ? "is-active" : "")}
              onClick={openAsk}
              role="tab"
              aria-selected={view === "ask"}
            >{t.tabAsk}</button>
            <button
              className={"view-tab " + (view === "forms" ? "is-active" : "")}
              onClick={openForms}
              role="tab"
              aria-selected={view === "forms"}
            >{t.tabForms}</button>
          </div>
          <div className="crumbs">
            <span>{t.crumbHome}</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-active">{activeConv?.title || t.crumbActive}</span>
          </div>
          <div className="topbar-actions">
            <div className="lang-toggle" role="tablist">
              <button className={"lang-btn " + (lang === "vi" ? "is-active" : "")} onClick={() => setLang("vi")} role="tab" aria-selected={lang === "vi"}>VI</button>
              <button className={"lang-btn " + (lang === "en" ? "is-active" : "")} onClick={() => setLang("en")} role="tab" aria-selected={lang === "en"}>EN</button>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE BACKDROP */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)}></div>}

      {/* SIDEBAR */}
      <aside className={"sidebar " + (sidebarOpen ? "is-open" : "")}>
        <div className="sidebar-section">
          <button className="btn-new" onClick={newChat}>
            <Icon.Plus />
            <span>{t.newChat}</span>
          </button>
        </div>
        <div className="sidebar-label">
          <span>{t.history}</span>
          <span>{sortedConvs.length}</span>
        </div>
        <div className="history-list scroll">
          {sortedConvs.length === 0 ? (
            <div className="history-empty">{t.historyEmpty}</div>
          ) : sortedConvs.map(c => (
            <button
              key={c.id}
              className={"history-item " + (c.id === activeId ? "is-active" : "")}
              onClick={() => switchTo(c.id)}
            >
              <span className="history-title">{c.title || t.untitled}</span>
              <span className="history-meta">{formatRelative(c.updatedAt, lang)}</span>
              <span className="history-del" onClick={(e) => deleteConversation(c.id, e)} title={t.delete}>
                <Icon.Trash />
              </span>
            </button>
          ))}
        </div>
        <div className="sidebar-foot">
          <div className="foot-name">{t.bot}</div>
          <div className="foot-sub">{t.poweredBy}</div>
        </div>
      </aside>

      {/* FORMS TAB (Teller Portal, luôn giữ mounted sau lần mở đầu) */}
      {formsLoaded && (
        <section className="forms-view" aria-hidden={view !== "forms"}>
          <iframe className="forms-frame" src="forms/" title={t.tabForms} />
        </section>
      )}

      {/* ASK TAB — gửi câu hỏi cho chuyên viên pháp chế + tra kết quả theo email */}
      <section className="ask-view" aria-hidden={view !== "ask"}>
        <div className="ask-scroll scroll">
          <div className="ask-inner">
            <div className="ask-card">
              <h2 className="ask-h">{t.askHeading}</h2>
              <p className="ask-lead">{t.askLead}</p>
              <EscalateForm t={t} lang={lang} source="ask_tab" />
            </div>
            <div className="ask-card">
              <h2 className="ask-h">{t.lookupHeading}</h2>
              <p className="ask-lead">{t.lookupLead}</p>
              <EscalateLookup t={t} lang={lang} />
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <main className="main">
        <div className="scroll" ref={scrollRef}>
          <div className="container">
            {!hasMessages ? (
              <Welcome t={t} lang={lang} onSuggestion={(s) => send(s)} />
            ) : (
              <div className="messages">
                {messages.map(m => (
                  <Message
                    key={m.id}
                    msg={m}
                    t={t}
                    onSuggestionClick={(s) => send(s)}
                    onEscalate={escalateFromMessage}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COMPOSER */}
        <div className="composer-wrap">
          <div className="container">
            <div className="composer">
              <textarea
                ref={inputRef}
                className="composer-input"
                placeholder={t.inputPlaceholder}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                disabled={sending}
              />
              <button
                className="composer-send"
                onClick={() => send()}
                disabled={!input.trim() || sending}
                aria-label={t.send}
              >
                <Icon.Send />
              </button>
            </div>
            <div className="composer-foot">
              <span className="foot-disclaimer">
                <Icon.Shield />
                {t.disclaimer}
              </span>
              <span className="foot-hint">
                <kbd>↵</kbd> {t.enterHint} · <kbd>⇧</kbd>+<kbd>↵</kbd> {t.shiftEnter}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* STATUS BAR */}
      <footer className="statusbar">
        <div className="status-cell">
          <span className={"status-dot " + (isOnline ? "" : "off")}></span>
          <span className="value">{isOnline ? t.online : t.offline}</span>
        </div>
        <div className="status-divider"></div>
        <div className="status-cell">
          <span className="label">{t.sessionId}</span>
          <span className="value">{activeShortSession}</span>
        </div>
        <div className="status-divider hide-sm"></div>
        <div className="status-cell hide-sm">
          <span className="label">ENV</span>
          <span className="value">{t.statusEnv}</span>
        </div>
        <div className="status-divider hide-md hide-sm"></div>
        <div className="status-cell hide-md hide-sm">
          <span className="label">MODEL</span>
          <span className="value">{t.statusModel}</span>
        </div>
        <div className="status-divider hide-md hide-sm"></div>
        <div className="status-cell hide-md hide-sm">
          <span className="label">{t.statusCorpus}</span>
          <span className="value">{CORPUS.docs} VB · {(CORPUS.chunks / 1000).toFixed(1)}K</span>
        </div>
        <div className="status-spacer"></div>
        <div className="status-cell brand">
          <span className="label">PHS</span>
          <span className="value">v{APP_VERSION}</span>
        </div>
        <div className="status-divider"></div>
        <div className="status-cell">
          <span className="value">{timeStr}</span>
        </div>
      </footer>

      <EscalateModal
        t={t}
        lang={lang}
        ctx={escalateCtx}
        onClose={() => setEscalateCtx(null)}
        onSubmitted={markEscalated}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
