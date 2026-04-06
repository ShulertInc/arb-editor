# ARB Locale Editor

> [!CAUTION]
> **Disclaimer**: This project was written almost completely by AI and may contain bugs, security issues, and other problems. Use at your own risk and please review the code before running it.

A lightweight browser-based editor for Flutter `.arb` localization files, with SQLite persistence.

## What it supports

- Import one or many `.arb` files
- Infer locale from `@@locale` or filename pattern `app_<locale>.arb`
- Edit message keys and translations across locales
- Edit metadata in template locale (`@key.description`, `@key.placeholders`)
- Add locale files and new message keys
- Basic checks for missing translations and missing descriptions
- Export current locale or all locales as pretty-printed ARB
- Persist all locale/message data on the server in SQLite
- Auto-translate missing message values with DeepL

## Run it

1. Install dependencies:

    ```bash
    npm install
    ```

2. Start the server:

    ```bash
    DEEPL_API_KEY=your_key_here npm run server
    ```

    If you do not set `DEEPL_API_KEY`, the editor still works, but DeepL translation will be unavailable.

    Optional environment variable:
    - `DEEPL_API_URL` (defaults to `https://api-free.deepl.com/v2/translate`)

3. Open:

    ```text
    http://localhost:3000
    ```

SQLite DB file location:

- `data/arb-editor.db`

Server API endpoints:

- `GET /api/state` - fetch persisted editor state
- `PUT /api/state` - persist current editor state
- `POST /api/translate` - translate text for target locales via DeepL
- `GET /api/health` - health check

## Notes for Flutter `gen-l10n`

- Keep files under your configured `arb-dir` (commonly `lib/l10n`)
- Use `flutter gen-l10n` or `flutter run` after saving files
- Typical naming: `app_en.arb`, `app_es.arb`, etc.
