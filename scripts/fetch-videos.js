/* =====================================================
   YouTube Channel Video Fetcher — Para Drutów
   
   Определение Shorts: через YouTube API (videos.list + contentDetails)
   Shorts = длительность ≤ 60 секунд
   ===================================================== */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  AUTO_DEPLOY:         true,
  REPO_DIR:            path.join(__dirname, '..'),
  GIT_BRANCH:          'main',
  GIT_COMMIT_MESSAGE:  'Update video data'
};

// ─────────────────────────────────────────────────────
// Парсинг ISO 8601 duration в секунды
// PT1M30S → 90,  PT45S → 45,  PT10M → 600
// ─────────────────────────────────────────────────────
function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 999;
  const h = parseInt(m[1] || 0);
  const min = parseInt(m[2] || 0);
  const s = parseInt(m[3] || 0);
  return h * 3600 + min * 60 + s;
}

// ─────────────────────────────────────────────────────
// Получить длительности для массива videoId (по 50 за раз)
// Возвращает Map: id → seconds
// ─────────────────────────────────────────────────────
async function fetchDurations(videoIds) {
  const result = new Map();
  // API принимает до 50 id за раз
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50).join(',');
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${chunk}&key=${CONFIG.API_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    for (const item of (data.items || [])) {
      result.set(item.id, parseDuration(item.contentDetails.duration));
    }
    process.stdout.write(`  Durations fetched: ${result.size}/${videoIds.length}...\r`);
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

    // 2. Uploads playlist
    const uploadsId = await getUploadsPlaylistId(channelId);
    console.log(`Uploads playlist: ${uploadsId}\n`);

    // 3. Загрузить все видео из плейлиста
    console.log('Fetching playlist...');
    const max = (!CONFIG.MAX_RESULTS || CONFIG.MAX_RESULTS === 0) ? Infinity : CONFIG.MAX_RESULTS;
    const allVideos = await fetchPlaylistVideos(uploadsId, null, [], max);
    console.log(`Total fetched: ${allVideos.length}\n`);

    // 4. Получить длительности через videos.list API
    console.log('Fetching video durations via API...');
    const ids = allVideos.map(v => v.id);
    const durations = await fetchDurations(ids);
    console.log(`Durations fetched: ${durations.size}\n`);

    // 5. Разделить: Shorts ≤ 60 сек, Videos > 60 сек
    const regularVideos = [];
    const shorts = [];

    for (const video of allVideos) {
      const secs = durations.get(video.id) ?? 999;
      video.duration = secs; // сохранить длительность в JSON
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

    // 10. Генерация video sitemap
    const sitemapPath = path.join(CONFIG.REPO_DIR, 'sitemap-video.xml');
    generateVideoSitemap(finalVideos, finalShorts, sitemapPath);

    // 11. Деплой
    if (CONFIG.AUTO_DEPLOY) deployToGitHub(videosPath, shortsPath, sitemapPath);
    else console.log('AUTO_DEPLOY off. Run: git add . && git commit && git push\n');

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
  xml += `  <url>\n    <loc>https://paradrutow.com/video.html</loc>\n`;
  for (const v of videos) {
    xml += `    <video:video>\n`;
    xml += `      <video:thumbnail_loc>${v.thumbnail}</video:thumbnail_loc>\n`;
    xml += `      <video:title>${esc(v.title)}</video:title>\n`;
    xml += `      <video:description>${esc(v.description)}</video:description>\n`;
    xml += `      <video:player_loc>https://www.youtube.com/embed/${v.id}</video:player_loc>\n`;
    xml += `      <video:publication_date>${v.publishedAt}</video:publication_date>\n`;
    xml += `    </video:video>\n`;
  }
  xml += `  </url>\n`;
  xml += `  <url>\n    <loc>https://paradrutow.com/shorts.html</loc>\n`;
  for (const s of shorts) {
    xml += `    <video:video>\n`;
    xml += `      <video:thumbnail_loc>${s.thumbnail}</video:thumbnail_loc>\n`;
    xml += `      <video:title>${esc(s.title)}</video:title>\n`;
    xml += `      <video:description>${esc(s.description)}</video:description>\n`;
    xml += `      <video:player_loc>https://www.youtube.com/embed/${s.id}</video:player_loc>\n`;
    xml += `      <video:publication_date>${s.publishedAt}</video:publication_date>\n`;
    xml += `    </video:video>\n`;
  }
  xml += `  </url>\n</urlset>`;
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
function deployToGitHub(videosPath, shortsPath, sitemapPath) {
  console.log('Deploying to GitHub...\n');
  const date = new Date().toISOString().slice(0, 10);
  const msg  = `${CONFIG.GIT_COMMIT_MESSAGE} ${date}`;
  try {
    process.chdir(CONFIG.REPO_DIR);
    execSync(`git add "${videosPath}" "${shortsPath}" "${sitemapPath}"`, { stdio: 'inherit' });
    const status = execSync('git status --porcelain').toString().trim();
    if (!status) { console.log('Nothing to commit — already up to date.\n'); return; }
    execSync(`git commit -m "${msg}"`, { stdio: 'inherit' });
    execSync(`git push origin ${CONFIG.GIT_BRANCH}`, { stdio: 'inherit' });
    console.log(`\nDeployed! https://norveg88.github.io/\n`);
  } catch (err) {
    console.error('Git error:', err.message);
    console.log(`\nRun manually:\n  git add assets/data/videos.json assets/data/shorts.json\n  git commit -m "${msg}"\n  git push origin ${CONFIG.GIT_BRANCH}\n`);
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

async function getUploadsPlaylistId(channelId) {
  const url  = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${CONFIG.API_KEY}`;
  const res  = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  if (!data.items?.[0]) throw new Error('Channel not found');
  return data.items[0].contentDetails.relatedPlaylists.uploads;
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
