import { cn, ui } from '../uiClasses';

export default function Footer({ onExportCurrent, onExportAll }) {
    const primaryButtonClass = cn(ui.buttonBase, ui.buttonPrimary);
    const outlineButtonClass = cn(ui.buttonBase, ui.buttonOutline);

    return (
        <section className={ui.panel}>
            <h2 className="text-lg font-semibold text-primary">Export</h2>
            <p className="text-muted text-sm">
                Files are saved as app_{'{locale}'}.arb using pretty JSON.
            </p>
            <div className="flex gap-2 flex-wrap">
                <button
                    className={primaryButtonClass}
                    onClick={onExportCurrent}
                >
                    Export Current Locale
                </button>
                <button className={outlineButtonClass} onClick={onExportAll}>
                    Export All Locales
                </button>
            </div>
        </section>
    );
}
