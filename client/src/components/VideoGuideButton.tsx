import React, { useState } from 'react';
import VideoGuideModal from './VideoGuideModal';
import { videoGuideService } from '../services/videoGuideService';

interface VideoGuideButtonProps {
    moduleName: string;
    className?: string;
    label?: string;
}

const VideoGuideButton: React.FC<VideoGuideButtonProps> = ({ moduleName, className = '', label = 'Watch Tutorial' }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
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
            // Optional: Show a toast or just open a default video
            console.log('No video guide found for this module');
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
        </>
    );
};

export default VideoGuideButton;
