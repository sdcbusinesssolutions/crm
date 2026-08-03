import React, { useState, useRef, useEffect } from 'react';

interface VideoGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    videoId: string;
    title: string;
}

const VideoGuideModal: React.FC<VideoGuideModalProps> = ({ isOpen, onClose, videoId, title }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const modalStartPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStartPos.current.x;
            const dy = e.clientY - dragStartPos.current.y;
            setPosition({
                x: modalStartPos.current.x + dx,
                y: modalStartPos.current.y + dy
            });
        };
        
        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        setIsDragging(true);
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        modalStartPos.current = { ...position };
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/0 pointer-events-none p-4">
            <div 
                className="bg-white rounded-t-2xl rounded-b-sm overflow-hidden shadow-2xl w-full max-w-4xl flex flex-col relative pointer-events-auto"
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                <div 
                    className={`flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleMouseDown}
                >
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                        </svg>
                        {title}
                    </h3>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-full p-2 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 Aspect Ratio */ }}>
                    <iframe 
                        className="absolute top-0 left-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&loop=1&playlist=${videoId}`}
                        title="YouTube video player" 
                        frameBorder="0" 
                        sandbox="allow-scripts allow-same-origin allow-presentation"
                        allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowFullScreen
                    ></iframe>
                    {/* Invisible overlay to block mouse hover on the top YouTube title/channel icon */}
                    <div className="absolute top-0 left-0 w-full h-[80px] z-50 cursor-default" title=""></div>
                </div>
            </div>
        </div>
    );
};

export default VideoGuideModal;
