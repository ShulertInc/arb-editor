import { useState } from 'react';
import { cn, ui } from '../uiClasses';
import { getAllMessageKeys, getTemplateLocale } from '../utils';
import ChecksModal from './ChecksModal';
import ExportModal from './ExportModal';

function parseLocaleFromFilename(filename) {
    const match = filename.match(/_([A-Za-z0-9_\-]+)\.arb$/);
    return match ? match[1] : null;
}

export default function Header({
    checks,
    locales,
    selectedLocale,
    allKeys,
    localeCount,
    setLocales,
    setSelectedLocale,
    setSelectedKey,
    setStatus,
    queueSave,
}) {
    const [showChecks, setShowChecks] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const outlineButtonClass = cn(ui.buttonBase, ui.buttonOutline);
    const primaryButtonClass = cn(ui.buttonBase, ui.buttonPrimary);

    async function handleImport(event) {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (files.length === 0) return;

        const nextLocales = new Map(locales);
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
                nextLocales.set(locale, json);
                imported += 1;
            } catch (err) {
                setStatus(`Failed to import ${file.name}: ${err.message}`);
            }
        }

        if (nextLocales.size > 0 && !selectedLocale) {
            setSelectedLocale(getTemplateLocale(nextLocales, null));
        }

        const nextKeys = getAllMessageKeys(nextLocales);
        setLocales(nextLocales);
        setSelectedKey(current =>
            current && nextKeys.includes(current)
                ? current
                : (nextKeys[0] ?? null),
        );
        setStatus(`Imported ${imported} file(s).`);
        queueSave(nextLocales);
    }

    function handleAddLocale() {
        const locale = window.prompt(
            'Locale code (examples: en, es, fr_CA, zh_Hans):',
        );
        if (!locale) return;
        if (locales.has(locale)) {
            setStatus(`Locale ${locale} already exists.`);
            return;
        }

        const nextLocales = new Map(locales);
        nextLocales.set(locale, { '@@locale': locale });
        setLocales(nextLocales);
        if (!selectedLocale) {
            setSelectedLocale(locale);
        }
        setStatus(`Added locale ${locale}.`);
        queueSave(nextLocales);
    }

    function handleRemoveLocale() {
        if (locales.size === 0) {
            setStatus('No locales to remove.');
            return;
        }

        const localeList = Array.from(locales.keys()).join(', ');
        const locale = window.prompt(
            `Enter locale to remove (available: ${localeList}):`,
        );
        if (!locale) return;
        if (!locales.has(locale)) {
            setStatus(`Locale ${locale} does not exist.`);
            return;
        }

        const arb = locales.get(locale);
        const keys = Object.entries(arb).filter(
            ([key, value]) => !key.startsWith('@@') && value !== '',
        );

        if (keys.length > 0) {
            window.alert(
                `Locale ${locale} has ${keys.length} message(s). Remove them before deleting the locale.`,
            );
            return;
        }

        const nextLocales = new Map(locales);
        nextLocales.delete(locale);
        setLocales(nextLocales);

        if (selectedLocale === locale) {
            setSelectedLocale(getTemplateLocale(nextLocales, null));
        }

        setStatus(`Removed locale ${locale}.`);
        queueSave(nextLocales);
    }

    function handleAddMessage() {
        if (locales.size === 0) {
            setStatus('Add a locale first, then create message keys.');
            return;
        }

        const key = window.prompt('New message key (example: helloWorld):');
        if (!key) return;
        if (key.startsWith('@')) {
            setStatus('Message key must not start with @.');
            return;
        }
        if (allKeys.includes(key)) {
            setSelectedKey(key);
            setStatus(`Message key ${key} already exists.`);
            return;
        }

        const nextLocales = new Map(locales);
        for (const [locale, arb] of nextLocales.entries()) {
            nextLocales.set(locale, { ...arb, [key]: '' });
        }

        setLocales(nextLocales);
        setSelectedKey(key);
        setStatus(`Created message key ${key}.`);
        queueSave(nextLocales);
    }

    return (
        <header className="flex justify-between items-center gap-3 flex-wrap">
            <div>
                <h1 className="text-2xl md:text-3xl font-semibold">
                    ARB Locale Editor
                </h1>
                <p className="text-muted text-sm">
                    Simple translation editing for ARB files
                </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
                <label className={outlineButtonClass} htmlFor="importFiles">
                    Import ARB Files
                </label>
                <input
                    id="importFiles"
                    type="file"
                    accept=".arb,application/json"
                    multiple
                    hidden
                    onChange={handleImport}
                />
                <button
                    className={outlineButtonClass}
                    onClick={handleAddLocale}
                >
                    Add Locale
                </button>
                <button
                    className={outlineButtonClass}
                    onClick={handleRemoveLocale}
                >
                    Remove Locale
                </button>
                <button
                    className={outlineButtonClass}
                    onClick={handleAddMessage}
                >
                    Add Message
                </button>
                <button
                    className={outlineButtonClass}
                    onClick={() => setShowExport(true)}
                >
                    Export
                </button>
                <button
                    className={primaryButtonClass}
                    onClick={() => setShowChecks(true)}
                >
                    Checks ({checks.length})
                </button>
            </div>

            <ChecksModal
                checks={checks}
                isOpen={showChecks}
                onSelectKey={setSelectedKey}
                onClose={() => setShowChecks(false)}
            />

            <ExportModal
                isOpen={showExport}
                locales={locales}
                selectedLocale={selectedLocale}
                localeCount={localeCount}
                setStatus={setStatus}
                onClose={() => setShowExport(false)}
            />
        </header>
    );
}
