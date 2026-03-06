/* videos.js — карточки в стиле книг, плеер внутри карточки */
const VIDEOS_JSON_URL = '/paradrutow/assets/data/videos.json';

async function loadVideos() {
    const container = document.getElementById('videos-container');
    const loader    = document.getElementById('videos-loader');
    const errorDiv  = document.getElementById('videos-error');
    if (!container) return;
    try {
        const res = await fetch(VIDEOS_JSON_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const videos = await res.json();
        loader.style.display = 'none';
        if (videos && videos.length > 0) {
            videos.forEach((video, i) => container.appendChild(createVideoCard(video, i)));
        } else {
            container.innerHTML = '<p style="text-align:center;opacity:0.7;">Brak wideo.</p>';
        }
    } catch (err) {
        console.error('Failed to load videos:', err);
        loader.style.display = 'none';
        errorDiv.style.display = 'block';
    }
}

function createVideoCard(video, index) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.style.cssText = 'opacity:0;transform:translateY(24px);';

    /* медиа 16:9 */
    const media = document.createElement('div');
    media.className = 'vc-media';

    const preview = document.createElement('div');
    preview.className = 'vc-preview';

    const img = document.createElement('img');
    img.src = video.thumbnail;
    img.alt = video.title;
    img.loading = 'lazy';
    preview.appendChild(img);

    const playBtn = document.createElement('div');
    playBtn.className = 'vc-play';
    playBtn.innerHTML = '&#9658;';
    preview.appendChild(playBtn);
    media.appendChild(preview);

    const iframe = document.createElement('iframe');
    iframe.className = 'vc-iframe';
    iframe.title = video.title;
    iframe.allowFullscreen = true;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    media.appendChild(iframe);

    /* название */
    const body = document.createElement('div');
    body.className = 'vc-body';
    const title = document.createElement('h2');
    title.className = 'vc-title';
    title.textContent = video.title;
    body.appendChild(title);

    card.appendChild(media);
    card.appendChild(body);

    /* клик — плеер */
    preview.addEventListener('click', () => {
        card.classList.add('playing');
        iframe.src = `https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`;
        preview.style.display = 'none';
        iframe.style.display = 'block';
    });

    setTimeout(() => {
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, Math.min(index * 60, 800));

    return card;
}

document.addEventListener('DOMContentLoaded', loadVideos);
