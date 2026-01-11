import React, { useState } from 'react';

interface TemplatePreviewProps {
    type: string;
    header: string;
    body: string;
    footer: string;
    actions: any;
    language: string;
    companyName?: string;
    logoUrl?: string;
    mediaUrl?: string;
    locationHeader?: {
        latitude: string;
        longitude: string;
        name: string;
        address: string;
    };
    carouselMediaUrls?: string[];
    variableSamples?: any[];
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({ type, header, body, footer, actions, language, companyName = 'Business Name', logoUrl, mediaUrl, variableSamples, locationHeader, carouselMediaUrls }) => {
    // Helper to format body text with WhatsApp markdown
    const formatBody = (text: string) => {
        if (!text) return '';
        let formatted = text;

        // Replace variables with samples if available
        if (variableSamples && variableSamples.length > 0) {
            // Check if positional or named
            const isPositional = variableSamples.every(s => typeof s === 'string' || typeof s === 'number');

            if (isPositional) {
                // Positional replacement {{1}}, {{2}}...
                variableSamples.forEach((sample, index) => {
                    const sampleText = sample || `{{${index + 1}}}`; // Fallback to placeholder if empty
                    const regex = new RegExp(`{{${index + 1}}}`, 'g');
                    formatted = formatted.replace(regex, `<span class="bg-blue-100 text-blue-800 px-1 rounded mx-0.5 font-medium text-xs">${sampleText}</span>`);
                });
            } else {
                // Named replacement {{name}}, {{price}}...
                variableSamples.forEach(sample => {
                    if (sample && sample.param_name) {
                        const sampleText = sample.example || `{{${sample.param_name}}}`;
                        const regex = new RegExp(`{{${sample.param_name}}}`, 'g');
                        formatted = formatted.replace(regex, `<span class="bg-blue-100 text-blue-800 px-1 rounded mx-0.5 font-medium text-xs">${sampleText}</span>`);
                    }
                });
            }
        } else {
            // Fallback for no samples: highlight variables
            formatted = formatted
                .replace(/{{(\d+)}}/g, '<span class="bg-blue-100 text-blue-800 px-1 rounded mx-0.5 font-medium text-xs">{{$1}}</span>')
                .replace(/{{([a-z0-9_]+)}}/g, '<span class="bg-blue-100 text-blue-800 px-1 rounded mx-0.5 font-medium text-xs">{{$1}}</span>');
        }

        formatted = formatted
            .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/~(.*?)~/g, '<del>$1</del>')
            .replace(/\n/g, '<br/>');
        return formatted;
    };

    const renderHeader = () => {
        if (!header && type === 'TEXT') return null;

        if (type === 'TEXT' && header) {
            return <div className="font-bold text-slate-900 mb-2 text-base">{header}</div>;
        }

        if (['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(type)) {
            return (
                <div className="bg-slate-200 h-40 w-full rounded-lg mb-3 flex flex-col items-center justify-center text-slate-500 relative overflow-hidden group">
                    {type === 'IMAGE' && (
                        mediaUrl ? (
                            <img src={mediaUrl} alt="Header" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-4xl">🖼️</span>
                        )
                    )}
                    {type === 'VIDEO' && (
                        mediaUrl ? (
                            <video src={mediaUrl} className="w-full h-full object-cover" controls />
                        ) : (
                            <span className="text-4xl">🎥</span>
                        )
                    )}
                    {type === 'DOCUMENT' && (
                        mediaUrl ? (
                            <div className="flex flex-col items-center p-4 bg-white/50 w-full h-full justify-center">
                                <span className="text-4xl mb-2">📄</span>
                                <span className="text-xs truncate max-w-full px-2">{mediaUrl.split('/').pop()}</span>
                            </div>
                        ) : (
                            <span className="text-4xl">📄</span>
                        )
                    )}
                    {type === 'LOCATION' && (
                        locationHeader && locationHeader.name ? (
                            <div className="w-full h-full bg-slate-100 flex flex-col p-3 justify-center relative">
                                <div className="absolute inset-0 bg-slate-300 opacity-20" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
                                <div className="z-10 bg-white/80 p-2 rounded shadow-sm backdrop-blur-sm">
                                    <p className="font-bold text-sm text-slate-800 truncate">{locationHeader.name}</p>
                                    <p className="text-xs text-slate-500 truncate">{locationHeader.address}</p>
                                </div>
                                <div className="absolute bottom-2 right-2 text-red-500 text-2xl">📍</div>
                            </div>
                        ) : (
                            <span className="text-4xl">📍</span>
                        )
                    )}
                    {!mediaUrl && !locationHeader?.name && (
                        <span className="text-xs font-bold mt-2 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-2">{type} HEADER</span>
                    )}
                </div>
            );
        }
        return null;
    };

    const renderActions = () => {
        if (!actions || actions.type === 'NONE') return null;

        if (actions.type === 'MEDIA_CARD_CAROUSEL' || type === 'CAROUSEL') {
            const cards = actions.cards || carouselMediaUrls?.map((url, i) => ({
                header: { format: 'IMAGE' },
                body: 'Card Body...',
                buttons: []
            })) || [];
            if (cards.length === 0 && (!carouselMediaUrls || carouselMediaUrls.length === 0)) return <div className="p-2 text-xs text-slate-400 italic text-center">No cards added</div>;

            // If cards are missing but we have URLs (from preview extraction), verify logic
            const displayCards = cards.length > 0 ? cards : (carouselMediaUrls || []).map(url => ({ header: { format: 'IMAGE' }, body: 'Card Body', buttons: [] }));

            return (
                <div className="mt-2 -mx-1 overflow-x-auto flex gap-2 pb-2 px-1 custom-scrollbar snap-x">
                    {displayCards.map((card: any, idx: number) => {
                        const cardMediaUrl = carouselMediaUrls ? carouselMediaUrls[idx] : mediaUrl;
                        return (
                            <div key={idx} className="min-w-[200px] w-[200px] bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm snap-center flex-shrink-0 relative group">
                                <div className="absolute top-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full z-10 font-bold backdrop-blur-sm">
                                    {idx + 1}/{displayCards.length}
                                </div>
                                <div className="h-24 bg-slate-200 flex items-center justify-center text-2xl overflow-hidden relative">
                                    {cardMediaUrl ? (
                                        (card.header?.format === 'VIDEO' || card.header?.type === 'VIDEO') ? (
                                            <video src={cardMediaUrl} className="w-full h-full object-cover" controls />
                                        ) : (
                                            <img src={cardMediaUrl} alt="Card Header" className="w-full h-full object-cover" />
                                        )
                                    ) : (
                                        (card.header?.format === 'VIDEO' || card.header?.type === 'VIDEO') ? '🎥' : '🖼️'
                                    )}
                                </div>
                                <div className="p-2">
                                    <p className="text-xs text-slate-800 line-clamp-3">{card.body || 'Card body text...'}</p>
                                </div>
                                {card.buttons && card.buttons.length > 0 && (
                                    <div className="border-t border-slate-100">
                                        {card.buttons.map((btn: any, bIdx: number) => (
                                            <div key={bIdx} className="py-2 text-center text-[#00a884] text-xs font-bold border-b last:border-b-0 border-slate-50 cursor-pointer hover:bg-slate-50">
                                                {btn.text || 'Button'}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (actions.type === 'PRODUCT_CARD_CAROUSEL') {
            return (
                <div className="mt-2 -mx-1 overflow-x-auto flex gap-2 pb-2 px-1 custom-scrollbar snap-x">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="min-w-[140px] w-[140px] bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm snap-center flex-shrink-0">
                            <div className="h-24 bg-slate-100 flex items-center justify-center text-2xl">🛍️</div>
                            <div className="p-2">
                                <div className="h-3 w-3/4 bg-slate-200 rounded mb-1"></div>
                                <div className="h-3 w-1/2 bg-slate-200 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        const buttons = actions.buttons || [];
        if (buttons.length === 0) return null;

        return (
            <div className="mt-2 space-y-2 w-full">
                {buttons.map((btn: any, idx: number) => (
                    <div key={idx} className="bg-white text-[#00a884] text-center py-2.5 rounded-lg shadow-sm border-t border-slate-50 font-medium text-sm cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                        {btn.type === 'PHONE_NUMBER' && <span>📞</span>}
                        {btn.type === 'URL' && <span>🔗</span>}
                        {btn.type === 'FLOW' && <span>📝</span>}
                        {btn.text || 'Button'}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full w-full items-center justify-center p-2 md:p-4">
            {/* Phone Container - Uses aspect ratio and max dimensions to fit */}
            <div
                className="relative w-full max-w-[300px] aspect-[9/19.5] max-h-full shadow-2xl rounded-[2.5rem] border-[8px] border-slate-900 bg-slate-900 overflow-hidden flex flex-col shrink-0"
            >
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-slate-900 rounded-b-xl z-20"></div>

                {/* Screen Content */}
                <div className="w-full h-full bg-[#e5ddd5] overflow-hidden flex flex-col relative rounded-[2rem]">
                    {/* Status Bar (Mobile Only) */}
                    <div className="h-10 bg-[#e5ddd5] flex justify-between items-center px-6 pt-2 text-xs font-bold text-slate-800 z-10">
                        <span>9:41</span>
                        <div className="flex gap-1">
                            <div className="w-4 h-2.5 bg-slate-800 rounded-[1px]"></div>
                            <div className="w-0.5 h-2.5 bg-slate-800 rounded-[1px]"></div>
                        </div>
                    </div>

                    {/* App Header */}
                    <div className="bg-[#008069] text-white p-3 flex items-center gap-3 shadow-md z-10 shrink-0">
                        <div className="w-6 h-6 flex items-center justify-center cursor-pointer">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7" /></svg>
                        </div>
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex-shrink-0 overflow-hidden bg-white">
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                            ) : (
                                <div className="w-full h-full bg-slate-300 flex items-center justify-center text-slate-500 text-xs font-bold">
                                    {companyName.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-sm truncate">{companyName}</h3>
                        </div>
                        <div className="flex gap-3">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="flex flex-col items-start max-w-[90%]">
                            <div className="bg-white rounded-lg rounded-tl-none shadow-sm p-1 overflow-hidden w-full">
                                <div className="p-2 pb-1">
                                    {renderHeader()}
                                    <div
                                        className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: formatBody(body) || '<span class="text-slate-300 italic">Your message...</span>' }}
                                    />
                                    {footer && (
                                        <div className="text-[11px] text-slate-400 mt-2 pt-1 border-t border-slate-50 font-medium">
                                            {footer}
                                        </div>
                                    )}
                                </div>
                                {/* Timestamp */}
                                {/* Timestamp Removed */}

                                {/* Buttons */}
                                {actions && actions.type !== 'NONE' && (
                                    <div className="border-t border-slate-100 bg-slate-50/30">
                                        {renderActions()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Chat Input (Visual Only) */}
                    <div className="bg-[#f0f2f5] p-2 flex items-center gap-2 shrink-0">
                        <div className="p-2 text-slate-500">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div className="p-2 text-slate-500">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <div className="flex-1 bg-white rounded-full h-9 px-4 flex items-center text-sm text-slate-400">
                            Message
                        </div>
                        <div className="p-2 text-slate-500">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplatePreview;
