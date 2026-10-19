/* shorts.js — карточки в стиле видео, плеер внутри.
   Карточки уже лежат в HTML (их вставляет scripts/build-pages.js) — скрипт их «оживляет».
   Если карточек в HTML нет, они создаются из JSON как раньше. */
const SHORTS_JSON_URL = '/assets/data/shorts.json';

async function loadShorts() {
    const container = document.getElementById('shorts-container');
    const loader    = document.getElementById('shorts-loader');
    const errorDiv  = document.getElementById('shorts-error');
    if (!container) return;

    const pre = [...container.querySelectorAll('.short-card[data-id]')];
    pre.forEach(card => wireShortCard(card, card.dataset.id));

    try {
        const res = await fetch(SHORTS_JSON_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const shorts = await res.json();
        if (loader) loader.style.display = 'none';
        if (pre.length) {
            const byId = new Map(shorts.map(s => [s.id, s]));
            pre.forEach(card => {
                const s = byId.get(card.dataset.id);
                if (s && window.PDVideoLangs) PDVideoLangs.attach(s, {
                    body: card.querySelector('.sc-body'), title: card.querySelector('.sc-title'), img: card.querySelector('img')
                });
            });
        } else if (shorts && shorts.length > 0) {
            shorts.forEach((s, i) => container.appendChild(createShortCard(s, i)));
        } else {
            container.innerHTML = '<p style="text-align:center;opacity:0.7;grid-column:1/-1;">Brak shorts.</p>';
        }
    } catch (err) {
        console.error('Failed to load shorts:', err);
        if (loader) loader.style.display = 'none';
        if (!pre.length && errorDiv) errorDiv.style.display = 'block';
    }
}

function wireShortCard(card, id) {
    const preview = card.querySelector('.sc-preview');
    const img = preview && preview.querySelector('img');
    if (!preview) return;
    function showFallback() {
        if (img) img.style.display = 'none';
        if (!preview.querySelector('.sc-fallback')) {
            preview.style.background = 'linear-gradient(135deg,#1a1a1a,#2a2a2a)';
            const icon = document.createElement('div');
            icon.className = 'sc-fallback';
            icon.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#c5a059;font-size:2rem;opacity:0.5;';
            icon.textContent = '▶';
            preview.appendChild(icon);
        }
    }
    if (img) {
        img.onerror = showFallback;
        img.onload = () => { if (img.naturalWidth <= 120) showFallback(); };
        if (img.complete && img.naturalWidth && img.naturalWidth <= 120) showFallback();
    }
    preview.addEventListener('click', () => {
        const iframe = document.createElement('iframe');
        iframe.className = 'sc-iframe';
        iframe.title = card.querySelector('.sc-title')?.textContent || '';
        iframe.allowFullscreen = true;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
        preview.parentNode.appendChild(iframe);
        card.classList.add('playing');
        preview.style.display = 'none';
        iframe.style.display = 'block';
    });
}

function createShortCard(short, index) {
    const card = document.createElement('div');
    card.className = 'short-card';
    card.dataset.id = short.id;
    card.style.cssText = 'opacity:0;transform:translateY(24px);';
    card.innerHTML = '<div class="sc-media"><div class="sc-preview"><img loading="lazy"><div class="sc-play">&#9658;</div></div></div>' +
                     '<div class="sc-body"><h2 class="sc-title"></h2></div>';
    const img = card.querySelector('img');
    img.src = short.thumbnail;
    img.alt = short.title;
    if (short.duration) {
        const badge = document.createElement('div');
        badge.className = 'sc-duration';
        badge.textContent = formatDuration(short.duration);
        card.querySelector('.sc-preview').appendChild(badge);
    }
    const title = card.querySelector('.sc-title');
    title.textContent = short.title;
    wireShortCard(card, short.id);
    if (window.PDVideoLangs) PDVideoLangs.attach(short, { body: card.querySelector('.sc-body'), title, img });

    setTimeout(() => {
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, Math.min(index * 55, 800));
    return card;
}

function formatDuration(secs) {
    if (secs < 60) return `0:${String(secs).padStart(2,'0')}`;
    return `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
}

document.addEventListener('DOMContentLoaded', loadShorts);
