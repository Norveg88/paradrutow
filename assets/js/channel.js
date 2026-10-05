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

    function setBanner(card, src) {
        if (!src) return;
        // Тот же вариант, которым YouTube сам показывает баннер на канале:
        // готовая полоса из центра (fcrop64), JPEG, 2120 px — ~150 КБ.
        // Без суффикса YouTube отдаёт весь баннер 16:9, а «=w1707» — PNG на 2+ МБ.
        const CROP = '=w2120-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj';
        const best = src.includes('=') ? src : src + CROP;
        const banner = document.getElementById('ch-banner');
        const apply = (u) => {
            banner.style.backgroundImage = `url("${u}")`;
            banner.hidden = false;
            card.classList.add('has-banner');
        };
        // Блок показывается только после полной загрузки картинки —
        // пустой полосы на её месте не будет
        const probe = new Image();
        probe.onload = () => apply(best);
        probe.onerror = () => {
            if (best === src) return;
            const raw = new Image();
            raw.onload = () => apply(src);
            raw.src = src;
        };
        probe.src = best;
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
        setBanner(card, data.banner);
        renderLocalized();

        new MutationObserver(renderLocalized)
            .observe(document.documentElement, { attributes: true, attributeFilter: ['data-ui-lang'] });
    }

    document.addEventListener('DOMContentLoaded', load);
})();
