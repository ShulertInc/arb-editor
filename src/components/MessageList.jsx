import { useEffect, useMemo, useRef, useState } from 'react';
import { ui } from '../uiClasses';
import { truncatePreview } from '../utils';

export default function MessageList({
    allKeys,
    selectedKey,
    defaultLocale,
    locales,
    onSelectKey,
}) {
    const [search, setSearch] = useState('');
    const itemRefs = useRef(new Map());

    const filteredKeys = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return allKeys;
        return allKeys.filter(key => key.toLowerCase().includes(query));
    }, [allKeys, search]);

    useEffect(() => {
        if (!selectedKey) return;
        const selectedItem = itemRefs.current.get(selectedKey);
        if (!selectedItem) return;

        selectedItem.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth',
        });
    }, [selectedKey]);

    return (
        <aside className={ui.panel}>
            <h2 className="text-lg font-semibold text-primary">Messages</h2>
            <input
                className={ui.input}
                type="text"
                placeholder="Filter keys"
                value={search}
                onChange={event => setSearch(event.target.value)}
            />
            <ul className="max-h-[62vh] overflow-auto pr-0.5">
                {filteredKeys.length > 0 ? (
                    filteredKeys.map(key => {
                        const defaultValue = defaultLocale
                            ? (locales.get(defaultLocale)?.[key] ?? '')
                            : '';
                        const preview =
                            typeof defaultValue === 'string' &&
                            defaultValue.trim()
                                ? truncatePreview(defaultValue)
                                : 'empty';
                        return (
                            <li
                                key={key}
                                ref={node => {
                                    if (node) {
                                        itemRefs.current.set(key, node);
                                    } else {
                                        itemRefs.current.delete(key);
                                    }
                                }}
                                className={`border rounded-[10px] p-2.5 cursor-pointer text-sm leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis mb-2 last:mb-0 font-mono transition-colors hover:border-gray-400 ${
                                    selectedKey === key
                                        ? 'border-primary bg-gray-100'
                                        : 'border-gray-200 bg-white'
                                }`}
                                onClick={() => onSelectKey(key)}
                            >
                                {key} ({preview})
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
