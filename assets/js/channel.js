/* channel.js — баннер канала YouTube на странице видео.
   Данные: /assets/data/channel.json, его пишет scripts/fetch-videos.js.
   Пока файла нет — блок остаётся скрытым, страница работает как раньше. */
(function () {
    const URL = '/assets/data/channel.json';
    const LOCALE = { pl: 'pl-PL', en: 'en-GB', ru: 'ru-RU', ua: 'uk-UA', de: 'de-DE', fr: 'fr-FR' };
    let data = null;

    function locale() {
        // Язык интерфейса (data-ui-lang ставит lang.js); <html lang> всегда "pl"
        const root = document.documentElement;
        const l = (root.dataset.uiLang || root.lang || 'pl').toLowerCase();
        return LOCALE[l] || l;
    }
    function fmtNum(n) {
        return new Intl.NumberFormat(locale()).format(n);
    }
    function fmtDate(iso) {
        return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' })
            .format(new Date(iso));
    }

    // Числа и дата зависят от языка — перерисовываются при его смене
    function renderLocalized() {
        if (!data) return;
        const put = (id, v) => {
            const el = document.getElementById(id);
            if (!el) return;
            const box = el.closest('.ch-stat');
            const ok = typeof v === 'number' && isFinite(v);
            if (box) box.hidden = !ok;
            if (ok) el.textContent = fmtNum(v);
        };
        put('ch-subs', data.subscriberCount);
        put('ch-videos', data.videoCount);
        put('ch-views', data.viewCount);

        const t = document.getElementById('ch-date');
        if (t && data.updatedAt) {
            t.dateTime = data.updatedAt;
            t.textContent = fmtDate(data.updatedAt);
        }
    }

    async function load() {
        const card = document.getElementById('channel-card');
        if (!card) return;
        try {
            const res = await fetch(URL, { cache: 'no-cache' });
            if (!res.ok) return;
            data = await res.json();
        } catch (e) {
            return;
        }

        if (data.title) document.getElementById('ch-title').textContent = data.title;
        if (data.handle) document.getElementById('ch-handle').textContent = data.handle;
        if (data.url) document.getElementById('ch-link').href = data.url;
        if (data.avatar) {
            const av = document.getElementById('ch-avatar');
            av.src = data.avatar;
            av.alt = data.title || 'Para Drutów';
            av.hidden = false;
        }

        card.hidden = false;
        renderLocalized();

        new MutationObserver(renderLocalized)
            .observe(document.documentElement, { attributes: true, attributeFilter: ['data-ui-lang'] });
    }

    document.addEventListener('DOMContentLoaded', load);
})();
