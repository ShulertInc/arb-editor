import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from './components/Editor';
import Header from './components/Header';
import MessageList from './components/MessageList';
import {
    deepClone,
    getAllMessageKeys,
    getTemplateLocale,
    inferPlaceholdersForKey,
    runChecks,
} from './utils';

function getMessageMeta(localesMap, locale, key) {
    const arb = localesMap.get(locale);
    if (!arb) return {};
    const raw = arb[`@${key}`];
    return raw && typeof raw === 'object' ? deepClone(raw) : {};
}

function getSelectedKeyFromHash() {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return null;

    try {
        return decodeURIComponent(hash);
    } catch {
        return hash;
    }
}

export default function App() {
    const [locales, setLocales] = useState(new Map());
    const [selectedKey, setSelectedKey] = useState(null);
    const [selectedLocale, setSelectedLocale] = useState(null);
    const [status, setStatus] = useState('Connecting to server...');
    const [isHydrated, setIsHydrated] = useState(false);
    const saveTimerRef = useRef(null);
    const isHydratingRef = useRef(true);

    const defaultLocale = useMemo(
        () => getTemplateLocale(locales, selectedLocale),
        [locales, selectedLocale],
    );

    const allKeys = useMemo(() => getAllMessageKeys(locales), [locales]);
    const checks = useMemo(() => runChecks(locales), [locales]);
    const keySections = useMemo(() => {
        const next = {};

        for (const key of allKeys) {
            let section = '';

            if (defaultLocale) {
                const meta = getMessageMeta(locales, defaultLocale, key);
                if (typeof meta.section === 'string') {
                    section = meta.section.trim();
                }
            }

            if (!section) {
                const separatorMatch = key.match(/[./:]/);
                section = separatorMatch
                    ? key.slice(0, separatorMatch.index).trim()
                    : '';
            }

            next[key] = section || 'General';
        }

        return next;
    }, [allKeys, locales, defaultLocale]);
    const sectionOptions = useMemo(() => {
        const unique = new Set(Object.values(keySections));
        unique.add('General');

        return Array.from(unique).sort((a, b) => {
            if (a === 'General') return -1;
            if (b === 'General') return 1;
            return a.localeCompare(b);
        });
    }, [keySections]);

    const editorState = useMemo(() => {
        if (!selectedKey) {
            return {
                key: '',
                description: '',
                section: '',
                placeholdersJson: '',
                inferredPlaceholders: {},
                inferredSource: '',
                translations: {},
            };
        }

        const meta = defaultLocale
            ? getMessageMeta(locales, defaultLocale, selectedKey)
            : {};
        const inferred = inferPlaceholdersForKey(
            locales,
            selectedKey,
            defaultLocale,
        );

        const placeholdersJson = meta.placeholders
            ? JSON.stringify(meta.placeholders, null, 2)
            : Object.keys(inferred.placeholders).length > 0
              ? JSON.stringify(inferred.placeholders, null, 2)
              : '';

        const translations = {};
        for (const locale of Array.from(locales.keys()).sort((a, b) =>
            a.localeCompare(b),
        )) {
            const arb = locales.get(locale);
            translations[locale] =
                typeof arb?.[selectedKey] === 'string' ? arb[selectedKey] : '';
        }

        return {
            key: selectedKey,
            description:
                typeof meta.description === 'string' ? meta.description : '',
            section: typeof meta.section === 'string' ? meta.section : '',
            placeholdersJson,
            inferredPlaceholders: inferred.placeholders,
            inferredSource: inferred.defaultLocale
                ? `Inferred from ${inferred.defaultLocale}`
                : 'Inferred placeholders need at least one locale.',
            translations,
        };
    }, [locales, selectedKey, defaultLocale]);

    function queueSave(nextLocales) {
        if (isHydratingRef.current) return;
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        setStatus('Saving...');
        saveTimerRef.current = setTimeout(async () => {
            try {
                const response = await fetch(
                    import.meta.env.BASE_URL + 'api/state',
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            locales: Object.fromEntries(nextLocales.entries()),
                        }),
                    },
                );

                if (!response.ok) {
                    throw new Error('Server refused update');
                }

                const localeCount = nextLocales.size;
                const keyCount = getAllMessageKeys(nextLocales).length;
                setStatus(
                    `Saved. ${localeCount} locale(s), ${keyCount} message(s).`,
                );
            } catch {
                setStatus('Save failed: could not persist to server.');
            }
            saveTimerRef.current = null;
        }, 350);
    }

    useEffect(() => {
        let mounted = true;

        async function loadState() {
            try {
                const response = await fetch(
                    import.meta.env.BASE_URL + 'api/state',
                );
                if (!response.ok) {
                    throw new Error('Could not fetch initial state');
                }

                const payload = await response.json();
                const nextLocales = new Map();
                const rawLocales = payload?.locales ?? {};

                for (const [locale, arb] of Object.entries(rawLocales)) {
                    if (!arb || typeof arb !== 'object' || Array.isArray(arb))
                        continue;
                    nextLocales.set(locale, arb);
                }

                if (!mounted) return;
                setLocales(nextLocales);
                const template = getTemplateLocale(nextLocales, null);
                setSelectedLocale(template);
                const nextKeys = getAllMessageKeys(nextLocales);
                const hashedKey = getSelectedKeyFromHash();
                setSelectedKey(
                    hashedKey && nextKeys.includes(hashedKey)
                        ? hashedKey
                        : (nextKeys[0] ?? null),
                );
                setStatus('Data loaded.');
            } catch {
                if (!mounted) return;
                setStatus(
                    'Server unavailable. Working in local in-memory mode.',
                );
            } finally {
                isHydratingRef.current = false;
                if (mounted) {
                    setIsHydrated(true);
                }
            }
        }

        loadState();

        return () => {
            mounted = false;
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (isHydratingRef.current) return;
        if (locales.size === 0) {
            setStatus('Start by importing one or more .arb files.');
            return;
        }
    }, [locales, allKeys, status]);

    useEffect(() => {
        if (!isHydrated) return;

        const nextHash = selectedKey
            ? `#${encodeURIComponent(selectedKey)}`
            : '';

        if (window.location.hash === nextHash) return;

        const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
        window.history.replaceState(null, '', nextUrl);
    }, [selectedKey, isHydrated]);

    return (
        <>
            <main className="mx-auto max-w-full px-4 py-6 grid gap-3.5 md:py-4">
                <Header
                    checks={checks}
                    locales={locales}
                    selectedLocale={selectedLocale}
                    allKeys={allKeys}
                    localeCount={locales.size}
                    setLocales={setLocales}
                    setSelectedLocale={setSelectedLocale}
                    setSelectedKey={setSelectedKey}
                    setStatus={setStatus}
                    queueSave={queueSave}
                />

                <section className="bg-white border border-gray-200 rounded-[10px] shadow-[0_1px_2px_rgba(24,24,27,0.06),0_8px_20px_rgba(24,24,27,0.04)] p-3 text-muted text-sm">
                    {status}
                </section>

                <section className="grid grid-cols-[320px_1fr] gap-3.5 max-[980px]:grid-cols-1">
                    <MessageList
                        allKeys={allKeys}
                        keySections={keySections}
                        selectedKey={selectedKey}
                        defaultLocale={defaultLocale}
                        locales={locales}
                        onSelectKey={setSelectedKey}
                    />

                    <Editor
                        selectedKey={selectedKey}
                        editorState={editorState}
                        sectionOptions={sectionOptions}
                        locales={locales}
                        selectedLocale={selectedLocale}
                        allKeys={allKeys}
                        setLocales={setLocales}
                        setSelectedKey={setSelectedKey}
                        setStatus={setStatus}
                        queueSave={queueSave}
                    />
                </section>
            </main>
        </>
    );
}
