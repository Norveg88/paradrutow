/* =====================================================
   ui.js — Fade-in, Back to top, Contact form
   ===================================================== */

// -----------------------------------------
// 1. FADE-IN карточек при скролле
// -----------------------------------------
function initFadeIn() {
    // Появление как раньше — когда в кадр вошло 10% высоты блока, — но требуя
    // не больше MAX_PX. У очень длинных карточек (песенка на главной) 10% это
    // сотни пикселей: на невысоких экранах блок не успевал проявиться до
    // прокрутки и снизу оставалась пустота. Короткие карточки не меняются:
    // для них 10% и так меньше порога в пикселях.
    const MAX_PX = 160;
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const reveal = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target); // один раз — и хватит
            }
        });
    };

    document.querySelectorAll(".card.glass-card, .app-hero, .feature-image-wrapper, .yt-card, .section-tile, .why-card, .song-card").forEach((el, i) => {
        el.style.transitionDelay = `${i * 60}ms`; // каскадная задержка
        // Всё, что хотя бы краем видно на первом экране при открытии, проявляется
        // сразу, не дожидаясь прокрутки. Иначе песенка на главной, выглядывая
        // из-под баннера узкой полоской, ждала свайпа.
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.top < viewportH && r.bottom > 0) {
            requestAnimationFrame(() => el.classList.add("visible"));
            return;
        }
        const h = el.offsetHeight;
        const threshold = h > 0 ? Math.min(0.1, MAX_PX / h) : 0.1;
        new IntersectionObserver(reveal, {
            threshold,
            rootMargin: "0px 0px -40px 0px"
        }).observe(el);
    });
}

// -----------------------------------------
// 2. КНОПКА "НАВЕРХ"
// -----------------------------------------
function initBackToTop() {
    const btn = document.getElementById("back-to-top");
    if (!btn) return;

    window.addEventListener("scroll", () => {
        btn.classList.toggle("visible", window.scrollY > 400);
    }, { passive: true });

    btn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// -----------------------------------------
// 3. ФОРМА КОНТАКТА — Formspree
// -----------------------------------------
function initContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector("button[type=submit]");
        const originalText = submitBtn.textContent;

        // Блокируем кнопку
        submitBtn.disabled = true;
        submitBtn.textContent = "⏳ ...";

        try {
            // Тема письма с именем и адресом посетителя — чтобы в ящике
            // было видно, кто написал, не открывая письмо. Скрытое поле
            // _subject в разметке остаётся запасным вариантом.
            const data = new FormData(form);
            const name = (data.get("name") || "").toString().trim().slice(0, 60);
            const email = (data.get("email") || "").toString().trim().slice(0, 80);
            const topic = (data.get("topic") || "").toString();
            const pageLang = (document.documentElement.lang || "pl").toUpperCase();
            const tag = (topic ? ` [${topic}]` : "") + (pageLang !== "PL" ? ` [${pageLang}]` : "");
            if (name || email) {
                const who = name && email ? `${name} (${email})` : (name || email);
                data.set("_subject", `Wiadomość od ${who} — paradrutow.com${tag}`);
            }

            const response = await fetch(form.action, {
                method: "POST",
                body: data,
                headers: { "Accept": "application/json" }
            });

            if (response.ok) {
                showFormMessage(form, "success");
                form.reset();
            } else {
                showFormMessage(form, "error");
            }
        } catch {
            showFormMessage(form, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// Karty tematów nad formularzem: wybierają temat i przenoszą do pola wiadomości
function initTopicCards() {
    const select = document.getElementById("contact-topic");
    const cards = [...document.querySelectorAll(".topic-card[data-topic]")];
    if (!select || !cards.length) return;
    const mark = () => cards.forEach(c => c.classList.toggle("is-active", c.dataset.topic === select.value));
    cards.forEach(card => card.addEventListener("click", () => {
        select.value = card.dataset.topic;
        mark();
        const form = document.getElementById("contact-form");
        form.scrollIntoView({ behavior: "smooth", block: "center" });
        const ta = form.querySelector("textarea");
        if (ta) setTimeout(() => ta.focus({ preventScroll: true }), 450);
    }));
    select.addEventListener("change", mark);
}

function showFormMessage(form, type) {
    // Удаляем старое сообщение если есть
    const old = form.querySelector(".form-message");
    if (old) old.remove();

    const msg = document.createElement("p");
    msg.className = `form-message form-message--${type}`;

    const lang = window.PD_LANG || document.documentElement.lang || "pl";
    const messages = {
        success: {
            pl: "✓ Wiadomość wysłana! Odpowiemy wkrótce.",
            en: "✓ Message sent! We'll reply soon.",
            de: "✓ Nachricht gesendet! Wir antworten bald.",
            fr: "✓ Message envoyé ! Nous répondrons bientôt.",
            es: "✓ ¡Mensaje enviado! Te responderemos pronto.",
            pt: "✓ Mensagem enviada! Responderemos em breve."
        },
        error: {
            pl: "✗ Błąd wysyłania. Spróbuj ponownie.",
            en: "✗ Send error. Please try again.",
            de: "✗ Sendefehler. Bitte erneut versuchen.",
            fr: "✗ Erreur d'envoi. Veuillez réessayer.",
            es: "✗ Error al enviar. Inténtalo de nuevo.",
            pt: "✗ Erro no envio. Tente novamente."
        }
    };

    msg.textContent = (messages[type][lang]) || messages[type]["en"];
    form.appendChild(msg);

    // Убираем через 6 секунд
    setTimeout(() => msg.remove(), 6000);
}

// -----------------------------------------
// Инициализация
// -----------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    initFadeIn();
    window.uiReady = true; // страховочный таймер в <head> видит, что анимация запущена
    initBackToTop();
    initContactForm();
    initTopicCards();
});
