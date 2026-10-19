/* home.js — главная страница.
   Карточки роликов уже лежат в HTML (их вставляет scripts/build-pages.js);
   здесь: вкладки «С чего начать», плеер внутри карточки, флаги языков роликов
   и мягкое появление блоков при прокрутке. */
(function () {
    // ---------- Вкладки уровней ----------
    function initTabs() {
        const tabs = [...document.querySelectorAll('.lvl-tab')];
        if (!tabs.length) return;
        function select(tab, focus) {
            tabs.forEach(t => {
                const on = t === tab;
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.tabIndex = on ? 0 : -1;
                const panel = document.getElementById(t.getAttribute('aria-controls'));
                if (panel) panel.hidden = !on;
            });
            if (focus) tab.focus();
        }
        tabs.forEach((t, i) => {
            t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
            t.addEventListener('click', () => select(t));
            t.addEventListener('keydown', e => {
                const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                select(tabs[(i + d + tabs.length) % tabs.length], true);
            });
        });
    }

    // ---------- Плеер в карточке ----------
    function wire(card) {
        const id = card.dataset.id;
        const preview = card.querySelector('.vc-preview');
        if (!id || !preview) return;
        const img = preview.querySelector('img');
        if (img) img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
        preview.addEventListener('click', () => {
            const iframe = document.createElement('iframe');
            iframe.className = 'vc-iframe';
            iframe.title = card.querySelector('.vc-title')?.textContent || '';
            iframe.allowFullscreen = true;
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
            preview.parentNode.appendChild(iframe);
            card.classList.add('playing');
            preview.style.display = 'none';
            iframe.style.display = 'block';
        });
    }

    function initVideos() {
        let data = {};
        try { data = JSON.parse(document.getElementById('home-video-data')?.textContent || '{}'); } catch (e) {}
        document.querySelectorAll('.js-video-cards .video-card[data-id]').forEach(card => {
            wire(card);
            const item = data[card.dataset.id];
            if (item && window.PDVideoLangs) PDVideoLangs.attach(item, {
                body: card.querySelector('.vc-body'), title: card.querySelector('.vc-title'), img: card.querySelector('img')
            });
        });
    }

    // ---------- Появление при прокрутке ----------
    function initReveal() {
        const els = [...document.querySelectorAll('.reveal')];
        if (!('IntersectionObserver' in window)) return;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const io = new IntersectionObserver(entries => {
            entries.forEach(en => {
                if (en.isIntersecting) { en.target.classList.remove('pre'); io.unobserve(en.target); }
            });
        }, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });
        els.forEach(el => {
            if (el.getBoundingClientRect().top < vh) return;   // уже на экране — без анимации
            el.classList.add('pre');
            io.observe(el);
        });
    }

    function start() { initTabs(); initVideos(); initReveal(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
