import React, { useEffect, useState } from 'react';
import FacebookLeadAdsCard from './FacebookLeadAdsCard';
import OpenAIIntegrationCard from './OpenAIIntegrationCard';
import GoogleSheetsCard from './GoogleSheetsCard';
import GmailCard from './GmailCard';
import GoogleCalendarCard from './GoogleCalendarCard';
import GoogleContactsCard from './GoogleContactsCard';
import SmtpCard from './SmtpCard';
import { themeService } from '../../services/themeService';

interface IntegrationsViewProps {
    onToggleSidebar?: () => void;
    onNavigate?: (item: any) => void;
}

const IntegrationsView: React.FC<IntegrationsViewProps> = ({ onToggleSidebar, onNavigate }) => {
    const [brandColor, setBrandColor] = useState('#ea580c'); // Default orange
    const [connectedApps, setConnectedApps] = useState<string[]>([]);

    useEffect(() => {
        const loadTheme = async () => {
            const theme = await themeService.getTheme();
            if (theme?.colors?.brand) {
                setBrandColor(theme.colors.brand);
            }
        };
        loadTheme();
    }, []);

    const handleConnect = (appName: string, url: string) => {
        setConnectedApps(prev => [...prev, appName]);
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };

    // Helper for subtle background
    const getSubtleBg = () => ({
        backgroundColor: brandColor,
        opacity: 0.1,
        color: brandColor,
        borderColor: brandColor
    });

    return (
        <div className="flex flex-col w-full h-full bg-slate-50 font-sans text-slate-900 animate-fade-in relative overflow-hidden container-mobile-fix">
            {/* Header - Fixed to Top */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0 z-30 sticky top-0">
                <div className="px-4 sm:px-8 py-3 max-w-[1800px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {onToggleSidebar && (
                            <button
                                onClick={onToggleSidebar}
                                className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                            </button>
                        )}
                        <div>
                            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Integrations</h1>
                            <p className="text-slate-500 text-sm mt-1 font-medium hidden sm:block">Connect your workspace with third-party tools and services.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-24">
                <div className="max-w-[1800px] mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {/* Facebook Lead Ads - Connected */}
                        <div className="h-full">
                            <FacebookLeadAdsCard />
                        </div>

                        {/* OpenAI */}
                        <div className="h-full">
                            <OpenAIIntegrationCard />
                        </div>

                        {/* Google Sheets */}
                        <div className="h-full">
                            <GoogleSheetsCard />
                        </div>

                        {/* Gmail */}
                        <div className="h-full">
                            <GmailCard />
                        </div>

                        {/* Google Calendar */}
                        <div className="h-full">
                            <GoogleCalendarCard />
                        </div>

                        {/* Google Contacts */}
                        <div className="h-full">
                            <GoogleContactsCard />
                        </div>

                        {/* SMTP */}
                        <div className="h-full">
                            <SmtpCard />
                        </div>

                        {/* Telegram */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute top-3 right-3 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                                Beta
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center mb-4 text-sky-500 font-bold text-xl">
                                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.638z" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Telegram</h3>
                            <p className="text-slate-500 text-sm mb-6">
                                Set up and manage the integration flow
                            </p>
                            <button disabled className="w-full px-4 py-2 border border-slate-200 font-medium rounded-lg cursor-not-allowed opacity-80"
                                style={{ backgroundColor: brandColor, color: '#fff', opacity: 0.6 }}>
                                Coming Soon
                            </button>
                        </div>

                        {/* Zoom */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute top-3 right-3 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                                Beta
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center mb-4 text-white font-bold text-xl">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M4.5 9C4.5 7.61929 5.61929 6.5 7 6.5H13C14.3807 6.5 15.5 7.61929 15.5 9V15C15.5 16.3807 14.3807 17.5 13 17.5H7C5.61929 17.5 4.5 16.3807 4.5 15V9Z" /><path d="M17 10.5V13.5L21 15.5V8.5L17 10.5Z" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Zoom</h3>
                            <p className="text-slate-500 text-sm mb-6">
                                Set up and manage the integration flow
                            </p>
                            <button disabled className="w-full px-4 py-2 border border-slate-200 font-medium rounded-lg cursor-not-allowed opacity-80"
                                style={{ backgroundColor: brandColor, color: '#fff', opacity: 0.6 }}>
                                Coming Soon
                            </button>
                        </div>

                        {/* Webhook Integration */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4 text-purple-600 font-bold text-xl">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Webhook Integration</h3>
                            <p className="text-slate-500 text-sm mb-6">
                                Receive and send data via webhooks to connect with external systems
                            </p>
                            <button
                                onClick={() => {
                                    if (onNavigate) onNavigate('Flows');
                                    else window.location.href = '?view=Flows';
                                }}
                                className="w-full px-4 py-2 font-medium rounded-lg transition-all hover:shadow-md"
                                style={{ backgroundColor: brandColor, color: '#fff' }}>
                                Configure
                            </button>
                        </div>

                        {/* API Integration */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4 text-emerald-600 font-bold text-xl">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">API Integration</h3>
                            <p className="text-slate-500 text-sm mb-6">
                                Access our REST API to build custom integrations and automations
                            </p>
                            <button
                                onClick={() => {
                                    if (onNavigate) onNavigate('Flows');
                                    else window.location.href = '?view=Flows';
                                }}
                                className="w-full px-4 py-2 font-medium rounded-lg transition-all hover:shadow-md"
                                style={{ backgroundColor: brandColor, color: '#fff' }}>
                                View Documentation
                            </button>
                        </div>

                        {/* Bulk RCS Integration */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            {/* Animated glow bg on hover - Moved behind */}
                            <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-cyan-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0" />
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#0d2444] to-[#0a4a5e] shadow-md ring-2 ring-teal-100">
                                        <img
                                            src="https://bulkrcs.online/wp-content/uploads/2024/12/cropped-bulkrcs-192x192.png"
                                            alt="Bulk RCS"
                                            className="w-9 h-9 object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).parentElement!.innerHTML = `<svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#00e5c8" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>`;
                                            }}
                                        />
                                    </div>
                                    {connectedApps.includes('bulk_rcs') && (
                                        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Connected
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">Bulk RCS</h3>
                                <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                                    Send rich, interactive RCS messages at scale. Engage customers with branded, media-rich business messaging directly on Android devices.
                                </p>
                                <button
                                    onClick={() => handleConnect('bulk_rcs', 'https://bulkrcs.online')}
                                    className="w-full px-4 py-2.5 font-semibold rounded-lg hover:shadow-lg flex items-center justify-center gap-2 select-none outline-none transition-all"
                                    style={{
                                        background: connectedApps.includes('bulk_rcs') ? '#f8fafc' : 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                                        color: connectedApps.includes('bulk_rcs') ? '#475569' : '#fff',
                                        border: connectedApps.includes('bulk_rcs') ? '1px solid #e2e8f0' : 'none',
                                        boxShadow: connectedApps.includes('bulk_rcs') ? 'none' : '0 4px 14px rgba(6, 182, 212, 0.35)'
                                    }}>
                                    {connectedApps.includes('bulk_rcs') ? 'Manage' : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            Connect
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* N8N Workflow Automation */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-red-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0" />
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#ea4b20] to-[#ff6a3d] shadow-md ring-2 ring-orange-100">
                                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                                            <circle cx="5" cy="12" r="3" fill="white" opacity="0.9"/>
                                            <circle cx="19" cy="12" r="3" fill="white" opacity="0.9"/>
                                            <path d="M8 12h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                                            <path d="M2 6l3 6-3 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M22 6l-3 6 3 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-200">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                                            Powered by N8N
                                        </div>
                                        {connectedApps.includes('n8n') && (
                                            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Connected
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">N8N Workflow Automation</h3>
                                <p className="text-slate-600 text-sm mb-2 leading-relaxed">
                                    Automate complex workflows by connecting your WhatsApp flows with 400+ apps. Trigger actions, sync data, and build powerful no-code automations.
                                </p>
                                <p className="text-[11px] text-orange-600 font-medium mb-5 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                    Executed via N8N Workflow Engine
                                </p>
                                <button
                                    onClick={() => handleConnect('n8n', 'https://n8n.io')}
                                    className="w-full px-4 py-2.5 font-semibold rounded-lg hover:shadow-lg flex items-center justify-center gap-2 select-none outline-none transition-all"
                                    style={{
                                        background: connectedApps.includes('n8n') ? '#f8fafc' : 'linear-gradient(135deg, #ea4b20 0%, #ff6a3d 100%)',
                                        color: connectedApps.includes('n8n') ? '#475569' : '#fff',
                                        border: connectedApps.includes('n8n') ? '1px solid #e2e8f0' : 'none',
                                        boxShadow: connectedApps.includes('n8n') ? 'none' : '0 4px 14px rgba(234, 75, 32, 0.3)'
                                    }}>
                                    {connectedApps.includes('n8n') ? 'Configure' : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            Explore N8N
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* AI Voice Calling Agent */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-purple-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-0" />
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#6d28d9] to-[#a855f7] shadow-md ring-2 ring-violet-100">
                                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 10v2a7 7 0 01-14 0v-2" />
                                            <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/>
                                            <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/>
                                        </svg>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-1 bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-violet-200">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                                            3rd Party
                                        </div>
                                        {connectedApps.includes('ai_voice') && (
                                            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Connected
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">AI Voice Calling Agent</h3>
                                <p className="text-slate-600 text-sm mb-2 leading-relaxed">
                                    Deploy AI-powered outbound &amp; inbound voice agents. Automate sales calls, customer support, and follow-ups with human-like voice bots.
                                </p>
                                <p className="text-[11px] text-violet-600 font-medium mb-5 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                    Powered by external Voice platform
                                </p>
                                <button
                                    onClick={() => handleConnect('ai_voice', '')}
                                    disabled={false} /* Enable it for simulation */
                                    className={`w-full px-4 py-2.5 font-semibold rounded-lg flex items-center justify-center gap-2 select-none outline-none transition-all ${connectedApps.includes('ai_voice') ? 'cursor-default' : 'hover:shadow-lg'}`}
                                    style={{
                                        background: connectedApps.includes('ai_voice') ? '#f8fafc' : 'linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)',
                                        color: connectedApps.includes('ai_voice') ? '#475569' : '#fff',
                                        border: connectedApps.includes('ai_voice') ? '1px solid #e2e8f0' : 'none',
                                        boxShadow: connectedApps.includes('ai_voice') ? 'none' : '0 4px 14px rgba(109, 40, 217, 0.3)'
                                    }}>
                                    {connectedApps.includes('ai_voice') ? 'Manage Agent' : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Coming Soon
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntegrationsView;
