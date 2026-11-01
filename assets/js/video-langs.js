/* video-langs.js — названия роликов на языке страницы + строка с флагами языков.
   Подключается перед videos.js / shorts.js. Данные: item.titles = { pl, en, …, it, … } — любые языки.
   Флаг берётся из /assets/img/flags/<код>.svg; если файла нет — вместо флага короткий код языка. */
(function () {
    const ORDER = ['pl', 'en', 'de', 'fr', 'es', 'pt'];
    const NATIVE = { pl: 'Polski', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', pt: 'Português' };
    const LABELS = {
        pl: { avail: 'Dostępne języki:', auto: 'Tłumaczenie automatyczne' },
        en: { avail: 'Available in:',    auto: 'Automatic translation' },
        de: { avail: 'Verfügbar auf:',   auto: 'Automatische Übersetzung' },
        fr: { avail: 'Disponible en :',  auto: 'Traduction automatique' },
        es: { avail: 'Disponible en:',   auto: 'Traducción automática' },
        pt: { avail: 'Disponível em:',   auto: 'Tradução automática' }
    };

    const registry = []; // { item, titleEl, img, iframe, row }

    function current() {
        const l = window.PD_LANG || document.documentElement.dataset.uiLang || 'pl';
        return LABELS[l] ? l : 'pl';
    }

    function langsOf(item) {
        const t = item.titles || {};
        const list = [...ORDER.filter(l => t[l]), ...Object.keys(t).filter(l => !ORDER.includes(l) && t[l])];
        return list.length ? list : ['pl'];
    }

    // Nazwa języka w nim samym: it → Italiano, nl → Nederlands (przeglądarka zna wszystkie)
    function nativeName(l) {
        if (NATIVE[l]) return NATIVE[l];
        try {
            const n = new Intl.DisplayNames([l], { type: 'language' }).of(l);
            if (n && n.toLowerCase() !== l) return n.charAt(0).toUpperCase() + n.slice(1);
        } catch (e) {}
        return l.toUpperCase();
    }

    function titleFor(item, lang) {
        const t = item.titles || {};
        return t[lang] || t.pl || item.title;
    }

    // Только польский + английский — английский считаем автопереводом
    function isAutoEnglish(item) {
        const l = langsOf(item);
        return l.length === 2 && l[0] === 'pl' && l[1] === 'en';
    }

    function buildRow(item) {
        const row = document.createElement('div');
        row.className = 'vl-row';
        const label = document.createElement('span');
        label.className = 'vl-label';
        row.appendChild(label);
        const flags = document.createElement('span');
        flags.className = 'vl-flags';
        const auto = isAutoEnglish(item);
        for (const l of langsOf(item)) {
            const f = document.createElement('span');
            f.className = 'vl-flag';
            f.dataset.l = l;
            const img = document.createElement('img');
            img.src = `/assets/img/flags/${l}.svg`;
            img.alt = nativeName(l);
            img.width = 20; img.height = 14;
            img.loading = 'lazy';
            // brak flagi dla tego języka — pokaż kod (IT, NL…)
            img.onerror = () => {
                const code = document.createElement('span');
                code.className = 'vl-code';
                code.textContent = l.toUpperCase();
                img.replaceWith(code);
            };
            f.appendChild(img);
            if (l === 'en' && auto) {
                const a = document.createElement('span');
                a.className = 'vl-auto';
                a.textContent = 'auto';
                f.appendChild(a);
                f.classList.add('is-auto');
            }
            flags.appendChild(f);
        }
        row.appendChild(flags);
        return row;
    }

    function apply(entry, lang) {
        const L = LABELS[lang];
        const t = titleFor(entry.item, lang);
        entry.titleEl.textContent = t;
        if (entry.img) entry.img.alt = t;
        if (entry.iframe) entry.iframe.title = t;
        entry.row.querySelector('.vl-label').textContent = L.avail;
        entry.row.querySelectorAll('.vl-flag').forEach(f => {
            const l = f.dataset.l;
            f.classList.toggle('is-current', l === lang);
            f.title = f.classList.contains('is-auto') ? `${nativeName(l)} — ${L.auto}` : nativeName(l);
        });
    }

    // Вызывается из videos.js / shorts.js для каждой карточки
    function attach(item, parts) {
        const row = buildRow(item);
        parts.body.appendChild(row);
        const entry = { item, titleEl: parts.title, img: parts.img, iframe: parts.iframe, row };
        registry.push(entry);
        apply(entry, current());
    }

    document.addEventListener('pd:lang', () => {
        const lang = current();
        registry.forEach(e => apply(e, lang));
    });

    window.PDVideoLangs = { attach, titleFor };
})();
