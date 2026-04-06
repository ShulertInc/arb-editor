import { useEffect, useMemo, useRef, useState } from 'react';
import { cn, ui } from '../uiClasses';
import { truncatePreview } from '../utils';

export default function MessageList({
    allKeys,
    keySections,
    selectedKey,
    defaultLocale,
    locales,
    onSelectKey,
}) {
    const [search, setSearch] = useState('');
    const [collapsedSections, setCollapsedSections] = useState({});
    const itemRefs = useRef(new Map());

    const filteredKeys = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return allKeys;
        return allKeys.filter(key => {
            if (key.toLowerCase().includes(query)) return true;
            const section = (keySections[key] || '').toLowerCase();
            return section.includes(query);
        });
    }, [allKeys, keySections, search]);

    const groupedKeys = useMemo(() => {
        const groups = new Map();

        for (const key of filteredKeys) {
            const section = keySections[key] || 'General';
            if (!groups.has(section)) {
                groups.set(section, []);
            }
            groups.get(section).push(key);
        }

        return Array.from(groups.entries()).sort(([a], [b]) => {
            if (a === 'General') return -1;
            if (b === 'General') return 1;
            return a.localeCompare(b);
        });
    }, [filteredKeys, keySections]);

    useEffect(() => {
        if (!selectedKey) return;
        const selectedItem = itemRefs.current.get(selectedKey);
        if (!selectedItem) return;

        selectedItem.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth',
        });
    }, [selectedKey]);

    useEffect(() => {
        if (!selectedKey) return;
        const section = keySections[selectedKey] || 'General';
        setCollapsedSections(prev => {
            if (!prev[section]) return prev;
            return { ...prev, [section]: false };
        });
    }, [selectedKey, keySections]);

    function toggleSection(section) {
        setCollapsedSections(prev => ({
            ...prev,
            [section]: !prev[section],
        }));
    }

    return (
        <aside className={cn(ui.panel, 'px-0 pb-0')}>
            <h2 className="text-lg font-semibold text-primary mx-3.5">
                Messages
            </h2>
            <div className="px-3.5">
                <input
                    className={ui.input}
                    type="text"
                    placeholder="Filter keys"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                />
            </div>
            <ul className="max-h-[62vh] overflow-auto [scrollbar-gutter:stable] px-3.5 pb-3.5">
                {filteredKeys.length > 0 ? (
                    groupedKeys.map(([section, keys]) => {
                        const isCollapsed =
                            !search.trim() && collapsedSections[section];

                        return (
                            <li key={section} className="mb-2.5 last:mb-0">
                                <button
                                    type="button"
                                    className="w-full text-left cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted mb-1.5 px-1 flex items-center justify-between"
                                    onClick={() => toggleSection(section)}
                                >
                                    <span>{section}</span>
                                    <span aria-hidden="true">
                                        {isCollapsed ? '+' : '-'}
                                    </span>
                                </button>
                                {isCollapsed ? null : (
                                    <ul>
                                        {keys.map(key => {
                                            const defaultValue = defaultLocale
                                                ? (locales.get(defaultLocale)?.[
                                                      key
                                                  ] ?? '')
                                                : '';
                                            const preview =
                                                typeof defaultValue ===
                                                    'string' &&
                                                defaultValue.trim()
                                                    ? truncatePreview(
                                                          defaultValue,
                                                      )
                                                    : 'empty';
                                            return (
                                                <li
                                                    key={key}
                                                    ref={node => {
                                                        if (node) {
                                                            itemRefs.current.set(
                                                                key,
                                                                node,
                                                            );
                                                        } else {
                                                            itemRefs.current.delete(
                                                                key,
                                                            );
                                                        }
                                                    }}
                                                    className={`border rounded-[10px] p-2.5 cursor-pointer text-sm leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis mb-2 last:mb-0 font-mono transition-colors hover:border-gray-400 ${
                                                        selectedKey === key
                                                            ? 'border-primary bg-gray-100'
                                                            : 'border-gray-200 bg-white'
                                                    }`}
                                                    onClick={() =>
                                                        onSelectKey(key)
                                                    }
                                                >
                                                    {key} ({preview})
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </li>
                        );
                    })
                ) : (
                    <li className="border border-dashed border-gray-200 rounded-[10px] p-3 text-muted text-sm">
                        {search
                            ? 'No keys match your filter.'
                            : 'No message keys yet.'}
                    </li>
                )}
            </ul>
        </aside>
    );
}
