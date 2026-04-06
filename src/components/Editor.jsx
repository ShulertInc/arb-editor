import { useEffect, useMemo, useState } from 'react';
import { cn, ui } from '../uiClasses';
import {
    getAllMessageKeys,
    getTemplateLocale,
    mergeInferredPlaceholders,
    tryParseJsonObject,
    validatePlaceholders,
} from '../utils';

export default function Editor({
    selectedKey,
    editorState,
    sectionOptions,
    locales,
    selectedLocale,
    allKeys,
    setLocales,
    setSelectedKey,
    setStatus,
    queueSave,
}) {
    const [draftKey, setDraftKey] = useState('');
    const [draftDescription, setDraftDescription] = useState('');
    const [draftSectionChoice, setDraftSectionChoice] = useState('General');
    const [draftCustomSection, setDraftCustomSection] = useState('');
    const [draftPlaceholders, setDraftPlaceholders] = useState('');
    const [draftTranslations, setDraftTranslations] = useState({});
    const [isTranslating, setIsTranslating] = useState(false);

    const normalizedSectionOptions = useMemo(() => {
        const cleaned = sectionOptions
            .map(option => option.trim())
            .filter(Boolean);
        return cleaned.includes('General') ? cleaned : ['General', ...cleaned];
    }, [sectionOptions]);

    useEffect(() => {
        setDraftKey(editorState.key);
        setDraftDescription(editorState.description);

        const currentSection = (editorState.section || '').trim();
        if (
            currentSection &&
            !normalizedSectionOptions.includes(currentSection)
        ) {
            setDraftSectionChoice('__other__');
            setDraftCustomSection(currentSection);
        } else {
            setDraftSectionChoice(currentSection || 'General');
            setDraftCustomSection('');
        }

        setDraftPlaceholders(editorState.placeholdersJson);
        setDraftTranslations(editorState.translations);
    }, [editorState, normalizedSectionOptions]);

    const primaryButtonClass = cn(ui.buttonBase, ui.buttonPrimary);
    const dangerButtonClass = cn(ui.buttonBase, ui.buttonDanger);
    const outlineButtonClass = cn(ui.buttonBase, ui.buttonOutline);
    const outlineSmallButtonClass = cn(
        ui.buttonBase,
        ui.buttonOutline,
        ui.buttonSmall,
    );

    function handleMergeInferred() {
        if (!selectedKey) return;
        const inferred = editorState.inferredPlaceholders;
        if (Object.keys(inferred).length === 0) {
            setStatus('No placeholders were inferred for this message.');
            return;
        }

        const existing = tryParseJsonObject(draftPlaceholders) ?? {};
        const merged = mergeInferredPlaceholders(inferred, existing);
        setDraftPlaceholders(JSON.stringify(merged, null, 2));
        setStatus('Merged inferred placeholders into metadata JSON.');
    }

    function handleDeleteMessage() {
        if (!selectedKey) return;
        const ok = window.confirm(`Delete ${selectedKey} from all locales?`);
        if (!ok) return;

        const nextLocales = new Map(locales);
        for (const [locale, arb] of nextLocales.entries()) {
            const nextArb = { ...arb };
            delete nextArb[selectedKey];
            delete nextArb[`@${selectedKey}`];
            nextLocales.set(locale, nextArb);
        }

        const nextKeys = getAllMessageKeys(nextLocales);
        setLocales(nextLocales);
        setSelectedKey(nextKeys[0] ?? null);
        setStatus(`Deleted ${selectedKey}.`);
        queueSave(nextLocales);
    }

    async function handleTranslateWithDeepL() {
        if (!selectedKey || isTranslating) return;

        const sourceLocale = getTemplateLocale(locales, selectedLocale);
        if (!sourceLocale) {
            setStatus('Cannot translate without a source locale.');
            return;
        }

        const sourceText = draftTranslations[sourceLocale] ?? '';
        if (!sourceText.trim()) {
            setStatus(
                `Source text is empty for ${sourceLocale}. Add it before translating.`,
            );
            return;
        }

        const targetLocales = Object.keys(draftTranslations)
            .filter(locale => locale !== sourceLocale)
            .filter(locale => !(draftTranslations[locale] ?? '').trim());

        if (targetLocales.length === 0) {
            setStatus('No empty target translations to auto-fill.');
            return;
        }

        setIsTranslating(true);
        setStatus(
            `Translating ${selectedKey} into ${targetLocales.length} locale(s)...`,
        );

        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceText,
                    sourceLocale,
                    targets: targetLocales,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    payload?.error || 'Translation request failed.',
                );
            }

            const results = Array.isArray(payload?.results)
                ? payload.results
                : [];
            const successful = results.filter(
                result => result?.ok && typeof result?.text === 'string',
            );

            if (successful.length === 0) {
                const firstError = results.find(result => !result?.ok)?.error;
                setStatus(
                    firstError || 'No translations were returned by DeepL.',
                );
                return;
            }

            const updates = Object.fromEntries(
                successful.map(result => [result.locale, result.text]),
            );

            setDraftTranslations(prev => ({
                ...prev,
                ...updates,
            }));

            const failedCount = results.length - successful.length;
            setStatus(
                failedCount > 0
                    ? `Translated ${successful.length} locale(s); ${failedCount} failed.`
                    : `Translated ${successful.length} locale(s) with DeepL.`,
            );
        } catch (error) {
            setStatus(
                error instanceof Error
                    ? `DeepL translation failed: ${error.message}`
                    : 'DeepL translation failed.',
            );
        } finally {
            setIsTranslating(false);
        }
    }

    function handleSaveMessage(event) {
        event.preventDefault();
        if (!selectedKey) return;

        const oldKey = selectedKey;
        const newKey = draftKey.trim();
        if (!newKey) {
            setStatus('Message key cannot be empty.');
            return;
        }
        if (newKey.startsWith('@')) {
            setStatus('Message key must not start with @.');
            return;
        }
        if (newKey !== oldKey && allKeys.includes(newKey)) {
            setStatus(
                `Cannot rename to ${newKey}; a key with that name already exists.`,
            );
            return;
        }

        const placeholderCheck = validatePlaceholders(draftPlaceholders);
        if (!placeholderCheck.ok) {
            setStatus(placeholderCheck.error);
            return;
        }

        const nextLocales = new Map(locales);
        for (const [locale, arb] of nextLocales.entries()) {
            const nextArb = { ...arb };

            if (newKey !== oldKey) {
                if (Object.prototype.hasOwnProperty.call(nextArb, oldKey)) {
                    nextArb[newKey] = nextArb[oldKey];
                    delete nextArb[oldKey];
                }
                if (
                    Object.prototype.hasOwnProperty.call(nextArb, `@${oldKey}`)
                ) {
                    nextArb[`@${newKey}`] = nextArb[`@${oldKey}`];
                    delete nextArb[`@${oldKey}`];
                }
            }

            if (
                Object.prototype.hasOwnProperty.call(draftTranslations, locale)
            ) {
                nextArb[newKey] = draftTranslations[locale];
            }

            nextLocales.set(locale, nextArb);
        }

        const template = getTemplateLocale(nextLocales, selectedLocale);
        if (template) {
            const target = { ...nextLocales.get(template) };
            const meta = {};
            const description = draftDescription.trim();
            const section =
                draftSectionChoice === '__other__'
                    ? draftCustomSection.trim()
                    : draftSectionChoice.trim();
            if (description) {
                meta.description = description;
            }
            if (section && section !== 'General') {
                meta.section = section;
            }
            if (placeholderCheck.value) {
                meta.placeholders = placeholderCheck.value;
            }

            if (Object.keys(meta).length > 0) {
                target[`@${newKey}`] = meta;
            } else {
                delete target[`@${newKey}`];
            }

            nextLocales.set(template, target);
        }

        setLocales(nextLocales);
        setSelectedKey(newKey);
        setStatus(`Saved ${newKey}.`);
        queueSave(nextLocales);
    }

    if (!selectedKey) {
        return (
            <section className={cn(ui.panel, 'min-h-96')}>
                <div className="grid place-items-center text-center text-muted min-h-72 gap-2">
                    <h3 className="text-lg font-semibold text-primary">
                        No message selected
                    </h3>
                    <p className="text-sm text-muted">
                        Select a key from the list, or add a new message.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className={cn(ui.panel, 'min-h-96')}>
            <form className="grid gap-3" onSubmit={handleSaveMessage}>
                <div className="grid grid-cols-3 gap-2.5 max-[900px]:grid-cols-1">
                    <label className={ui.label}>
                        <span>Message Key</span>
                        <input
                            className={cn(ui.input, 'font-mono')}
                            type="text"
                            required
                            value={draftKey}
                            onChange={event => setDraftKey(event.target.value)}
                        />
                    </label>
                    <label className={ui.label}>
                        <span>Description</span>
                        <input
                            className={ui.input}
                            type="text"
                            placeholder="Context for translators"
                            value={draftDescription}
                            onChange={event =>
                                setDraftDescription(event.target.value)
                            }
                        />
                    </label>
                    <label className={ui.label}>
                        <span>Section</span>
                        <select
                            className={ui.input}
                            value={draftSectionChoice}
                            onChange={event =>
                                setDraftSectionChoice(event.target.value)
                            }
                        >
                            {normalizedSectionOptions.map(option => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                            <option value="__other__">Other...</option>
                        </select>
                        {draftSectionChoice === '__other__' ? (
                            <input
                                className={ui.input}
                                type="text"
                                placeholder="Enter custom section"
                                value={draftCustomSection}
                                onChange={event =>
                                    setDraftCustomSection(event.target.value)
                                }
                            />
                        ) : null}
                    </label>
                </div>

                <div className="grid gap-2.5">
                    {Object.keys(draftTranslations)
                        .sort((a, b) => a.localeCompare(b))
                        .map(locale => (
                            <label key={locale} className={ui.label}>
                                <span className="text-primary">{locale}</span>
                                <textarea
                                    className={cn(ui.input, 'resize-none')}
                                    dir="auto"
                                    rows={3}
                                    value={draftTranslations[locale]}
                                    onChange={event =>
                                        setDraftTranslations(prev => ({
                                            ...prev,
                                            [locale]: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                        ))}
                </div>

                <details className="border border-gray-200 rounded-[10px] p-2.5 grid gap-2.5 bg-gray-50">
                    <summary className="cursor-pointer text-primary font-semibold">
                        Advanced placeholders
                    </summary>
                    <p className="text-muted text-sm">
                        {editorState.inferredSource}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                        {Object.entries(editorState.inferredPlaceholders).map(
                            ([name, config]) => (
                                <span
                                    key={name}
                                    className="border border-gray-200 rounded-full px-2.5 py-1 bg-white text-xs font-mono"
                                >
                                    {name}: {config.type}
                                </span>
                            ),
                        )}
                    </div>
                    <button
                        className={outlineSmallButtonClass}
                        type="button"
                        onClick={handleMergeInferred}
                    >
                        Merge Inferred Placeholders
                    </button>
                    <label className={ui.label}>
                        <span>Placeholders JSON</span>
                        <textarea
                            className={cn(ui.input, 'font-mono resize-none')}
                            dir="auto"
                            rows={6}
                            placeholder='{"userName": {"type": "String", "example": "Bob"}}'
                            value={draftPlaceholders}
                            onChange={event =>
                                setDraftPlaceholders(event.target.value)
                            }
                        />
                    </label>
                </details>

                <div className="flex gap-2 flex-wrap">
                    <button className={primaryButtonClass} type="submit">
                        Save Message
                    </button>
                    <button
                        className={outlineButtonClass}
                        type="button"
                        onClick={handleTranslateWithDeepL}
                        disabled={isTranslating}
                    >
                        {isTranslating ? 'Translating...' : 'Translate Missing'}
                    </button>
                    <button
                        className={dangerButtonClass}
                        type="button"
                        onClick={handleDeleteMessage}
                    >
                        Delete Message
                    </button>
                </div>
            </form>
        </section>
    );
}
