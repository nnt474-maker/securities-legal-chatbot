const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ============ CONFIG ============
// Webhook n8n cố định — nối thẳng, người dùng không phải dán URL hay mở cài đặt.
// Gọi thẳng (không qua proxy Vercel) vì câu hỏi pháp lý nặng có thể chạy hơn 60s,
// vượt giới hạn thời gian của serverless function gói free; trình duyệt thì chờ
// được. n8n đã mở CORS (phản hồi access-control-allow-origin theo Origin) nên
// gọi thẳng từ domain Vercel không bị chặn.
const WEBHOOK_URL = "https://n8n.phs.vn/webhook/PHS-legal-chat";
const APP_VERSION = "1.0.0";
// Quy mô kho văn bản hiển thị ở màn hình chào + thanh trạng thái.
// Cập nhật tay khi nạp thêm văn bản (xem bảng legal_source_catalog).
const CORPUS = { docs: 47, chunks: 4891 };

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
};

function mdToHtml(src) {
  if (!src) return "";
  let s = String(src);
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${c.trim()}</code></pre>`);
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/^###\s+(.+)$/gm, "<h4>$1</h4>");
  s = s.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^#\s+(.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/(?:^|\n)((?:[-•]\s+.+(?:\n|$))+)/g, (m, block) => {
    const items = block.trim().split(/\n/).map(l => l.replace(/^[-•]\s+/, "").trim()).filter(Boolean);
    return "\n<ul>" + items.map(i => `<li>${i}</li>`).join("") + "</ul>";
  });
  s = s.replace(/(?:^|\n)((?:\d+\.\s+.+(?:\n|$))+)/g, (m, block) => {
    const items = block.trim().split(/\n/).map(l => l.replace(/^\d+\.\s+/, "").trim()).filter(Boolean);
    return "\n<ol>" + items.map(i => `<li>${i}</li>`).join("") + "</ol>";
  });
  s = s.replace(/(?:^|\n)>\s+(.+)(?=\n|$)/g, "\n<blockquote>$1</blockquote>");
  const blocks = s.split(/\n{2,}/).map(b => {
    if (/^\s*<(h\d|ul|ol|pre|blockquote)/.test(b)) return b;
    return "<p>" + b.replace(/\n/g, "<br>") + "</p>";
  });
  return blocks.join("\n");
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

function Message({ msg, t, onSuggestionClick }) {
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
            <div className="msg-prose" dangerouslySetInnerHTML={{ __html: highlightLawRefs(mdToHtml(msg.content)) }} />
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
  const [now, setNow] = useState(new Date());

  const t = I18N[lang];
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Live clock for status bar
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
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
    <div className="app" data-screen-label="Chat">
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

      {/* MAIN */}
      <main className="main">
        <div className="scroll" ref={scrollRef}>
          <div className="container">
            {!hasMessages ? (
              <Welcome t={t} lang={lang} onSuggestion={(s) => send(s)} />
            ) : (
              <div className="messages">
                {messages.map(m => (
                  <Message key={m.id} msg={m} t={t} onSuggestionClick={(s) => send(s)} />
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
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
