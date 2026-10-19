/* =====================================================
   Сборщик языковых версий страниц — Para Drutów

   Источник — польская страница в корне сайта (video.html, shorts.html).
   Её правим как обычно, затем:   node scripts/build-pages.js
   Скрипт:
     • вставляет карточки роликов прямо в HTML (их видит Google, а не только скрипт);
     • собирает версии /en/video.html и т.д.: <html lang>, canonical, title,
       description, тексты меню и подписи из assets/i18n/<lang>.json, названия роликов;
     • ставит hreflang на все версии и обновляет sitemap.xml.
   fetch-videos.js запускает сборку сам после загрузки роликов.

   Новый язык страницы: добавить его в PAGES[...].langs (когда тексты переведены).
   ===================================================== */
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://paradrutow.com';
const ALL_LANGS = ['pl', 'en', 'de', 'fr', 'es', 'pt'];   // кнопки переключателя
const DEFAULT_LANG = 'pl';                                // корень сайта, x-default

const PAGES = {
  'video.html':  { langs: ['pl', 'en', 'de', 'fr', 'es', 'pt'], data: 'videos.json', kind: 'video', metaKey: 'meta_desc_video', titleKey: 'title_video' },
  'shorts.html': { langs: ['pl', 'en', 'de', 'fr', 'es', 'pt'], data: 'shorts.json', kind: 'short', metaKey: 'meta_desc_shorts', titleKey: 'title_shorts' },
  // ldKeys — строки JSON-LD, которые переводятся: в польском исходнике стоит значение из pl.json
  'apps.html':   { langs: ['pl', 'en', 'de', 'fr', 'es', 'pt'], metaKey: 'meta_desc_apps', titleKey: 'title_apps',
                   ldKeys: ['ld_apps_name', 'ld_wzorai_desc', 'ld_wzorai_offer', 'ld_shift_desc'] },
};

const pageUrl  = (file, lang) => lang === DEFAULT_LANG ? `/${file}` : `/${lang}/${file}`;
const fullUrl  = (file, lang) => SITE + pageUrl(file, lang);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const dictFile = lang => readJson(path.join(ROOT, 'assets/i18n', `${lang}.json`));
// Чего нет в словаре языка — берём из английского (как lang.js для ES/PT), но не из польского
const dict = lang => lang === 'en' ? dictFile('en') : { ...dictFile('en'), ...dictFile(lang) };

function titleOf(item, lang) {
  const t = item.titles || {};
  return t[lang] || t.pl || item.title;
}

function fmtDuration(secs) {
  return secs < 60 ? `0:${String(secs).padStart(2, '0')}` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

// ---------- карточки (та же разметка, что создают videos.js / shorts.js) ----------
function renderCards(items, kind, lang) {
  const p = kind === 'video' ? 'vc' : 'sc';
  const cls = kind === 'video' ? 'video-card' : 'short-card';
  return items.map(it => {
    const t = esc(titleOf(it, lang));
    const dur = kind === 'short' && it.duration ? `<div class="sc-duration">${fmtDuration(it.duration)}</div>` : '';
    return `<div class="${cls}" data-id="${esc(it.id)}"><div class="${p}-media"><div class="${p}-preview">` +
      `<img src="${esc(it.thumbnail)}" alt="${t}" loading="lazy"><div class="${p}-play">&#9658;</div>${dur}</div></div>` +
      `<div class="${p}-body"><h2 class="${p}-title">${t}</h2></div></div>`;
  }).join('\n');
}

// ---------- переключатель языков: ссылки на существующие версии, кнопки для остальных ----------
function renderSwitcher(file, langs) {
  const items = ALL_LANGS.map(l => langs.includes(l)
    ? `                <a data-lang="${l}" href="${pageUrl(file, l)}" hreflang="${l}">${l.toUpperCase()}</a>`
    : `                <button data-lang="${l}">${l.toUpperCase()}</button>`);
  return `<div class="lang-switcher">\n${items.join('\n')}\n            </div>`;
}

function renderAlternates(file, langs) {
  const links = langs.map(l => `    <link rel="alternate" hreflang="${l}" href="${fullUrl(file, l)}">`);
  links.push(`    <link rel="alternate" hreflang="x-default" href="${fullUrl(file, DEFAULT_LANG)}">`);
  return `<!-- i18n:alternates (scripts/build-pages.js) -->\n${links.join('\n')}\n    <meta name="pd-versions" content="${langs.join(',')}">\n    <!-- /i18n:alternates -->`;
}

// Общая часть для всех версий: карточки, переключатель, hreflang
function applyCommon(html, file, cfg, lang, items) {
  if (cfg.kind) {
    const id = cfg.kind === 'video' ? 'videos' : 'shorts';
    const container = new RegExp(`<div id="${id}-container"[^>]*>[\\s\\S]*?<\\/div><!-- \\/${id}-container -->|<div id="${id}-container"><\\/div>`);
    if (!container.test(html)) throw new Error(`${file}: #${id}-container not found`);
    html = html.replace(container, () => `<div id="${id}-container" data-pre="1">\n${renderCards(items, cfg.kind, lang)}\n</div><!-- /${id}-container -->`);
    // лоадер не нужен — карточки уже в HTML
    html = html.replace(new RegExp(`<div id="${id}-loader" class="videos-loader"[^>]*>`), `<div id="${id}-loader" class="videos-loader" style="display:none">`);
  }

  const sw = /<div class="lang-switcher">[\s\S]*?<\/div>/;
  if (!sw.test(html)) throw new Error(`${file}: lang-switcher not found`);
  html = html.replace(sw, () => renderSwitcher(file, cfg.langs));

  const alt = /<!-- i18n:alternates[\s\S]*?<!-- \/i18n:alternates -->/;
  const block = renderAlternates(file, cfg.langs);
  if (alt.test(html)) html = html.replace(alt, () => block);
  else html = html.replace(/(<link rel="canonical"[^>]*>)/, (m) => `${m}\n    ${block}`);
  return html;
}

// Перевод польского исходника на язык lang
function translate(html, file, cfg, lang) {
  const d = dict(lang);
  const missing = new Set();
  const val = k => { if (d[k] === undefined) missing.add(k); return d[k]; };

  html = html.replace(/<html lang="[^"]*">/, `<html lang="${lang}">`);
  const url = fullUrl(file, lang);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);

  const title = val(cfg.titleKey), desc = val(cfg.metaKey);
  if (title) html = html.replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*(")/g, (m, a, b) => a + esc(title) + b);
  if (desc) html = html.replace(/(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*(")/g, (m, a, b) => a + esc(desc) + b);

  // элементы с data-i18n: содержимое берём из словаря (как это делает lang.js)
  html = html.replace(/(<([a-z][a-z0-9]*)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, open, tag, key, inner, close) => {
    if (new RegExp(`<${tag}\\b`).test(inner)) throw new Error(`${file}: nested <${tag}> inside data-i18n="${key}"`);
    const v = val(key);
    return v === undefined ? m : open + v + close;
  });
  html = html.replace(/(<[^>]*\sdata-i18n-placeholder="([^"]+)"[^>]*>)/g, (m, tagStr, key) => {
    const v = val(key);
    return v === undefined ? m : tagStr.replace(/(\s)placeholder="[^"]*"/, `$1placeholder="${esc(v)}"`);
  });

  // картинки по языку: data-i18n-img="/assets/img/WzorAI{lang}.png"; если файла на этом языке нет — английский
  const imgFor = tpl => {
    const pick = l => tpl.replace('{lang}', l);
    return fs.existsSync(path.join(ROOT, pick(lang))) ? pick(lang) : pick('en');
  };
  const imgSwaps = [];
  html = html.replace(/<img\b[^>]*\sdata-i18n-img="([^"]+)"[^>]*>/g, (tag, tpl) => {
    const plSrc = tpl.replace('{lang}', DEFAULT_LANG), src = imgFor(tpl);
    if (plSrc !== src) imgSwaps.push([plSrc, src]);
    return tag.replace(/(\ssrc=")[^"]*(")/, `$1${src}$2`);
  });
  // та же картинка в og:image / twitter:image / JSON-LD
  for (const [a, b] of imgSwaps) html = html.split(a).join(b);

  // JSON-LD: переводимые строки и адрес страницы
  if (cfg.ldKeys) {
    const pl = dictFile(DEFAULT_LANG);
    html = html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (m, a, body, c) => {
      for (const k of cfg.ldKeys) {
        if (!pl[k]) throw new Error(`pl.json: ${k} missing`);
        const from = JSON.stringify(pl[k]);
        if (!body.includes(from)) throw new Error(`${file}: JSON-LD text for ${k} differs from pl.json`);
        body = body.split(from).join(JSON.stringify(val(k) ?? pl[k]));
      }
      body = body.split(`"${fullUrl(file, DEFAULT_LANG)}"`).join(`"${fullUrl(file, lang)}"`);
      JSON.parse(body);
      return a + body + c;
    });
  }

  // внутренние ссылки на страницы, у которых есть версия на этом языке
  for (const [f, c] of Object.entries(PAGES)) {
    if (c.langs.includes(lang)) html = html.split(`href="/${f}"`).join(`href="${pageUrl(f, lang)}"`);
  }
  if (missing.size) console.warn(`  ! ${lang}/${file}: no translation for ${[...missing].join(', ')} — left in Polish`);
  return html;
}

function writeIfChanged(p, content) {
  const old = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (old === content) return false;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  return true;
}

// ---------- sitemap.xml: версии страниц со ссылками друг на друга ----------
function updateSitemap() {
  const p = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(p, 'utf8');
  for (const [file, cfg] of Object.entries(PAGES)) {
    const loc0 = fullUrl(file, DEFAULT_LANG);
    const m = xml.match(new RegExp(`  <url>\\s*<loc>${loc0.replace(/[.]/g, '\\.')}</loc>[\\s\\S]*?</url>`));
    if (!m) throw new Error(`sitemap: ${loc0} not found`);
    const get = tag => (m[0].match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) || [])[1];
    const lastmod = get('lastmod'), freq = get('changefreq'), prio = get('priority');
    const alts = cfg.langs.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${fullUrl(file, l)}"/>`)
      .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${loc0}"/>`).join('\n');
    const block = cfg.langs.map(l => `  <url>\n    <loc>${fullUrl(file, l)}</loc>\n${alts}\n` +
      (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') + (freq ? `    <changefreq>${freq}</changefreq>\n` : '') +
      (prio ? `    <priority>${prio}</priority>\n` : '') + `  </url>`).join('\n');
    // убрать прежние блоки этой страницы (основной и языковые) и вставить новые на место основного
    const others = cfg.langs.filter(l => l !== DEFAULT_LANG).map(l => fullUrl(file, l));
    for (const u of others) xml = xml.replace(new RegExp(`  <url>\\s*<loc>${u.replace(/[.]/g, '\\.')}</loc>[\\s\\S]*?</url>\\n?`), '');
    xml = xml.replace(new RegExp(`  <url>\\s*<loc>${loc0.replace(/[.]/g, '\\.')}</loc>[\\s\\S]*?</url>`), () => block);
  }
  return writeIfChanged(p, xml);
}

function build() {
  const changed = [];
  for (const [file, cfg] of Object.entries(PAGES)) {
    const items = cfg.data ? readJson(path.join(ROOT, 'assets/data', cfg.data)) : [];
    const srcPath = path.join(ROOT, file);
    const src = fs.readFileSync(srcPath, 'utf8');
    const CRLF = src.includes('\r\n');
    const base = src.replace(/\r\n/g, '\n');
    for (const lang of cfg.langs) {
      // сначала перевод (он переписывает внутренние ссылки), потом переключатель и hreflang
      let html = lang === DEFAULT_LANG ? base : translate(base, file, cfg, lang);
      html = applyCommon(html, file, cfg, lang, items);
      if (CRLF) html = html.replace(/\n/g, '\r\n');
      const out = lang === DEFAULT_LANG ? srcPath : path.join(ROOT, lang, file);
      if (writeIfChanged(out, html)) changed.push(path.relative(ROOT, out).replace(/\\/g, '/'));
    }
  }
  if (updateSitemap()) changed.push('sitemap.xml');
  console.log(changed.length ? `build-pages: updated ${changed.join(', ')}` : 'build-pages: nothing changed');
  return changed;
}

// Для генерации video-sitemap и других скриптов
function versionsOf(file) { return (PAGES[file] || { langs: [DEFAULT_LANG] }).langs; }

module.exports = { build, PAGES, pageUrl, fullUrl, titleOf, versionsOf, DEFAULT_LANG };

if (require.main === module) build();
