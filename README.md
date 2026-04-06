# ARB Locale Editor

A lightweight browser-based editor for Flutter `.arb` localization files.

## What it supports

- Import one or many `.arb` files
- Infer locale from `@@locale` or filename pattern `app_<locale>.arb`
- Edit message keys and translations across locales
- Edit metadata in template locale (`@key.description`, `@key.placeholders`)
- Add locale files and new message keys
- Basic checks for missing translations and missing descriptions
- Export current locale or all locales as pretty-printed ARB

## Run it

Open `index.html` in your browser.

## Notes for Flutter `gen-l10n`

- Keep files under your configured `arb-dir` (commonly `lib/l10n`)
- Use `flutter gen-l10n` or `flutter run` after saving files
- Typical naming: `app_en.arb`, `app_es.arb`, etc.
