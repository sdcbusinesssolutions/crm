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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
            <div className="relative max-w-md w-full bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-8 animate-slide-up overflow-hidden">
                {/* Decorative background element */}
                <div className={`absolute top-0 right-0 w-32 h-32 ${getIconBg()} opacity-5 -mr-16 -mt-16 rounded-full blur-3xl`}></div>
                
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600 z-10"
                >
                    <CloseIcon className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center">
                    {/* Icon Container */}
                    <div className={`flex-shrink-0 w-20 h-20 ${getIconBg()} rounded-3xl flex items-center justify-center shadow-2xl shadow-${getIconBg().split('-')[1]}-200 mb-6 transform -rotate-6 transition-transform hover:rotate-0 duration-500`}>
                        {getIcon()}
                    </div>

                    {/* Content */}
                    <div className="w-full">
                        <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{title}</h3>
                        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100 mb-8">
                            <p className="text-[15px] text-slate-600 font-medium leading-relaxed whitespace-pre-line text-left">
                                {message}
                            </p>
                        </div>
                    </div>

                    {/* OK Button */}
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-[var(--color-brand)] text-white rounded-2xl font-black text-lg hover:opacity-95 transition-all transform hover:-translate-y-1 shadow-xl shadow-[var(--color-brand)]/20 active:scale-[0.98]"
                    >
                        Great, thanks!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Toast;
