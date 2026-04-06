export function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

export function parseLocaleFromFilename(filename) {
    const match = filename.match(/_([A-Za-z0-9_\-]+)\.arb$/);
    return match ? match[1] : null;
}

export function truncatePreview(text, maxLength = 48) {
    const normalized = String(text).replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, maxLength - 1)}…`;
}

export function getAllMessageKeys(localesMap) {
    const keys = new Set();
    for (const arb of localesMap.values()) {
        Object.keys(arb)
            .filter(key => !key.startsWith('@'))
            .forEach(key => keys.add(key));
    }
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

export function getTemplateLocale(localesMap, selectedLocale) {
    const localeNames = Array.from(localesMap.keys());
    if (localeNames.length === 0) return null;

    const exactEnglish = localeNames.find(
        locale => locale.toLowerCase() === 'en',
    );
    if (exactEnglish) return exactEnglish;

    const englishVariant = localeNames.find(locale => {
        const value = locale.toLowerCase();
        return value.startsWith('en_') || value.startsWith('en-');
    });
    if (englishVariant) return englishVariant;

    if (selectedLocale && localesMap.has(selectedLocale)) {
        return selectedLocale;
    }

    return localeNames.sort((a, b) => a.localeCompare(b))[0] ?? null;
}

export function getMessageMeta(localesMap, locale, key) {
    const arb = localesMap.get(locale);
    if (!arb) return {};
    const raw = arb[`@${key}`];
    return raw && typeof raw === 'object' ? deepClone(raw) : {};
}

export function validatePlaceholders(text) {
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

export function tryParseJsonObject(text) {
    if (!text.trim()) return null;
    try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
    } catch {
        return null;
    }
    return null;
}

export function inferPlaceholdersFromMessage(message) {
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

export function inferPlaceholdersForKey(localesMap, key, defaultLocale) {
    if (!defaultLocale) {
        return { defaultLocale: null, placeholders: {} };
    }
    const arb = localesMap.get(defaultLocale);
    const defaultMessage = arb?.[key];
    const placeholders = inferPlaceholdersFromMessage(defaultMessage);
    return { defaultLocale, placeholders };
}

export function mergeInferredPlaceholders(inferred, existing) {
    const merged = deepClone(existing ?? {});
    for (const [name, config] of Object.entries(inferred)) {
        if (!merged[name]) {
            merged[name] = config;
        }
    }
    return merged;
}

export function runChecks(localesMap) {
    const issues = [];
    const locales = Array.from(localesMap.keys()).sort();
    const keys = getAllMessageKeys(localesMap);

    for (const key of keys) {
        const missing = locales.filter(locale => {
            const value = localesMap.get(locale)?.[key];
            return typeof value !== 'string' || value.trim() === '';
        });

        if (missing.length > 0) {
            issues.push({
                key,
                message: `${key}: missing translation in ${missing.join(', ')}`,
            });
        }
    }

    return issues;
}

export function sortArbForOutput(arb) {
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

export function downloadArb(localesMap, locale) {
    const arb = localesMap.get(locale);
    if (!arb) return;

    const ordered = sortArbForOutput(arb);
    const blob = new Blob([`${JSON.stringify(ordered, null, 4)}\n`], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `app_${locale}.arb`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
