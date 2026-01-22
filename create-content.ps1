$base = "content"

$languages = @(
  @{ code="pl"; title="Para Drutów"; home="Strona informacyjna o dziewiarstwie." },
  @{ code="en"; title="Para Drutów"; home="An informational website about knitting." },
  @{ code="uk"; title="Para Drutów"; home="Інформаційний сайт про вʼязання." },
  @{ code="ru"; title="Para Drutów"; home="Информационный сайт о вязании." },
  @{ code="de"; title="Para Drutów"; home="Eine Informationsseite über Stricken." },
  @{ code="fr"; title="Para Drutów"; home="Un site d'information sur le tricot." }
)

$sections = @(
  @{ name="videos"; title=@{pl="Wideo"; en="Videos"; uk="Відео"; ru="Видео"; de="Videos"; fr="Vidéos"} },
  @{ name="apps"; title=@{pl="Aplikacje"; en="Apps"; uk="Додатки"; ru="Приложения"; de="Apps"; fr="Applications"} },
  @{ name="books"; title=@{pl="Książki"; en="Books"; uk="Книги"; ru="Книги"; de="Bücher"; fr="Livres"} },
  @{ name="patterns"; title=@{pl="Wzory"; en="Patterns"; uk="Візерунки"; ru="Узоры"; de="Muster"; fr="Motifs"} },
  @{ name="contact"; title=@{pl="Kontakt"; en="Contact"; uk="Контакт"; ru="Контакты"; de="Kontakt"; fr="Contact"} }
)

foreach ($lang in $languages) {
  $langPath = Join-Path $base $lang.code
  New-Item -ItemType Directory -Force -Path $langPath | Out-Null

  # Главная
  $homeFile = Join-Path $langPath "_index.md"
  if (!(Test-Path $homeFile)) {
@"
---
title: "$($lang.title)"
---

🧶 **Para Drutów**

$($lang.home)
"@ | Set-Content $homeFile -Encoding UTF8
  }

  # Разделы
  foreach ($section in $sections) {
    $sectionPath = Join-Path $langPath $section.name
    New-Item -ItemType Directory -Force -Path $sectionPath | Out-Null

    $indexFile = Join-Path $sectionPath "_index.md"
    if (!(Test-Path $indexFile)) {
@"
---
title: "$($section.title[$lang.code])"
---

"@ | Set-Content $indexFile -Encoding UTF8
    }
  }
}

Write-Host "✅ Структура content/ создана успешно" -ForegroundColor Green
