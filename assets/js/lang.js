const defaultLang = localStorage.getItem("lang") || "pl";

async function loadLang(lang) {
    try {
        const res = await fetch(`/assets/i18n/${lang}.json`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (data[key]) {
                el.innerHTML = data[key];
            }
        });
        // Картинки, зависящие от языка: data-i18n-img="/assets/img/WzorAI{lang}.png"
        document.querySelectorAll("[data-i18n-img]").forEach(el => {
            const tpl = el.getAttribute("data-i18n-img");
            if (tpl) el.setAttribute("src", tpl.replace("{lang}", lang));
        });
        document.documentElement.lang = lang;
        document.querySelectorAll("[data-lang]").forEach(btn => {
            btn.classList.toggle("active-lang", btn.getAttribute("data-lang") === lang);
        });
    } catch (e) {
        console.warn("Translations not found for:", lang);
    }
}

function setLang(lang) {
    localStorage.setItem("lang", lang);
    loadLang(lang);
}

// --- Hamburger меню ---
function initHamburger() {
    const hamburger = document.getElementById("hamburger");
    const navLinks  = document.querySelector(".nav-links");
    const navControls = document.querySelector(".nav-controls");
    if (!hamburger) return;

    hamburger.addEventListener("click", () => {
        const isOpen = hamburger.classList.toggle("open");
        navLinks.classList.toggle("open", isOpen);
        navControls.classList.toggle("open", isOpen);
        hamburger.setAttribute("aria-expanded", isOpen);
    });

    // Закрываем при клике на ссылку
    navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            hamburger.classList.remove("open");
            navLinks.classList.remove("open");
            navControls.classList.remove("open");
            hamburger.setAttribute("aria-expanded", false);
        });
    });

    // Закрываем при клике вне меню
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".nav.glass-panel")) {
            hamburger.classList.remove("open");
            navLinks.classList.remove("open");
            navControls.classList.remove("open");
            hamburger.setAttribute("aria-expanded", false);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    loadLang(defaultLang);
    initHamburger();

    document.querySelectorAll("[data-lang]").forEach(btn => {
        btn.addEventListener("click", () => {
            setLang(btn.getAttribute("data-lang"));
        });
    });
});
