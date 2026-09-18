(function () {
  const KEY = "mb_cookie_consent";
  if (localStorage.getItem(KEY)) return;

  const scriptEl = document.currentScript;
  const policyHref = (scriptEl && scriptEl.dataset.policyHref) || "politique-confidentialite.html";

  const banner = document.createElement("div");
  banner.className = "cookie-banner";
  banner.innerHTML = `
    <div class="cookie-banner-inner">
      <p>🍪 Ce site utilise des cookies et un stockage local nécessaires à son fonctionnement (espace formation, quiz, chat) et pour mesurer sa fréquentation.
        <a href="${policyHref}" target="_blank" rel="noopener">En savoir plus</a>
      </p>
      <div class="cookie-banner-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-cookie-choice="refuse">Refuser</button>
        <button type="button" class="btn btn-primary btn-sm" data-cookie-choice="accept">Tout accepter</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);

  banner.querySelectorAll("[data-cookie-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      localStorage.setItem(KEY, btn.dataset.cookieChoice === "accept" ? "accepted" : "refused");
      banner.remove();
    });
  });
})();
