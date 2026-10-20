// ---------- Определение языка ----------
const SUPPORTED_LANGS = ["pl", "en", "de", "fr", "es", "pt"];

// Коды браузера -> коды сайта (остальные языки получают английский, см. detectLang)
const LANG_ALIASES = {
    pl: "pl", en: "en", de: "de", fr: "fr", es: "es", pt: "pt",
    cs: "pl", sk: "pl"  // чешский/словацкий ближе к польскому, чем к английскому
};

// Словари ES и PT пока неполные (переведены страницы видео и шортсов):
// всё, чего в них нет, берётся из английского словаря, а не остаётся по-польски.
const DICT_FALLBACK = { es: "en", pt: "en" };

async function fetchDict(name) {
    const res = await fetch(`/assets/i18n/${name}.json?v=${I18N_VERSION}`);
    if (!res.ok) throw new Error("Not found: " + name);
    return res.json();
}

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

function readUrlLang() {
    try {
        const v = new URLSearchParams(location.search).get("lang");
        return SUPPORTED_LANGS.includes(v) ? v : null;
    } catch (e) { return null; }
}

function browserLang() {
    const prefs = (navigator.languages && navigator.languages.length)
        ? navigator.languages
        : [navigator.language || ""];
    for (const tag of prefs) {
        const base = String(tag).toLowerCase().split("-")[0];
        const mapped = LANG_ALIASES[base];
        if (mapped) return mapped;
    }
    return "en"; // ничего не подошло — английский как международный
}

// ---------- Страницы с отдельными языковыми версиями ----------
// scripts/build-pages.js ставит <meta name="pd-versions" content="pl,en"> и ссылки
// в переключателе. На таких страницах язык задаёт сам адрес (/en/video.html),
// а не скрипт: Google видит каждую версию отдельно.
const PAGE_VERSIONS = (document.querySelector('meta[name="pd-versions"]')?.content || "")
    .split(",").map(s => s.trim()).filter(Boolean);
const PAGE_LANG = PAGE_VERSIONS.length ? (document.documentElement.lang || "pl") : null;
const MAIN_VERSION = PAGE_VERSIONS[0] || "pl";   // польская версия в корне сайта

function versionUrl(lang) {
    const a = document.querySelector(`.lang-switcher a[data-lang="${lang}"]`);
    return a ? a.getAttribute("href") : null;
}

function goToVersion(lang) {
    const u = versionUrl(lang);
    if (u) location.replace(u + location.hash);
}

function detectLang() {
    const saved = readSavedLang();
    const urlLang = readUrlLang();
    const explicit = saved || urlLang;   // выбор посетителя или ссылка с ?lang=

    if (PAGE_LANG) {
        if (isCrawler()) return PAGE_LANG;
        if (explicit) {
            // Посетитель выбрал язык, у которого есть своя страница — открываем её
            if (explicit !== PAGE_LANG && PAGE_VERSIONS.includes(explicit)) goToVersion(explicit);
            // Языка нет среди версий — переводим интерфейс скриптом на основной (польской) странице
            else if (!PAGE_VERSIONS.includes(explicit) && PAGE_LANG !== MAIN_VERSION) goToVersion(MAIN_VERSION);
            return explicit;
        }
        // Без явного выбора никуда не перебрасываем (иначе Google не увидит все версии).
        const b = browserLang();
        if (!PAGE_VERSIONS.includes(b) && PAGE_LANG === MAIN_VERSION) return b; // как раньше: перевод интерфейса
        if (b !== PAGE_LANG && PAGE_VERSIONS.includes(b)) window.PD_SUGGEST = b; // предложим версию плашкой
        return PAGE_LANG;
    }

    // ---------- Обычные страницы: язык переключает скрипт ----------
    if (explicit) return explicit;
    // Страница 404 одна на весь сайт: битый адрес /de/… — значит, посетитель читал немецкую версию
    const pathLang = (location.pathname.match(/^\/([a-z]{2})\//) || [])[1];
    if (pathLang && SUPPORTED_LANGS.includes(pathLang) && !isCrawler()) return pathLang;
    if (isCrawler()) return "pl";   // роботам — польский, как в HTML
    return browserLang();
}

// Плашка «Эта страница есть на вашем языке» — только предложение, без автоперехода
const SUGGEST_TEXT = {
    pl: "Ta strona jest dostępna także po polsku",
    en: "This page is also available in English",
    de: "Diese Seite gibt es auch auf Deutsch",
    fr: "Cette page existe aussi en français",
    es: "Esta página también está disponible en español",
    pt: "Esta página também está disponível em português"
};
function showSuggestion(lang) {
    try { if (sessionStorage.getItem("pd-suggest-off")) return; } catch (e) {}
    const url = versionUrl(lang);
    if (!url || !SUGGEST_TEXT[lang]) return;
    const bar = document.createElement("div");
    bar.className = "lang-suggest";
    const link = document.createElement("a");
    link.href = url;
    link.hreflang = lang;
    link.textContent = SUGGEST_TEXT[lang] + " →";
    link.addEventListener("click", () => { try { localStorage.setItem("lang", lang); } catch (e) {} });
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "×");
    close.textContent = "×";
    close.addEventListener("click", () => {
        bar.remove();
        try { sessionStorage.setItem("pd-suggest-off", "1"); } catch (e) {}
    });
    bar.append(link, close);
    const main = document.querySelector("main") || document.body;
    main.insertBefore(bar, main.firstChild);
}

const defaultLang = detectLang();
// Текущий язык страницы — его читают другие скрипты (например, video-langs.js)
window.PD_LANG = defaultLang;

// Версия словарей. Поднимать при добавлении/изменении ключей в assets/i18n/*.json,
// иначе у вернувшихся посетителей браузер отдаст закэшированный старый файл.
const I18N_VERSION = 34;

async function loadLang(lang) {
    try {
        const base = DICT_FALLBACK[lang];
        const data = base
            ? { ...(await fetchDict(base)), ...(await fetchDict(lang).catch(() => ({}))) }
            : await fetchDict(lang);
        const dict = base || lang;   // для картинок вида WzorAI{lang}.png
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (data[key]) {
                el.innerHTML = data[key];
            }
        });
        // Картинки, зависящие от языка: data-i18n-img="/assets/img/WzorAI{lang}.png"
        document.querySelectorAll("[data-i18n-img]").forEach(el => {
            const tpl = el.getAttribute("data-i18n-img");
            if (tpl) el.setAttribute("src", tpl.replace("{lang}", dict));
        });
        // Подсказки в полях ввода
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            if (data[key]) el.setAttribute("placeholder", data[key]);
        });
        // <html lang> всегда остаётся "pl": основной текст сайта — польские описания
        // книг и схем, переводятся только кнопки, меню и подписи. Язык интерфейса
        // хранится отдельно — по нему скрипты форматируют числа и даты.
        document.documentElement.dataset.uiLang = lang;
        document.querySelectorAll("[data-lang]").forEach(btn => {
            btn.classList.toggle("active-lang", btn.getAttribute("data-lang") === lang);
        });
        window.PD_LANG = lang;
        document.dispatchEvent(new CustomEvent("pd:lang", { detail: { lang } }));
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
    if (window.PD_SUGGEST) showSuggestion(window.PD_SUGGEST);

    document.querySelectorAll(".lang-switcher [data-lang]").forEach(el => {
        el.addEventListener("click", (e) => {
            const lang = el.getAttribute("data-lang");
            if (el.tagName === "A") {
                // Ссылка на версию страницы: запоминаем выбор, переход делает сам браузер
                try { localStorage.setItem("lang", lang); } catch (err) {}
                return;
            }
            // Кнопка — языка без своей страницы: перевод скриптом на основной версии
            if (PAGE_LANG && PAGE_LANG !== MAIN_VERSION) {
                e.preventDefault();
                try { localStorage.setItem("lang", lang); } catch (err) {}
                goToVersion(MAIN_VERSION);
                return;
            }
            setLang(lang);
        });
    });
});
