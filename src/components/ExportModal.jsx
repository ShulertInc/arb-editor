import { useMemo } from 'react';
import { cn, ui } from '../uiClasses';
import { downloadAllArbAsZip, downloadArb } from '../utils';

export default function ExportModal({
    isOpen,
    locales,
    selectedLocale,
    localeCount,
    setStatus,
    onClose,
}) {
    const sortedLocales = useMemo(
        () => Array.from(locales.keys()).sort((a, b) => a.localeCompare(b)),
        [locales],
    );

    if (!isOpen) return null;

    const primaryButtonClass = cn(ui.buttonBase, ui.buttonPrimary);
    const outlineButtonClass = cn(ui.buttonBase, ui.buttonOutline);
    const closeButtonClass = cn(
        ui.buttonBase,
        ui.buttonOutline,
        ui.buttonSmall,
    );

    const handleExportSingle = event => {
        if (locales.size === 0) {
            setStatus('No locales to export.');
            return;
        }

        const locale = event.target.value;
        if (!locale || !locales.has(locale)) {
            setStatus('No locale selected for export.');
            return;
        }

        downloadArb(locales, locale);
        setStatus(`Exported ${locale}.`);
        event.target.value = '';
    };

    const handleExportAll = async () => {
        if (locales.size === 0) {
            setStatus('No locales to export.');
            return;
        }

        try {
            await downloadAllArbAsZip(locales);
            setStatus(`Exported ${locales.size} locale file(s) as zip.`);
        } catch {
            setStatus('Failed to export all locales as zip.');
        }
    };

    return (
        <div className={ui.modalBackdrop} onClick={onClose}>
            <div
                className={cn(ui.modal, 'max-w-xl')}
                role="dialog"
                aria-modal="true"
                onClick={event => event.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-primary">
                        Export
                    </h3>
                    <button className={closeButtonClass} onClick={onClose}>
                        Close
                    </button>
                </div>

                <p className="text-sm text-muted">
                    Files are saved as app_&#123;locale&#125;.arb using pretty
                    JSON.
                </p>
                <p className="text-xs text-muted">
                    {selectedLocale
                        ? `Current locale: ${selectedLocale}`
                        : 'No locale selected yet.'}{' '}
                    {localeCount > 0
                        ? `${localeCount} locale(s) available.`
                        : 'Import or add a locale to export.'}
                </p>

                <div className="flex gap-2 flex-wrap">
                    <select
                        className={cn(primaryButtonClass, 'appearance-none')}
                        defaultValue=""
                        onChange={handleExportSingle}
                        disabled={sortedLocales.length === 0}
                    >
                        <option value="" disabled>
                            Export Locale
                        </option>
                        {sortedLocales.map(locale => (
                            <option key={locale} value={locale}>
                                app_{locale}.arb
                            </option>
                        ))}
                    </select>
                    <button
                        className={outlineButtonClass}
                        onClick={handleExportAll}
                    >
                        Export All Locales
                    </button>
                </div>
            </div>
        </div>
    );
}
