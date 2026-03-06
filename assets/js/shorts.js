/* =====================================================
   shorts.js — карточки 9:16, клик → плеер с анимацией
   ===================================================== */

const SHORTS_JSON_URL = '/paradrutow/assets/data/shorts.json';

async function loadShorts() {
    const container = document.getElementById('shorts-container');
    const loader    = document.getElementById('shorts-loader');
    const errorDiv  = document.getElementById('shorts-error');
    if (!container) return;

    try {
        const res = await fetch(SHORTS_JSON_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const shorts = await res.json();
        loader.style.display = 'none';

        if (shorts && shorts.length > 0) {
            shorts.forEach((short, i) => container.appendChild(createShortCard(short, i)));
        } else {
            container.innerHTML = '<p style="text-align:center;opacity:0.7;grid-column:1/-1;">Brak shorts do wyświetlenia.</p>';
        }
    } catch (err) {
        console.error('Failed to load shorts:', err);
        loader.style.display = 'none';
        errorDiv.style.display = 'block';
    }
}

function createShortCard(short, index) {
    const card = document.createElement('div');
    card.className = 'short-card';
    card.style.cssText = 'opacity:0;transform:translateY(20px);';

    /* ── Медиа 9:16 ── */
    const media = document.createElement('div');
    media.className = 'sc-media';

    /* Превью */
    const preview = document.createElement('div');
    preview.className = 'sc-preview';

    const img = document.createElement('img');
    img.src     = short.thumbnail;
    img.alt     = short.title;
    img.loading = 'lazy';
    preview.appendChild(img);

    const playBtn = document.createElement('div');
    playBtn.className = 'sc-play';
    playBtn.innerHTML = '&#9658;';
    preview.appendChild(playBtn);

    if (short.duration) {
        const badge = document.createElement('div');
        badge.className   = 'sc-duration';
        badge.textContent = formatDuration(short.duration);
        preview.appendChild(badge);
    }

    media.appendChild(preview);

    /* iframe внутри media */
    const iframe = document.createElement('iframe');
    iframe.className       = 'sc-iframe';
    iframe.title           = short.title;
    iframe.allowFullscreen = true;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    media.appendChild(iframe);

    /* ── Заголовок ── */
    const title = document.createElement('p');
    title.className   = 'sc-title';
    title.textContent = short.title;

    card.appendChild(media);
    card.appendChild(title);

    /* ── Клик: превью уменьшается → исчезает → появляется плеер ── */
    preview.addEventListener('click', () => {
        preview.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
        preview.style.transform  = 'scale(0.85)';
        preview.style.opacity    = '0';
        setTimeout(() => {
            preview.style.display = 'none';
            iframe.src = `https://www.youtube.com/embed/${short.id}?autoplay=1&rel=0&modestbranding=1`;
            iframe.classList.add('sc-iframe--active');
        }, 250);
    });

    setTimeout(() => {
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        card.style.opacity    = '1';
        card.style.transform  = 'translateY(0)';
    }, Math.min(index * 55, 800));

    return card;
}

function formatDuration(secs) {
    if (secs < 60) return `0:${String(secs).padStart(2,'0')}`;
    return `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
}

document.addEventListener('DOMContentLoaded', loadShorts);
