/* videos.js — карточки в стиле книг, плеер внутри карточки.
   Карточки уже лежат в HTML (их вставляет scripts/build-pages.js) — скрипт их «оживляет»:
   клик открывает плеер, а video-langs.js добавляет флаги и меняет название по языку.
   Если карточек в HTML нет (старая сборка), они создаются из JSON как раньше. */
const VIDEOS_JSON_URL = '/assets/data/videos.json';

async function loadVideos() {
    const container = document.getElementById('videos-container');
    const loader    = document.getElementById('videos-loader');
    const errorDiv  = document.getElementById('videos-error');
    if (!container) return;

    const pre = [...container.querySelectorAll('.video-card[data-id]')];
    pre.forEach(card => wireVideoCard(card, card.dataset.id));

    try {
        const res = await fetch(VIDEOS_JSON_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const videos = await res.json();
        if (loader) loader.style.display = 'none';
        if (pre.length) {
            const byId = new Map(videos.map(v => [v.id, v]));
            pre.forEach(card => {
                const v = byId.get(card.dataset.id);
                if (v && window.PDVideoLangs) PDVideoLangs.attach(v, {
                    body: card.querySelector('.vc-body'), title: card.querySelector('.vc-title'), img: card.querySelector('img')
                });
            });
        } else if (videos && videos.length > 0) {
            videos.forEach((video, i) => container.appendChild(createVideoCard(video, i)));
        } else {
            container.innerHTML = '<p style="text-align:center;opacity:0.7;">Brak wideo.</p>';
        }
    } catch (err) {
        console.error('Failed to load videos:', err);
        if (loader) loader.style.display = 'none';
        if (!pre.length && errorDiv) errorDiv.style.display = 'block';
    }
}

// Клик по превью — плеер в карточке; запасная картинка, если превью не загрузилось
function wireVideoCard(card, id) {
    const preview = card.querySelector('.vc-preview');
    const img = preview && preview.querySelector('img');
    if (!preview) return;
    function showFallback() {
        if (img) img.style.display = 'none';
        if (!preview.querySelector('.vc-fallback')) {
            preview.style.background = 'linear-gradient(135deg,#1a1a1a,#2a2a2a)';
            const icon = document.createElement('div');
            icon.className = 'vc-fallback';
            icon.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#c5a059;font-size:2.5rem;opacity:0.5;';
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

function createVideoCard(video, index) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.id = video.id;
    card.style.cssText = 'opacity:0;transform:translateY(24px);';
    card.innerHTML = '<div class="vc-media"><div class="vc-preview"><img loading="lazy"><div class="vc-play">&#9658;</div></div></div>' +
                     '<div class="vc-body"><h2 class="vc-title"></h2></div>';
    const img = card.querySelector('img');
    img.src = video.thumbnail;
    img.alt = video.title;
    const title = card.querySelector('.vc-title');
    title.textContent = video.title;
    wireVideoCard(card, video.id);
    if (window.PDVideoLangs) PDVideoLangs.attach(video, { body: card.querySelector('.vc-body'), title, img });

    setTimeout(() => {
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, Math.min(index * 60, 800));
    return card;
}

document.addEventListener('DOMContentLoaded', loadVideos);
