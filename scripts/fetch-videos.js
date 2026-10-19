/* =====================================================
   YouTube Channel Video Fetcher — Para Drutów
   
   Определение Shorts: через YouTube API (videos.list + contentDetails)
   Shorts = длительность ≤ 60 секунд
   ===================================================== */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pages = require('./build-pages');   // языковые версии video.html / shorts.html

// Читаем API ключ из .env файла (не публикуется на GitHub)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const [key, ...val] = line.split('=');
      if (key && val.length) process.env[key.trim()] = val.join('=').trim();
    }
  }
}
loadEnv();

const CONFIG = {
  API_KEY:             process.env.YOUTUBE_API_KEY || '',
  CHANNEL_ID:          '@ParaDrutow',
  MAX_RESULTS:         0,           // 0 = все видео
  MERGE_WITH_EXISTING: true,
  SORT_ORDER:          'newest-first',
  AUTO_DEPLOY:         !process.argv.includes('--no-deploy'), // node fetch-videos.js --no-deploy — без коммита и пуша
  REPO_DIR:            path.join(__dirname, '..'),
  GIT_BRANCH:          'main',
  GIT_COMMIT_MESSAGE:  'Update video data'
};

// ─────────────────────────────────────────────────────
// Парсинг ISO 8601 duration в секунды
// PT1M30S → 90,  PT45S → 45,  PT10M → 600
// ─────────────────────────────────────────────────────
function parseDuration(iso) {
  if (!iso || typeof iso !== 'string') return 999;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 999;
  const h = parseInt(m[1] || 0);
  const min = parseInt(m[2] || 0);
  const s = parseInt(m[3] || 0);
  return h * 3600 + min * 60 + s;
}

// ─────────────────────────────────────────────────────
// Языки сайта, для которых сохраняем названия роликов.
// YouTube отдаёт коды вида en-US, de-DE, pt-BR — приводим к базовому коду.
// ─────────────────────────────────────────────────────
const TITLE_LANGS = ['pl', 'en', 'de', 'fr', 'es', 'pt'];

function collectTitles(item) {
  const titles = {};
  const add = (code, title) => {
    const base = String(code || '').toLowerCase().split('-')[0];
    if (TITLE_LANGS.includes(base) && title && !titles[base]) titles[base] = title;
  };
  // Основное название — на языке ролика (у канала это польский)
  add(item.snippet?.defaultLanguage || 'pl', item.snippet?.title);
  for (const [code, loc] of Object.entries(item.localizations || {})) add(code, loc?.title);
  // Польское название есть всегда: если ролик помечен другим языком, берём основное
  if (!titles.pl && item.snippet?.title) titles.pl = item.snippet.title;
  // Порядок ключей как в TITLE_LANGS — так JSON стабилен между запусками
  return Object.fromEntries(TITLE_LANGS.filter(l => titles[l]).map(l => [l, titles[l]]));
}

// ─────────────────────────────────────────────────────
// Длительности и названия на всех языках для массива videoId (по 50 за раз).
// Один запрос videos.list стоит 1 единицу квоты независимо от числа part.
// Возвращает Map: id → { duration, titles }
// ─────────────────────────────────────────────────────
async function fetchVideoDetails(videoIds) {
  const result = new Map();
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50).join(',');
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,localizations&id=${chunk}&key=${CONFIG.API_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    for (const item of (data.items || [])) {
      result.set(item.id, {
        duration: parseDuration(item.contentDetails?.duration),
        titles:   collectTitles(item)
      });
    }
    process.stdout.write(`  Details fetched: ${result.size}/${videoIds.length}...\r`);
  }
  process.stdout.write('\n');
  return result;
}

// ─────────────────────────────────────────────────────
// ГЛАВНАЯ ФУНКЦИЯ
// ─────────────────────────────────────────────────────
async function fetchChannelVideos() {
  console.log('========================================');
  console.log(' Para Drutów — YouTube Video Fetcher');
  console.log('========================================\n');

  try {
    // 1. Resolve handle → channelId
    let channelId = CONFIG.CHANNEL_ID;
    if (channelId.startsWith('@')) {
      console.log(`Resolving: ${channelId}`);
      channelId = await resolveChannelHandle(channelId);
      console.log(`Channel ID: ${channelId}\n`);
    }

    // 2. Канал: плейлист загрузок + описание, баннер и статистика (один запрос)
    const channel = await fetchChannelInfo(channelId);
    const uploadsId = channel.uploadsId;
    console.log(`Uploads playlist: ${uploadsId}`);
    console.log(`Channel stats: ${channel.info.subscriberCount ?? 'скрыто'} subs, ${channel.info.videoCount} videos, ${channel.info.viewCount} views\n`);

    // 3. Загрузить все видео из плейлиста
    console.log('Fetching playlist...');
    const max = (!CONFIG.MAX_RESULTS || CONFIG.MAX_RESULTS === 0) ? Infinity : CONFIG.MAX_RESULTS;
    const allVideos = await fetchPlaylistVideos(uploadsId, null, [], max);
    console.log(`Total fetched: ${allVideos.length}\n`);

    // 4. Длительности и названия на всех языках через videos.list API
    console.log('Fetching video details (durations + titles) via API...');
    const ids = allVideos.map(v => v.id);
    const details = await fetchVideoDetails(ids);
    console.log(`Details fetched: ${details.size}\n`);

    // 5. Разделить: Shorts ≤ 60 сек, Videos > 60 сек
    const regularVideos = [];
    const shorts = [];

    for (const video of allVideos) {
      // Пропускаем видео без данных (приватные/удалённые — API их не вернул)
      if (!details.has(video.id)) continue;
      const { duration: secs, titles } = details.get(video.id);
      video.duration = secs; // сохранить длительность в JSON
      video.titles   = titles; // { pl: "...", en: "...", ... } — названия по языкам
      if (secs <= 90) {
        // Обновить URL на формат /shorts/ для шортсов
        video.url = `https://www.youtube.com/shorts/${video.id}`;
        shorts.push(video);
      } else {
        regularVideos.push(video);
      }
    }

    console.log(`Result: ${regularVideos.length} videos (>60s) + ${shorts.length} shorts (≤60s)\n`);

    // 6. Пути к файлам
    const outputDir = path.join(CONFIG.REPO_DIR, 'assets', 'data');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const videosPath = path.join(outputDir, 'videos.json');
    const shortsPath = path.join(outputDir, 'shorts.json');

    // 7. Merge или перезапись
    let finalVideos = CONFIG.MERGE_WITH_EXISTING ? mergeData(videosPath, regularVideos) : regularVideos;
    let finalShorts = CONFIG.MERGE_WITH_EXISTING ? mergeData(shortsPath, shorts)        : shorts;

    // 8. Сортировка
    const sortFn = CONFIG.SORT_ORDER === 'newest-first'
      ? (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
      : (a, b) => new Date(a.publishedAt) - new Date(b.publishedAt);

    finalVideos.sort(sortFn);
    finalShorts.sort(sortFn);

    // 9. Сохранить
    fs.writeFileSync(videosPath, JSON.stringify(finalVideos, null, 2), 'utf-8');
    console.log(`Saved videos.json: ${finalVideos.length} videos`);

    fs.writeFileSync(shortsPath, JSON.stringify(finalShorts, null, 2), 'utf-8');
    console.log(`Saved shorts.json: ${finalShorts.length} shorts\n`);

    // 9b. Данные канала для баннера на странице видео.
    // updatedAt — момент запуска скрипта: на эту дату действительны цифры.
    const channelPath = path.join(outputDir, 'channel.json');
    const channelData = {
      ...channel.info,
      regularVideos: finalVideos.length,
      shorts:        finalShorts.length,
      updatedAt:     new Date().toISOString()
    };
    fs.writeFileSync(channelPath, JSON.stringify(channelData, null, 2), 'utf-8');
    console.log(`Saved channel.json: updated ${channelData.updatedAt}\n`);

    // 10. Генерация video sitemap
    const sitemapPath = path.join(CONFIG.REPO_DIR, 'sitemap-video.xml');
    generateVideoSitemap(finalVideos, finalShorts, sitemapPath);

    // 10b. Языковые версии страниц video.html / shorts.html с карточками в HTML
    const built = pages.build().map(f => path.join(CONFIG.REPO_DIR, f));

    // 11. Деплой
    if (CONFIG.AUTO_DEPLOY) deployToGitHub([videosPath, shortsPath, sitemapPath, channelPath, ...built]);
    else console.log('AUTO_DEPLOY off. Run:\n  git add assets/data sitemap-video.xml sitemap.xml video.html shorts.html en de fr es pt\n  git commit -m "Update video data" && git push\n');

  } catch (err) {
    console.error('\nError:', err.message);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────
// Merge: объединяет новые данные с существующими по id
// ─────────────────────────────────────────────────────
// Генерация sitemap-video.xml
function generateVideoSitemap(videos, shorts, sitemapPath) {
  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
      .replace(/[\r\n]+/g, ' ')
      .slice(0, 2048);
  }
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;
  // Каждая языковая версия страницы — свой <url>, названия роликов на её языке
  // (описание — оригинальное: переводов описаний у роликов нет)
  for (const [file, items] of [['video.html', videos], ['shorts.html', shorts]]) {
    for (const lang of pages.versionsOf(file)) {
      xml += `  <url>\n    <loc>${pages.fullUrl(file, lang)}</loc>\n`;
      for (const v of items) {
        xml += `    <video:video>\n`;
        xml += `      <video:thumbnail_loc>${v.thumbnail}</video:thumbnail_loc>\n`;
        xml += `      <video:title>${esc(pages.titleOf(v, lang))}</video:title>\n`;
        xml += `      <video:description>${esc(v.description)}</video:description>\n`;
        xml += `      <video:player_loc>https://www.youtube.com/embed/${v.id}</video:player_loc>\n`;
        xml += `      <video:publication_date>${v.publishedAt}</video:publication_date>\n`;
        xml += `    </video:video>\n`;
      }
      xml += `  </url>\n`;
    }
  }
  xml += `</urlset>`;
  fs.writeFileSync(sitemapPath, xml, 'utf-8');
  console.log(`Saved sitemap-video.xml: ${videos.length} videos + ${shorts.length} shorts\n`);
}

function mergeData(filePath, newItems) {
  let existing = [];
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      console.log(`  Existing ${path.basename(filePath)}: ${existing.length}`);
    } catch (e) {}
  }
  const map = new Map(existing.map(item => [item.id, item]));
  let added = 0;
  for (const item of newItems) {
    if (!map.has(item.id)) added++;
    map.set(item.id, item);
  }
  console.log(`  +${added} new`);
  return Array.from(map.values());
}

// ─────────────────────────────────────────────────────
// Deploy: git add → commit → push
// ─────────────────────────────────────────────────────
function deployToGitHub(files) {
  console.log('Deploying to GitHub...\n');
  const date = new Date().toISOString().slice(0, 10);
  const msg  = `${CONFIG.GIT_COMMIT_MESSAGE} ${date}`;
  try {
    process.chdir(CONFIG.REPO_DIR);
    execSync(`git add ${files.map(f => `"${f}"`).join(' ')}`, { stdio: 'inherit' });
    // Проверяем только подготовленные файлы, а не всю папку
    const staged = execSync('git diff --cached --name-only').toString().trim();
    if (!staged) { console.log('Nothing to commit — already up to date.\n'); return; }
    execSync(`git commit -m "${msg}"`, { stdio: 'inherit' });
    execSync(`git push origin ${CONFIG.GIT_BRANCH}`, { stdio: 'inherit' });
    console.log(`\nDeployed! https://paradrutow.com/\n`);
    // IndexNow: сообщить Bing и др., какие страницы обновились в этом коммите
    // (videos.json/channel.json -> video.html, shorts.json -> shorts.html).
    // Ошибка здесь не мешает обновлению — данные уже на сайте.
    try {
      execSync('node scripts/indexnow.js', { stdio: 'inherit' });
    } catch (e) {
      console.log('IndexNow: пропущено — ' + e.message);
    }
  } catch (err) {
    console.error('Git error:', err.message);
    console.log(`\nRun manually:\n  git add assets/data/videos.json assets/data/shorts.json assets/data/channel.json sitemap-video.xml\n  git commit -m "${msg}"\n  git push origin ${CONFIG.GIT_BRANCH}\n`);
  }
}

// ─────────────────────────────────────────────────────
// YouTube API helpers
// ─────────────────────────────────────────────────────
async function resolveChannelHandle(handle) {
  const clean = handle.replace('@', '');
  const url   = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(clean)}&key=${CONFIG.API_KEY}`;
  const res   = await fetch(url);
  const data  = await res.json();
  if (data.error) throw new Error(data.error.message);
  if (!data.items?.[0]) throw new Error(`Channel not found: ${handle}`);
  return data.items[0].id;
}

// Один запрос channels.list: плейлист загрузок + всё для баннера на сайте.
// Стоит 1 единицу квоты API, как и прежний запрос только за плейлистом.
async function fetchChannelInfo(channelId) {
  const parts = 'snippet,statistics,contentDetails,brandingSettings';
  const url  = `https://www.googleapis.com/youtube/v3/channels?part=${parts}&id=${channelId}&key=${CONFIG.API_KEY}`;
  const res  = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const ch = data.items?.[0];
  if (!ch) throw new Error('Channel not found');

  const sn = ch.snippet || {};
  const st = ch.statistics || {};
  const handle = sn.customUrl ? (sn.customUrl.startsWith('@') ? sn.customUrl : '@' + sn.customUrl) : CONFIG.CHANNEL_ID;
  const thumbs = sn.thumbnails || {};
  const num = (v) => (v === undefined || v === null || v === '') ? null : Number(v);

  return {
    uploadsId: ch.contentDetails.relatedPlaylists.uploads,
    info: {
      id:          ch.id,
      title:       sn.title || '',
      handle,
      url:         `https://www.youtube.com/${handle}`,
      avatar:      (thumbs.high || thumbs.medium || thumbs.default || {}).url || '',
      banner:      ch.brandingSettings?.image?.bannerExternalUrl || '',
      // YouTube отдаёт число подписчиков округлённым до 3 значащих цифр;
      // если автор скрыл его — поля нет, на сайте эта цифра не показывается
      subscriberCount: st.hiddenSubscriberCount ? null : num(st.subscriberCount),
      videoCount:  num(st.videoCount),
      viewCount:   num(st.viewCount)
    }
  };
}

async function fetchPlaylistVideos(playlistId, pageToken = null, all = [], max = Infinity) {
  const url  = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${CONFIG.API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const res  = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  if (!data.items) throw new Error('Failed to fetch videos');

  all.push(...data.items.map(item => ({
    id:          item.contentDetails.videoId,
    title:       item.snippet.title,
    description: item.snippet.description,
    thumbnail:   item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
    publishedAt: item.snippet.publishedAt,
    url:         `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`
  })));

  process.stdout.write(`  ${all.length} fetched...\r`);

  if (data.nextPageToken && all.length < max)
    return fetchPlaylistVideos(playlistId, data.nextPageToken, all, max);

  process.stdout.write('\n');
  return max === Infinity ? all : all.slice(0, max);
}

fetchChannelVideos();
