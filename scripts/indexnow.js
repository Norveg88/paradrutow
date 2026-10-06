// IndexNow: сообщает Bing (а через него DuckDuckGo, Yahoo, Ecosia, Copilot),
// Yandex, Seznam и Naver, что страницы сайта изменились. Google IndexNow не использует.
//
//   node scripts/indexnow.js                  — всё, что изменилось с прошлой отправки
//                                               (если отправок ещё не было — последний коммит)
//   node scripts/indexnow.js --since <commit> — изменённые начиная с указанного коммита
//   node scripts/indexnow.js --all            — все страницы из sitemap.xml
//   node scripts/indexnow.js books.html       — конкретные страницы
//   ... --dry                                 — только показать, ничего не отправлять
//
// Отправляется только то, что уже на GitHub (origin/main), и только адреса из sitemap.xml:
// 404 и служебные файлы — никогда. Место последней отправки хранится в
// scripts/.indexnow-state.json (локально, в репозиторий не попадает).
// fetch-videos.js вызывает этот скрипт после каждого пуша — отдельно запускать не нужно.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOST = 'paradrutow.com';
const KEY  = '09b5f0ccea4a8a8d78b17e47c6ea755d';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const args = process.argv.slice(2);
const dry  = args.includes('--dry');
const all  = args.includes('--all');
const sinceIdx = args.indexOf('--since');
const since = sinceIdx >= 0 ? args[sinceIdx + 1] : null;
const files = args.filter((a, i) => !a.startsWith('--') && (sinceIdx < 0 || i !== sinceIdx + 1));

// Адреса из sitemap.xml — только они считаются страницами сайта
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const allowed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

const toUrl = (f) => {
  const name = f.replace(/\\/g, '/').replace(/^\.\//, '');
  return name === 'index.html' ? `https://${HOST}/` : `https://${HOST}/${name}`;
};

// Данные, от которых зависит содержимое страницы
const DATA_TO_PAGE = {
  'assets/data/videos.json':  'video.html',
  'assets/data/channel.json': 'video.html',
  'assets/data/shorts.json':  'shorts.html'
};

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}

// Отправляем только то, что уже на GitHub: конец диапазона — origin/main
function endRef() {
  try { git('rev-parse --verify origin/main'); return 'origin/main'; } catch (e) { return 'HEAD'; }
}

// Запоминаем, до какого коммита всё уже отправлено (локальный файл, не в репозитории)
const STATE = path.join(__dirname, '.indexnow-state.json');
function readLast() {
  try {
    const c = JSON.parse(fs.readFileSync(STATE, 'utf8')).lastCommit;
    git(`merge-base --is-ancestor ${c} ${endRef()}`); // коммит всё ещё в истории?
    return c;
  } catch (e) { return null; }
}
function saveLast() {
  fs.writeFileSync(STATE, JSON.stringify({ lastCommit: git(`rev-parse ${endRef()}`), at: new Date().toISOString() }, null, 2));
}

function changedFiles() {
  const end = endRef();
  const last = readLast();
  const range = since ? `${since}..${end}` : last ? `${last}..${end}` : `${end}~1..${end}`;
  console.log(`IndexNow: изменения ${range}${!since && last ? ' (с прошлой отправки)' : ''}`);
  const list = git(`diff --name-only ${range}`).split(/\r?\n/).filter(Boolean);
  // Страница, в которой поменялась только версия подключённых файлов (?v=13 -> ?v=14),
  // для поисковика не изменилась — такие не отправляем
  return list.filter((f) => !/\.html$/.test(f) || !onlyVersionBump(range, f));
}

function onlyVersionBump(range, file) {
  const diff = git(`diff -U0 ${range} -- "${file}"`).split(/\r?\n/);
  const norm = (l) => l.slice(1).replace(/\?v=\d+/g, '?v=').trim();
  const minus = diff.filter((l) => l.startsWith('-') && !l.startsWith('---')).map(norm).sort();
  const plus  = diff.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map(norm).sort();
  return minus.length > 0 && minus.length === plus.length && minus.every((l, i) => l === plus[i]);
}

let pages;
if (all) pages = allowed.slice();
else {
  const list = files.length ? files : changedFiles();
  const html = list.map((f) => DATA_TO_PAGE[f.replace(/\\/g, '/')] || f).filter((f) => /^[^/\\]+\.html$/.test(f));
  pages = [...new Set(html.map(toUrl))].filter((u) => allowed.includes(u));
}

// Запоминать место можно, только если проверены все изменения, а не выбранные вручную файлы
const tracksState = !dry && !files.length && !since;

if (!pages.length) {
  console.log('IndexNow: изменённых страниц нет — отправлять нечего.');
  if (tracksState) saveLast();
  process.exit(0);
}

console.log(`IndexNow: ${pages.length} адрес(ов)`);
pages.forEach((u) => console.log('  ' + u));
if (dry) { console.log('(--dry: ничего не отправлено)'); process.exit(0); }

(async () => {
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: pages })
    });
    const MSG = {
      200: 'принято',
      202: 'принято, ключ ещё проверяется',
      400: 'неверный запрос',
      403: 'ключ не подтверждён — файл ключа недоступен на сайте?',
      422: 'адреса не относятся к сайту или ключ не совпадает',
      429: 'слишком много запросов — повторите позже'
    };
    console.log(`IndexNow: ответ ${res.status} — ${MSG[res.status] || res.statusText}`);
    if (res.status >= 400) process.exitCode = 1;
    else if (tracksState) saveLast(); // отправлено — в следующий раз начнём отсюда
  } catch (err) {
    console.log('IndexNow: не удалось отправить — ' + err.message);
    process.exitCode = 1;
  }
})();
