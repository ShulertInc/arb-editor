import Database from 'better-sqlite3';
import express from 'express';
import fs from 'fs';
import path from 'path';

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
