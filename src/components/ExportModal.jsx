import { cn, ui } from '../uiClasses';
import { downloadArb, getTemplateLocale } from '../utils';

export default function ExportModal({
    isOpen,
    locales,
    selectedLocale,
    localeCount,
    setStatus,
    onClose,
}) {
    if (!isOpen) return null;

    const primaryButtonClass = cn(ui.buttonBase, ui.buttonPrimary);
    const outlineButtonClass = cn(ui.buttonBase, ui.buttonOutline);
    const closeButtonClass = cn(
        ui.buttonBase,
        ui.buttonOutline,
        ui.buttonSmall,
    );

    const handleExportCurrent = () => {
        if (locales.size === 0) {
            setStatus('No locales to export.');
            return;
        }

        const selected =
            (selectedLocale && locales.has(selectedLocale) && selectedLocale) ||
            getTemplateLocale(locales, selectedLocale);

        if (!selected) {
            setStatus('No locale selected for export.');
            return;
        }

        downloadArb(locales, selected);
        setStatus(`Exported ${selected}.`);
        onClose();
    };

    const handleExportAll = () => {
        if (locales.size === 0) {
            setStatus('No locales to export.');
            return;
        }

        for (const locale of locales.keys()) {
            downloadArb(locales, locale);
        }

        setStatus(`Exported ${locales.size} locale file(s).`);
        onClose();
    };

    return (
        <div className={ui.modalBackdrop} onClick={onClose}>
            <div
                className={ui.modal}
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
                    <button
                        className={primaryButtonClass}
                        onClick={handleExportCurrent}
                    >
                        Export Current Locale
                    </button>
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
