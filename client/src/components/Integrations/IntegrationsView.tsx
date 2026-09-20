import React, { useEffect, useState } from 'react';
import GoogleSheetsCard from './GoogleSheetsCard';
import GmailCard from './GmailCard';
import SmtpCard from './SmtpCard';
import { themeService } from '../../services/themeService';
import { usePermissions, ACCESS_TYPES } from '../../modules/teamStaff/hooks/usePermissions';

interface IntegrationsViewProps {
    onToggleSidebar?: () => void;
    onNavigate?: (item: any) => void;
}

const IntegrationsView: React.FC<IntegrationsViewProps> = ({ onToggleSidebar, onNavigate }) => {
    const { hasAccess } = usePermissions();
    const canRead = hasAccess('Integrations', ACCESS_TYPES.READ);
    const canWrite = hasAccess('Integrations', ACCESS_TYPES.READ_WRITE);

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
        if (!canWrite) return;
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

    if (!canRead) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full p-8 text-center bg-slate-50">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 border border-red-100 text-red-500">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-slate-900">Access Denied</h2>
                <p className="max-w-md mx-auto text-slate-500">You do not have permission to view or manage integrations. Please contact your administrator if you believe this is an error.</p>
            </div>
        );
    }

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
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Integrations</h1>
                                {!canWrite && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        Read Only Mode
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-500 text-sm mt-1 font-medium hidden sm:block">Connect your workspace with third-party tools and services.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-24">
                <div className="max-w-[1800px] mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">

                        {/* Google Sheets */}
                        <div className="h-full">
                            <GoogleSheetsCard />
                        </div>

                        {/* Gmail */}
                        <div className="h-full">
                            <GmailCard />
                        </div>

                        {/* SMTP */}
                        <div className="h-full">
                            <SmtpCard />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntegrationsView;
