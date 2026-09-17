(function () {
  const API_BASE = "https://formation-admin-backend.onrender.com";
  const VISITOR_KEY = "mb_chat_visitor_id";
  const SEEN_KEY = "mb_chat_seen_count";

  function getVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  function buildWidget() {
    const bubble = document.createElement("button");
    bubble.className = "mb-chat-bubble";
    bubble.setAttribute("aria-label", "Ouvrir le chat");
    bubble.innerHTML = '💬<span class="mb-chat-dot"></span>';

    const panel = document.createElement("div");
    panel.className = "mb-chat-panel";
    panel.innerHTML = `
      <div class="mb-chat-header">
        <span>💬 Une question ?</span>
        <button type="button" class="mb-chat-close" aria-label="Fermer">✕</button>
      </div>
      <div class="mb-chat-body"></div>
      <form class="mb-chat-form">
        <input type="text" placeholder="Votre message..." autocomplete="off" required>
        <button type="submit">➤</button>
      </form>
    `;

    document.body.appendChild(bubble);
    document.body.appendChild(panel);
    return { bubble, panel };
  }

  function renderMessages(body, messages) {
    body.innerHTML = "";
    if (messages.length === 0) {
      const hello = document.createElement("div");
      hello.className = "mb-chat-msg agent";
      hello.textContent = "Bonjour ! 👋 Posez votre question, je réponds automatiquement si possible, sinon michben vous répondra ici.";
      body.appendChild(hello);
    }
    messages.forEach((m) => {
      const div = document.createElement("div");
      div.className = "mb-chat-msg " + m.sender;
      if (m.sender !== "visitor") {
        const label = document.createElement("span");
        label.className = "mb-chat-sender";
        label.textContent = m.sender === "admin" ? "michben" : "Assistant";
        div.appendChild(label);
      }
      div.appendChild(document.createTextNode(m.body));
      body.appendChild(div);
    });
    body.scrollTop = body.scrollHeight;
  }

  async function fetchMessages(visitorId) {
    try {
      const res = await fetch(`${API_BASE}/api/chat/messages?visitor_id=${encodeURIComponent(visitorId)}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      return [];
    }
  }

  function init() {
    const { bubble, panel } = buildWidget();
    const body = panel.querySelector(".mb-chat-body");
    const form = panel.querySelector(".mb-chat-form");
    const input = form.querySelector("input");
    const visitorId = getVisitorId();
    let pollTimer = null;

    async function refresh(scroll) {
      const messages = await fetchMessages(visitorId);
      renderMessages(body, messages);
      const seen = Number(localStorage.getItem(SEEN_KEY) || "0");
      if (!panel.classList.contains("open") && messages.length > seen) {
        bubble.classList.add("has-unread");
      }
      return messages;
    }

    function markSeen(count) {
      localStorage.setItem(SEEN_KEY, String(count));
      bubble.classList.remove("has-unread");
    }

    bubble.addEventListener("click", async () => {
      const opening = !panel.classList.contains("open");
      panel.classList.toggle("open");
      if (opening) {
        const messages = await refresh();
        markSeen(messages.length);
        input.focus();
        if (!pollTimer) pollTimer = setInterval(async () => {
          const msgs = await refresh();
          if (panel.classList.contains("open")) markSeen(msgs.length);
        }, 6000);
      }
    });

    panel.querySelector(".mb-chat-close").addEventListener("click", () => {
      panel.classList.remove("open");
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      input.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/api/chat/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitor_id: visitorId, body: text }),
        });
        const data = await res.json();
        const messages = await fetchMessages(data.visitor_id || visitorId);
        renderMessages(body, messages);
        markSeen(messages.length);
      } catch (err) {
        const errDiv = document.createElement("div");
        errDiv.className = "mb-chat-msg agent";
        errDiv.textContent = "Message non envoyé (connexion indisponible). Réessayez dans un instant.";
        body.appendChild(errDiv);
      } finally {
        input.disabled = false;
        input.focus();
      }
    });

    // Verifie discretement en arriere-plan (toutes les 25s) si une reponse admin est arrivee.
    setInterval(async () => {
      if (panel.classList.contains("open")) return;
      const messages = await fetchMessages(visitorId);
      const seen = Number(localStorage.getItem(SEEN_KEY) || "0");
      if (messages.length > seen) bubble.classList.add("has-unread");
    }, 25000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
