import { twMerge } from 'tailwind-merge';

export const ui = {
    panel: 'bg-white border border-gray-200 rounded-[10px] shadow-[0_1px_2px_rgba(24,24,27,0.06),0_8px_20px_rgba(24,24,27,0.04)] p-3.5 flex flex-col gap-3',
    input: 'w-full border border-gray-200 rounded-[10px] px-3 py-2.5 bg-white text-primary text-sm focus:outline-2 focus:outline-offset-0 focus:outline-gray-400 focus:border-transparent',
    label: 'grid gap-1.5 text-xs text-muted',
    buttonBase:
        'rounded-[10px] px-3 py-2 text-sm font-semibold cursor-pointer border transition-opacity hover:opacity-90',
    buttonPrimary: 'border-transparent bg-primary text-white',
    buttonOutline: 'border-gray-200 bg-white text-primary',
    buttonDanger: 'border-transparent bg-red-700 text-white',
    buttonSmall: 'px-2.5 py-1.5 text-xs',
    modalBackdrop:
        'fixed inset-0 bg-black/[0.38] grid place-items-center p-4 z-[100]',
    modal: 'w-full max-w-4xl max-h-[82vh] overflow-auto bg-white border border-gray-200 rounded-2xl shadow-[0_24px_56px_rgba(0,0,0,0.24)] p-3.5 grid gap-3',
};

export function cn(...values) {
    return twMerge(...values);
}
