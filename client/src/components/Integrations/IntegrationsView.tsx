import React, { useEffect, useState } from 'react';
import FacebookLeadAdsCard from './FacebookLeadAdsCard';
import GoogleSheetsCard from './GoogleSheetsCard';
import GmailCard from './GmailCard';
import GoogleCalendarCard from './GoogleCalendarCard';
import GoogleContactsCard from './GoogleContactsCard';
import SmtpCard from './SmtpCard';
import { themeService } from '../../services/themeService';

interface IntegrationsViewProps {
    onToggleSidebar?: () => void;
}

const IntegrationsView: React.FC<IntegrationsViewProps> = ({ onToggleSidebar }) => {
    const [brandColor, setBrandColor] = useState('#ea580c'); // Default orange

    useEffect(() => {
        const loadTheme = async () => {
            const theme = await themeService.getTheme();
            if (theme?.colors?.brand) {
                setBrandColor(theme.colors.brand);
            }
        };
        loadTheme();
    }, []);

    // Helper for subtle background
    const getSubtleBg = () => ({
        backgroundColor: brandColor,
        opacity: 0.1,
        color: brandColor,
        borderColor: brandColor
    });

    return (
        <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50 h-full container-mobile-fix">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                            <h1 className="text-2xl font-bold text-slate-800">Integrations</h1>
                            <p className="text-slate-500 mt-1">Connect your workspace with third-party tools and services.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Facebook Lead Ads - Connected */}
                    <div className="h-full">
                        <FacebookLeadAdsCard />
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
                </div>
            </div>
        </div>
    );
};

export default IntegrationsView;
