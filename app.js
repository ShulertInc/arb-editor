const state = {
    locales: new Map(),
    selectedKey: null,
    selectedLocale: null,
    saveTimer: null,
    isHydrating: true,
};

const el = {
    importFiles: document.getElementById('importFiles'),
    newLocaleBtn: document.getElementById('newLocaleBtn'),
    newMessageBtn: document.getElementById('newMessageBtn'),
    status: document.getElementById('status'),
    messageSearch: document.getElementById('messageSearch'),
    messageList: document.getElementById('messageList'),
    emptyState: document.getElementById('emptyState'),
    editorForm: document.getElementById('editorForm'),
    messageKey: document.getElementById('messageKey'),
    messageDescription: document.getElementById('messageDescription'),
    placeholdersJson: document.getElementById('placeholdersJson'),
    inferredSource: document.getElementById('inferredSource'),
    inferredPlaceholders: document.getElementById('inferredPlaceholders'),
    applyInferredBtn: document.getElementById('applyInferredBtn'),
    translationsGrid: document.getElementById('translationsGrid'),
    deleteMessageBtn: document.getElementById('deleteMessageBtn'),
    issuesList: document.getElementById('issuesList'),
    exportCurrentBtn: document.getElementById('exportCurrentBtn'),
    exportAllBtn: document.getElementById('exportAllBtn'),
    translationFieldTemplate: document.getElementById(
        'translationFieldTemplate',
    ),
};

function setStatus(text) {
    el.status.textContent = text;
}

function getSerializableState() {
    return {
        locales: Object.fromEntries(state.locales.entries()),
    };
}

function hydrateState(payload) {
    state.locales = new Map();
    const locales = payload?.locales ?? {};

    for (const [locale, arb] of Object.entries(locales)) {
        if (!arb || typeof arb !== 'object' || Array.isArray(arb)) continue;
        state.locales.set(locale, arb);
    }

    state.selectedLocale = getTemplateLocale();
    state.selectedKey = getAllMessageKeys()[0] ?? null;
}

async function persistState() {
    if (state.isHydrating) return;

    try {
        const response = await fetch('/api/state', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(getSerializableState()),
        });

        if (!response.ok) {
            throw new Error('Server refused update');
        }
    } catch {
        setStatus('Save failed: could not persist to server.');
    }
}

function queueSave() {
    if (state.isHydrating) return;
    if (state.saveTimer) {
        clearTimeout(state.saveTimer);
    }
    setStatus('Saving...');
    state.saveTimer = setTimeout(async () => {
        await persistState();
        state.saveTimer = null;
        const localeCount = state.locales.size;
        const keyCount = getAllMessageKeys().length;
        setStatus(
            `Saved to SQLite. ${localeCount} locale(s), ${keyCount} message key(s).`,
        );
    }, 350);
}

async function loadStateFromServer() {
    try {
        const response = await fetch('/api/state');
        if (!response.ok) {
            throw new Error('Could not fetch initial state');
        }
        const payload = await response.json();
        hydrateState(payload);
        state.isHydrating = false;
        render();
        setStatus('Loaded from SQLite.');
    } catch {
        state.isHydrating = false;
        render();
        setStatus('Server unavailable. Working in local in-memory mode.');
    }
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function parseLocaleFromFilename(filename) {
    const match = filename.match(/_([A-Za-z0-9_\-]+)\.arb$/);
    return match ? match[1] : null;
}

function getAllMessageKeys() {
    const keys = new Set();
    for (const arb of state.locales.values()) {
        Object.keys(arb)
            .filter(key => !key.startsWith('@'))
            .forEach(key => keys.add(key));
    }
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

function getTemplateLocale() {
    const localeNames = Array.from(state.locales.keys());
    if (localeNames.length === 0) return null;

    const exactEnglish = localeNames.find(
        locale => locale.toLowerCase() === 'en',
    );
    if (exactEnglish) return exactEnglish;

    const englishVariant = localeNames.find(
        locale =>
            locale.toLowerCase().startsWith('en_') ||
            locale.toLowerCase().startsWith('en-'),
    );
    if (englishVariant) return englishVariant;

    if (state.selectedLocale && state.locales.has(state.selectedLocale)) {
        return state.selectedLocale;
    }

    return localeNames.sort((a, b) => a.localeCompare(b))[0] ?? null;
}

function ensureLocale(locale) {
    if (!state.locales.has(locale)) {
        state.locales.set(locale, {
            '@@locale': locale,
        });
        queueSave();
    }
}

function getMessageMeta(locale, key) {
    const arb = state.locales.get(locale);
    if (!arb) return {};
    const raw = arb[`@${key}`];
    return raw && typeof raw === 'object' ? deepClone(raw) : {};
}

function setMessageMeta(locale, key, meta) {
    const arb = state.locales.get(locale);
    if (!arb) return;
    const hasMeta = meta && Object.keys(meta).length > 0;
    if (hasMeta) {
        arb[`@${key}`] = deepClone(meta);
    } else {
        delete arb[`@${key}`];
    }
}

function deleteMessageEverywhere(key) {
    for (const arb of state.locales.values()) {
        delete arb[key];
        delete arb[`@${key}`];
    }
    queueSave();
}

function renameMessageKey(oldKey, newKey) {
    if (oldKey === newKey) return;
    for (const arb of state.locales.values()) {
        if (Object.prototype.hasOwnProperty.call(arb, oldKey)) {
            arb[newKey] = arb[oldKey];
            delete arb[oldKey];
        }
        if (Object.prototype.hasOwnProperty.call(arb, `@${oldKey}`)) {
            arb[`@${newKey}`] = arb[`@${oldKey}`];
            delete arb[`@${oldKey}`];
        }
    }
    queueSave();
}

function validatePlaceholders(text) {
    if (!text.trim()) return { ok: true, value: undefined };
    try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { ok: true, value: parsed };
        }
        return { ok: false, error: 'Placeholders must be a JSON object.' };
    } catch {
        return { ok: false, error: 'Invalid JSON in placeholders.' };
    }
}

function tryParseJsonObject(text) {
    if (!text.trim()) return null;
    try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}

function inferPlaceholdersFromMessage(message) {
    const placeholders = {};
    if (typeof message !== 'string' || message.trim() === '') {
        return placeholders;
    }

    const pattern =
        /{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*(plural|select|selectordinal)\b)?/g;
    let match = null;
    while ((match = pattern.exec(message)) !== null) {
        const name = match[1];
        const kind = match[2] ?? null;

        if (placeholders[name]) continue;

        if (kind === 'plural' || kind === 'selectordinal') {
            placeholders[name] = { type: 'num', example: 2 };
            continue;
        }

        if (kind === 'select') {
            placeholders[name] = { type: 'String', example: 'other' };
            continue;
        }

        placeholders[name] = { type: 'String' };
    }

    return placeholders;
}

function inferPlaceholdersForKey(key) {
    const defaultLocale = getTemplateLocale();
    if (!defaultLocale) {
        return { defaultLocale: null, placeholders: {} };
    }

    const arb = state.locales.get(defaultLocale);
    const defaultMessage = arb?.[key];
    const placeholders = inferPlaceholdersFromMessage(defaultMessage);

    return { defaultLocale, placeholders };
}

function mergeInferredPlaceholders(inferred, existing) {
    const merged = deepClone(existing ?? {});
    for (const [name, config] of Object.entries(inferred)) {
        if (!merged[name]) {
            merged[name] = config;
        }
    }
    return merged;
}

function renderInferredPlaceholderPanel(key) {
    const { defaultLocale, placeholders } = inferPlaceholdersForKey(key);
    const entries = Object.entries(placeholders);

    el.inferredPlaceholders.innerHTML = '';
    if (!defaultLocale) {
        el.inferredSource.textContent =
            'Inferred placeholders need at least one locale.';
        el.applyInferredBtn.disabled = true;
        return placeholders;
    }

    if (entries.length === 0) {
        el.inferredSource.textContent = `No placeholders inferred from ${defaultLocale}.`;
        el.applyInferredBtn.disabled = true;
        return placeholders;
    }

    el.inferredSource.textContent = `Inferred from default locale ${defaultLocale}.`;
    el.applyInferredBtn.disabled = false;

    for (const [name, config] of entries) {
        const chip = document.createElement('span');
        chip.className = 'placeholder-chip';
        chip.textContent = `${name}: ${config.type}`;
        el.inferredPlaceholders.appendChild(chip);
    }

    return placeholders;
}

function renderMessageList() {
    const filter = el.messageSearch.value.trim().toLowerCase();
    const keys = getAllMessageKeys().filter(key =>
        key.toLowerCase().includes(filter),
    );

    el.messageList.innerHTML = '';
    if (keys.length === 0) {
        const li = document.createElement('li');
        li.className = 'message-meta';
        li.textContent = filter
            ? 'No keys match your filter.'
            : 'No message keys yet.';
        el.messageList.appendChild(li);
        return;
    }

    for (const key of keys) {
        const li = document.createElement('li');
        li.className = `message-item${state.selectedKey === key ? ' active' : ''}`;

        const keyEl = document.createElement('div');
        keyEl.className = 'message-key';
        keyEl.textContent = key;

        const counts = Array.from(state.locales.entries()).reduce(
            (acc, [locale, arb]) => {
                if (arb[key]) acc.translated += 1;
                if (arb[`@${key}`]) acc.meta += 1;
                return acc;
            },
            { translated: 0, meta: 0 },
        );

        const metaEl = document.createElement('div');
        metaEl.className = 'message-meta';
        metaEl.textContent = `${counts.translated}/${state.locales.size} locales translated, ${counts.meta} metadata entries`;

        li.appendChild(keyEl);
        li.appendChild(metaEl);
        li.addEventListener('click', () => {
            state.selectedKey = key;
            render();
        });

        el.messageList.appendChild(li);
    }
}

function buildTranslationInputs(key) {
    el.translationsGrid.innerHTML = '';

    for (const [locale, arb] of Array.from(state.locales.entries()).sort(
        (a, b) => a[0].localeCompare(b[0]),
    )) {
        const fragment = el.translationFieldTemplate.content.cloneNode(true);
        const label = fragment.querySelector('.translation-label');
        const textarea = fragment.querySelector('textarea');

        label.textContent = locale;
        textarea.value = typeof arb[key] === 'string' ? arb[key] : '';
        textarea.dataset.locale = locale;

        el.translationsGrid.appendChild(fragment);
    }
}

function renderEditor() {
    const key = state.selectedKey;
    if (!key) {
        el.emptyState.classList.remove('hidden');
        el.editorForm.classList.add('hidden');
        return;
    }

    el.emptyState.classList.add('hidden');
    el.editorForm.classList.remove('hidden');

    const templateLocale = getTemplateLocale();
    const meta = templateLocale ? getMessageMeta(templateLocale, key) : {};
    const inferredPlaceholders = renderInferredPlaceholderPanel(key);

    el.messageKey.value = key;
    el.messageDescription.value =
        typeof meta.description === 'string' ? meta.description : '';
    if (meta.placeholders) {
        el.placeholdersJson.value = JSON.stringify(meta.placeholders, null, 2);
    } else if (Object.keys(inferredPlaceholders).length > 0) {
        el.placeholdersJson.value = JSON.stringify(
            inferredPlaceholders,
            null,
            2,
        );
    } else {
        el.placeholdersJson.value = '';
    }

    buildTranslationInputs(key);
}

function runChecks() {
    const issues = [];
    const locales = Array.from(state.locales.keys()).sort();
    const keys = getAllMessageKeys();

    for (const key of keys) {
        const missing = locales.filter(locale => {
            const value = state.locales.get(locale)?.[key];
            return typeof value !== 'string' || value.trim() === '';
        });
        if (missing.length > 0) {
            issues.push({
                type: 'warn',
                text: `${key}: missing translation in ${missing.join(', ')}`,
            });
        }

        // const templateLocale = getTemplateLocale();
        // if (templateLocale) {
        //     const meta = getMessageMeta(templateLocale, key);
        //     if (!meta.description) {
        //         issues.push({
        //             type: 'warn',
        //             text: `${key}: missing @${key}.description in ${templateLocale}`,
        //         });
        //     }
        // }
    }

    el.issuesList.innerHTML = '';
    if (issues.length === 0) {
        const li = document.createElement('li');
        li.className = 'issue-item';
        li.style.borderLeftColor = '#16a34a';
        li.textContent = 'No issues found.';
        el.issuesList.appendChild(li);
        return;
    }

    for (const issue of issues) {
        const li = document.createElement('li');
        li.className = `issue-item${issue.type === 'error' ? ' error' : ''}`;
        li.textContent = issue.text;
        el.issuesList.appendChild(li);
    }
}

function sortArbForOutput(arb) {
    const ordered = {};
    if (arb['@@locale']) {
        ordered['@@locale'] = arb['@@locale'];
    }

    const messageKeys = Object.keys(arb)
        .filter(key => !key.startsWith('@'))
        .sort((a, b) => a.localeCompare(b));

    for (const key of messageKeys) {
        ordered[key] = arb[key];
        if (arb[`@${key}`]) {
            ordered[`@${key}`] = arb[`@${key}`];
        }
    }

    for (const [key, value] of Object.entries(arb)) {
        if (key.startsWith('@@') && key !== '@@locale') {
            ordered[key] = value;
        }
    }

    return ordered;
}

function downloadArb(locale) {
    const arb = state.locales.get(locale);
    if (!arb) return;
    const ordered = sortArbForOutput(arb);
    const blob = new Blob([`${JSON.stringify(ordered, null, 4)}\n`], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app_${locale}.arb`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function render() {
    renderMessageList();
    renderEditor();
    runChecks();

    const localeCount = state.locales.size;
    const keyCount = getAllMessageKeys().length;
    if (localeCount === 0) {
        setStatus('Start by importing one or more .arb files.');
    } else {
        setStatus(`${localeCount} locale(s), ${keyCount} message key(s).`);
    }
}

async function importArbFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    let imported = 0;
    for (const file of files) {
        const text = await file.text();
        try {
            const json = JSON.parse(text);
            if (!json || typeof json !== 'object' || Array.isArray(json)) {
                throw new Error('File is not a JSON object');
            }
            const inferredLocale = parseLocaleFromFilename(file.name);
            const locale = json['@@locale'] || inferredLocale;
            if (!locale) {
                throw new Error(
                    'Could not infer locale; include @@locale or use app_<locale>.arb filename',
                );
            }
            json['@@locale'] = locale;
            state.locales.set(locale, json);
            imported += 1;
        } catch (err) {
            setStatus(`Failed to import ${file.name}: ${err.message}`);
        }
    }

    if (!state.selectedLocale && state.locales.size > 0) {
        state.selectedLocale = getTemplateLocale();
    }
    if (!state.selectedKey) {
        state.selectedKey = getAllMessageKeys()[0] ?? null;
    }

    render();
    setStatus(`Imported ${imported} file(s).`);
    queueSave();
}

el.importFiles.addEventListener('change', event => {
    importArbFiles(event.target.files);
    event.target.value = '';
});

el.messageSearch.addEventListener('input', renderMessageList);

el.newLocaleBtn.addEventListener('click', () => {
    const locale = prompt('Locale code (examples: en, es, fr_CA, zh_Hans):');
    if (!locale) return;
    if (state.locales.has(locale)) {
        setStatus(`Locale ${locale} already exists.`);
        return;
    }
    ensureLocale(locale);
    render();
    setStatus(`Added locale ${locale}.`);
});

el.newMessageBtn.addEventListener('click', () => {
    if (state.locales.size === 0) {
        setStatus('Add a locale first, then create message keys.');
        return;
    }

    const key = prompt('New message key (example: helloWorld):');
    if (!key) return;

    if (key.startsWith('@')) {
        setStatus('Message key must not start with @.');
        return;
    }

    const exists = getAllMessageKeys().includes(key);
    if (exists) {
        setStatus(`Message key ${key} already exists.`);
        state.selectedKey = key;
        render();
        return;
    }

    for (const arb of state.locales.values()) {
        arb[key] = '';
    }

    state.selectedKey = key;
    render();
    setStatus(`Created message key ${key}.`);
    queueSave();
});

el.editorForm.addEventListener('submit', event => {
    event.preventDefault();

    const oldKey = state.selectedKey;
    const newKey = el.messageKey.value.trim();

    if (!newKey) {
        setStatus('Message key cannot be empty.');
        return;
    }

    if (newKey.startsWith('@')) {
        setStatus('Message key must not start with @.');
        return;
    }

    const allKeys = getAllMessageKeys();
    if (newKey !== oldKey && allKeys.includes(newKey)) {
        setStatus(
            `Cannot rename to ${newKey}; a key with that name already exists.`,
        );
        return;
    }

    const placeholderCheck = validatePlaceholders(el.placeholdersJson.value);
    if (!placeholderCheck.ok) {
        setStatus(placeholderCheck.error);
        return;
    }

    renameMessageKey(oldKey, newKey);

    const templateLocale = getTemplateLocale();
    if (templateLocale) {
        const meta = {};
        const description = el.messageDescription.value.trim();
        if (description) {
            meta.description = description;
        }
        if (placeholderCheck.value) {
            meta.placeholders = placeholderCheck.value;
        }
        setMessageMeta(templateLocale, newKey, meta);
    }

    const textareas = el.translationsGrid.querySelectorAll(
        'textarea[data-locale]',
    );
    for (const textarea of textareas) {
        const locale = textarea.dataset.locale;
        const arb = state.locales.get(locale);
        if (!arb) continue;
        arb[newKey] = textarea.value;
    }

    state.selectedKey = newKey;
    render();
    setStatus(`Saved ${newKey}.`);
    queueSave();
});

el.deleteMessageBtn.addEventListener('click', () => {
    const key = state.selectedKey;
    if (!key) return;

    const ok = confirm(`Delete ${key} from all locales?`);
    if (!ok) return;

    deleteMessageEverywhere(key);
    state.selectedKey = getAllMessageKeys()[0] ?? null;
    render();
    setStatus(`Deleted ${key}.`);
});

el.exportCurrentBtn.addEventListener('click', () => {
    if (state.locales.size === 0) {
        setStatus('No locales to export.');
        return;
    }

    const selected =
        state.selectedLocale && state.locales.has(state.selectedLocale)
            ? state.selectedLocale
            : getTemplateLocale();

    if (!selected) {
        setStatus('No locale selected for export.');
        return;
    }

    downloadArb(selected);
    setStatus(`Exported ${selected}.`);
});

el.exportAllBtn.addEventListener('click', () => {
    if (state.locales.size === 0) {
        setStatus('No locales to export.');
        return;
    }

    for (const locale of state.locales.keys()) {
        downloadArb(locale);
    }
    setStatus(`Exported ${state.locales.size} locale file(s).`);
});

el.applyInferredBtn.addEventListener('click', () => {
    const key = state.selectedKey;
    if (!key) return;

    const { placeholders } = inferPlaceholdersForKey(key);
    if (Object.keys(placeholders).length === 0) {
        setStatus('No placeholders were inferred for this message.');
        return;
    }

    const existing = tryParseJsonObject(el.placeholdersJson.value) ?? {};
    const merged = mergeInferredPlaceholders(placeholders, existing);
    el.placeholdersJson.value = JSON.stringify(merged, null, 2);
    setStatus('Merged inferred placeholders into metadata JSON.');
});

loadStateFromServer();
