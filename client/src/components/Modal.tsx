import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
    noPadding?: boolean;
    scrollable?: boolean;
    extraClassName?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md', noPadding = false, scrollable = true, extraClassName = '' }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        full: 'max-w-full m-4'
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className={`bg-[var(--color-surface)] text-[var(--color-text)] rounded-[2rem] shadow-[0_30px_90px_rgba(0,0,0,0.4)] w-full ${sizeClasses[size]} transform transition-all border-2 border-slate-900 flex flex-col max-h-[90vh] ${extraClassName} animate-in zoom-in-95 duration-200`}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-6 border-b border-slate-100/50 flex-shrink-0">
                    <h3 className="text-xl font-black tracking-tight text-slate-800">{title}</h3>
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="w-8 h-8 rounded-full bg-[#00684a] flex items-center justify-center text-white hover:bg-[#005c42] transition-all active:scale-90 shadow-md border border-[#005c42]"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={`${noPadding ? '' : 'p-6'} ${scrollable ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'} flex-1`}>
                    {children}
                </div>

                {footer && (
                    <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex justify-end gap-3 flex-shrink-0">
                        {footer}
                    </div>
                )}
            </div>
            {/* Backdrop click closer */}
            <div className="absolute inset-0 -z-10" onClick={(e) => { e.stopPropagation(); onClose(); }}></div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default Modal;
