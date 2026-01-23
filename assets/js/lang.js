const defaultLang = localStorage.getItem("lang") || "ru";

function loadLang(lang) {
    fetch(`assets/i18n/${lang}.json`)
        .then(res => res.json())
        .then(data => {
            document.querySelectorAll("[data-i18n]").forEach(el => {
                const key = el.getAttribute("data-i18n");
                if (data[key]) {
                    el.innerHTML = data[key];
                }
            });
        });
}

function setLang(lang) {
    localStorage.setItem("lang", lang);
    loadLang(lang);
}

document.addEventListener("DOMContentLoaded", () => {
    loadLang(defaultLang);

    document.querySelectorAll("[data-lang]").forEach(btn => {
        btn.addEventListener("click", () => {
            const lang = btn.getAttribute("data-lang");
            setLang(lang);
        });
    });
});