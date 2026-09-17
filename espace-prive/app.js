// --- Protection par code d'accès -------------------------------------
// L'espace est protégé par un code (invitation) transmis par email après
// paiement. Le code n'est jamais stocké en clair : seule son empreinte
// SHA-256 est comparée. Voir SETUP.md pour changer le code.
const ACCESS_HASH = "16f21255df3a6748b91b80c6fd367b83f2618c931e77562632dacb650600ec95";
const STORAGE_KEY = "mb_formation_access_v1";

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
  return { ok: hash === ACCESS_HASH };
}

function initGate() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === ACCESS_HASH) {
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
      localStorage.setItem(STORAGE_KEY, ACCESS_HASH);
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
  location.reload();
}

// --- Onglets -----------------------------------------------------------
function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
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

document.addEventListener("DOMContentLoaded", () => {
  initGate();
  initTabs();
  initFiches();
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
});
