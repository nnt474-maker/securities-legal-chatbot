"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Lang = "vi" | "en";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  ts: number;
}

const i18n = {
  vi: {
    appName: "Tư vấn pháp lý chứng khoán",
    placeholder: "Nhập câu hỏi của bạn...",
    send: "Gửi",
    reset: "Cuộc trò chuyện mới",
    disclaimer:
      "Thông tin chỉ mang tính tham khảo, không thay thế tư vấn từ luật sư",
    error: "Không thể kết nối, vui lòng thử lại",
    processing: "Đang xử lý...",
    welcome:
      "Xin chào! Tôi là trợ lý tư vấn pháp lý chứng khoán. Bạn có thể hỏi tôi về các quy định pháp luật liên quan đến thị trường chứng khoán Việt Nam.",
  },
  en: {
    appName: "Securities Legal Assistant",
    placeholder: "Type your question...",
    send: "Send",
    reset: "New conversation",
    disclaimer:
      "For reference only, does not replace professional legal advice",
    error: "Connection failed, please try again",
    processing: "Processing...",
    welcome:
      "Hello! I am your securities legal advisory assistant. Feel free to ask me about regulations related to the Vietnamese securities market.",
  },
};

function ScalesIcon({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="3" x2="12" y2="20" />
      <path d="M5 20h14" />
      <path d="M3 7l4 8c0 0-4 0-4-4s4-4 4-4" />
      <path d="M21 7l-4 8c0 0 4 0 4-4s-4-4-4-4" />
      <path d="M8 7h8" />
      <circle cx="12" cy="3" r="1" fill={color} stroke="none" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "4px 0" }}>
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
    </div>
  );
}

function extractSuggestions(text: string): { clean: string; suggestions: string[] } {
  const lines = text.split("\n");
  const suggestions: string[] = [];
  const rest: string[] = [];

  for (const line of lines) {
    const m = line.match(/^[•●]\s+(.+)$/);
    if (m) {
      suggestions.push(m[1].trim());
    } else {
      rest.push(line);
    }
  }

  return {
    clean: rest.join("\n").trim(),
    suggestions,
  };
}

export default function ChatInterface() {
  const [lang, setLang] = useState<Lang>("vi");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return crypto.randomUUID();
    }
    return "session-ssr";
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const t = i18n[lang];

  // Load language preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("chat_lang") as Lang | null;
    if (saved === "vi" || saved === "en") setLang(saved);
  }, []);

  // Show welcome message on first load or reset
  useEffect(() => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "bot",
        content: t.welcome,
        ts: Date.now(),
      },
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang === "vi" ? "vi" : "en"]); // re-run only when lang changes to repopulate welcome

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const switchLang = (next: Lang) => {
    setLang(next);
    localStorage.setItem("chat_lang", next);
  };

  const resetConversation = () => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "bot",
        content: i18n[lang].welcome,
        ts: Date.now(),
      },
    ]);
    setErrorMsg("");
    setInput("");
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setErrorMsg("");
      setInput("");

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatInput: trimmed, sessionId, lang }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const botMsg: Message = {
          id: crypto.randomUUID(),
          role: "bot",
          content: data.output ?? t.error,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } catch (err) {
        console.error(err);
        setErrorMsg(t.error);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading, sessionId, lang, t.error]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div style={styles.shell}>
      {/* ── HEADER ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoCircle}>
            <ScalesIcon size={26} color="#C9A84C" />
          </div>
          <span style={styles.appName}>{t.appName}</span>
        </div>

        <div style={styles.headerRight}>
          <button
            style={styles.resetBtn}
            onClick={resetConversation}
            title={t.reset}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
            </svg>
            <span style={styles.resetLabel}>{t.reset}</span>
          </button>

          {/* Language toggle */}
          <div style={styles.langToggle}>
            <button
              style={{ ...styles.langBtn, ...(lang === "vi" ? styles.langBtnActive : {}) }}
              onClick={() => switchLang("vi")}
            >
              VIE
            </button>
            <button
              style={{ ...styles.langBtn, ...(lang === "en" ? styles.langBtnActive : {}) }}
              onClick={() => switchLang("en")}
            >
              ENG
            </button>
          </div>
        </div>
      </header>

      {/* ── MESSAGES ── */}
      <main style={styles.chatArea}>
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const { clean, suggestions } = isUser
            ? { clean: msg.content, suggestions: [] }
            : extractSuggestions(msg.content);

          return (
            <div
              key={msg.id}
              className="msg-enter"
              style={{
                ...styles.msgRow,
                flexDirection: isUser ? "row-reverse" : "row",
              }}
            >
              {/* Bot avatar */}
              {!isUser && (
                <div style={styles.avatar}>
                  <ScalesIcon size={18} color="#1B3A6B" />
                </div>
              )}

              <div style={{ maxWidth: "75%", minWidth: 60 }}>
                <div
                  style={{
                    ...styles.bubble,
                    ...(isUser ? styles.userBubble : styles.botBubble),
                  }}
                >
                  {isUser ? (
                    <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                  ) : (
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {clean}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Suggestion chips */}
                {suggestions.length > 0 && (
                  <div style={styles.suggestions}>
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        style={styles.suggestionChip}
                        onClick={() => sendMessage(s)}
                        disabled={loading}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading && (
          <div className="msg-enter" style={{ ...styles.msgRow, flexDirection: "row" }}>
            <div style={styles.avatar}>
              <ScalesIcon size={18} color="#1B3A6B" />
            </div>
            <div style={{ ...styles.bubble, ...styles.botBubble }}>
              <LoadingDots />
            </div>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div style={styles.errorBanner}>
            <span>⚠ {errorMsg}</span>
            <button style={styles.errorClose} onClick={() => setErrorMsg("")}>✕</button>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── INPUT AREA ── */}
      <footer style={styles.footer}>
        <p style={styles.disclaimer}>{t.disclaimer}</p>
        <div style={styles.inputRow}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={loading ? t.processing : t.placeholder}
            disabled={loading}
            rows={1}
            style={styles.textarea}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              ...styles.sendBtn,
              opacity: loading || !input.trim() ? 0.5 : 1,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            }}
            aria-label={t.send}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}

// ── Inline styles ──────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    maxWidth: 860,
    margin: "0 auto",
    background: "#ffffff",
    boxShadow: "0 0 40px rgba(27,58,107,0.10)",
  },

  // Header
  header: {
    background: "#1B3A6B",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    height: 64,
    flexShrink: 0,
    gap: 12,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  appName: {
    fontWeight: 700,
    fontSize: "1rem",
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  resetBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 6,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: "0.78rem",
    fontWeight: 500,
    transition: "background 0.15s",
    whiteSpace: "nowrap",
  },
  resetLabel: {
    display: "inline",
  },
  langToggle: {
    display: "flex",
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.3)",
  },
  langBtn: {
    padding: "5px 10px",
    background: "transparent",
    color: "rgba(255,255,255,0.7)",
    border: "none",
    cursor: "pointer",
    fontSize: "0.78rem",
    fontWeight: 600,
    letterSpacing: 0.5,
    transition: "background 0.15s, color 0.15s",
  },
  langBtnActive: {
    background: "#C9A84C",
    color: "#fff",
  },

  // Chat
  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    background: "#f8fafc",
  },
  msgRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    border: "1.5px solid #cbd5e1",
  },
  bubble: {
    padding: "10px 14px",
    borderRadius: 16,
    fontSize: "0.95rem",
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  userBubble: {
    background: "#1B3A6B",
    color: "#fff",
    borderBottomRightRadius: 4,
  },
  botBubble: {
    background: "#fff",
    color: "#1e293b",
    border: "1px solid #e2e8f0",
    borderBottomLeftRadius: 4,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },

  // Suggestions
  suggestions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    paddingLeft: 4,
  },
  suggestionChip: {
    background: "#fff",
    border: "1.5px solid #1B3A6B",
    color: "#1B3A6B",
    borderRadius: 20,
    padding: "4px 12px",
    fontSize: "0.82rem",
    cursor: "pointer",
    fontWeight: 500,
    transition: "background 0.15s, color 0.15s",
    textAlign: "left",
  },

  // Error
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: 8,
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "0.88rem",
  },
  errorClose: {
    background: "none",
    border: "none",
    color: "#dc2626",
    cursor: "pointer",
    fontWeight: 700,
    padding: "0 4px",
  },

  // Footer
  footer: {
    borderTop: "1px solid #e2e8f0",
    background: "#fff",
    padding: "10px 16px 14px",
    flexShrink: 0,
  },
  disclaimer: {
    fontSize: "0.72rem",
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 8,
    fontStyle: "italic",
  },
  inputRow: {
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    border: "1.5px solid #e2e8f0",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: "0.95rem",
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
    maxHeight: 120,
    overflowY: "auto",
    transition: "border-color 0.15s",
    background: "#f8fafc",
    color: "#1e293b",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#1B3A6B",
    color: "#fff",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background 0.15s, opacity 0.15s",
  },
};
