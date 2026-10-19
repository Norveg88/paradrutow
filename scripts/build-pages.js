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
  // tagSubject — в теме письма с формы виден язык страницы: «Wiadomość z paradrutow.com [DE]»
  'contact.html': { langs: ['pl', 'en', 'de', 'fr', 'es', 'pt'], metaKey: 'meta_desc_contact', titleKey: 'title_contact', tagSubject: true },
  // Описания узоров переведены, сами PDF — на польском: это сказано на каждой карточке (pat_note_*)
  'patterns.html': { langs: ['pl', 'en', 'de', 'fr', 'es', 'pt'], metaKey: 'meta_desc_patterns', titleKey: 'title_patterns',
                     ldKeys: ['ld_pat_list', 'ld_pat5', 'ld_pat4', 'ld_pat3', 'ld_pat2', 'ld_pat1'] },
  // content — длинный текст не в словарях, а в scripts/i18n-content/privacy.<lang>.html
  // (польский тоже: правим файл .pl.html, сборка вставляет его в privacy.html)
  'privacy.html': { langs: ['pl', 'en', 'de', 'fr', 'es', 'pt'], metaKey: 'meta_desc_privacy', titleKey: 'title_privacy', content: 'privacy' },
  // home — главная: адреса / и /en/; последние ролики, «С чего начать», полка книг и цифры канала
  // вставляются при сборке (renderHome), поэтому главная обновляется вместе с загрузкой видео
  'index.html': { langs: ['pl', 'en', 'de', 'fr', 'es', 'pt'], metaKey: 'meta_desc_home', titleKey: 'title_home', home: true,
                  ldKeys: ['ld_home_desc'] },
};

// ---------- Главная ----------
const HOME = {
  // «С чего начать»: по 4 ролика на уровень (id роликов с YouTube)
  levels: {
    lvl1: ['V9vH-AbZAt4', '0WGzXl8PPN8', 'K2QY1Ud24fI', 'nQ6KLA_zTPw'],
    lvl2: ['g6OTiTDPimU', 'ynPlg_rP_64', 'EEk3HIJJTms', 'weFiywLWaYw'],
    lvl3: ['zVLrfxyxxtA', 'lC2wKNy9VPU', 'DKW-9wvGg50', 'AR2qmviQVPw'],
  },
  latest: 3,          // «Новое на канале» — без повторов с уровнями
  shorts: 6,
  // Полка книг: на польской главной — польские издания, на остальных — английские
  books: {
    pl:    [['book13', 'Sekretne życie włóczki'], ['book11', 'Dom na drutach'], ['book8', 'Sweter z historią'],
            ['book7', 'Para Drutów. Miejsce, w którym ludzie zostają'], ['book5', '16 Pięt do Skarpetek'], ['book6', 'Planner Dziewiarski']],
    other: [['book12', 'The Secret Life of Yarn'], ['book10', 'The Knitted Home'], ['book9', 'Your Knitting Journey']],
  },
};
const OG_LOCALE = { pl: 'pl_PL', en: 'en_US', de: 'de_DE', fr: 'fr_FR', es: 'es_ES', pt: 'pt_BR' };

// index.html открывается как / и /en/ (без имени файла)
const pagePath = file => file === 'index.html' ? '' : file;
const pageUrl  = (file, lang) => lang === DEFAULT_LANG ? `/${pagePath(file)}` : `/${lang}/${pagePath(file)}`;
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

  if (cfg.home) html = renderHome(html, lang);

  const sw = /<div class="lang-switcher">[\s\S]*?<\/div>/;
  if (!sw.test(html)) throw new Error(`${file}: lang-switcher not found`);
  html = html.replace(sw, () => renderSwitcher(file, cfg.langs));

  const alt = /<!-- i18n:alternates[\s\S]*?<!-- \/i18n:alternates -->/;
  const block = renderAlternates(file, cfg.langs);
  if (alt.test(html)) html = html.replace(alt, () => block);
  else html = html.replace(/(<link rel="canonical"[^>]*>)/, (m) => `${m}\n    ${block}`);
  return html;
}

// Главная: блоки между <!-- home:имя --> и <!-- /home:имя -->
function renderHome(html, lang) {
  const d = dict(lang);
  const videos = readJson(path.join(ROOT, 'assets/data', 'videos.json'));
  const shorts = readJson(path.join(ROOT, 'assets/data', 'shorts.json'));
  const ch = readJson(path.join(ROOT, 'assets/data', 'channel.json'));
  const byId = new Map(videos.map(v => [v.id, v]));
  const linkTo = f => (PAGES[f] && PAGES[f].langs.includes(lang)) ? pageUrl(f, lang) : `/${f}`;
  const need = k => { if (d[k] === undefined) throw new Error(`${lang}.json: ${k} missing`); return d[k]; };
  const shown = [];
  const pick = ids => ids.map(id => { const v = byId.get(id); if (!v) throw new Error(`home: video ${id} not in videos.json`); shown.push(v); return v; });

  const block = (name, inner) => {
    const re = new RegExp(`(<!-- home:${name}\\b.*?-->\\n)([ \\t]*)[\\s\\S]*?\\n([ \\t]*<!-- \\/home:${name} -->)`);
    if (!re.test(html)) throw new Error(`index.html: home:${name} markers not found`);
    html = html.replace(re, (m, a, ind, b) => a + inner(ind) + '\n' + b);
  };

  // Цифры канала одной фразой (формы слов — по правилам языка)
  const nf = new Intl.NumberFormat(lang);
  const pr = new Intl.PluralRules(lang);
  const word = (base, n) => d[`${base}_${pr.select(n)}`] ?? need(`${base}_other`);
  const fill = t => t
    .replace('{views}', nf.format(Math.floor(ch.viewCount / 1e6)))
    .replace('{videos}', `${nf.format(ch.videoCount)} ${word('home_n_videos', ch.videoCount)}`)
    .replace('{people}', `${nf.format(ch.subscriberCount)} ${word('home_n_people', ch.subscriberCount)}`);
  block('proof', ind => `${ind}<p class="hero-proof"><span class="proof-main">${fill(need('home_proof'))}</span>` +
    `<span class="proof-meta">${fill(need('home_proof_meta'))}</span></p>`);

  const cards = (list, ind, cls) => `${ind}<div class="${cls} js-video-cards">\n` +
    renderCards(list, 'video', lang).split('\n').map(l => ind + '    ' + l).join('\n') + `\n${ind}</div>`;
  for (const [k, ids] of Object.entries(HOME.levels)) block(k, ind => cards(pick(ids), ind, 'vgrid'));
  const levelIds = new Set(Object.values(HOME.levels).flat());
  const latest = videos.filter(v => !levelIds.has(v.id)).slice(0, HOME.latest);
  shown.push(...latest);
  block('latest', ind => cards(latest, ind, 'vgrid vgrid-3'));

  block('shorts', ind => `${ind}<div class="shorts-strip">\n` + shorts.slice(0, HOME.shorts).map(s => {
    const t = esc(titleOf(s, lang));
    return `${ind}    <a class="short-thumb" href="${linkTo('shorts.html')}"><img src="${esc(s.thumbnail)}" alt="${t}" loading="lazy" decoding="async"><span>${t}</span></a>`;
  }).join('\n') + `\n${ind}</div>`);

  const books = HOME.books[lang] || HOME.books.other;
  block('books', ind => `${ind}<div class="shelf">\n` + books.map(([img, title]) =>
    `${ind}    <a href="${linkTo('books.html')}" title="${esc(title)}"><img src="/assets/img/home/${img}.webp" alt="${esc(title)}" width="300" height="450" loading="lazy" decoding="async"></a>`
  ).join('\n') + `\n${ind}</div>`);

  // Названия роликов на всех языках — для флагов (video-langs.js), без загрузки videos.json
  const data = {};
  for (const v of shown) data[v.id] = { title: v.title, titles: v.titles || {} };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  html = html.replace(/\n?<script type="application\/json" id="home-video-data">[\s\S]*?<\/script>/, '');
  html = html.replace('</main>', `</main>\n<script type="application/json" id="home-video-data">${json}</script>`);
  return html;
}

// Текст страницы на языке lang между <!-- i18n:content --> и <!-- /i18n:content -->
function applyContent(html, file, cfg, lang) {
  const f = path.join(__dirname, 'i18n-content', `${cfg.content}.${lang}.html`);
  if (!fs.existsSync(f)) throw new Error(`${file}: ${path.relative(ROOT, f)} missing`);
  const body = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const re = /(<!-- i18n:content\b.*?-->\n)[\s\S]*?(\n\s*<!-- \/i18n:content -->)/;
  if (!re.test(html)) throw new Error(`${file}: i18n:content markers not found`);
  return html.replace(re, (m, a, b) => a + body + b);
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

  html = html.replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${OG_LOCALE[lang]}$2`);
  html = html.split('/assets/img/og-home-pl.jpg').join(`/assets/img/og-home-${lang}.jpg`);
  html = html.split('"inLanguage":"pl"').join(`"inLanguage":"${lang}"`);

  if (cfg.tagSubject) {
    const re = /(<input type="hidden" name="_subject" value=")([^"]*?)(?: \[[A-Z]{2}\])?(")/;
    if (!re.test(html)) throw new Error(`${file}: _subject not found`);
    html = html.replace(re, (m, a, v, b) => `${a}${v} [${lang.toUpperCase()}]${b}`);
  }

  // внутренние ссылки на страницы, у которых есть версия на этом языке
  for (const [f, c] of Object.entries(PAGES)) {
    if (!c.langs.includes(lang)) continue;
    html = html.split(`href="/${f}"`).join(`href="${pageUrl(f, lang)}"`);
    if (f === 'index.html') html = html.split('href="/"').join(`href="${pageUrl(f, lang)}"`);
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
      let html = cfg.content ? applyContent(base, file, cfg, lang) : base;
      if (lang !== DEFAULT_LANG) html = translate(html, file, cfg, lang);
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
