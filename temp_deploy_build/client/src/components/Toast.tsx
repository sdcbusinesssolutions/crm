import React from 'react';
import { CloseIcon, CheckIcon } from './icons';

interface ToastProps {
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ type, title, message, onClose }) => {
    // Map types to theme-aligned styles
    // We use the brand color for the primary action button to align with global settings.
    // Icons retain their semantic colors (Green for success, Red for error) for clarity, 
    // but the container and text use global theme variables.

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckIcon className="w-6 h-6 text-white" />;
            case 'error':
                return <span className="text-white text-2xl font-bold">!</span>;
            case 'warning':
                return <span className="text-white text-2xl font-bold">!</span>;
            case 'info':
                return <span className="text-white text-2xl font-bold">i</span>;
        }
    };

    const getIconBg = () => {
        switch (type) {
            case 'success': return 'bg-green-500';
            case 'error': return 'bg-red-500';
            case 'warning': return 'bg-yellow-500';
            case 'info': return 'bg-blue-500';
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="relative max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-6 animate-slide-up">
                {/* Icon */}
                <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 ${getIconBg()} rounded-full flex items-center justify-center shadow-sm`}>
                        {getIcon()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                        <h3 className="text-lg font-bold text-[var(--color-text)] mb-1">{title}</h3>
                        <p className="text-sm text-[var(--color-text)] opacity-80 leading-relaxed whitespace-pre-line">{message}</p>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[var(--color-bg)] transition-colors text-[var(--color-text)] opacity-60 hover:opacity-100"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* OK Button */}
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-all transform hover:-translate-y-0.5 shadow-md"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Toast;
