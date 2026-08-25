import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import VideoGuideModal from './VideoGuideModal';
import { videoGuideService } from '../services/videoGuideService';

interface VideoGuideButtonProps {
    moduleName: string;
    className?: string;
    label?: string;
}

const VideoGuideButton: React.FC<VideoGuideButtonProps> = ({ moduleName, className = '', label = 'Watch Tutorial' }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
    const [videoId, setVideoId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const extractVideoId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const handleClick = async () => {
        setIsLoading(true);
        const url = await videoGuideService.getGuideUrl(moduleName);
        setIsLoading(false);

        if (url) {
            const extractedId = extractVideoId(url);
            if (extractedId) {
                setVideoId(extractedId);
                setIsModalOpen(true);
            } else {
                window.open(url, '_blank');
            }
        } else {
            setIsComingSoonOpen(true);
        }
    };

    return (
        <>
            <button
                onClick={handleClick}
                disabled={isLoading}
                className={`flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 ${className}`}
                title={`Watch ${moduleName} Tutorial`}
            >
                {isLoading ? (
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                    </svg>
                )}
                <span className="hidden sm:inline">{label}</span>
            </button>

            {videoId && (
                <VideoGuideModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    videoId={videoId} 
                    title={`${moduleName} Tutorial`} 
                />
            )}

            {isComingSoonOpen && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Coming Soon!</h3>
                            <p className="text-slate-500 text-sm mb-6">
                                We're working hard on an awesome video tutorial for the <strong>{moduleName}</strong> module. Check back later!
                            </p>
                            <button
                                onClick={() => setIsComingSoonOpen(false)}
                                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
                            >
                                Got it!
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default VideoGuideButton;
