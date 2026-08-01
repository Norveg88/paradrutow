/* Подписка на рассылку — Kit
   Окно создаётся здесь, а не в разметке: так форма есть на всех страницах,
   и её не нужно дублировать в каждом HTML-файле.
   Скрипт подключён с defer после lang.js, поэтому окно успевает
   появиться в DOM до того, как lang.js начнёт переводить страницу. */

const KIT_FORM = "https://app.kit.com/forms/9752061/subscriptions";

(function buildModal() {
    if (document.getElementById("news-modal")) return;

    const wrap = document.createElement("div");
    wrap.id = "news-modal";
    wrap.className = "news-modal";
    wrap.hidden = true;
    wrap.innerHTML = `
        <div class="news-modal-box news-card" role="dialog" aria-modal="true" aria-labelledby="news-modal-title">
            <button type="button" class="news-modal-close" aria-label="Zamknij">&times;</button>
            <h2 class="news-head" id="news-modal-title" data-i18n="news_title">Bądź na bieżąco</h2>
            <p class="news-desc" data-i18n="news_desc">Zapisz się, a napiszemy, gdy pojawią się nowe wzory, książki, filmy albo aktualizacje aplikacji.</p>
            <form class="news-form" action="${KIT_FORM}" method="post" novalidate>
                <input type="text" class="news-trap" tabindex="-1" autocomplete="off" aria-hidden="true">
                <div class="news-row">
                    <input type="email" class="news-input" name="email_address" required
                           data-i18n-placeholder="news_placeholder" placeholder="Twój adres e-mail" aria-label="E-mail">
                    <button type="submit" class="news-btn" data-i18n="news_button">Zapisz się</button>
                </div>
                <label class="news-consent">
                    <input type="checkbox" required>
                    <span data-i18n="news_consent">Chcę otrzymywać informacje o nowościach Para Drutów na podany adres e-mail.</span>
                </label>
            </form>
            <p class="news-msg news-msg--ok" data-i18n="news_success" hidden>Sprawdź skrzynkę — wysłaliśmy link potwierdzający.</p>
            <p class="news-msg news-msg--err" data-i18n="news_error" hidden>Coś poszło nie tak. Spróbuj jeszcze raz.</p>
        </div>`;
    document.body.appendChild(wrap);
})();

document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("news-modal");
    let lastFocused = null;

    const openModal = (e) => {
        if (e) e.preventDefault();
        lastFocused = document.activeElement;
        modal.hidden = false;
        document.body.style.overflow = "hidden";
        const field = modal.querySelector(".news-input");
        if (field) setTimeout(() => field.focus(), 50);
    };

    const closeModal = () => {
        modal.hidden = true;
        document.body.style.overflow = "";
        if (lastFocused) lastFocused.focus();
    };

    document.querySelectorAll(".js-news-open").forEach(el => el.addEventListener("click", openModal));
    modal.querySelector(".news-modal-close").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.hidden) closeModal();
    });

    // --- Отправка (и встроенные формы, и форма в окне) ---
    document.querySelectorAll(".news-form").forEach(form => {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const card    = form.closest(".news-card");
            const okMsg   = card.querySelector(".news-msg--ok");
            const errMsg  = card.querySelector(".news-msg--err");
            const btn     = form.querySelector(".news-btn");
            const input   = form.querySelector("input[type=email]");
            const consent = form.querySelector("input[type=checkbox]");
            const trap    = form.querySelector(".news-trap");

            // Ловушка для ботов: поле скрыто, люди его не заполняют
            if (trap && trap.value) return;

            if (consent && !consent.checked) {
                consent.focus();
                return;
            }

            errMsg.hidden = true;
            const label = btn.textContent;
            btn.disabled = true;
            btn.textContent = "…";

            const fd = new FormData();
            fd.append("email_address", input.value.trim());
            fd.append("fields[language]", localStorage.getItem("lang") || "pl");

            const fail = () => {
                errMsg.hidden = false;
                btn.disabled = false;
                btn.textContent = label;
            };

            try {
                const res  = await fetch(form.action, {
                    method: "POST",
                    body: fd,
                    headers: { "Accept": "application/json" }
                });
                const data = await res.json().catch(() => ({}));

                if (res.ok && data.status !== "error") {
                    form.hidden = true;
                    okMsg.hidden = false;
                } else {
                    fail();
                }
            } catch (err) {
                fail();
            }
        });
    });
});
