// --- Protection par code d'accès -------------------------------------
// L'espace est protégé par un code (invitation) transmis par email après
// paiement. Le code n'est jamais stocké en clair : seule son empreinte
// SHA-256 est comparée. Voir SETUP.md pour changer le code.
const ACCESS_HASH = "16f21255df3a6748b91b80c6fd367b83f2618c931e77562632dacb650600ec95";
const STORAGE_KEY = "mb_formation_access_v1";

// API du backend admin (verification de code par eleve + enregistrement des scores de quiz).
// Si l'API est indisponible, l'espace reste utilisable en mode local (sans suivi cote admin).
const API_BASE = "https://formation-admin-backend.onrender.com";
const STUDENT_TOKEN_KEY = "mb_student_token";

async function tryLinkStudentSession(rawCode) {
  try {
    const res = await fetch(`${API_BASE}/api/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: rawCode }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.valid && data.token) {
      localStorage.setItem(STUDENT_TOKEN_KEY, data.token);
      if (data.name) localStorage.setItem("mb_student_name", data.name);
    }
  } catch (err) {
    // API indisponible : on continue en mode local, sans bloquer l'eleve.
  }
}

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text.trim().toUpperCase());
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function showContent() {
  document.getElementById("gate").classList.add("private-hidden");
  document.getElementById("content").classList.remove("private-hidden");
}

async function checkCode(code) {
  if (!window.crypto || !window.crypto.subtle) {
    return { ok: false, reason: "secure-context" };
  }
  const hash = await sha256Hex(code);
  if (hash === ACCESS_HASH) return { ok: true, legacy: true };

  // Code individuel : verification cote serveur (console admin).
  try {
    const res = await fetch(`${API_BASE}/api/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.valid) return { ok: true, token: data.token, name: data.name };
  } catch (err) {
    // API indisponible : seul le code historique fonctionnera hors-ligne.
  }
  return { ok: false };
}

function initGate() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === ACCESS_HASH || localStorage.getItem(STUDENT_TOKEN_KEY)) {
    showContent();
    return;
  }

  const form = document.getElementById("gate-form");
  const input = document.getElementById("gate-input");
  const error = document.getElementById("gate-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";
    const result = await checkCode(input.value);
    if (result.reason === "secure-context") {
      error.textContent = "Cette page doit être ouverte via https ou un serveur local (pas en double-clic sur le fichier).";
      return;
    }
    if (result.ok) {
      if (result.token) {
        localStorage.setItem(STUDENT_TOKEN_KEY, result.token);
        if (result.name) localStorage.setItem("mb_student_name", result.name);
      } else {
        localStorage.setItem(STORAGE_KEY, ACCESS_HASH);
        if (result.legacy) tryLinkStudentSession(input.value);
      }
      showContent();
    } else {
      error.textContent = "Code invalide. Vérifiez l'email reçu après votre paiement.";
      input.value = "";
      input.focus();
    }
  });
}

function logout() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STUDENT_TOKEN_KEY);
  localStorage.removeItem("mb_student_name");
  location.reload();
}

// --- Onglets -----------------------------------------------------------
function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn[data-tab]");
  const panels = document.querySelectorAll(".tab-panel");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function initQuizSubTabs() {
  const buttons = document.querySelectorAll(".tab-btn[data-quiz-tab]");
  const panels = document.querySelectorAll(".quiz-panel");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.quizTab).classList.add("active");
    });
  });
}

// --- Fiches : sauvegarde locale + export --------------------------------
const FICHES_KEY = "mb_formation_fiches_v1";

function initFiches() {
  const fields = document.querySelectorAll("[data-fiche-field]");
  const saved = JSON.parse(localStorage.getItem(FICHES_KEY) || "{}");

  fields.forEach(field => {
    const key = field.dataset.ficheField;
    if (saved[key] !== undefined) field.value = saved[key];
    field.addEventListener("input", () => {
      const data = JSON.parse(localStorage.getItem(FICHES_KEY) || "{}");
      data[key] = field.value;
      localStorage.setItem(FICHES_KEY, JSON.stringify(data));
      const hint = document.getElementById("fiches-save-hint");
      if (hint) {
        hint.textContent = "Enregistré automatiquement ✓";
        clearTimeout(hint._t);
        hint._t = setTimeout(() => (hint.textContent = ""), 2000);
      }
    });
  });

  const downloadBtn = document.getElementById("download-fiches");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const data = JSON.parse(localStorage.getItem(FICHES_KEY) || "{}");
      let text = "MES FICHES DE FORMATION — michben\n" + "=".repeat(40) + "\n\n";
      document.querySelectorAll("[data-fiche-field]").forEach(field => {
        const label = field.closest(".fiche-field").querySelector("label").textContent;
        text += label + "\n" + (data[field.dataset.ficheField] || "(non renseigné)") + "\n\n";
      });
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mes-fiches-formation.txt";
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

// --- Quiz (3 types : Claude Code / Fly Connectome / Mixte) ---------------
const QUIZ_KEY_PREFIX = "mb_formation_quiz_";

async function submitQuizResult(quizType, score, total) {
  const token = localStorage.getItem(STUDENT_TOKEN_KEY);
  if (!token) return; // pas de suivi admin possible sans session eleve reconnue
  try {
    await fetch(`${API_BASE}/api/quiz-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, quiz_type: quizType, score, total }),
    });
  } catch (err) {
    // API indisponible : le score reste visible localement pour l'eleve.
  }
}

function initQuizForm(form) {
  const quizType = form.dataset.quizType;
  const total = Number(form.dataset.total);
  const panel = form.closest(".quiz-panel");
  const resultBox = panel.querySelector(".quiz-result");
  const scoreEl = resultBox.querySelector("[data-score-el]");
  const messageEl = resultBox.querySelector("[data-message-el]");
  const storageKey = QUIZ_KEY_PREFIX + quizType;

  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (saved) {
    Object.entries(saved).forEach(([name, value]) => {
      const input = form.querySelector(`input[name="${name}"][value="${value}"]`);
      if (input) input.checked = true;
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const questions = form.querySelectorAll(".quiz-question");
    let score = 0;
    const answers = {};

    questions.forEach((q) => {
      const name = q.querySelector("input").name;
      const correct = q.dataset.correct;
      const checked = form.querySelector(`input[name="${name}"]:checked`);
      const feedback = q.querySelector(".q-feedback");
      q.classList.remove("correct", "incorrect");

      if (!checked) {
        q.classList.add("incorrect");
        feedback.textContent = "Pas de réponse sélectionnée.";
        return;
      }
      answers[name] = checked.value;
      if (checked.value === correct) {
        score++;
        q.classList.add("correct");
        feedback.textContent = "✓ Bonne réponse";
      } else {
        q.classList.add("incorrect");
        const correctLabel = q.querySelector(`input[value="${correct}"]`).closest("label").textContent.trim();
        feedback.textContent = "✗ Réponse attendue : " + correctLabel;
      }
    });

    localStorage.setItem(storageKey, JSON.stringify(answers));
    submitQuizResult(quizType, score, total);

    scoreEl.textContent = score + " / " + total;
    animateCountUp(scoreEl, score, total);
    resultBox.classList.add("show");
    resultBox.classList.remove("tier-good", "tier-mid", "tier-low");

    const ratio = score / total;
    if (ratio >= 0.8) {
      resultBox.classList.add("tier-good");
      messageEl.textContent = "Excellent ! Vous maîtrisez bien ces notions. 🎉";
      launchConfetti(resultBox);
    } else if (ratio >= 0.5) {
      resultBox.classList.add("tier-mid");
      messageEl.textContent = "Bon travail. Relisez les modules où vous avez hésité avant de continuer.";
    } else {
      resultBox.classList.add("tier-low");
      messageEl.textContent = "Reprenez tranquillement les modules ci-dessus, puis retentez ce quiz.";
    }

    resultBox.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function initQuiz() {
  document.querySelectorAll(".quiz-form").forEach(initQuizForm);
}

document.addEventListener("DOMContentLoaded", () => {
  initGate();
  initTabs();
  initQuizSubTabs();
  initFiches();
  initQuiz();
  initScrollReveal();
  initTerminalAnim();
  initConnectomeAnim();
  initRewardGauge();
  initFileTreeAnim();
  initPromptReveal();
  initKanban();
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
});

// --- Petites animations pedagogiques ------------------------------------

function animateCountUp(el, target, total) {
  const duration = 600;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const current = Math.round(progress * target);
    el.textContent = current + " / " + total;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function launchConfetti(container) {
  const emojis = ["🎉", "✨", "🎊", "⭐"];
  container.style.position = "relative";
  for (let i = 0; i < 10; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    piece.style.left = 10 + Math.random() * 80 + "%";
    piece.style.top = "0px";
    piece.style.animationDelay = Math.random() * 0.3 + "s";
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 1600);
  }
}

function initScrollReveal() {
  const targets = document.querySelectorAll(".module, .card, .fiche-card, .price-card, .anim-terminal, .anim-connectome, .anim-gauge-wrap, .kanban-board, .anim-filetree, .anim-prompt-grid");
  targets.forEach((el) => el.classList.add("reveal"));

  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("in-view"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  targets.forEach((el) => observer.observe(el));
}

// Terminal progressif : tape une commande puis affiche son resultat.
function initTerminalAnim() {
  document.querySelectorAll(".anim-terminal").forEach((box) => {
    const lines = JSON.parse(box.dataset.lines || "[]");
    const body = box.querySelector(".anim-terminal-body");
    const replayBtn = box.querySelector(".anim-replay");
    let playing = false;

    async function play() {
      if (playing) return;
      playing = true;
      body.innerHTML = "";
      for (const line of lines) {
        const cmdLine = document.createElement("div");
        const prompt = document.createElement("span");
        prompt.textContent = "$ ";
        prompt.style.color = "#6bd1ff";
        cmdLine.appendChild(prompt);
        const cmdText = document.createElement("span");
        cmdLine.appendChild(cmdText);
        const cursor = document.createElement("span");
        cursor.className = "cursor";
        cmdLine.appendChild(cursor);
        body.appendChild(cmdLine);

        for (const ch of line.cmd) {
          cmdText.textContent += ch;
          await sleep(28);
        }
        cursor.remove();
        await sleep(250);

        if (line.out) {
          const outLine = document.createElement("div");
          outLine.className = "line-out";
          outLine.textContent = line.out;
          body.appendChild(outLine);
        }
        await sleep(350);
      }
      playing = false;
    }

    if (replayBtn) replayBtn.addEventListener("click", play);

    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              play();
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.4 }
      );
      obs.observe(box);
    } else {
      play();
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Flux neuronal : petit graphe connectome anime (3 sensoriels, 4 intermediaires, 2 moteurs).
function initConnectomeAnim() {
  const svgEl = document.getElementById("connectome-svg");
  if (!svgEl) return;

  const sensory = [{ x: 40, y: 40 }, { x: 40, y: 100 }, { x: 40, y: 160 }];
  const mid = [{ x: 190, y: 25 }, { x: 190, y: 75 }, { x: 190, y: 125 }, { x: 190, y: 175 }];
  const motor = [{ x: 340, y: 70 }, { x: 340, y: 130 }];

  const edges = [];
  sensory.forEach((s) => mid.forEach((m) => edges.push([s, m])));
  mid.forEach((m) => motor.forEach((mo) => edges.push([m, mo])));

  let running = false;
  let stopRequested = false;

  async function runOnce() {
    for (const [from, to] of edges) {
      if (stopRequested) return;
      await animateDot(svgEl, from, to, 260);
    }
  }

  async function loop() {
    if (running) return;
    running = true;
    stopRequested = false;
    while (!stopRequested) {
      await runOnce();
      await sleep(300);
    }
    running = false;
  }

  const playBtn = document.getElementById("connectome-play");
  const pauseBtn = document.getElementById("connectome-pause");
  const resetBtn = document.getElementById("connectome-reset");
  if (playBtn) playBtn.addEventListener("click", loop);
  if (pauseBtn) pauseBtn.addEventListener("click", () => { stopRequested = true; });
  if (resetBtn) resetBtn.addEventListener("click", () => {
    stopRequested = true;
    svgEl.querySelectorAll(".signal-dot").forEach((d) => d.remove());
  });
}

function animateDot(svgEl, from, to, duration) {
  return new Promise((resolve) => {
    const ns = "http://www.w3.org/2000/svg";
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("r", "5");
    dot.setAttribute("class", "signal-dot");
    dot.setAttribute("cx", from.x);
    dot.setAttribute("cy", from.y);
    svgEl.appendChild(dot);

    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      dot.setAttribute("cx", from.x + (to.x - from.x) * t);
      dot.setAttribute("cy", from.y + (to.y - from.y) * t);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        dot.remove();
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

// Jauge de recompense : illustre l'apprentissage par renforcement.
function initRewardGauge() {
  const wrap = document.querySelector(".anim-gauge-wrap");
  if (!wrap) return;
  const fill = wrap.querySelector(".anim-gauge-fill");
  const face = wrap.querySelector(".anim-gauge-face");
  let level = 50;

  function render() {
    fill.style.width = level + "%";
    face.textContent = level >= 75 ? "🤩" : level >= 50 ? "🙂" : level >= 25 ? "😐" : "😞";
    face.classList.add("bump");
    setTimeout(() => face.classList.remove("bump"), 250);
  }

  wrap.querySelectorAll("[data-reward]").forEach((btn) => {
    btn.addEventListener("click", () => {
      level = Math.max(0, Math.min(100, level + Number(btn.dataset.reward)));
      render();
    });
  });
  render();
}

// Fichiers qui se creent : arborescence qui apparait progressivement.
function initFileTreeAnim() {
  document.querySelectorAll(".anim-filetree").forEach((tree) => {
    const lines = tree.querySelectorAll(".file-line");
    const play = () => {
      lines.forEach((line, i) => {
        line.style.animationDelay = i * 0.18 + "s";
        line.style.animation = "none";
        void line.offsetWidth;
        line.style.animation = "";
      });
    };
    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { play(); obs.unobserve(entry.target); }
        });
      }, { threshold: 0.4 });
      obs.observe(tree);
    } else {
      play();
    }
  });
}

// Prompt avant/apres : revele la version structuree.
function initPromptReveal() {
  document.querySelectorAll("[data-prompt-reveal-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.promptRevealBtn);
      if (target) {
        target.classList.remove("hidden-reveal");
        btn.textContent = "✓ Version structurée révélée";
        btn.disabled = true;
      }
    });
  });
}

// Kanban de suivi : drag & drop entre colonnes, sauvegarde locale.
const KANBAN_KEY = "mb_kanban_v1";

function initKanban() {
  const board = document.querySelector(".kanban-board");
  if (!board) return;

  const saved = JSON.parse(localStorage.getItem(KANBAN_KEY) || "null");
  if (saved) {
    Object.entries(saved).forEach(([cardId, colId]) => {
      const card = document.getElementById(cardId);
      const col = document.querySelector(`[data-col="${colId}"] .kanban-cards`);
      if (card && col) col.appendChild(card);
    });
  }

  function saveState() {
    const state = {};
    board.querySelectorAll(".kanban-card").forEach((card) => {
      const col = card.closest("[data-col]");
      if (col) state[card.id] = col.dataset.col;
    });
    localStorage.setItem(KANBAN_KEY, JSON.stringify(state));
  }

  board.querySelectorAll(".kanban-card").forEach((card) => {
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", () => card.classList.add("dragging"));
    card.addEventListener("dragend", () => { card.classList.remove("dragging"); saveState(); });
  });

  board.querySelectorAll("[data-col]").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const dragging = board.querySelector(".dragging");
      if (dragging) col.querySelector(".kanban-cards").appendChild(dragging);
    });
  });
}
