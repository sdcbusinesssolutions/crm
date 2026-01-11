import React, { useState, useEffect, useLayoutEffect } from 'react';
import Dashboard from './components/Dashboard';
import FlowEditor from './components/FlowEditor';
import Sidebar, { MenuItem } from './components/Sidebar';
import WhatsAppNumbers from './components/WhatsAppNumbers';
import Contacts from './components/Contacts';
import InputFields from './components/InputFields';
import Inbox from './components/Inbox';
import GlobalSettings from './components/GlobalSettings';
import { MenuIcon } from './components/icons';
import { themeService } from './services/themeService';
import CampaignList from './client/src/components/Campaigns/CampaignList';
import CreateCampaign from './client/src/components/Campaigns/CreateCampaign';
import CampaignDetails from './client/src/components/Campaigns/CampaignDetails';

const App: React.FC = () => {
    const [activeMenuItem, setActiveMenuItem] = useState<MenuItem>('Dashboard');
    const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [campaignView, setCampaignView] = useState<'list' | 'create' | 'details'>('list');
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

    // Apply theme on initial load
    useLayoutEffect(() => {
        const savedTheme = themeService.getTheme();
        themeService.applyTheme(savedTheme);
    }, []);

    const handleNavigateToFlow = (flowId: string) => {
        setCurrentFlowId(flowId);
        setActiveMenuItem('Flows'); // CRITICAL FIX: Switch view to editor
    };

    const handleBackToDashboard = () => {
        setCurrentFlowId(null);
        setActiveMenuItem('Dashboard');
    };

    const handleMenuNavigation = (item: MenuItem) => {
        setActiveMenuItem(item);
        if (item !== 'Flows') {
            setCurrentFlowId(null);
        }

        // Reset/Initialize Campaign View
        if (item === 'Campaigns') {
            setCampaignView('list');
            setSelectedCampaignId(null);
        } else {
            // Optional: reset if leaving (already defaulting in state, but good for cleanliness)
            setCampaignView('list');
            setSelectedCampaignId(null);
        }

        setSidebarOpen(false); // Close sidebar on mobile when navigating
    };

    // The current application logic (Dashboard + Flow Editor)
    const renderFlowBuilderApp = () => {
        if (currentFlowId) {
            return <FlowEditor flowId={currentFlowId} onBack={handleBackToDashboard} />;
        }
        return <Dashboard onNavigateToFlow={handleNavigateToFlow} />;
    };

    const renderContent = () => {
        // Prioritize Campaigns check
        if (activeMenuItem === 'Campaigns') {
            if (campaignView === 'create') {
                return <CreateCampaign onBack={() => setCampaignView('list')} />;
            }
            if (campaignView === 'details' && selectedCampaignId) {
                return <CampaignDetails campaignId={selectedCampaignId} onBack={() => setCampaignView('list')} />;
            }
            return (
                <CampaignList
                    onCreate={() => setCampaignView('create')}
                    onSelect={(id) => {
                        setSelectedCampaignId(id);
                        setCampaignView('details');
                    }}
                />
            );
        }

        if (activeMenuItem === 'Flows' || activeMenuItem === 'Dashboard') {
            // Allow Dashboard to be rendered when explicit or defaulting from Flow
            if (activeMenuItem === 'Flows') return renderFlowBuilderApp();
            return <Dashboard onNavigateToFlow={handleNavigateToFlow} />;
        }

        if (activeMenuItem === 'Inbox') {
            return <Inbox />;
        }

        if (activeMenuItem === 'WhatsApp Numbers') {
            return <WhatsAppNumbers />;
        }

        // Map both 'Contacts' (parent click behavior fallback) and 'Contact List' to the Contacts component
        if (activeMenuItem === 'Contact List' || activeMenuItem === 'Contacts') {
            return <Contacts initialTab="contacts" />;
        }

        if (activeMenuItem === 'Contact Groups') {
            return <Contacts initialTab="groups" />;
        }

        if (activeMenuItem === 'Input Fields') {
            return <Contacts initialTab="inputs" />;
        }

        if (activeMenuItem === 'Settings' || activeMenuItem === 'Branding & Appearance') {
            return <GlobalSettings />;
        }



        // Placeholder for other menu items
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full p-8 text-center animate-fade-in">
                <div className="w-20 h-20 bg-canvas-surface rounded-full shadow-sm flex items-center justify-center mb-6">
                    <span className="text-4xl">🛠️</span>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-canvas-text">{activeMenuItem}</h2>
                <p className="max-w-md mx-auto text-slate-400">This module is currently under active development. Check back soon for updates.</p>
                <button
                    onClick={() => setActiveMenuItem('Flows')}
                    className="mt-8 px-6 py-2.5 bg-brand-600 text-white rounded-btn hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 font-bold text-sm"
                >
                    Go to Flows
                </button>
            </div>
        );
    };

    // Determine if we are currently editing a flow (to hide global header on mobile)
    const isEditingFlow = activeMenuItem === 'Flows' && currentFlowId !== null;

    return (
        <div className="flex h-screen w-screen overflow-hidden">
            {/* Sidebar */}
            <Sidebar
                activeItem={activeMenuItem}
                onNavigate={handleMenuNavigation}
                isOpen={isSidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex-col overflow-hidden relative w-full min-h-0 flex">
                {/* Mobile Header Trigger - Visible only on small screens AND when not in flow editor */}
                {!isEditingFlow && (
                    <div className="md:hidden flex items-center justify-between px-4 py-3 bg-canvas-surface border-b border-slate-200 z-20 shadow-sm shrink-0">
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <MenuIcon className="w-6 h-6" />
                            </button>
                            <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-brand-600 rounded-md flex items-center justify-center">
                                    <span className="text-white font-bold text-xs">V</span>
                                </div>
                                <span className="font-bold text-lg text-slate-800">UpShpoi</span>
                            </div>
                        </div>
                    </div>
                )}

                {renderContent()}
            </div>
        </div>
    );
};

export default App;