// ---------- Определение языка ----------
const SUPPORTED_LANGS = ["pl", "en", "ru", "ua", "de", "fr"];

// Коды браузера -> коды сайта
const LANG_ALIASES = {
    pl: "pl", en: "en", ru: "ru", de: "de", fr: "fr",
    uk: "ua",  // украинский по ISO — uk, у нас папка ua
    be: "ru",  // белорусский -> русский
    cs: "pl", sk: "pl"  // чешский/словацкий ближе к польскому, чем к английскому
};

// Поисковым роботам всегда отдаём польскую версию:
// она совпадает с HTML-исходником, canonical и og:locale
function isCrawler() {
    return /bot|crawler|spider|crawling|slurp|lighthouse|headlesschrome|pagespeed/i
        .test(navigator.userAgent || "");
}

function readSavedLang() {
    try {
        const v = localStorage.getItem("lang");
        return SUPPORTED_LANGS.includes(v) ? v : null;
    } catch (e) {
        return null; // приватный режим / отключённое хранилище
    }
}

function detectLang() {
    // 1. Явный выбор пользователя — высший приоритет
    const saved = readSavedLang();
    if (saved) return saved;

    // 2. ?lang=en в ссылке (рассылка, соцсети, реклама)
    try {
        const urlLang = new URLSearchParams(location.search).get("lang");
        if (SUPPORTED_LANGS.includes(urlLang)) return urlLang;
    } catch (e) { /* игнорируем */ }

    // 3. Роботы — только польский
    if (isCrawler()) return "pl";

    // 4. Языки браузера, по порядку приоритета
    const prefs = (navigator.languages && navigator.languages.length)
        ? navigator.languages
        : [navigator.language || ""];
    for (const tag of prefs) {
        const base = String(tag).toLowerCase().split("-")[0];
        const mapped = LANG_ALIASES[base];
        if (mapped) return mapped;
    }

    // 5. Ничего не подошло — английский как международный
    return "en";
}

const defaultLang = detectLang();

// Версия словарей. Поднимать при добавлении/изменении ключей в assets/i18n/*.json,
// иначе у вернувшихся посетителей браузер отдаст закэшированный старый файл.
const I18N_VERSION = 7;

async function loadLang(lang) {
    try {
        const res = await fetch(`/assets/i18n/${lang}.json?v=${I18N_VERSION}`);
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
        // Подсказки в полях ввода
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            if (data[key]) el.setAttribute("placeholder", data[key]);
        });
        document.documentElement.lang = lang;
        document.querySelectorAll("[data-lang]").forEach(btn => {
            btn.classList.toggle("active-lang", btn.getAttribute("data-lang") === lang);
        });
    } catch (e) {
        console.warn("Translations not found for:", lang);
        // Файл перевода недоступен — не оставляем страницу наполовину
        if (lang !== "pl") loadLang("pl");
    }
}

function setLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    try {
        localStorage.setItem("lang", lang);
    } catch (e) { /* приватный режим — язык применится только на эту сессию */ }
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
