const { useState, useEffect, useRef, useCallback } = React;

// ============ CONFIG ============
const DEFAULT_WEBHOOK = "";

const I18N = {
  vi: {
    appTitle: "PHS Legal",
    appSubtitle: "Trợ lý pháp lý chứng khoán",
    welcomeKicker: "Xin chào,",
    welcomeTitle: "Tôi có thể giúp gì cho bạn về pháp lý chứng khoán?",
    welcomeBody: "Đặt câu hỏi về Luật Chứng khoán, Nghị định, Thông tư, hoặc các quy định nội bộ. Câu trả lời được trích dẫn từ văn bản pháp luật hiện hành.",
    suggestionsLabel: "Câu hỏi gợi ý",
    suggestions: [
      "Điều kiện trở thành công ty đại chúng là gì?",
      "Cổ đông lớn được định nghĩa như thế nào?",
      "Quy định về giao dịch ký quỹ (margin)?",
      "Người nội bộ phải công bố thông tin khi nào?",
      "Điều kiện niêm yết trên HOSE?",
      "Xử phạt hành vi giao dịch nội gián?",
    ],
    inputPlaceholder: "Nhập câu hỏi của bạn…",
    thinking: "Đang tra cứu văn bản",
    relatedLabel: "Có thể bạn quan tâm",
    newChat: "Cuộc trò chuyện mới",
    settings: "Cài đặt",
    settingsTitle: "Kết nối n8n",
    settingsHint: "Dán URL webhook từ n8n Chat Trigger của bạn",
    webhookLabel: "Webhook URL",
    save: "Lưu",
    cancel: "Hủy",
    disclaimer: "Thông tin tham khảo, không thay thế tư vấn pháp lý chính thức.",
    error: "Không kết nối được tới máy chủ. Kiểm tra cấu hình webhook trong Cài đặt.",
    notConfigured: "Chưa cấu hình webhook n8n. Mở Cài đặt để dán URL.",
    you: "Bạn",
    bot: "PHS Legal",
    send: "Gửi",
    copied: "Đã sao chép",
    copy: "Sao chép",
    sessionId: "Phiên",
  },
  en: {
    appTitle: "PHS Legal",
    appSubtitle: "Securities legal assistant",
    welcomeKicker: "Hello,",
    welcomeTitle: "How can I help with securities law today?",
    welcomeBody: "Ask about the Securities Law, decrees, circulars, or internal regulations. Answers are cited from current legal documents.",
    suggestionsLabel: "Suggested questions",
    suggestions: [
      "What are the conditions to become a public company?",
      "How is a major shareholder defined?",
      "Regulations on margin trading?",
      "When must insiders disclose information?",
      "Listing requirements on HOSE?",
      "Penalties for insider trading?",
    ],
    inputPlaceholder: "Type your question…",
    thinking: "Searching legal documents",
    relatedLabel: "Related questions",
    newChat: "New conversation",
    settings: "Settings",
    settingsTitle: "Connect to n8n",
    settingsHint: "Paste the webhook URL from your n8n Chat Trigger",
    webhookLabel: "Webhook URL",
    save: "Save",
    cancel: "Cancel",
    disclaimer: "For reference only. Not a substitute for formal legal advice.",
    error: "Couldn't reach the server. Check webhook configuration in Settings.",
    notConfigured: "n8n webhook not configured. Open Settings to paste the URL.",
    you: "You",
    bot: "PHS Legal",
    send: "Send",
    copied: "Copied",
    copy: "Copy",
    sessionId: "Session",
  },
};

// ============ HELPERS ============
const genSessionId = () =>
  "sess_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);

const STORAGE = {
  webhook: "phs_legal_webhook",
  lang: "phs_legal_lang",
  session: "phs_legal_session",
  history: "phs_legal_history",
};

// Lightweight markdown → HTML (safe-ish; we control the source from n8n which is trusted within our deployment)
function mdToHtml(src) {
  if (!src) return "";
  let s = String(src);
  // Escape HTML
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Code blocks ```...```
  s = s.replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${c.trim()}</code></pre>`);
  // Inline code `...`
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  // Bold **...**
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // Italic *...*
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  // Headings
  s = s.replace(/^###\s+(.+)$/gm, "<h4>$1</h4>");
  s = s.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^#\s+(.+)$/gm, "<h2>$1</h2>");
  // Links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Unordered lists
  s = s.replace(/(?:^|\n)((?:[-•]\s+.+(?:\n|$))+)/g, (m, block) => {
    const items = block.trim().split(/\n/).map(l => l.replace(/^[-•]\s+/, "").trim()).filter(Boolean);
    return "\n<ul>" + items.map(i => `<li>${i}</li>`).join("") + "</ul>";
  });
  // Ordered lists
  s = s.replace(/(?:^|\n)((?:\d+\.\s+.+(?:\n|$))+)/g, (m, block) => {
    const items = block.trim().split(/\n/).map(l => l.replace(/^\d+\.\s+/, "").trim()).filter(Boolean);
    return "\n<ol>" + items.map(i => `<li>${i}</li>`).join("") + "</ol>";
  });
  // Paragraphs from double newlines
  const blocks = s.split(/\n{2,}/).map(b => {
    if (/^\s*<(h\d|ul|ol|pre|blockquote)/.test(b)) return b;
    return "<p>" + b.replace(/\n/g, "<br>") + "</p>";
  });
  return blocks.join("\n");
}

// Try to extract suggestions from various n8n response shapes
function extractSuggestions(data) {
  if (!data) return [];
  const candidates = [
    data.suggestions,
    data.related,
    data.followups,
    data.followUps,
    data.next_questions,
    data.relatedQuestions,
    data.output?.suggestions,
    data.data?.suggestions,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) {
      return c.map(x => (typeof x === "string" ? x : x?.text || x?.question || x?.label)).filter(Boolean).slice(0, 6);
    }
  }
  // Try to parse from answer text: "**Có thể bạn quan tâm:**\n- q1\n- q2"
  const text = data.output || data.answer || data.text || data.message || "";
  if (typeof text === "string") {
    const m = text.match(/(?:có thể bạn quan tâm|related questions|gợi ý câu hỏi|suggested questions?)[:\s]*\n([\s\S]+?)(?:\n\n|$)/i);
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
    data.output ||
    data.answer ||
    data.text ||
    data.message ||
    data.response ||
    data.data?.output ||
    data.data?.answer ||
    JSON.stringify(data)
  );
}

// Strip the "related questions" tail if it appears in the answer body
function stripSuggestionsBlock(text) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/(?:\n+)(?:\*\*)?(?:có thể bạn quan tâm|related questions|gợi ý câu hỏi|suggested questions?)(?:\*\*)?[:\s]*\n[\s\S]+$/i, "").trim();
}

// ============ COMPONENTS ============

function TypingDots() {
  return (
    <span className="typing">
      <span></span><span></span><span></span>
    </span>
  );
}

function Logo() {
  return (
    <div className="logo">
      <div className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="20" height="20">
          <path d="M6 4 H20 A6 6 0 0 1 26 10 V13 A6 6 0 0 1 20 19 H12 V28 H6 Z" fill="currentColor"/>
        </svg>
      </div>
      <div className="logo-text">
        <div className="logo-name">PHS Legal</div>
      </div>
    </div>
  );
}

function SettingsModal({ open, onClose, webhook, setWebhook, t }) {
  const [val, setVal] = useState(webhook);
  useEffect(() => setVal(webhook), [webhook, open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{t.settingsTitle}</h3>
        <p className="modal-hint">{t.settingsHint}</p>
        <label className="field-label">{t.webhookLabel}</label>
        <input
          className="field-input"
          type="url"
          placeholder="https://your-n8n.example.com/webhook/xxxxx"
          value={val}
          onChange={e => setVal(e.target.value)}
          autoFocus
        />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t.cancel}</button>
          <button className="btn-primary" onClick={() => { setWebhook(val.trim()); onClose(); }}>{t.save}</button>
        </div>
      </div>
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
        <div className="msg-bubble msg-bubble-user">{msg.content}</div>
      </div>
    );
  }

  return (
    <div className="msg msg-bot">
      <div className="msg-avatar" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="14" height="14">
          <path d="M6 4 H20 A6 6 0 0 1 26 10 V13 A6 6 0 0 1 20 19 H12 V28 H6 Z" fill="currentColor"/>
        </svg>
      </div>
      <div className="msg-body">
        <div className="msg-meta">
          <span className="msg-author">{t.bot}</span>
          {msg.timestamp && <span className="msg-time">{msg.timestamp}</span>}
        </div>
        {msg.loading ? (
          <div className="msg-thinking">
            <TypingDots />
            <span className="thinking-label">{t.thinking}…</span>
          </div>
        ) : msg.error ? (
          <div className="msg-error">{msg.content}</div>
        ) : (
          <>
            <div className="msg-prose" dangerouslySetInnerHTML={{ __html: mdToHtml(msg.content) }} />
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
            {!msg.loading && msg.content && (
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

function Welcome({ t, onSuggestion }) {
  return (
    <div className="welcome">
      <div className="welcome-kicker">{t.welcomeKicker}</div>
      <h1 className="welcome-title">{t.welcomeTitle}</h1>
      <p className="welcome-body">{t.welcomeBody}</p>

      <div className="welcome-suggestions">
        <div className="suggestions-label">
          <span className="suggestions-line" aria-hidden="true"></span>
          <span>{t.suggestionsLabel}</span>
          <span className="suggestions-line" aria-hidden="true"></span>
        </div>
        <div className="suggestion-grid">
          {t.suggestions.map((s, i) => (
            <button key={i} className="suggestion-card" onClick={() => onSuggestion(s)}>
              <span className="suggestion-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="suggestion-text">{s}</span>
              <span className="suggestion-arrow">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ MAIN APP ============
function App() {
  const [lang, setLang] = useState(() => localStorage.getItem(STORAGE.lang) || "vi");
  const [webhook, setWebhookState] = useState(() => localStorage.getItem(STORAGE.webhook) || DEFAULT_WEBHOOK);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(STORAGE.session) || genSessionId());
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE.history);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const t = I18N[lang];
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE.lang, lang);
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => { localStorage.setItem(STORAGE.session, sessionId); }, [sessionId]);
  useEffect(() => { localStorage.setItem(STORAGE.history, JSON.stringify(messages.slice(-50))); }, [messages]);

  const setWebhook = useCallback((v) => {
    setWebhookState(v);
    localStorage.setItem(STORAGE.webhook, v);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 180) + "px";
    }
  }, [input]);

  const newChat = () => {
    setMessages([]);
    setSessionId(genSessionId());
    setInput("");
  };

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    const now = new Date();
    const ts = now.toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" });

    const userMsg = { id: "u_" + Date.now(), role: "user", content: text, timestamp: ts };
    const loadingMsg = { id: "b_" + Date.now(), role: "bot", content: "", loading: true };
    setMessages(m => [...m, userMsg, loadingMsg]);
    setInput("");
    setSending(true);

    if (!webhook) {
      setMessages(m => m.map(x => x.id === loadingMsg.id ? { ...x, loading: false, error: true, content: t.notConfigured } : x));
      setSending(false);
      setSettingsOpen(true);
      return;
    }

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
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const ctype = res.headers.get("content-type") || "";
      const data = ctype.includes("application/json") ? await res.json() : await res.text();

      const rawAnswer = extractAnswer(data);
      const suggestions = extractSuggestions(data);
      const cleanAnswer = stripSuggestionsBlock(rawAnswer);

      setMessages(m => m.map(x =>
        x.id === loadingMsg.id
          ? { ...x, loading: false, content: cleanAnswer, suggestions, timestamp: new Date().toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" }) }
          : x
      ));
    } catch (e) {
      console.error(e);
      setMessages(m => m.map(x => x.id === loadingMsg.id ? { ...x, loading: false, error: true, content: t.error } : x));
    } finally {
      setSending(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasChat = messages.length > 0;

  return (
    <div className="app" data-screen-label="Chat">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <Logo />
          <div className="header-right">
            <div className="lang-toggle" role="tablist" aria-label="Language">
              <button
                className={"lang-btn " + (lang === "vi" ? "is-active" : "")}
                onClick={() => setLang("vi")}
                role="tab"
                aria-selected={lang === "vi"}
              >VI</button>
              <button
                className={"lang-btn " + (lang === "en" ? "is-active" : "")}
                onClick={() => setLang("en")}
                role="tab"
                aria-selected={lang === "en"}
              >EN</button>
            </div>
            <button className="icon-btn" onClick={newChat} title={t.newChat} aria-label={t.newChat}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
            <button className="icon-btn" onClick={() => setSettingsOpen(true)} title={t.settings} aria-label={t.settings}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="main">
        <div className="scroll" ref={scrollRef}>
          <div className="container">
            {!hasChat ? (
              <Welcome t={t} onSuggestion={(s) => send(s)} />
            ) : (
              <div className="messages">
                {messages.map(m => (
                  <Message key={m.id} msg={m} t={t} onSuggestionClick={(s) => send(s)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="composer-wrap">
          <div className="container composer-container">
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
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </button>
            </div>
            <div className="composer-foot">
              <span className="foot-disclaimer">{t.disclaimer}</span>
              <span className="foot-session">{t.sessionId} · <code>{sessionId.slice(-8)}</code></span>
            </div>
          </div>
        </div>
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        webhook={webhook}
        setWebhook={setWebhook}
        t={t}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
