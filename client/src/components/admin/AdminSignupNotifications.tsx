import React, { useState, useEffect } from 'react';
import { adminSettingsService } from '../../services/adminSettingsService';
import { inboxService } from '../../services/inboxService';
import { SearchableSelect } from './SearchableSelect';

const AdminSignupNotifications: React.FC = () => {
    const [notificationSettings, setNotificationSettings] = useState({
        whatsapp_waba_id: '',
        whatsapp_api_number_id: '',
        admin_whatsapp_number: '',
        admin_whatsapp_template_name: '',
        notify_admin_on_signup: false,
        send_welcome_whatsapp: false,
        welcome_template_name: '',
        welcome_template_params: [] as any[],
        welcome_template_media_url: '',
        notify_admin_via_email: false,
        admin_email_address: '',
        send_welcome_email: false,
        welcome_email_subject: '',
        welcome_email_body: '',
        admin_whatsapp_template_params: [] as any[],
        admin_whatsapp_media_url: '',
        trigger_webhook_on_signup: false,
        admin_webhook_url: ''
    });

    const [isSavingNotifications, setIsSavingNotifications] = useState(false);
    const [activeTab, setActiveTab] = useState<'whatsapp' | 'email' | 'webhook'>('whatsapp');
    const [templates, setTemplates] = useState<any[]>([]);
    const [isUploadingMedia, setIsUploadingMedia] = useState<'welcome' | 'admin' | null>(null);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

    const handleLoadTemplates = async () => {
        if (!notificationSettings.whatsapp_waba_id || !notificationSettings.whatsapp_api_number_id) {
            alert("Please provide both WABA ID and API Number ID to load templates.");
            return;
        }
        try {
            setIsLoadingTemplates(true);
            const data = await adminSettingsService.getWhatsappTemplates(notificationSettings.whatsapp_waba_id, notificationSettings.whatsapp_api_number_id);
            setTemplates(data || []);
            alert(`Loaded ${data?.length || 0} templates successfully!`);
        } catch (error: any) {
            console.error('Failed to load templates:', error);
            alert('Failed to load templates: ' + error.message);
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const handleTemplateChange = (type: 'welcome' | 'admin', templateName: string) => {
        const keyName = type === 'welcome' ? 'welcome_template_name' : 'admin_whatsapp_template_name';
        const keyParams = type === 'welcome' ? 'welcome_template_params' : 'admin_whatsapp_template_params';
        const keyMedia = type === 'welcome' ? 'welcome_template_media_url' : 'admin_whatsapp_media_url';
        
        setNotificationSettings(prev => ({ ...prev, [keyName]: templateName }));

        const selectedTemplate = templates.find(t => t.name === templateName);
        if (selectedTemplate) {
            // Count body parameters
            let paramCount = 0;
            const bodyText = selectedTemplate.body_text;
            if (bodyText) {
                const matches = bodyText.match(/\{\{(\d+)\}\}/g);
                if (matches) {
                    paramCount = matches.length;
                }
            }

            // Generate exact number of params
            const newParams = Array(paramCount).fill(null).map(() => ({ type: 'field', value: 'name' }));
            setNotificationSettings(prev => ({ ...prev, [keyParams]: newParams }));
            
            // Check for media
            const hasMedia = ['IMAGE', 'VIDEO', 'DOCUMENT', 'CAROUSEL'].includes(selectedTemplate.header_format || '') ||
                             ['IMAGE', 'VIDEO', 'DOCUMENT', 'CAROUSEL'].includes(selectedTemplate.template_type || '');
            if (!hasMedia) {
                setNotificationSettings(prev => ({ ...prev, [keyMedia]: '' }));
            }
        }
    };

    const hasMediaHeader = (templateName: string) => {
        const t = templates.find(t => t.name === templateName);
        if (!t) return false;
        return ['IMAGE', 'VIDEO', 'DOCUMENT', 'CAROUSEL'].includes(t.header_format || '') ||
               ['IMAGE', 'VIDEO', 'DOCUMENT', 'CAROUSEL'].includes(t.template_type || '');
    };

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const data = await adminSettingsService.getSignupNotifications();
                setNotificationSettings({
                    whatsapp_waba_id: data.whatsapp_waba_id || '',
                    whatsapp_api_number_id: data.whatsapp_api_number_id || '',
                    admin_whatsapp_number: data.admin_whatsapp_number || '',
                    admin_whatsapp_template_name: data.admin_whatsapp_template_name || '',
                    notify_admin_on_signup: data.notify_admin_on_signup || false,
                    send_welcome_whatsapp: data.send_welcome_whatsapp || false,
                    welcome_template_name: data.welcome_template_name || '',
                    welcome_template_params: data.welcome_template_params || [],
                    welcome_template_media_url: data.welcome_template_media_url || '',
                    notify_admin_via_email: data.notify_admin_via_email || false,
                    admin_email_address: data.admin_email_address || '',
                    send_welcome_email: data.send_welcome_email || false,
                    welcome_email_subject: data.welcome_email_subject || '',
                    welcome_email_body: data.welcome_email_body || '',
                    admin_whatsapp_template_params: data.admin_whatsapp_template_params || [],
                    admin_whatsapp_media_url: data.admin_whatsapp_media_url || '',
                    trigger_webhook_on_signup: data.trigger_webhook_on_signup || false,
                    admin_webhook_url: data.admin_webhook_url || ''
                });

                // Auto-load templates if credentials exist
                if (data.whatsapp_waba_id && data.whatsapp_api_number_id) {
                    try {
                        const loadedTemplates = await adminSettingsService.getWhatsappTemplates(data.whatsapp_waba_id, data.whatsapp_api_number_id);
                        setTemplates(loadedTemplates || []);
                    } catch (e) {
                        console.error('Auto-load templates failed:', e);
                    }
                }
            } catch (err) {
                console.error('Failed to load signup notification settings:', err);
            }
        };
        loadSettings();
    }, []);

    const handleAddParam = (type: 'welcome' | 'admin') => {
        const key = type === 'welcome' ? 'welcome_template_params' : 'admin_whatsapp_template_params';
        const currentParams = notificationSettings[key] || [];
        setNotificationSettings({ ...notificationSettings, [key]: [...currentParams, { type: 'field', value: 'name' }] });
    };

    const handleRemoveParam = (type: 'welcome' | 'admin', index: number) => {
        const key = type === 'welcome' ? 'welcome_template_params' : 'admin_whatsapp_template_params';
        const currentParams = [...(notificationSettings[key] || [])];
        currentParams.splice(index, 1);
        setNotificationSettings({ ...notificationSettings, [key]: currentParams });
    };

    const handleUpdateParam = (type: 'welcome' | 'admin', index: number, field: string, value: string) => {
        const key = type === 'welcome' ? 'welcome_template_params' : 'admin_whatsapp_template_params';
        const currentParams = [...(notificationSettings[key] || [])];
        currentParams[index] = { ...currentParams[index], [field]: value };
        setNotificationSettings({ ...notificationSettings, [key]: currentParams });
    };

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'welcome' | 'admin') => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploadingMedia(type);
            const uploadedUrl = await inboxService.uploadMedia(file, 'template');
            if (uploadedUrl) {
                const key = type === 'welcome' ? 'welcome_template_media_url' : 'admin_whatsapp_media_url';
                setNotificationSettings(prev => ({ ...prev, [key]: uploadedUrl }));
            } else {
                alert("Failed to upload media");
            }
        } catch (err: any) {
            console.error('Media upload failed', err);
            alert("Error uploading media: " + err.message);
        } finally {
            setIsUploadingMedia(null);
            // clear the input value so the same file can be uploaded again if needed
            e.target.value = '';
        }
    };

    const handleSaveNotificationSettings = async () => {
        try {
            setIsSavingNotifications(true);
            await adminSettingsService.saveSignupNotifications(notificationSettings);
            alert('Signup Notification settings saved successfully!');
        } catch (error: any) {
            console.error('Error saving notification settings:', error);
            alert('Failed to save settings: ' + error.message);
        } finally {
            setIsSavingNotifications(false);
        }
    };

    const adminTemplateOptions = [
        { value: '', label: '-- Select a Template --' },
        ...(notificationSettings.admin_whatsapp_template_name && !templates.find(t => t.name === notificationSettings.admin_whatsapp_template_name) ? [{ value: notificationSettings.admin_whatsapp_template_name, label: notificationSettings.admin_whatsapp_template_name }] : []),
        ...templates.map(t => ({ value: t.name, label: `${t.name} (${t.language})` }))
    ];

    const welcomeTemplateOptions = [
        { value: '', label: '-- Select a Template --' },
        ...(notificationSettings.welcome_template_name && !templates.find(t => t.name === notificationSettings.welcome_template_name) ? [{ value: notificationSettings.welcome_template_name, label: notificationSettings.welcome_template_name }] : []),
        ...templates.map(t => ({ value: t.name, label: `${t.name} (${t.language})` }))
    ];

    return (
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-2 border-[#006B4D]/30 transition-all duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
                <div>
                    <h3 className="text-2xl font-black text-black tracking-tight">Platform Signup Notifications</h3>
                    <p className="text-black text-sm mt-1 font-bold">Configure automated WhatsApp, Email, & Webhook alerts for new user signups.</p>
                </div>
                <button
                    onClick={handleSaveNotificationSettings}
                    disabled={isSavingNotifications}
                    className="px-6 py-3 bg-[#006B4D] hover:bg-[#00563e] text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSavingNotifications ? (
                        <><span className="animate-spin text-lg leading-none">⚙</span> Saving...</>
                    ) : (
                        <><span className="text-lg leading-none">💾</span> Save Settings</>
                    )}
                </button>
            </div>
            
            {/* TABS HEADER */}
            <div className="px-8 py-4 border-b border-slate-100 bg-slate-50/50 flex gap-4">
                <button
                    onClick={() => setActiveTab('whatsapp')}
                    className={`px-5 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 border ${activeTab === 'whatsapp' ? 'bg-[#006B4D]/10 border-[#006B4D]/50 text-[#006B4D] shadow-[0_0_15px_rgba(0,107,77,0.15)]' : 'bg-white border-[var(--border-color)] text-black hover:bg-slate-100 hover:text-black'}`}
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> WhatsApp Alerts
                </button>
                <button
                    onClick={() => setActiveTab('email')}
                    className={`px-5 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 border ${activeTab === 'email' ? 'bg-[#006B4D]/10 border-[#006B4D]/50 text-[#006B4D] shadow-[0_0_15px_rgba(0,107,77,0.15)]' : 'bg-white border-[var(--border-color)] text-black hover:bg-slate-100 hover:text-black'}`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg> Email Alerts
                </button>
                <button
                    onClick={() => setActiveTab('webhook')}
                    className={`px-5 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 border ${activeTab === 'webhook' ? 'bg-[#006B4D]/10 border-[#006B4D]/50 text-[#006B4D] shadow-[0_0_15px_rgba(0,107,77,0.15)]' : 'bg-white border-[var(--border-color)] text-black hover:bg-slate-100 hover:text-black'}`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg> Webhook Alerts
                </button>
            </div>

            <div className="p-8 space-y-8">
                
                        {/* --- WHATSAPP SECTION --- */}
                        {activeTab === 'whatsapp' && (
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-2xl border-2 border-[#006B4D] shadow-sm hover:shadow-[#006B4D]/10 transition-all">
                                    <h4 className="text-lg font-bold text-black mb-6 flex items-center pb-4 border-b border-[#006B4D]/20">
                                        <svg className="w-6 h-6 mr-3 text-[#006B4D] drop-shadow-sm" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                                        <span className="tracking-tight text-black">WhatsApp Meta Credentials</span>
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em]">WhatsApp WABA ID</label>
                                                <button 
                                                    onClick={handleLoadTemplates}
                                                    disabled={isLoadingTemplates || !notificationSettings.whatsapp_waba_id || !notificationSettings.whatsapp_api_number_id}
                                                    className="px-4 py-1.5 bg-white border border-[#006B4D] text-[#006B4D] hover:bg-slate-50 rounded text-xs font-bold shadow-sm transition-colors whitespace-nowrap disabled:opacity-50"
                                                >
                                                    {isLoadingTemplates ? 'Loading...' : 'Load Templates'}
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={notificationSettings.whatsapp_waba_id}
                                                onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsapp_waba_id: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border-2 border-[#006B4D]/40 rounded-lg text-sm font-bold text-black focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                                placeholder="1234567890"
                                            />
                                            <p className="text-xs text-black mt-2">The WhatsApp Business Account (WABA) ID found in your Meta Developer Dashboard.</p>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em] mb-2">WhatsApp API Number ID</label>
                                            <input
                                                type="text"
                                                value={notificationSettings.whatsapp_api_number_id}
                                                onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsapp_api_number_id: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border-2 border-[#006B4D]/40 rounded-lg text-sm font-bold text-black focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                                placeholder="10987654321"
                                            />
                                            <p className="text-xs text-black mt-2 font-medium bg-orange-50 p-2.5 rounded-lg border border-orange-100">
                                                <strong className="text-orange-700">⚠️ Important:</strong> Number <strong>must already be connected</strong> and approved for the Integration User Email provided.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                        
                                <div className="bg-white p-6 rounded-2xl border-2 border-[#006B4D] shadow-sm hover:shadow-[#006B4D]/10 transition-all">
                                    <div className="flex items-center justify-between mb-6 border-b border-[#006B4D]/20 pb-4">
                                        <div>
                                            <h4 className="text-lg font-bold text-black">Admin Notification via WhatsApp</h4>
                                            <p className="text-xs text-black mt-1">Receive a message when a new user signs up on the platform.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={notificationSettings.notify_admin_on_signup} onChange={(e) => setNotificationSettings({ ...notificationSettings, notify_admin_on_signup: e.target.checked })} />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006B4D]"></div>
                                        </label>
                                    </div>

                                    {notificationSettings.notify_admin_on_signup && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em] mb-2">Admin WhatsApp Number</label>
                                                    <input
                                                        type="text"
                                                        value={notificationSettings.admin_whatsapp_number}
                                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, admin_whatsapp_number: e.target.value })}
                                                        className="w-full px-4 py-3 bg-white border-2 border-[#006B4D]/40 rounded-lg text-sm font-bold text-black focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                                        placeholder="+1234567890"
                                                    />
                                                    <p className="text-xs text-black mt-2">Include country code (e.g., +1 for US).</p>
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em] mb-2">Admin Template Name (Optional)</label>
                                                    <SearchableSelect
                                                        options={adminTemplateOptions}
                                                        value={notificationSettings.admin_whatsapp_template_name}
                                                        onChange={(val) => handleTemplateChange('admin', val)}
                                                    />
                                                    <p className="text-xs text-black mt-2">
                                                        Select the template approved in your Meta Developer Dashboard. Leave blank to send a standard text message.
                                                    </p>
                                                </div>
                                                {notificationSettings.admin_whatsapp_template_name && hasMediaHeader(notificationSettings.admin_whatsapp_template_name) && (
                                                    <div>
                                                        <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em] mb-2">Header Media URL</label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={notificationSettings.admin_whatsapp_media_url}
                                                                onChange={(e) => setNotificationSettings({ ...notificationSettings, admin_whatsapp_media_url: e.target.value })}
                                                                className="flex-1 px-4 py-3 bg-white border-2 border-[#006B4D]/40 rounded-lg text-sm font-bold text-black focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                                                placeholder="https://example.com/admin-alert-image.png"
                                                            />
                                                            <label className={`flex-shrink-0 px-4 py-3 bg-black hover:bg-gray-800 text-white text-black rounded-lg text-sm font-bold cursor-pointer transition-colors flex items-center justify-center border-2 border-[#006B4D]/40 ${isUploadingMedia === 'admin' ? 'opacity-50 cursor-wait' : ''}`}>
                                                                {isUploadingMedia === 'admin' ? (
                                                                    <><span className="animate-spin mr-2">⚙</span> Uploading...</>
                                                                ) : (
                                                                    <><span className="mr-2">📤</span> Upload</>
                                                                )}
                                                                <input 
                                                                    type="file" 
                                                                    className="hidden" 
                                                                    accept="image/*,video/*,.pdf" 
                                                                    onChange={(e) => handleMediaUpload(e, 'admin')} 
                                                                    disabled={isUploadingMedia === 'admin'}
                                                                />
                                                            </label>
                                                        </div>
                                                        <p className="text-xs text-black mt-2">Upload a file or paste a direct URL for this template's header.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {notificationSettings.admin_whatsapp_template_name && templates.find(t => t.name === notificationSettings.admin_whatsapp_template_name) && (
                                                <div className="bg-[#006B4D]/5 border-2 border-[#006B4D] p-5 rounded-xl shadow-inner">
                                                    <div>
                                                        <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em] mb-2">Template Parameters</label>
                                                        <p className="text-xs text-black mb-3">Map the {'{{1}}'}, {'{{2}}'} slots to user data.</p>
                                                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2">
                                                            {notificationSettings.admin_whatsapp_template_params.map((param, idx) => (
                                                                <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-[#006B4D]/20 shadow-sm">
                                                                    <span className="text-xs font-black text-black w-8 text-center">{`{{${idx + 1}}}`}</span>
                                                                    <select
                                                                        value={param.type}
                                                                        onChange={(e) => handleUpdateParam('admin', idx, 'type', e.target.value)}
                                                                        className="px-3 py-2 bg-slate-50 border-2 border-[#006B4D]/40 rounded-md text-xs font-bold focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all appearance-none cursor-pointer text-black"
                                                                        style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.65em auto', paddingRight: '1.75rem' }}
                                                                    >
                                                                        <option value="field">Dynamic Field</option>
                                                                        <option value="custom">Static Text</option>
                                                                    </select>
                                                                    {param.type === 'field' ? (
                                                                        <select
                                                                            value={param.value}
                                                                            onChange={(e) => handleUpdateParam('admin', idx, 'value', e.target.value)}
                                                                            className="flex-1 px-3 py-2 bg-slate-50 border-2 border-[#006B4D]/40 rounded-md text-xs font-bold focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all appearance-none cursor-pointer text-black"
                                                                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.65em auto', paddingRight: '1.75rem' }}
                                                                        >
                                                                            <option value="name">User Name</option>
                                                                            <option value="email">User Email</option>
                                                                            <option value="contact">User Contact</option>
                                                                        </select>
                                                                    ) : (
                                                                        <input
                                                                            type="text"
                                                                            value={param.value}
                                                                            onChange={(e) => handleUpdateParam('admin', idx, 'value', e.target.value)}
                                                                            className="flex-1 px-3 py-2 bg-slate-50 border-2 border-[#006B4D]/40 rounded-md text-xs font-bold focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all text-black"
                                                                            placeholder="Custom text"
                                                                        />
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 pt-4 border-t border-[#006B4D]/20">
                                                        <strong className="text-[11px] font-black text-black uppercase tracking-[0.08em] block mb-2">Template Preview</strong>
                                                        <div className="bg-white p-3 rounded-lg border border-[#006B4D]/20 font-mono text-xs text-black whitespace-pre-wrap leading-relaxed shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
                                                            {templates.find(t => t.name === notificationSettings.admin_whatsapp_template_name)?.body_text || 'No body content'}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="bg-white p-6 rounded-2xl border-2 border-[#006B4D] shadow-sm hover:shadow-[#006B4D]/10 transition-all">
                                    <div className="flex items-center justify-between mb-6 border-b border-[#006B4D]/20 pb-4">
                                        <div>
                                            <h4 className="text-lg font-bold text-black">Send Welcome WhatsApp Message</h4>
                                            <p className="text-xs text-black mt-1">Automatically send a welcome message template to new users.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={notificationSettings.send_welcome_whatsapp} onChange={(e) => setNotificationSettings({ ...notificationSettings, send_welcome_whatsapp: e.target.checked })} />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006B4D]"></div>
                                        </label>
                                    </div>

                                    {notificationSettings.send_welcome_whatsapp && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em] mb-2">Welcome Template Name</label>
                                                    <SearchableSelect
                                                        options={welcomeTemplateOptions}
                                                        value={notificationSettings.welcome_template_name}
                                                        onChange={(val) => handleTemplateChange('welcome', val)}
                                                    />
                                                    <p className="text-xs text-black mt-2">
                                                        Select the template approved in your Meta Developer Dashboard.
                                                    </p>
                                                </div>
                                                {notificationSettings.welcome_template_name && hasMediaHeader(notificationSettings.welcome_template_name) && (
                                                    <div>
                                                        <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em] mb-2">Header Media URL</label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={notificationSettings.welcome_template_media_url}
                                                                onChange={(e) => setNotificationSettings({ ...notificationSettings, welcome_template_media_url: e.target.value })}
                                                                className="flex-1 px-4 py-3 bg-white border-2 border-[#006B4D]/40 rounded-lg text-sm font-bold text-black focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                                                placeholder="https://example.com/welcome-image.png"
                                                            />
                                                            <label className={`flex-shrink-0 px-4 py-3 bg-black hover:bg-gray-800 text-white text-black rounded-lg text-sm font-bold cursor-pointer transition-colors flex items-center justify-center border-2 border-[#006B4D]/40 ${isUploadingMedia === 'welcome' ? 'opacity-50 cursor-wait' : ''}`}>
                                                                {isUploadingMedia === 'welcome' ? (
                                                                    <><span className="animate-spin mr-2">⚙</span> Uploading...</>
                                                                ) : (
                                                                    <><span className="mr-2">📤</span> Upload</>
                                                                )}
                                                                <input 
                                                                    type="file" 
                                                                    className="hidden" 
                                                                    accept="image/*,video/*,.pdf" 
                                                                    onChange={(e) => handleMediaUpload(e, 'welcome')} 
                                                                    disabled={isUploadingMedia === 'welcome'}
                                                                />
                                                            </label>
                                                        </div>
                                                        <p className="text-xs text-black mt-2">Upload a file or paste a direct URL for this template's header.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {notificationSettings.welcome_template_name && templates.find(t => t.name === notificationSettings.welcome_template_name) && (
                                                <div className="bg-[#006B4D]/5 border-2 border-[#006B4D] p-5 rounded-xl shadow-inner">
                                                    <div>
                                                        <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em] mb-2">Template Parameters</label>
                                                        <p className="text-xs text-black mb-3">Map the {'{{1}}'}, {'{{2}}'} slots to user data.</p>
                                                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2">
                                                            {notificationSettings.welcome_template_params.map((param, idx) => (
                                                                <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-[#006B4D]/20 shadow-sm">
                                                                    <span className="text-xs font-black text-black w-8 text-center">{`{{${idx + 1}}}`}</span>
                                                                    <select
                                                                        value={param.type}
                                                                        onChange={(e) => handleUpdateParam('welcome', idx, 'type', e.target.value)}
                                                                        className="px-3 py-2 bg-slate-50 border-2 border-[#006B4D]/40 rounded-md text-xs font-bold focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all appearance-none cursor-pointer text-black"
                                                                        style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.65em auto', paddingRight: '1.75rem' }}
                                                                    >
                                                                        <option value="field">Dynamic Field</option>
                                                                        <option value="custom">Static Text</option>
                                                                    </select>
                                                                    {param.type === 'field' ? (
                                                                        <select
                                                                            value={param.value}
                                                                            onChange={(e) => handleUpdateParam('welcome', idx, 'value', e.target.value)}
                                                                            className="flex-1 px-3 py-2 bg-slate-50 border-2 border-[#006B4D]/40 rounded-md text-xs font-bold focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all appearance-none cursor-pointer text-black"
                                                                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.65em auto', paddingRight: '1.75rem' }}
                                                                        >
                                                                            <option value="name">User Name</option>
                                                                            <option value="email">User Email</option>
                                                                            <option value="contact">User Contact</option>
                                                                        </select>
                                                                    ) : (
                                                                        <input
                                                                            type="text"
                                                                            value={param.value}
                                                                            onChange={(e) => handleUpdateParam('welcome', idx, 'value', e.target.value)}
                                                                            className="flex-1 px-3 py-2 bg-slate-50 border-2 border-[#006B4D]/40 rounded-md text-xs font-bold focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all text-black"
                                                                            placeholder="Custom text"
                                                                        />
                                                                    )}
                                                                    <button onClick={() => handleRemoveParam('welcome', idx)} className="text-red-500 hover:text-red-700 p-1">✕</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 pt-4 border-t border-[#006B4D]/20">
                                                        <strong className="text-[11px] font-black text-black uppercase tracking-[0.08em] block mb-2">Template Preview</strong>
                                                        <div className="bg-white p-3 rounded-lg border border-[#006B4D]/20 font-mono text-xs text-black whitespace-pre-wrap leading-relaxed shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
                                                            {templates.find(t => t.name === notificationSettings.welcome_template_name)?.body_text || 'No body content'}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                {/* --- EMAIL SECTION --- */}
                {activeTab === 'email' && (
                    <div className="bg-white p-6 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all space-y-6">
                        <h4 className="text-lg font-bold text-black mb-6 flex items-center pb-4 border-b border-slate-100">
                            <svg className="w-6 h-6 mr-3 text-[#006B4D] drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                            <span className="tracking-tight">Email Notification Settings</span>
                        </h4>

                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <label className="block text-sm font-bold text-black">Notify Admin via Email</label>
                                <p className="text-xs text-black">Receive an email when a new user signs up.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={notificationSettings.notify_admin_via_email} onChange={(e) => setNotificationSettings({ ...notificationSettings, notify_admin_via_email: e.target.checked })} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006B4D]"></div>
                            </label>
                        </div>

                        {notificationSettings.notify_admin_via_email && (
                            <div className="space-y-4 bg-slate-50/80 p-5 rounded-xl border-2 border-[#006B4D]/30 shadow-sm mt-4">
                                <div>
                                    <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em] mb-2">Admin Email Address</label>
                                    <input
                                        type="text"
                                        value={notificationSettings.admin_email_address}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, admin_email_address: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border-2 border-[#006B4D]/40 rounded-lg text-sm font-bold text-black focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                        placeholder="admin1@example.com, admin2@example.com"
                                    />
                                    <p className="text-xs text-black mt-2">Use commas to notify multiple email addresses.</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border-2 border-[#006B4D]/30 mt-6">
                            <div>
                                <label className="block text-sm font-bold text-black">Send Welcome Email</label>
                                <p className="text-xs text-black">Automatically send an HTML welcome email to new users.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={notificationSettings.send_welcome_email} onChange={(e) => setNotificationSettings({ ...notificationSettings, send_welcome_email: e.target.checked })} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006B4D]"></div>
                            </label>
                        </div>

                        {notificationSettings.send_welcome_email && (
                            <div className="space-y-4 bg-slate-50/80 p-5 rounded-xl border-2 border-[#006B4D]/30 shadow-sm mt-4">
                                <div>
                                    <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em] mb-2">Welcome Email Subject</label>
                                    <input
                                        type="text"
                                        value={notificationSettings.welcome_email_subject}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, welcome_email_subject: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border-2 border-[#006B4D]/40 rounded-lg text-sm font-bold text-black focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                        placeholder="Welcome to our platform!"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em]">Welcome Email HTML Body</label>
                                        <button 
                                            onClick={() => setNotificationSettings({ 
                                                ...notificationSettings, 
                                                welcome_email_body: `<h1>Welcome to {{domain}}!</h1>\n\n<p>Hi {{name}},</p>\n\n<p>Thank you for signing up. We are absolutely thrilled to have you join our platform!</p>\n\n<p>Here are the details we have on file for you:</p>\n<ul>\n    <li><strong>Email:</strong> {{email}}</li>\n    <li><strong>Contact:</strong> {{contact_number}}</li>\n</ul>\n\n<p>If you have any questions, simply reply to this email.</p>\n\n<p><a href="https://{{domain}}">Go to Dashboard</a></p>`
                                            })}
                                            className="text-xs font-bold text-[#006B4D] bg-[#006B4D]/5 hover:bg-[#006B4D]/10 border border-[#006B4D]/20 px-3 py-1 rounded transition-colors"
                                        >
                                            Load Default Template
                                        </button>
                                    </div>
                                    <textarea
                                        value={notificationSettings.welcome_email_body}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, welcome_email_body: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border-2 border-[#006B4D]/40 rounded-lg text-sm font-bold text-black focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all h-64"
                                        placeholder="Write your HTML here or click 'Load Default Template'..."
                                    />
                                    <p className="text-xs text-black mt-3 font-medium bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <strong className="text-blue-700 block mb-1">💡 Dynamic Tags Supported:</strong>
                                        You can use the following placeholders in both Subject and Body to personalize the email:
                                        <br />
                                        <span className="inline-flex flex-wrap gap-2 mt-2">
                                            <span className="bg-white px-2 py-1 rounded shadow-sm text-blue-600 border border-blue-100"><code className="font-bold">{`{{name}}`}</code> - User's Name</span>
                                            <span className="bg-white px-2 py-1 rounded shadow-sm text-blue-600 border border-blue-100"><code className="font-bold">{`{{email}}`}</code> - User's Email</span>
                                            <span className="bg-white px-2 py-1 rounded shadow-sm text-blue-600 border border-blue-100"><code className="font-bold">{`{{contact_number}}`}</code> - User's Phone</span>
                                            <span className="bg-white px-2 py-1 rounded shadow-sm text-blue-600 border border-blue-100"><code className="font-bold">{`{{domain}}`}</code> - Your Domain</span>
                                        </span>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- WEBHOOK SECTION --- */}
                {activeTab === 'webhook' && (
                    <div className="bg-white p-6 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all space-y-6">
                        <h4 className="text-lg font-bold text-black mb-6 flex items-center pb-4 border-b border-slate-100">
                            <svg className="w-6 h-6 mr-3 text-[#006B4D] drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                            <span className="tracking-tight">Webhook Notification Settings</span>
                        </h4>

                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <label className="block text-sm font-bold text-black">Trigger Webhook on Signup</label>
                                <p className="text-xs text-black">Send an HTTP POST request to a custom webhook URL when a new user signs up.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={notificationSettings.trigger_webhook_on_signup} onChange={(e) => setNotificationSettings({ ...notificationSettings, trigger_webhook_on_signup: e.target.checked })} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006B4D]"></div>
                            </label>
                        </div>

                        {notificationSettings.trigger_webhook_on_signup && (
                            <div className="space-y-4 bg-slate-50/80 p-5 rounded-xl border-2 border-[#006B4D]/30 shadow-sm mt-4">
                                <div>
                                    <label className="block text-[11px] font-black text-black uppercase tracking-[0.08em] mb-2">Admin Webhook URL</label>
                                    <input
                                        type="url"
                                        value={notificationSettings.admin_webhook_url}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, admin_webhook_url: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border-2 border-[#006B4D]/40 rounded-lg text-sm font-bold text-black focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                        placeholder="https://hooks.zapier.com/hooks/catch/..."
                                    />
                                </div>
                                <p className="text-xs text-black mt-3">
                                    The webhook will receive a POST request with the following JSON format:
                                    <pre className="mt-2 p-3 bg-slate-800 text-black rounded-lg text-[10px] overflow-x-auto">
{`{
  "event": "new_user_signup",
  "domain": "yourtenantdomain.com",
  "contact_phone": "1234567890",
  "admin": {
    "email": "admin@example.com",
    "whatsapp_number": "+1234567890"
  },
  "user": {
    "name": "John Doe",
    "email": "john@example.com",
    "contact_number": "1234567890"
  },
  "timestamp": "2026-06-11T12:00:00.000Z"
}`}
                                    </pre>
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminSignupNotifications;
