import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

// Admin Pages
import AdminLogin from './pages/admin/auth/login';
import AdminDashboard from './pages/admin/dashboard/Dashboard';
import SuperDashboard from './pages/admin/SuperDashboard';
import AdminUsers from './pages/admin/users/Users';
import AdminPlans from './pages/admin/plans/Plans';
import AdminSubscriptions from './pages/admin/subscriptions/Subscriptions';
import AdminSettings from './pages/admin/settings/Settings';
import AdminLayout from './layouts/admin/AdminLayout';
import { Session } from '@supabase/supabase-js';
import Dashboard from './components/Dashboard';
import FlowEditor from './components/FlowEditor';
import Sidebar, { MenuItem } from './components/Sidebar';

import Contacts from './components/Contacts';
import InputFields from './components/InputFields';
import Inbox from './components/Inbox';
import GlobalSettings from './components/GlobalSettings';
import AuthPage from './components/AuthPage';
import { MenuIcon } from './components/icons';
import { themeService } from './services/themeService';
import FormPublicView from './components/FormPublicView';
import WhatsAppManagement from './components/WhatsAppManagement';
import AuthBridge from './components/WhatsAppManagement/AuthBridge';
import WhatsAppForms from './components/WhatsAppForms';
import WhatsAppFormBuilder from './components/WhatsAppFormBuilder';
import { tokenService } from './services/tokenService';
import TemplateList from './components/WhatsAppTemplates/TemplateList';
import TemplateBuilder from './components/WhatsAppTemplates/TemplateBuilder';
import CampaignList from './components/Campaigns/CampaignList';
import IntegrationsView from './components/Integrations/IntegrationsView';
import CampaignDetails from './components/Campaigns/CampaignDetails';
import FlowList from './components/FlowList';
import ImpersonationBanner from './components/ImpersonationBanner';
import MyPlan from './components/MyPlan';
import { ContactForms } from './components/ContactForms/ContactForms';
import ContactTags from './components/ContactTags';
import WhatsAppApiSettings from './components/WhatsAppApiSettings';
import CreateCampaignComponent from './components/Campaigns/CreateCampaign';
import { SheetAutomationList, SheetAutomationWizard } from './components/SheetAutomation';

import FormBuilder from './components/FormBuilder';
import GoogleCallbackPage from './components/GoogleCallbackPage';
import AuthCentralCallback from './components/AuthCentralCallback';

const MainApp: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [activeMenuItem, setActiveMenuItem] = useState<MenuItem>('Dashboard');
    const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
    const [currentWhatsAppFlowId, setCurrentWhatsAppFlowId] = useState<string | null>(null);
    const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
    const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false);
    const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
    const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);
    const [currentPipelineId, setCurrentPipelineId] = useState<string | null>(null);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isCreatingSheetAutomation, setIsCreatingSheetAutomation] = useState(false);

    // Domain Validation Logic
    const validateDomain = async (currentSession: Session) => {
        if (!currentSession?.user) return;

        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('signup_domain, role')
                .eq('id', currentSession.user.id)
                .single();

            if (profile) {
                const assignedDomain = profile.signup_domain;
                const role = profile.role;
                const currentDomain = window.location.hostname;
                const isLocalhost = currentDomain.includes('localhost');

                // MASTER ADMIN EXCEPTION:
                // If user is 'super_admin' or similar, they might be allowed everywhere.
                // But for now, we assume strict tenancy unless localhost.

                // STRICT CHECK:
                if (assignedDomain && assignedDomain !== currentDomain && !isLocalhost) {
                    // Check if current domain is Master Domain (clickube.com)
                    // If user lands on Master, redirect them to their Tenant.
                    console.warn(`[Tenancy] Domain mismatch! User belongs to ${assignedDomain} but is on ${currentDomain}`);

                    // Force Redirect
                    const protocol = window.location.protocol;
                    const targetUrl = `${protocol}//${assignedDomain}/login?email=${encodeURIComponent(currentSession.user.email || '')}&redirect_reason=domain_mismatch`;

                    // Sign out from this wrong domain to clean up
                    await supabase.auth.signOut();

                    window.location.href = targetUrl;
                    return false; // Validation failed
                }
            }
        } catch (e) {
            console.error("Domain validation error:", e);
        }
        return true; // Validation passed
    };

    // Check for existing session on load and handle redirects
    useEffect(() => {
        // Check if we are coming back from an auth redirect (email link)
        const isRedirecting = window.location.hash && (
            window.location.hash.includes('access_token') ||
            window.location.hash.includes('error_description')
        );

        if (isRedirecting) {
            console.log("Auth redirect detected, waiting for session processing...");
            setIsAuthLoading(true);
        }

        const checkSession = async () => {
            try {
                // getSession() will check local storage AND process the URL fragment if present
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.warn("Session check warning:", error.message);
                }
                if (session) {
                    // Validate Domain BEFORE setting session
                    const isValid = await validateDomain(session);
                    if (!isValid) return; // Stop loading if redirecting

                    setSession(session);
                    tokenService.setAccessToken(session.access_token);
                    // If we processed a hash, clean up the URL
                    if (window.location.hash) {
                        window.history.replaceState(null, '', ' ');
                    }
                }
            } catch (err) {
                console.error("Unexpected auth error:", err);
            } finally {
                // Always stop loading after initial check. 
                // onAuthStateChange will handle subsequent updates.
                setIsAuthLoading(false);
            }
        };

        checkSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("Auth State Change:", event);

            // For SIGNED_IN events, add a small delay to ensure the session is fully established
            if (event === 'SIGNED_IN' && session) {
                // Wait a bit for the session to be fully persisted
                await new Promise(resolve => setTimeout(resolve, 100));

                // Validate Domain
                const isValid = await validateDomain(session);
                if (!isValid) return;
            }

            setSession(session);
            tokenService.setAccessToken(session?.access_token || null);

            // Regardless of the event, if we get here, we are done loading
            setIsAuthLoading(false);

            if (event === 'SIGNED_IN' && window.location.hash.includes('access_token')) {
                window.history.replaceState(null, '', ' ');
            }
        });

        // Safety fallback: If redirect handling hangs for 5s, force UI to render
        const safetyTimeout = setTimeout(() => {
            if (isAuthLoading) setIsAuthLoading(false);
        }, 5000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []);

    // Apply theme on initial load
    useEffect(() => {
        if (!session) return;

        const loadTheme = async () => {
            const savedTheme = await themeService.getTheme();
            themeService.applyTheme(savedTheme);
        };
        loadTheme();
    }, [session]);

    const handleNavigateToFlow = useCallback((flowId: string) => {
        setCurrentFlowId(flowId);
        setActiveMenuItem('Flows');
    }, []);

    const handleBackToDashboard = useCallback(() => {
        setCurrentFlowId(null);
        setActiveMenuItem('Flows');
    }, []);

    const handleMenuNavigation = useCallback((item: MenuItem) => {
        setActiveMenuItem(item);

        // Always reset flow view to list when clicking the main menu item
        if (item === 'Flows') {
            setCurrentFlowId(null);
        } else {
            setCurrentFlowId(null);
        }
        if (item !== 'Pipelines') {
            setCurrentPipelineId(null);
        }
        if (item !== 'Whatsapp Forms') {
            setCurrentWhatsAppFlowId(null);
        }
        if (item !== 'Whatsapp Templates') {
            setCurrentTemplateId(null);
            setIsTemplateBuilderOpen(false);
        }

        // Reset Campaign State
        if (item === 'Campaigns') {
            setIsCreatingCampaign(false);
            setCurrentCampaignId(null);
        } else {
            setIsCreatingCampaign(false);
            setCurrentCampaignId(null);
        }

        if (item !== 'Sheet Automation') {
            setIsCreatingSheetAutomation(false);
        }

        setSidebarOpen(false); // Close sidebar on mobile when navigating
    }, []);

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        setSession(null);
        tokenService.clearAccessToken();
    }, []);

    const handleNavigateToWhatsAppBuilder = useCallback((flowId: string | null) => {
        setCurrentWhatsAppFlowId(flowId);
    }, []);

    const handleNavigateToPipeline = useCallback((pipelineId: string) => {
        setCurrentPipelineId(pipelineId);
        setActiveMenuItem('Pipelines');
    }, []);

    const handleBackToWhatsAppForms = useCallback(() => {
        setCurrentWhatsAppFlowId(null);
    }, []);

    const handleNavigateToTemplateBuilder = useCallback((templateId: string | null) => {
        setCurrentTemplateId(templateId);
        setIsTemplateBuilderOpen(true);
    }, []);

    const handleBackToTemplateList = useCallback(() => {
        setCurrentTemplateId(null);
        setIsTemplateBuilderOpen(false);
    }, []);

    // The current application logic (Dashboard + Flow Editor)
    const renderFlowBuilderApp = () => {
        if (currentFlowId) {
            return <FlowEditor flowId={currentFlowId} onBack={handleBackToDashboard} />;
        }
        return <FlowList onNavigateToFlow={handleNavigateToFlow} />;
    };

    const renderContent = () => {
        // Prioritize Campaigns Check
        if (activeMenuItem === 'Campaigns') {
            if (currentCampaignId) {
                return <CampaignDetails campaignId={currentCampaignId} onBack={() => setCurrentCampaignId(null)} />;
            }
            if (isCreatingCampaign) {
                return <CreateCampaignComponent onBack={() => setIsCreatingCampaign(false)} />;
            }
            return <CampaignList onCreate={() => setIsCreatingCampaign(true)} onSelect={(id) => setCurrentCampaignId(id)} />;
        }

        if (activeMenuItem === 'Dashboard') {
            return <Dashboard onNavigateToFlow={handleNavigateToFlow} onNavigate={handleMenuNavigation} onNavigateToPipeline={handleNavigateToPipeline} />;
        }

        if (activeMenuItem === 'Flows') {
            return renderFlowBuilderApp();
        }

        if (activeMenuItem === 'Inbox') {
            return <Inbox />;
        }



        if (activeMenuItem === 'Overview') {
            return <Contacts initialTab="dashboard" />;
        }

        if (activeMenuItem === 'Contact List') {
            return <Contacts initialTab="contacts" />;
        }

        if (activeMenuItem === 'Contacts') {
            return <Contacts initialTab="dashboard" />;
        }

        if (activeMenuItem === 'Contact Groups') {
            return <Contacts initialTab="groups" />;
        }

        if (activeMenuItem === 'Pipelines') {
            return <Contacts initialTab="pipelines" initialPipelineId={currentPipelineId} />;
        }

        if (activeMenuItem === 'Follow-up') {
            return <Contacts initialTab="follow-up" />;
        }

        if (activeMenuItem === 'Tags') {
            return <ContactTags />;
        }

        if (activeMenuItem === 'Input Fields') {
            return <Contacts initialTab="inputs" />;
        }

        if (activeMenuItem === 'Form Contact') {
            return <ContactForms />;
        }

        if (activeMenuItem === 'Form Builder') {
            return <Contacts initialTab="forms" />;
        }

        if (activeMenuItem === 'Settings' || activeMenuItem === 'Branding & Appearance') {
            return <GlobalSettings />;
        }

        if (activeMenuItem === 'WhatsApp Management') {
            return <WhatsAppManagement />;
        }

        if (activeMenuItem === 'My Plan') {
            return <MyPlan />;
        }

        if (activeMenuItem === 'WhatsApp API') {
            return <WhatsAppApiSettings />;
        }

        if (activeMenuItem === 'Whatsapp Forms') {
            if (currentWhatsAppFlowId) {
                return <WhatsAppFormBuilder flowId={currentWhatsAppFlowId} onBack={handleBackToWhatsAppForms} />;
            }
            return <WhatsAppForms onNavigateToBuilder={handleNavigateToWhatsAppBuilder} />;
        }

        if (activeMenuItem === 'Whatsapp Templates') {
            if (isTemplateBuilderOpen) {
                return <TemplateBuilder templateId={currentTemplateId} onBack={handleBackToTemplateList} />;
            }
            return <TemplateList onNavigateToBuilder={handleNavigateToTemplateBuilder} />;
        }

        if (activeMenuItem === 'Integrations') {
            return <IntegrationsView />;
        }

        if (activeMenuItem === 'Sheet Automation') {
            if (isCreatingSheetAutomation) {
                return (
                    <div className="p-8 h-full overflow-y-auto bg-slate-50">
                        <div className="max-w-4xl mx-auto">
                            <button onClick={() => setIsCreatingSheetAutomation(false)} className="mb-4 text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm">
                                ← Back to List
                            </button>
                            <SheetAutomationWizard
                                onClose={() => setIsCreatingSheetAutomation(false)}
                                onSave={() => setIsCreatingSheetAutomation(false)}
                            />
                        </div>
                    </div>
                );
            }
            return (
                <div className="p-8 h-full overflow-y-auto bg-slate-50">
                    <div className="max-w-6xl mx-auto">
                        <SheetAutomationList onCreate={() => setIsCreatingSheetAutomation(true)} onEdit={() => { }} />
                    </div>
                </div>
            );
        }

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

    // Handle Public Routes (Manual handling within MainApp if used directly, but usually handled by Router)
    // Legacy support if path was not caught by Router, though Router should handle it.
    // However, for clean separation, let's keep only auth logic here.

    if (isAuthLoading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-brand-600">
                <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 text-sm font-medium animate-pulse">Verifying session...</p>
            </div>
        );
    }

    if (!session) {
        return <AuthPage />;
    }

    const isEditingFlow = activeMenuItem === 'Flows' && currentFlowId !== null;
    const isEditingWhatsAppFlow = activeMenuItem === 'Whatsapp Forms' && currentWhatsAppFlowId !== null;
    const isEditingTemplate = activeMenuItem === 'Whatsapp Templates' && isTemplateBuilderOpen;

    return (
        <div className="flex h-screen w-screen overflow-hidden">
            <ImpersonationBanner />
            <Sidebar
                activeItem={activeMenuItem}
                onNavigate={handleMenuNavigation}
                isOpen={isSidebarOpen}
                onClose={() => setSidebarOpen(false)}
                userEmail={session?.user?.email}
            />
            <div className="flex-1 flex flex-col overflow-hidden relative w-full min-h-0">
                {!isEditingFlow && !isEditingWhatsAppFlow && !isEditingTemplate && (
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
                                <span className="font-bold text-lg text-slate-800">CRM</span>
                            </div>
                        </div>
                    </div>
                )}
                {/* Logout Button (Temporary placement or accessible via Settings in real app) */}
                <div className="absolute top-3 right-4 z-50 hidden lg:block">
                    <button
                        onClick={handleLogout}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
                    >
                        Sign Out
                    </button>
                </div>

                {renderContent()}
            </div>
        </div>
    );
};

// Main Router Component
const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                {/* Admin Routes */}
                <Route path="/admin" element={<Navigate to="/admin/auth/login" replace />} />
                <Route path="/admin/auth" element={<Navigate to="/admin/auth/login" replace />} />
                <Route path="/admin/auth/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminLayout />}>
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="plans" element={<AdminPlans />} />
                    <Route path="subscriptions" element={<AdminSubscriptions />} />
                    <Route path="settings" element={<AdminSettings />} />
                </Route>

                {/* Public Form Route */}
                <Route path="/forms/:token" element={<FormPublicWrapper />} />

                {/* Google OAuth Callback */}
                <Route path="/rest/oauth2-credential/callback" element={<GoogleCallbackPage />} />

                {/* WhatsApp Central Auth Bridge */}
                <Route path="/waba_auth_bridge" element={<AuthBridge />} />

                {/* Generic Multi-Domain Auth Callback */}
                <Route path="/auth_callback" element={<AuthCentralCallback />} />

                {/* Main App Catch-All */}
                <Route path="/*" element={<MainApp />} />
            </Routes>
        </Router>
    );
};

// Wrapper for public form to extract params
const FormPublicWrapper = () => {
    // Using react-router hooks to get params
    // But since FormPublicView expects token as prop, we can just grab it from URL or use useParams
    // For now, let's reuse the logic inside MainApp if simpler, OR simpler:
    const path = window.location.pathname;
    const token = path.split('/forms/')[1];
    if (!token) return <div>Invalid Form Token</div>;
    return <FormPublicView token={token} />;
}

export default App;
