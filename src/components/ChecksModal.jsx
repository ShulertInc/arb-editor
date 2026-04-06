import { cn, ui } from '../uiClasses';

export default function ChecksModal({ checks, onSelectKey, onClose, isOpen }) {
    if (!isOpen) return null;
    const closeButtonClass = cn(
        ui.buttonBase,
        ui.buttonOutline,
        ui.buttonSmall,
    );

    const selectKeyAndClose = key => {
        onSelectKey(key);
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
                        Checks ({checks.length})
                    </h3>
                    <button className={closeButtonClass} onClick={onClose}>
                        Close
                    </button>
                </div>
                <ul className="grid gap-2">
                    {checks.length > 0 ? (
                        checks.map(issue => (
                            <li
                                key={issue.message}
                                className="border border-l-4 border-border border-l-yellow-600 rounded-lg p-2.5 text-xs bg-white font-mono transition-colors cursor-pointer hover:border-gray-400"
                                tabIndex={0}
                                onClick={() => selectKeyAndClose(issue.key)}
                            >
                                {issue.message}
                            </li>
                        ))
                    ) : (
                        <li className="border border-l-4 border-l-green-700 rounded-lg p-2.5 text-xs bg-white font-mono">
                            No issues found.
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}
