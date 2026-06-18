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
import FeatureLimitsManager from './pages/admin/FeatureLimitsManager';
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
import DripCampaignManager from './components/DripCampaigns/DripCampaignManager';
import QuickReply from './components/QuickReply';
import FormBuilder from './components/FormBuilder';
import GoogleCallbackPage from './components/GoogleCallbackPage';
import AuthCentralCallback from './components/AuthCentralCallback';
import AiVoiceAgentView from './components/AiVoiceAgent/AiVoiceAgentView';
import StaffManagement from './modules/teamStaff/pages/StaffManagement';
import StaffLogin from './modules/teamStaff/pages/StaffLogin';
const MainApp: React.FC = () => {
    // --- BOUNCE INTERCEPTOR (Master Domain Only) ---
    // Handles cross-domain impersonation redirects from Supabase Magic Links
    useLayoutEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const bounceTarget = params.get('bounce');

        if (bounceTarget && window.location.hash.includes('access_token')) {
            console.log("Interceptor: Bouncing session to", bounceTarget);

            // Extract the hash from the current URL (Supabase put the tokens here)
            const hash = window.location.hash; // e.g., #access_token=...&refresh_token=...

            // Construct the final destination
            // Ensure target doesn't already have a hash mixed in weirdly, but usually it's clean base URL from backend
            let finalUrl = bounceTarget;

            // If target has query params, we append hash at the end
            // If target ends with slash, fine.

            // We strip the 'bounce' param from the current URL to keep history clean (optional), 
            // but we are redirecting anyway.

            // Redirect immediately
            window.location.href = `${finalUrl}${hash}`;
            return;
        }
    }, []);

    const [session, setSession] = useState<Session | null>(null);
    const [staffSession, setStaffSession] = useState<any>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [lockoutError, setLockoutError] = useState<string | null>(null);

    // PERSISTENT HASH TRACKING (FIX for Impersonation Redirect Loop)
    // We use a Ref to track if we started this session cycle with a hash.
    // This value survives re-renders and async closures where window.location.hash might have been cleared.
    const isHashLogin = React.useRef<boolean>(
        window.location.hash.includes('access_token') ||
        window.location.hash.includes('error_description') ||
        !!new URLSearchParams(window.location.search).get('bounce')
    );
    // State Initialization from URL Params (Persistence)
    const [activeMenuItem, setActiveMenuItem] = useState<MenuItem>(() => {
        const p = new URLSearchParams(window.location.search).get('view');
        return (p as MenuItem) || 'Dashboard';
    });
    const [currentFlowId, setCurrentFlowId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('flowId'));
    const [currentWhatsAppFlowId, setCurrentWhatsAppFlowId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('waFlowId'));
    const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('templateId'));
    const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(() => new URLSearchParams(window.location.search).get('templateBuilder') === 'true');
    const [isCreatingCampaign, setIsCreatingCampaign] = useState(() => new URLSearchParams(window.location.search).get('createCampaign') === 'true');
    const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('campaignId'));
    const [currentPipelineId, setCurrentPipelineId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('pipelineId'));
    const [isSidebarOpen, setSidebarOpen] = useState(false); // UI state, no need to persist
    const [isCreatingSheetAutomation, setIsCreatingSheetAutomation] = useState(() => new URLSearchParams(window.location.search).get('createSheetAuto') === 'true');
    const [editingSheetAutomationId, setEditingSheetAutomationId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('editSheetAutoId'));
    const [isCreatingDrip, setIsCreatingDrip] = useState(false);
    const [selectedDripId, setSelectedDripId] = useState<string | null>(null);
    const [followUpInitialView, setFollowUpInitialView] = useState<'list' | 'form'>('list');
    const [createCampaignData, setCreateCampaignData] = useState<{
        templateId?: string;
        manualNumbers?: string[];
        title?: string;
    } | undefined>(undefined);

    // Domain Validation Logic (ROBUST & DEBUGGABLE)
    const validateDomain = async (currentSession: Session) => {
        // IMPERSONATION: If we are bouncing, check 'bounce' param.
        // AUTH REDIRECT: If we are processing a hash (access_token), skip checking OLD session.
        // IMPERSONATION: If we flagged this as a hash/bounce login initially, SKIP validation.
        if (isHashLogin.current) {
            console.log("[Tenancy Check] Auth transition detected (via isHashLogin Ref). Skipping strict validation.");
            return true;
        }

        const params = new URLSearchParams(window.location.search);

        if (!currentSession?.user) return;

        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('signup_domain, role')
                .eq('id', currentSession.user.id)
                .single();

            if (profile) {
                const rawAssigned = (profile as any).signup_domain || '';
                const rawCurrent = window.location.hostname || '';

                // Normalize: Lowercase, strip protocol (http/s), and strip 'www.'
                const checkNormalize = (d: string) => d.trim().toLowerCase()
                    .replace(/^https?:\/\//, '')
                    .replace(/^www\./, '');

                const assignedDomain = checkNormalize(rawAssigned);
                const currentDomain = checkNormalize(rawCurrent);

                const isLocalhost = currentDomain.includes('localhost') || currentDomain.includes('127.0.0.1');

                // Debug Logging for User/Dev (Visible in Browser Console)
                console.log(`[Tenancy Check] User: ${currentSession.user.email}`);
                console.log(`[Tenancy Check] Assigned: "${assignedDomain}" (Raw: "${rawAssigned}")`);
                console.log(`[Tenancy Check] Current:  "${currentDomain}" (Raw: "${rawCurrent}")`);

                // STRICT CHECK:
                if (assignedDomain && assignedDomain !== currentDomain && !isLocalhost) {
                    console.warn(`[Tenancy] Domain mismatch! Redirecting...`);

                    // Force Redirect
                    const protocol = window.location.protocol;
                    const cleanParams = new URLSearchParams(window.location.search);
                    cleanParams.set('email', currentSession.user.email || '');
                    cleanParams.set('redirect_reason', 'domain_mismatch');
                    cleanParams.set('expected', assignedDomain);
                    cleanParams.set('actual', currentDomain);

                    // CRITICAL: Preserve 'token' if present (Magic URL / Impersonation)
                    const magicToken = new URLSearchParams(window.location.search).get('token');
                    if (magicToken) {
                        cleanParams.set('token', magicToken);
                    }

                    // Preserve Hash (Auth Tokens) if redirecting
                    const hash = window.location.hash || '';
                    const targetUrl = `${protocol}//${assignedDomain}/login?${cleanParams.toString()}${hash}`;

                    // Sign out from this wrong domain to clean up
                    try { await supabase.auth.signOut(); } catch (e) { }

                    // Clear local storage aggressively just in case to prevent loops
                    tokenService.clearAccessToken();

                    // Supabase derives the local storage key from the URL automatically
                    // Because we use a dynamic proxy URL now, the key changes. We should clear everything 
                    // starting with 'sb-' to ensure no old session fragments remain.
                    try {
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                                localStorage.removeItem(key);
                            }
                        }
                    } catch (err) {
                        console.warn('Failed to clear local storage dynamically:', err);
                    }

                    window.location.href = targetUrl;
                    return false; // Validation failed
                }
            } else {
                console.warn("[Tenancy Check] No profile found for user.");
            }
        } catch (e) {
            console.error("Domain validation error:", e);
        }
        return true; // Validation passed
    };

    const validatePlan = async (currentSession: Session) => {
        if (!currentSession?.user) return true;

        // Bypass plan check for localhost to avoid lockouts during dev
        const hostname = window.location.hostname;
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
            console.log("[Plan Check] Localhost detected. Bypassing plan validation.");
            return true;
        }

        try {
            // Check Role first - Super Admins never need plans
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', currentSession.user.id)
                .single();

            if (profile && (profile as any).role === 'super_admin') {
                console.log("[Plan Check] Super Admin detected. Bypassing plan validation.");
                return true;
            }

            // RPC call to check status
            const { data, error } = await (supabase.rpc as any)('check_user_plan_status', { target_user_id: currentSession.user.id });

            if (error) {
                // strict lock: block access if the check fails (e.g., due to permission error)
                console.warn("Plan check failed (RPC error):", error.message);
                setLockoutError("Your 7-Day Free Trial has expired or your account is suspended. Please contact support or upgrade your plan to continue using the platform.");
                await supabase.auth.signOut();
                tokenService.clearAccessToken();
                return false;
            }

            if (data && data.length > 0) {
                const status = data[0];
                if (status.is_allowed === false) {
                    console.warn("Blocking login due to expired plan:", status.message);
                    setLockoutError(status.message);
                    await supabase.auth.signOut();
                    tokenService.clearAccessToken();
                    return false;
                }
            }
            return true;
        } catch (e) {
            console.error("Plan validation exception", e);
            return true;
        }
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
                // 1. Check for staff session first (Local & Fast)
                const storedStaff = localStorage.getItem('staffData');
                if (storedStaff) {
                    try {
                        const parsed = JSON.parse(storedStaff);
                        setStaffSession(parsed);
                        console.log("✅ Initial Session: Staff detected", parsed.name);
                        setIsAuthLoading(false);
                        return; // Don't block on Supabase if staff
                    } catch (e) {
                        localStorage.removeItem('staffData');
                        localStorage.removeItem('staffToken');
                    }
                }

                // 2. getSession() will check local storage AND process the URL fragment if present
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.warn("Session check warning:", error.message);
                }
                if (session) {
                    // Validate Domain BEFORE setting session
                    const isValid = await validateDomain(session);
                    if (!isValid) return; // Stop loading if redirecting

                    const isPlanValid = await validatePlan(session);
                    if (!isPlanValid) {
                        setSession(null);
                        return;
                    }

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

            // 1. Update State
            setSession(session);
            tokenService.setAccessToken(session?.access_token || null);

            // 2. Race Condition Handler:
            // If INITIAL_SESSION provides an expired (or nearly expired) token, 
            // DO NOT unlock the UI yet. Wait for the inevitable TOKEN_REFRESHED event.
            // This prevents API calls firing with dead tokens.
            const now = Math.floor(Date.now() / 1000);
            const isExpired = session?.expires_at && session.expires_at <= now;

            if (event === 'INITIAL_SESSION' && isExpired) {
                console.log("[Auth] Initial session expired. Waiting for refresh...");
                return; // Keep loading...
            }

            setIsAuthLoading(false);

            // 3. Perform Tenancy Check Asynchronously (Background)
            // We don't want to block the initial UI render or causing race conditions with AuthPage
            if (event === 'SIGNED_IN' && session) {
                // FAIL-SAFE: Clear all dashboard caches on new sign-in
                // ensures we never show remnants of a previous user session.
                localStorage.removeItem('dashboard_stats_cache');
                localStorage.removeItem('lead_dashboard_cache');
                localStorage.removeItem('connection_cache');

                // Small delay to allow local storage propogation if needed
                await new Promise(resolve => setTimeout(resolve, 100));

                // If validation fails, this will trigger a redirect/signout
                validateDomain(session).then(async (valid) => {
                    if (valid) await validatePlan(session);
                }).catch(e => console.error("Async Validation Error:", e));
            }

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
        if (!session && !staffSession) return;

        const loadTheme = async () => {
            const savedTheme = await themeService.getTheme();
            themeService.applyTheme(savedTheme);
        };
        loadTheme();
    }, [session, staffSession]);

    // --- STATE PERSISTENCE EFFECT ---
    // Synchronize current state to URL Query Params
    useEffect(() => {
        if (isAuthLoading || (!session && !staffSession)) return;

        const params = new URLSearchParams(window.location.search);

        // View
        if (activeMenuItem && activeMenuItem !== 'Dashboard') params.set('view', activeMenuItem);
        else params.delete('view');

        // Flows
        if (currentFlowId) params.set('flowId', currentFlowId); else params.delete('flowId');
        if (currentWhatsAppFlowId) params.set('waFlowId', currentWhatsAppFlowId); else params.delete('waFlowId');

        // Templates
        if (currentTemplateId) params.set('templateId', currentTemplateId); else params.delete('templateId');
        if (isTemplateBuilderOpen) params.set('templateBuilder', 'true'); else params.delete('templateBuilder');

        // Campaigns
        if (currentCampaignId) params.set('campaignId', currentCampaignId); else params.delete('campaignId');
        if (isCreatingCampaign) params.set('createCampaign', 'true'); else params.delete('createCampaign');

        // Pipelines
        if (currentPipelineId) params.set('pipelineId', currentPipelineId); else params.delete('pipelineId');

        // Sheet Automation
        if (isCreatingSheetAutomation) params.set('createSheetAuto', 'true'); else params.delete('createSheetAuto');
        if (editingSheetAutomationId) params.set('editSheetAutoId', editingSheetAutomationId); else params.delete('editSheetAutoId');

        const newSearch = params.toString();
        const currentSearch = window.location.search.replace('?', '');

        // Only update if changed to avoid loops (though replaceState is cheap)
        if (newSearch !== currentSearch) {
            const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}${window.location.hash}`;
            window.history.replaceState(null, '', newUrl);
        }

    }, [
        activeMenuItem, currentFlowId, currentWhatsAppFlowId, currentTemplateId,
        isTemplateBuilderOpen, currentCampaignId, isCreatingCampaign,
        currentPipelineId, isCreatingSheetAutomation, editingSheetAutomationId,
        isAuthLoading, session, staffSession
    ]);

    const handleNavigateToFlow = useCallback((flowId: string) => {
        setCurrentFlowId(flowId);
        setActiveMenuItem('Flows');
    }, []);

    const handleBackToFlows = useCallback(() => {
        setCurrentFlowId(null);
        setActiveMenuItem('Flows');
    }, []);

    const handleMenuNavigation = useCallback((item: MenuItem | 'CREATE_DRIP' | 'EDIT_DRIP', extraData?: any) => {
        if (item === 'CREATE_DRIP') {
            setIsCreatingDrip(true);
            setSelectedDripId(null);
            setActiveMenuItem('Drip Campaigns');
            setSidebarOpen(false);
            return;
        }

        if (item === 'EDIT_DRIP') {
            setIsCreatingDrip(false);
            setSelectedDripId(extraData as string);
            setActiveMenuItem('Drip Campaigns');
            setSidebarOpen(false);
            return;
        }

        // Reset States on every navigation
        setIsCreatingDrip(false);
        setSelectedDripId(null);
        setFollowUpInitialView('list');
        setActiveMenuItem(item);

        // Feature-specific resets
        setCurrentFlowId(null);

        if (item !== 'Pipelines') setCurrentPipelineId(null);
        if (item !== 'Whatsapp Forms') setCurrentWhatsAppFlowId(null);
        if (item !== 'Whatsapp Templates') {
            setCurrentTemplateId(null);
            setIsTemplateBuilderOpen(false);
        }

        // Reset Campaign State
        setIsCreatingCampaign(false);
        setCreateCampaignData(undefined);
        setCurrentCampaignId(null);

        if (item !== 'G Automation') {
            setIsCreatingSheetAutomation(false);
        }

        setSidebarOpen(false);
    }, [
        setIsCreatingDrip, setActiveMenuItem, setSidebarOpen, setFollowUpInitialView,
        setCurrentFlowId, setCurrentPipelineId, setCurrentWhatsAppFlowId,
        setCurrentTemplateId, setIsTemplateBuilderOpen, setIsCreatingCampaign,
        setCreateCampaignData, setCurrentCampaignId, setIsCreatingSheetAutomation
    ]);

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        setSession(null);
        setStaffSession(null);
        tokenService.clearAccessToken();
        themeService.resetTheme();

        // Clear Dashboard Caches and Staff Sessions to prevent data leakage between sessions
        localStorage.removeItem('dashboard_stats_cache');
        localStorage.removeItem('lead_dashboard_cache');
        localStorage.removeItem('connection_cache'); // If exists
        localStorage.removeItem('staffToken');
        localStorage.removeItem('staffData');
    }, [setStaffSession]);

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
            return <FlowEditor flowId={currentFlowId} onBack={handleBackToFlows} />;
        }
        return <FlowList onNavigateToFlow={handleNavigateToFlow} onToggleSidebar={() => setSidebarOpen(true)} />;
    };

    const renderContent = () => {
        // Prioritize Campaigns Check
        if (activeMenuItem === 'Campaigns') {
            if (currentCampaignId) {
                return (
                    <CampaignDetails
                        campaignId={currentCampaignId}
                        onBack={() => setCurrentCampaignId(null)}
                        onRetarget={(data) => {
                            setCreateCampaignData(data);
                            setIsCreatingCampaign(true);
                            setCurrentCampaignId(null);
                        }}
                    />
                );
            }
            if (isCreatingCampaign) {
                return (
                    <CreateCampaignComponent
                        onBack={() => {
                            setIsCreatingCampaign(false);
                            setCreateCampaignData(undefined);
                        }}
                        initialData={createCampaignData}
                    />
                );
            }
            return (
                <CampaignList
                    onCreate={() => {
                        setCreateCampaignData(undefined);
                        setIsCreatingCampaign(true);
                    }}
                    onSelect={(id) => setCurrentCampaignId(id)}
                    onToggleSidebar={() => setSidebarOpen(true)}
                />
            );
        }

        if (activeMenuItem === 'Dashboard') {
            return <Dashboard onNavigateToFlow={handleNavigateToFlow} onNavigate={handleMenuNavigation} onNavigateToPipeline={handleNavigateToPipeline} onToggleSidebar={() => setSidebarOpen(true)} />;
        }

        if (activeMenuItem === 'Flows') {
            return renderFlowBuilderApp();
        }

        if (activeMenuItem === 'Inbox') {
            return <Inbox onToggleSidebar={() => setSidebarOpen(true)} />;
        }



        if (activeMenuItem === 'Overview') {
            return <Contacts initialTab="dashboard" onToggleSidebar={() => setSidebarOpen(true)} onNavigate={handleMenuNavigation} />;
        }

        if (activeMenuItem === 'Contact List') {
            return <Contacts initialTab="contacts" onToggleSidebar={() => setSidebarOpen(true)} onNavigate={handleMenuNavigation} />;
        }

        if (activeMenuItem === 'Contacts') {
            return <Contacts initialTab="dashboard" onToggleSidebar={() => setSidebarOpen(true)} onNavigate={handleMenuNavigation} />;
        }

        if (activeMenuItem === 'Contact Groups') {
            return <Contacts initialTab="groups" onToggleSidebar={() => setSidebarOpen(true)} onNavigate={handleMenuNavigation} />;
        }

        if (activeMenuItem === 'Pipelines') {
            return <Contacts initialTab="pipelines" initialPipelineId={currentPipelineId} onToggleSidebar={() => setSidebarOpen(true)} onNavigate={handleMenuNavigation} />;
        }

        if (activeMenuItem === 'Follow-up') {
            return <Contacts initialTab="follow-up" followUpInitialView={followUpInitialView} onToggleSidebar={() => setSidebarOpen(true)} onNavigate={handleMenuNavigation} />;
        }

        if (activeMenuItem === 'Tags') {
            return <ContactTags />;
        }

        if (activeMenuItem === 'Input Fields') {
            return <Contacts initialTab="inputs" onToggleSidebar={() => setSidebarOpen(true)} onNavigate={handleMenuNavigation} />;
        }

        if (activeMenuItem === 'Form Contact') {
            return <ContactForms />;
        }

        if (activeMenuItem === 'Form Builder') {
            return <Contacts initialTab="forms" onToggleSidebar={() => setSidebarOpen(true)} onNavigate={handleMenuNavigation} />;
        }

        if (activeMenuItem === 'Settings' || activeMenuItem === 'Branding & Appearance') {
            return <GlobalSettings onToggleSidebar={() => setSidebarOpen(true)} />;
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
            return <IntegrationsView onToggleSidebar={() => setSidebarOpen(true)} onNavigate={handleMenuNavigation} />;
        }

        if (activeMenuItem === 'AI Buddy') {
            return <AiVoiceAgentView />;
        }

        if (activeMenuItem === 'Quick Reply') {
            return <QuickReply onToggleSidebar={() => setSidebarOpen(true)} />;
        }

        // ... (rest of code)
        // ...
        // Note: I will only replace the render logic and state initialization part if possible, 
        // or just the block where SheetAutomationWizard is rendered.

        // I need to be careful with line numbers.
        // Let's scroll down to SheetAutomation render block.

        if (activeMenuItem === 'G Automation') {
            if (isCreatingSheetAutomation) {
                return (
                    <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50 container-mobile-fix">
                        <div className="max-w-4xl mx-auto">
                            <button onClick={() => {
                                setIsCreatingSheetAutomation(false);
                                setEditingSheetAutomationId(null);
                            }} className="mb-4 text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm bg-white/50 p-2 rounded-lg lg:bg-transparent lg:p-0">
                                <span className="text-xl">←</span> Back to List
                            </button>
                            <SheetAutomationWizard
                                editId={editingSheetAutomationId || undefined}
                                onClose={() => {
                                    setIsCreatingSheetAutomation(false);
                                    setEditingSheetAutomationId(null);
                                }}
                                onSave={() => {
                                    setIsCreatingSheetAutomation(false);
                                    setEditingSheetAutomationId(null);
                                }}
                            />
                        </div>
                    </div>
                );
            }
            return (
                <SheetAutomationList
                    onCreate={() => {
                        setEditingSheetAutomationId(null);
                        setIsCreatingSheetAutomation(true);
                    }}
                    onEdit={(id) => {
                        setEditingSheetAutomationId(id);
                        setIsCreatingSheetAutomation(true);
                    }}
                    onToggleSidebar={() => setSidebarOpen(true)}
                />
            );
        }

        if (activeMenuItem === 'Drip Campaigns') {
            return (
                <DripCampaignManager
                    initialView={(isCreatingDrip || selectedDripId) ? 'builder' : 'list'}
                    initialCampaignId={selectedDripId}
                    onToggleSidebar={() => setSidebarOpen(true)}
                    onExit={() => {
                        if (isCreatingDrip || selectedDripId) {
                            setFollowUpInitialView('form');
                            setActiveMenuItem('Follow-up');
                            setIsCreatingDrip(false);
                            setSelectedDripId(null);
                        } else {
                            setActiveMenuItem('Drip Campaigns');
                        }
                    }}
                />
            );
        }
        if (activeMenuItem === 'Team Staff') {
            return <StaffManagement />;
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
        // Render nothing while verifying — no spinner, no flash, just wait silently
        return null;
    }

    if (lockoutError) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 max-w-md w-full mx-4 text-center transform transition-all scale-100">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100">
                        <span className="text-4xl">🔒</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Access Denied</h2>
                    <p className="text-slate-600 mb-8 leading-relaxed font-medium">
                        {lockoutError}
                    </p>
                    <button 
                        onClick={() => setLockoutError(null)} 
                        className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-brand-200 active:scale-[0.98]"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    if (!session && !staffSession) {
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
                userEmail={session?.user?.email || staffSession?.email}
            />
            <div className="flex-1 flex flex-col overflow-hidden relative w-full min-h-0">
                {!isEditingFlow && !isEditingWhatsAppFlow && !isEditingTemplate &&
                    !['Inbox', 'Dashboard', 'Overview', 'Contacts', 'Contact List', 'Contact Groups', 'Pipelines', 'Flows', 'Campaigns', 'G Automation', 'Settings', 'Branding & Appearance', 'Integrations', 'Follow-up', 'Input Fields', 'Form Builder', 'Quick Reply'].map(s => s.toLowerCase()).includes((activeMenuItem || '').toLowerCase()) &&
                    (
                        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-canvas-surface border-b border-slate-200 z-20 shadow-sm shrink-0">
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
                {/* Logout Button removed - moved to Sidebar User Menu */}

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
                    <Route path="super" element={<SuperDashboard />} />
                    <Route path="limits" element={<FeatureLimitsManager />} />
                </Route>

                {/* Public Form Route */}
                <Route path="/forms/:token" element={<FormPublicWrapper />} />

                {/* Google OAuth Callback */}
                <Route path="/rest/oauth2-credential/callback" element={<GoogleCallbackPage />} />

                {/* WhatsApp Central Auth Bridge */}
                <Route path="/waba_auth_bridge" element={<AuthBridge />} />

                {/* Generic Multi-Domain Auth Callback */}
                <Route path="/auth_callback" element={<AuthCentralCallback />} />

                {/* Staff Login Portal */}
                <Route path="/staff/login" element={<StaffLogin />} />

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
