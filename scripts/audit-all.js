// Полная проверка сайта: node scripts/audit-all.js
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const files = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n');
const html = files.filter(f => f.endsWith('.html') && !f.startsWith('scripts/'));
const exists = u => fs.existsSync(path.join(ROOT, decodeURIComponent(u.replace(/^\//, '').split(/[?#]/)[0]) || 'index.html'));
const issues = [], refs = new Set();
const add = (f, m) => issues.push(`${f}: ${m}`);

for (const f of html) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const lang = (s.match(/<html lang="([^"]+)"/) || [])[1];
  // ссылки и ресурсы
  for (const m of s.matchAll(/\s(?:href|src|content|srcset|data-i18n-img)="([^"]+)"/g)) {
    let u = m[1];
    for (const part of u.split(',')) {
      let p = part.trim().split(' ')[0];
      if (p.startsWith('https://paradrutow.com/')) p = p.slice('https://paradrutow.com'.length);
      if (!p.startsWith('/') || p.startsWith('//')) continue;
      if (p.includes('{lang}')) { for (const l of ['pl', 'en']) refs.add(p.replace('{lang}', l).replace(/^\//, '').split(/[?#]/)[0]); continue; }
      const clean = decodeURIComponent(p.replace(/^\//, '').split(/[?#]/)[0]);
      refs.add(clean.endsWith('/') || clean === '' ? clean + 'index.html' : clean);
      const target = clean === '' || clean.endsWith('/') ? clean + 'index.html' : clean;
      if (!fs.existsSync(path.join(ROOT, target))) add(f, `missing ${p}`);
    }
  }
  // JSON-LD
  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { add(f, 'bad JSON-LD: ' + e.message); }
  }
  // мета
  const t = (s.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1] || '';
  const d = (s.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  if (f !== '404.html') {
    if (!t) add(f, 'no title'); if (t.length > 70) add(f, `title ${t.length} chars`);
    if (!d) add(f, 'no description'); if (d.replace(/&amp;/g, '&').length > 160) add(f, `description ${d.length} chars (Google показывает ~155)`);
    if (!/<link rel="canonical"/.test(s)) add(f, 'no canonical');
    if (!/hreflang="x-default"/.test(s)) add(f, 'no hreflang');
    const h1 = (s.match(/<h1\b/g) || []).length; if (h1 !== 1) add(f, `${h1} h1`);
  }
  if (/StitchAI/i.test(s)) add(f, 'mentions StitchAI');
  if (/feature\.jpg/.test(s)) add(f, 'uses feature.jpg');
  if (/hreflang="(ru|uk)"|data-lang="(ru|ua|uk)"/.test(s)) add(f, 'ru/ua leftovers');
  if (/[ąęłńśźżó]/i.test(s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/Para Drutów|Drutów|alt="[^"]*"|title="[^"]*"/g, '')) && lang && lang !== 'pl') {
    // полишская буква в тексте не-польской страницы — нормально для названий книг; считаем строки
  }
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i); if (dup.length) add(f, 'duplicate id: ' + [...new Set(dup)].join(','));
  for (const m of s.matchAll(/href="#([^"]+)"/g)) if (m[1] && !ids.includes(m[1])) add(f, 'anchor without target #' + m[1]);
  for (const m of s.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)) add(f, 'img without alt ' + m[0].slice(0, 60));
}
// css/js тоже ссылаются на файлы
for (const f of files.filter(f => /\.(css|js)$/.test(f) && f.startsWith('assets/'))) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of s.matchAll(/["'(](\/assets\/[^"')?#\s]+)/g)) refs.add(m[1].slice(1));
  for (const m of s.matchAll(/\/assets\/i18n\/\$\{[^}]+\}\.json/g)) ['pl', 'en', 'de', 'fr', 'es', 'pt'].forEach(l => refs.add(`assets/i18n/${l}.json`));
  if (/flags\/\$\{/.test(s)) ['pl', 'en', 'de', 'fr', 'es', 'pt'].forEach(l => refs.add(`assets/img/flags/${l}.svg`));
  if (/VIDEOS_JSON_URL|videos\.json/.test(s)) refs.add('assets/data/videos.json');
  if (/shorts\.json/.test(s)) refs.add('assets/data/shorts.json');
  if (/channel\.json/.test(s)) refs.add('assets/data/channel.json');
}
const unused = files.filter(f => f.startsWith('assets/') && !refs.has(f));
console.log('PAGES:', html.length);
console.log('ISSUES (' + issues.length + '):\n  ' + issues.join('\n  '));
console.log('UNUSED ASSETS (' + unused.length + '):');
for (const f of unused) console.log('  ' + f + '  ' + Math.round(fs.statSync(path.join(ROOT, f)).size / 1024) + ' KB');
console.log('OTHER FILES:', files.filter(f => !f.startsWith('assets/') && !f.endsWith('.html')).join(', '));
