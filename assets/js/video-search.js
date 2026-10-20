/* video-search.js — поиск по роликам на страницах видео и шортсов.
   Ищет по названиям на всех языках и по описанию, без учёта регистра и польских букв
   (ł = l, ą = a …). Несколько слов — все должны найтись. Темы-кнопки ищут сразу
   по нескольким языкам (data-q="czapk|hat|mütze…"). Запрос сохраняется в адресе: ?q=czapka */
(function () {
    const box = document.querySelector('.vsearch');
    if (!box) return;
    const container = document.getElementById(box.dataset.target);
    const input = box.querySelector('.vsearch-input');
    const clear = box.querySelector('.vsearch-clear');
    const status = box.querySelector('.vsearch-status');
    const chips = [...box.querySelectorAll('.vsearch-tag')];
    if (!container || !input) return;

    const norm = s => String(s || '').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '');
    // «czapka» находит «czapki», «czapkę»: у длинных слов отбрасываем окончание
    const stem = w => w.length > 4 ? w.slice(0, Math.max(4, w.length - 2)) : w;
    const text = cls => (box.querySelector(cls)?.textContent || '').trim();

    let index = null;   // Map id -> нормализованный текст
    async function loadIndex() {
        if (index) return index;
        try {
            const res = await fetch(box.dataset.src);
            const items = await res.json();
            // сначала ищем в названиях (все языки); описание — только если в названиях ничего нет
            index = new Map(items.map(v => [v.id, {
                title: norm([v.title, ...Object.values(v.titles || {})].join(' \n ')),
                desc: norm(v.description)
            }]));
        } catch (e) {
            // без данных ищем хотя бы по видимым названиям
            index = new Map([...container.querySelectorAll('[data-id]')].map(c => [c.dataset.id, { title: norm(c.textContent), desc: '' }]));
        }
        return index;
    }

    function matcher(q, exact) {
        // «a|b|c» — любое из слов (кнопки тем); пробел — все слова
        // слова темы ищем с начала слова: «hat» не должно находить «what», «lace» — «place»
        if (exact) {
            const alts = q.split('|').map(norm).filter(Boolean)
                .map(a => new RegExp('(^|[^a-z0-9])' + a.replace(/[.*+?^${}()[\]\\]/g, '\\$&')));
            return t => alts.some(r => r.test(t));
        }
        const words = norm(q).split(/\s+/).filter(Boolean).map(stem);
        return t => words.every(w => t.includes(w));
    }

    let activeChip = null;
    async function run(q, opts = {}) {
        const cards = [...container.querySelectorAll('[data-id]')];
        q = (q || '').trim();
        clear.hidden = !q;
        if (!q) {
            cards.forEach(c => { c.hidden = false; });
            status.textContent = '';
            chips.forEach(c => c.setAttribute('aria-pressed', 'false'));
            sync('');
            return;
        }
        const idx = await loadIndex();
        const test = matcher(opts.pattern || q, !!opts.pattern);
        const entry = c => idx.get(c.dataset.id) || { title: norm(c.textContent), desc: '' };
        let hits = cards.filter(c => test(entry(c).title));
        // темы ищут только по названиям; свой запрос — ещё и по описаниям, если в названиях пусто
        if (!hits.length && !opts.pattern) hits = cards.filter(c => test(entry(c).desc));
        const set = new Set(hits);
        cards.forEach(c => { c.hidden = !set.has(c); });
        const n = hits.length;
        status.textContent = n ? text('.vsearch-t-found').replace('{n}', n) : text('.vsearch-t-none');
        status.classList.toggle('is-empty', !n);
        sync(q);
    }

    function sync(q) {
        try {
            const u = new URL(location.href);
            if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
            history.replaceState(null, '', u.pathname + u.search + u.hash);
        } catch (e) {}
    }

    let timer;
    input.addEventListener('input', () => {
        activeChip = null;
        chips.forEach(c => c.setAttribute('aria-pressed', 'false'));
        clearTimeout(timer);
        timer = setTimeout(() => run(input.value), 150);
    });
    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') { input.value = ''; run(''); }
        if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); run(input.value); input.blur(); }
    });
    clear.addEventListener('click', () => { input.value = ''; activeChip = null; run(''); input.focus(); });
    chips.forEach(chip => chip.addEventListener('click', () => {
        if (activeChip === chip) { activeChip = null; input.value = ''; run(''); return; }
        activeChip = chip;
        chips.forEach(c => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
        input.value = chip.textContent.trim();
        run(input.value, { pattern: chip.dataset.q });
    }));

    // при смене языка обновить текст счётчика
    document.addEventListener('pd:lang', () => { if (input.value) run(input.value, activeChip ? { pattern: activeChip.dataset.q } : {}); });

    const q0 = new URLSearchParams(location.search).get('q');
    if (q0) {
        input.value = q0;
        // ссылка с выбранной темой (?q=Czapki) снова включает кнопку темы
        const chip = chips.find(c => c.textContent.trim().toLowerCase() === q0.trim().toLowerCase());
        if (chip) { activeChip = chip; chip.setAttribute('aria-pressed', 'true'); run(q0, { pattern: chip.dataset.q }); }
        else run(q0);
    }
})();
