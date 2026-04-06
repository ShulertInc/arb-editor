import Database from 'better-sqlite3';
import dotenv from 'config-dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {
    deepLSupportedSources,
    deepLSupportedTargets,
} from './deepl-config.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    'data',
);
const dbPath = path.join(dataDir, 'arb-editor.db');

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS editor_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const insertDefaultStmt = db.prepare(`
  INSERT OR IGNORE INTO editor_state (id, data, updated_at)
  VALUES (1, @data, @updated_at)
`);

insertDefaultStmt.run({
    data: JSON.stringify({ locales: {} }),
    updated_at: new Date().toISOString(),
});

const getStateStmt = db.prepare('SELECT data FROM editor_state WHERE id = 1');
const updateStateStmt = db.prepare(`
  UPDATE editor_state
  SET data = @data, updated_at = @updated_at
  WHERE id = 1
`);

function parseStateRow() {
    const row = getStateStmt.get();
    if (!row) return { locales: {} };
    try {
        const parsed = JSON.parse(row.data);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { locales: {} };
        }
        if (
            !parsed.locales ||
            typeof parsed.locales !== 'object' ||
            Array.isArray(parsed.locales)
        ) {
            return { locales: {} };
        }
        return parsed;
    } catch {
        return { locales: {} };
    }
}

function isValidState(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return false;
    }
    const { locales } = payload;
    if (!locales || typeof locales !== 'object' || Array.isArray(locales)) {
        return false;
    }

    for (const [locale, arb] of Object.entries(locales)) {
        if (typeof locale !== 'string' || locale.trim() === '') {
            return false;
        }
        if (!arb || typeof arb !== 'object' || Array.isArray(arb)) {
            return false;
        }
    }

    return true;
}

function toDeepLCode(locale, kind) {
    if (typeof locale !== 'string' || locale.trim() === '') {
        return null;
    }

    const normalized = locale.replace(/_/g, '-').toUpperCase();
    const [base, region] = normalized.split('-');

    if (kind === 'source') {
        return deepLSupportedSources.has(base) ? base : null;
    }

    if (base === 'EN') {
        if (region === 'US') return 'EN-US';
        if (region === 'GB') return 'EN-GB';
        return 'EN';
    }
    if (base === 'PT') {
        if (region === 'BR') return 'PT-BR';
        if (region === 'PT') return 'PT-PT';
        return 'PT-BR';
    }
    if (base === 'ZH') {
        if (region === 'HANS') return 'ZH-HANS';
        if (region === 'HANT') return 'ZH-HANT';
        return 'ZH';
    }

    if (deepLSupportedTargets.has(normalized)) {
        return normalized;
    }

    return deepLSupportedTargets.has(base) ? base : null;
}

app.use(express.json({ limit: '2mb' }));
app.use(
    express.static(
        path.join(path.dirname(new URL(import.meta.url).pathname), 'dist'),
    ),
);

app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

app.get('/api/state', (_req, res) => {
    res.json(parseStateRow());
});

app.post('/api/translate', async (req, res) => {
    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
        res.status(500).json({
            error: 'DEEPL_API_KEY is not configured on the server.',
        });
        return;
    }

    const sourceText = req.body?.sourceText;
    const sourceLocale = req.body?.sourceLocale;
    const targets = req.body?.targets;

    if (typeof sourceText !== 'string' || sourceText.trim() === '') {
        res.status(400).json({
            error: 'sourceText must be a non-empty string.',
        });
        return;
    }

    if (!Array.isArray(targets) || targets.length === 0) {
        res.status(400).json({ error: 'targets must be a non-empty array.' });
        return;
    }

    const sourceLang = toDeepLCode(sourceLocale, 'source');
    const endpoint =
        process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';

    const results = await Promise.all(
        targets.map(async locale => {
            const targetLang = toDeepLCode(locale, 'target');
            if (!targetLang) {
                return {
                    locale,
                    ok: false,
                    error: `Locale ${locale} is not supported by DeepL.`,
                };
            }

            const body = new URLSearchParams();
            body.append('text', sourceText);
            body.append('target_lang', targetLang);
            if (sourceLang) {
                body.append('source_lang', sourceLang);
            }

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        Authorization: `DeepL-Auth-Key ${apiKey}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    return {
                        locale,
                        ok: false,
                        error:
                            errorText.trim() ||
                            `DeepL request failed with ${response.status}.`,
                    };
                }

                const payload = await response.json();
                const translatedText =
                    payload?.translations?.[0]?.text ?? undefined;

                if (typeof translatedText !== 'string') {
                    return {
                        locale,
                        ok: false,
                        error: 'DeepL returned an unexpected response format.',
                    };
                }

                return { locale, ok: true, text: translatedText };
            } catch (error) {
                return {
                    locale,
                    ok: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'DeepL request failed.',
                };
            }
        }),
    );

    res.json({ results });
});

app.put('/api/state', (req, res) => {
    if (!isValidState(req.body)) {
        res.status(400).json({ error: 'Invalid state payload.' });
        return;
    }

    updateStateStmt.run({
        data: JSON.stringify(req.body),
        updated_at: new Date().toISOString(),
    });

    res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`ARB editor running on http://localhost:${PORT}`);
    console.log(`SQLite DB: ${dbPath}`);
});
