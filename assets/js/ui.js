/* =====================================================
   ui.js — Fade-in, Back to top, Contact form
   ===================================================== */

// -----------------------------------------
// 1. FADE-IN карточек при скролле
// -----------------------------------------
function initFadeIn() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target); // один раз — и хватит
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px"
    });

    document.querySelectorAll(".card.glass-card, .app-hero, .feature-image-wrapper").forEach((el, i) => {
        el.style.transitionDelay = `${i * 60}ms`; // каскадная задержка
        observer.observe(el);
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
            const response = await fetch(form.action, {
                method: "POST",
                body: new FormData(form),
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

function showFormMessage(form, type) {
    // Удаляем старое сообщение если есть
    const old = form.querySelector(".form-message");
    if (old) old.remove();

    const msg = document.createElement("p");
    msg.className = `form-message form-message--${type}`;

    const lang = localStorage.getItem("lang") || "pl";
    const messages = {
        success: {
            pl: "✓ Wiadomość wysłana! Odpowiemy wkrótce.",
            en: "✓ Message sent! We'll reply soon.",
            ru: "✓ Сообщение отправлено! Ответим вскоре.",
            ua: "✓ Повідомлення надіслано! Відповімо незабаром.",
            de: "✓ Nachricht gesendet! Wir antworten bald.",
            fr: "✓ Message envoyé ! Nous répondrons bientôt."
        },
        error: {
            pl: "✗ Błąd wysyłania. Spróbuj ponownie.",
            en: "✗ Send error. Please try again.",
            ru: "✗ Ошибка отправки. Попробуйте снова.",
            ua: "✗ Помилка відправки. Спробуйте ще раз.",
            de: "✗ Sendefehler. Bitte erneut versuchen.",
            fr: "✗ Erreur d'envoi. Veuillez réessayer."
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
    initBackToTop();
    initContactForm();
});
