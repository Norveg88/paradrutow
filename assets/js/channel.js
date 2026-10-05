/* channel.js — баннер канала YouTube на странице видео.
   Данные: /assets/data/channel.json, его пишет scripts/fetch-videos.js.
   Пока файла нет — блок остаётся скрытым, страница работает как раньше. */
(function () {
    const URL = '/assets/data/channel.json';
    const LOCALE = { pl: 'pl-PL', en: 'en-GB', ru: 'ru-RU', ua: 'uk-UA', de: 'de-DE', fr: 'fr-FR' };
    let data = null;

    function locale() {
        const l = (document.documentElement.lang || 'pl').toLowerCase();
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
        // У googleusercontent размер задаётся суффиксом: берём 1707px вместо оригинала 2560px.
        // Если уменьшенная версия не загрузится — используем оригинал.
        const small = src.includes('=') ? src : src + '=w1707';
        const banner = document.getElementById('ch-banner');
        const apply = (u) => {
            banner.style.backgroundImage = `url("${u}")`;
            banner.hidden = false;
            card.classList.add('has-banner');
        };
        const probe = new Image();
        probe.onload = () => apply(small);
        probe.onerror = () => { if (small !== src) apply(src); };
        probe.src = small;
    }

    function setDescription(text) {
        const desc = document.getElementById('ch-desc');
        const more = document.getElementById('ch-more');
        if (!desc) return;
        desc.textContent = text || '';
        desc.hidden = !text;
        if (!more || !text) return;
        // Кнопка нужна, только если текст не влез в 4 строки
        requestAnimationFrame(() => {
            if (desc.scrollHeight <= desc.clientHeight + 2) return;
            more.hidden = false;
            more.addEventListener('click', () => {
                const open = desc.classList.toggle('open');
                more.querySelector('[data-i18n="ch_more"]').hidden = open;
                more.querySelector('[data-i18n="ch_less"]').hidden = !open;
            });
        });
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
        setDescription(data.description);
        renderLocalized();

        new MutationObserver(renderLocalized)
            .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }

    document.addEventListener('DOMContentLoaded', load);
})();
