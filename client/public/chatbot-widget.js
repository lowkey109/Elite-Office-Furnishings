
/**
 * The Corporate Desk — AI Chatbot Widget
 * Embed on any website with a single <script> tag:
 *   <script src="https://app.thecorporatedesk.com.au/chatbot-widget.js" defer></script>
 *
 * The API base URL is auto-detected from this script's own src attribute,
 * so it works correctly from any domain hosting this file.
 */
(function () {
  "use strict";

  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || "";
  const API_BASE = SCRIPT_SRC
    ? new URL(SCRIPT_SRC).origin
    : "https://app.thecorporatedesk.com.au";

  const GOLD = "#C9A84C";
  const GOLD_LIGHT = "#D4B96A";
  const BG_DARK = "#0a0c11";
  const BG_PANEL = "#10131a";
  const BG_MSG = "#161b24";
  const TEXT_WHITE = "rgba(255,255,255,0.88)";
  const TEXT_DIM = "rgba(255,255,255,0.45)";
  const BORDER = "rgba(201,168,76,0.15)";

  const GREETING =
    "Welcome to The Corporate Desk. I'm your AI consultant — here to help with products, pricing, office fitouts, and more. What can I help you with today?";

  const QUICK_REPLIES = [
    { label: "Product pricing", value: "What are your pricing ranges for a typical office fitout?" },
    { label: "Lead times", value: "What are your typical lead times for delivery and installation?" },
    { label: "Get a quote", value: "I'd like to request a quote for my project." },
    { label: "ISO certified?", value: "What certifications do you have?" },
  ];

  let messages = [];
  let isOpen = false;
  let isStreaming = false;
  let quickRepliesShown = false;

  // ─── Inject Styles ──────────────────────────────────────────────────────────

  const style = document.createElement("style");
  style.textContent = `
    #tcd-widget-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999998;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${GOLD};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px rgba(201,168,76,0.4);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #tcd-widget-btn:hover { transform: scale(1.08); box-shadow: 0 6px 32px rgba(201,168,76,0.55); }
    #tcd-widget-btn svg { width: 24px; height: 24px; fill: ${BG_DARK}; }
    #tcd-widget-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #ef4444;
      border: 2px solid ${BG_DARK};
      display: none;
    }
    #tcd-widget-panel {
      position: fixed;
      bottom: 92px;
      right: 24px;
      z-index: 999999;
      width: 360px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 120px);
      background: ${BG_PANEL};
      border: 1px solid ${BORDER};
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 16px 64px rgba(0,0,0,0.7);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
      transition: opacity 0.2s, transform 0.2s;
    }
    #tcd-widget-panel.tcd-hidden { opacity: 0; transform: translateY(12px) scale(0.97); pointer-events: none; }
    #tcd-widget-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid ${BORDER};
      background: rgba(201,168,76,0.05);
    }
    #tcd-widget-header-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(201,168,76,0.12);
      border: 1px solid rgba(201,168,76,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #tcd-widget-header-avatar svg { width: 16px; height: 16px; fill: ${GOLD}; }
    #tcd-widget-header-info { flex: 1; }
    #tcd-widget-header-name {
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.02em;
    }
    #tcd-widget-header-sub {
      font-size: 11px;
      color: ${TEXT_DIM};
      margin-top: 1px;
    }
    #tcd-widget-close {
      background: none;
      border: none;
      cursor: pointer;
      color: ${TEXT_DIM};
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: color 0.15s;
    }
    #tcd-widget-close:hover { color: #ffffff; }
    #tcd-widget-close svg { width: 18px; height: 18px; fill: currentColor; }
    #tcd-widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 0;
      min-height: 200px;
      max-height: 340px;
      scroll-behavior: smooth;
    }
    #tcd-widget-messages::-webkit-scrollbar { width: 4px; }
    #tcd-widget-messages::-webkit-scrollbar-track { background: transparent; }
    #tcd-widget-messages::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.2); border-radius: 2px; }
    .tcd-msg { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 14px; }
    .tcd-msg.tcd-user { flex-direction: row-reverse; }
    .tcd-msg-avatar {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: rgba(201,168,76,0.12);
      border: 1px solid rgba(201,168,76,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .tcd-msg-avatar svg { width: 12px; height: 12px; fill: ${GOLD}; }
    .tcd-msg-bubble {
      max-width: 82%;
      padding: 10px 13px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.55;
    }
    .tcd-msg.tcd-assistant .tcd-msg-bubble {
      background: ${BG_MSG};
      border: 1px solid rgba(201,168,76,0.1);
      color: ${TEXT_WHITE};
      border-bottom-left-radius: 4px;
    }
    .tcd-msg.tcd-user .tcd-msg-bubble {
      background: ${GOLD};
      color: ${BG_DARK};
      font-weight: 600;
      border-bottom-right-radius: 4px;
    }
    .tcd-streaming::after {
      content: '▋';
      color: ${GOLD};
      animation: tcd-blink 0.8s step-end infinite;
    }
    @keyframes tcd-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
    .tcd-typing {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 10px 13px;
      background: ${BG_MSG};
      border: 1px solid rgba(201,168,76,0.1);
      border-radius: 14px;
      border-bottom-left-radius: 4px;
    }
    .tcd-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${GOLD};
      animation: tcd-bounce 1.2s infinite;
    }
    .tcd-dot:nth-child(2) { animation-delay: 0.2s; }
    .tcd-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes tcd-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }
    #tcd-widget-quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 14px 10px;
    }
    .tcd-qr-btn {
      background: rgba(201,168,76,0.08);
      border: 1px solid rgba(201,168,76,0.22);
      color: ${GOLD_LIGHT};
      font-size: 11px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 20px;
      cursor: pointer;
      transition: background 0.15s;
      font-family: inherit;
    }
    .tcd-qr-btn:hover { background: rgba(201,168,76,0.18); }
    #tcd-widget-input-row {
      display: flex;
      gap: 8px;
      padding: 12px 14px;
      border-top: 1px solid ${BORDER};
      background: rgba(0,0,0,0.2);
    }
    #tcd-widget-input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 9px 12px;
      font-size: 13px;
      color: #ffffff;
      outline: none;
      font-family: inherit;
      transition: border-color 0.15s;
      resize: none;
    }
    #tcd-widget-input::placeholder { color: ${TEXT_DIM}; }
    #tcd-widget-input:focus { border-color: rgba(201,168,76,0.4); }
    #tcd-widget-send {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: ${GOLD};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.15s;
      align-self: flex-end;
    }
    #tcd-widget-send:disabled { opacity: 0.45; cursor: not-allowed; }
    #tcd-widget-send svg { width: 16px; height: 16px; fill: ${BG_DARK}; }
    #tcd-widget-footer {
      text-align: center;
      padding: 6px 14px 10px;
      font-size: 10px;
      color: ${TEXT_DIM};
    }
    #tcd-widget-footer a { color: rgba(201,168,76,0.6); text-decoration: none; }
    @media (max-width: 400px) {
      #tcd-widget-panel { right: 12px; bottom: 84px; width: calc(100vw - 24px); }
      #tcd-widget-btn { right: 16px; bottom: 16px; }
    }
  `;
  document.head.appendChild(style);

  // ─── Build DOM ──────────────────────────────────────────────────────────────

  const btn = document.createElement("button");
  btn.id = "tcd-widget-btn";
  btn.setAttribute("aria-label", "Open The Corporate Desk AI chat");
  btn.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    <span id="tcd-widget-badge"></span>
  `;

  const panel = document.createElement("div");
  panel.id = "tcd-widget-panel";
  panel.className = "tcd-hidden";
  panel.innerHTML = `
    <div id="tcd-widget-header">
      <div id="tcd-widget-header-avatar">
        <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      </div>
      <div id="tcd-widget-header-info">
        <div id="tcd-widget-header-name">The Corporate Desk AI</div>
        <div id="tcd-widget-header-sub">Office Furniture Consultant · Online now</div>
      </div>
      <button id="tcd-widget-close" aria-label="Close chat">
        <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
      </button>
    </div>
    <div id="tcd-widget-messages"></div>
    <div id="tcd-widget-quick-replies"></div>
    <div id="tcd-widget-input-row">
      <textarea id="tcd-widget-input" placeholder="Ask about products, pricing, fitouts…" rows="1" maxlength="500"></textarea>
      <button id="tcd-widget-send" aria-label="Send">
        <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      </button>
    </div>
    <div id="tcd-widget-footer">Powered by <a href="https://thecorporatedesk.com.au" target="_blank">The Corporate Desk</a></div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // ─── References ─────────────────────────────────────────────────────────────
  const messagesEl = document.getElementById("tcd-widget-messages");
  const inputEl = document.getElementById("tcd-widget-input");
  const sendBtn = document.getElementById("tcd-widget-send");
  const badge = document.getElementById("tcd-widget-badge");
  const qrContainer = document.getElementById("tcd-widget-quick-replies");

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function scrollToBottom() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function createAvatar() {
    const av = document.createElement("div");
    av.className = "tcd-msg-avatar";
    av.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="${GOLD}" stroke-width="1.5" fill="none"/></svg>`;
    return av;
  }

  function appendMessage(role, content, streaming) {
    const row = document.createElement("div");
    row.className = "tcd-msg tcd-" + role;
    const bubble = document.createElement("div");
    bubble.className = "tcd-msg-bubble" + (streaming ? " tcd-streaming" : "");
    bubble.textContent = content;
    if (role === "assistant") {
      row.appendChild(createAvatar());
    }
    row.appendChild(bubble);
    if (messagesEl) messagesEl.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  function appendTyping() {
    const row = document.createElement("div");
    row.className = "tcd-msg tcd-assistant";
    row.id = "tcd-typing-row";
    const typing = document.createElement("div");
    typing.className = "tcd-typing";
    for (let i = 0; i < 3; i++) {
      const d = document.createElement("span");
      d.className = "tcd-dot";
      typing.appendChild(d);
    }
    row.appendChild(createAvatar());
    row.appendChild(typing);
    if (messagesEl) messagesEl.appendChild(row);
    scrollToBottom();
    return row;
  }

  function removeTyping() {
    const el = document.getElementById("tcd-typing-row");
    if (el) el.remove();
  }

  function showQuickReplies(replies) {
    if (!qrContainer) return;
    qrContainer.innerHTML = "";
    replies.forEach(function (qr) {
      const b = document.createElement("button");
      b.className = "tcd-qr-btn";
      b.textContent = qr.label;
      b.onclick = function () {
        qrContainer.innerHTML = "";
        sendMessage(qr.value);
      };
      qrContainer.appendChild(b);
    });
  }

  function setInputEnabled(enabled) {
    if (inputEl) inputEl.disabled = !enabled;
    if (sendBtn) sendBtn.disabled = !enabled;
    isStreaming = !enabled;
  }

  // ─── Send Message ───────────────────────────────────────────────────────────

  async function sendMessage(text) {
    const content = (text || (inputEl && inputEl.value) || "").trim();
    if (!content || isStreaming) return;
    if (inputEl) inputEl.value = "";
    if (qrContainer) qrContainer.innerHTML = "";

    messages.push({ role: "user", content: content });
    appendMessage("user", content, false);
    setInputEnabled(false);
    appendTyping();

    try {
      const response = await fetch(API_BASE + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages, stream: true }),
      });

      if (!response.ok) throw new Error("API error " + response.status);

      removeTyping();
      const bubble = appendMessage("assistant", "", true);
      let fullContent = "";

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const json = part.slice(6).trim();
          if (!json) continue;
          try {
            const parsed = JSON.parse(json);
            if (parsed.done) break;
            if (parsed.content) {
              fullContent += parsed.content;
              bubble.textContent = fullContent;
              scrollToBottom();
            }
          } catch (_) {}
        }
      }

      bubble.classList.remove("tcd-streaming");
      bubble.textContent = fullContent || "I'm sorry, I couldn't generate a response. Please try again.";
      messages.push({ role: "assistant", content: fullContent });

      if (!quickRepliesShown && messages.length >= 4) {
        quickRepliesShown = true;
        showQuickReplies([
          { label: "Get a free layout plan", value: "I'd like a free office layout plan." },
          { label: "Request a quote", value: "I'd like to request a formal quote for my project." },
          { label: "Book a strategy call", value: "I'd like to book a workplace strategy call." },
        ]);
      }
    } catch (err) {
      removeTyping();
      appendMessage("assistant", "Sorry, I'm having trouble connecting right now. Please call us on 1300 977 607 or email service@thecorporatedesk.com.au.", false);
      console.error("[TCD Widget]", err);
    } finally {
      setInputEnabled(true);
      if (inputEl) inputEl.focus();
    }
  }

  // ─── Open / Close ────────────────────────────────────────────────────────────

  function openWidget() {
    isOpen = true;
    panel.classList.remove("tcd-hidden");
    if (badge) badge.style.display = "none";
    if (inputEl) setTimeout(function () { inputEl.focus(); }, 150);

    if (messages.length === 0) {
      setTimeout(function () {
        appendMessage("assistant", GREETING, false);
        showQuickReplies(QUICK_REPLIES);
      }, 200);
    }
  }

  function closeWidget() {
    isOpen = false;
    panel.classList.add("tcd-hidden");
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  btn.addEventListener("click", function () {
    isOpen ? closeWidget() : openWidget();
  });

  document.getElementById("tcd-widget-close").addEventListener("click", closeWidget);

  sendBtn.addEventListener("click", function () { sendMessage(); });

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 100) + "px";
  });

  // Show unread badge after 8 seconds if widget hasn't been opened
  setTimeout(function () {
    if (!isOpen && badge) {
      badge.style.display = "block";
    }
  }, 8000);
})();
