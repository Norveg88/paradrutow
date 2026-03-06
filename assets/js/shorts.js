/* shorts.js — карточки в стиле видео, плеер внутри */
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
            shorts.forEach((s, i) => container.appendChild(createShortCard(s, i)));
        } else {
            container.innerHTML = '<p style="text-align:center;opacity:0.7;grid-column:1/-1;">Brak shorts.</p>';
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
    card.style.cssText = 'opacity:0;transform:translateY(24px);';

    /* медиа 9:16 */
    const media = document.createElement('div');
    media.className = 'sc-media';

    const preview = document.createElement('div');
    preview.className = 'sc-preview';

    const img = document.createElement('img');
    img.src = short.thumbnail;
    img.alt = short.title;
    img.loading = 'lazy';
    preview.appendChild(img);

    const playBtn = document.createElement('div');
    playBtn.className = 'sc-play';
    playBtn.innerHTML = '&#9658;';
    preview.appendChild(playBtn);

    if (short.duration) {
        const badge = document.createElement('div');
        badge.className = 'sc-duration';
        badge.textContent = formatDuration(short.duration);
        preview.appendChild(badge);
    }
    media.appendChild(preview);

    const iframe = document.createElement('iframe');
    iframe.className = 'sc-iframe';
    iframe.title = short.title;
    iframe.allowFullscreen = true;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    media.appendChild(iframe);

    /* название — такой же стиль как у видео */
    const body = document.createElement('div');
    body.className = 'sc-body';
    const title = document.createElement('h2');
    title.className = 'sc-title';
    title.textContent = short.title;
    body.appendChild(title);

    card.appendChild(media);
    card.appendChild(body);

    /* клик — плеер */
    preview.addEventListener('click', () => {
        card.classList.add('playing');
        iframe.src = `https://www.youtube.com/embed/${short.id}?autoplay=1&rel=0&modestbranding=1`;
        preview.style.display = 'none';
        iframe.style.display = 'block';
    });

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
