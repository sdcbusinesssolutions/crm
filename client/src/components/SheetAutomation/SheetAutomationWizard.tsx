import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { themeService } from '../../services/themeService';

interface SheetAutomationWizardProps {
    onClose: () => void;
    onSave: () => void;
    initialData?: any; // For editing
}

const SheetAutomationWizard: React.FC<SheetAutomationWizardProps> = ({ onClose, onSave, initialData }) => {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        schedule_type: 'daily', // daily, weekly, monthly, custom
        schedule_time: '09:00',
        connection_id: '',
        spreadsheet_id: '',
        sheet_name: '',
        connection_id: '',
        spreadsheet_id: '',
        sheet_name: '',
        triggers: [{ column: '', operator: 'equals', value: '' }] as { column: string, operator: string, value: string }[],
        template_id: '',
        mapping: {} as Record<string, { type: 'static' | 'column', value: string }>
    });

    const [connections, setConnections] = useState<any[]>([]);
    const [spreadsheets, setSpreadsheets] = useState<string[]>([]); // Just names for now or IDs? API returns active sheets usually
    const [sheetTabs, setSheetTabs] = useState<string[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [templateParams, setTemplateParams] = useState<string[]>([]); // Extracted from template body
    const [brandColor, setBrandColor] = useState('#ea580c');

    useEffect(() => {
        themeService.getTheme().then(t => setBrandColor(t.colors?.brand || '#ea580c'));
        fetchConnections();
        fetchTemplates();
        if (initialData) {
            setFormData(initialData); // Populate for edit
        }
    }, []);

    const fetchConnections = async () => {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const res = await fetch('/api/integrations/google/connections', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setConnections(await res.json());
    };

    const fetchTemplates = async () => {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const res = await fetch('/api/whatsapp/templates?status=approved', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            const data = await res.json();
            setTemplates(data.data || []);
        }
    };

    const [isFetchingSheets, setIsFetchingSheets] = useState(false);
    const [manualSheetEntry, setManualSheetEntry] = useState(false);

    // --- Actions ---
    const handleSheetSelect = async (spreadsheetId: string) => {
        if (!spreadsheetId) return;

        setIsFetchingSheets(true);
        setSheetTabs([]);
        setFormData(prev => ({ ...prev, spreadsheet_id: spreadsheetId, sheet_name: '' }));

        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;

        const res = await fetch('/api/integrations/google/sheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ connectionId: formData.connection_id, spreadsheetId })
        });

        setIsFetchingSheets(false);

        if (res.ok) {
            const data = await res.json();
            setSheetTabs(data.sheets || []);

            // Auto-select first sheet if available to improve UX
            if (data.sheets && data.sheets.length > 0) {
                const firstSheet = data.sheets[0];
                setFormData(prev => ({ ...prev, sheet_name: firstSheet }));
                handleTabSelect(firstSheet);
            }
        } else {
            setSheetTabs([]); // Clear sheets on error
            const err = await res.json();
            alert('Failed to fetch sheets: ' + (err.error || 'Please check the Spreadsheet ID and try again.'));
        }
    };

    const handleTabSelect = async (sheetName: string) => {
        setFormData(prev => ({ ...prev, sheet_name: sheetName }));
        // Fetch Columns
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;

        setIsLoading(true);
        try {
            console.log('Fetching columns for:', {
                connectionId: formData.connection_id,
                spreadsheetId: formData.spreadsheet_id,
                sheetName: sheetName
            });

            const res = await fetch('/api/integrations/google/columns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    connectionId: formData.connection_id,
                    spreadsheetId: formData.spreadsheet_id,
                    sheetName: sheetName
                })
            });
            if (res.ok) {
                const data = await res.json();
                console.log('Columns fetched:', data.columns);
                if (data.columns && data.columns.length > 0) {
                    setColumns(data.columns);
                } else {
                    setColumns([]);
                    alert('No columns found in the first row of this sheet.');
                }
            } else {
                const err = await res.json();
                console.error('Fetch Columns failed:', err);
                alert('Failed to fetch columns: ' + (err.error || 'Unknown error'));
            }
        } catch (e: any) {
            console.error('Fetch error:', e);
            alert('Error fetching columns: ' + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = () => {
        // Validation Logic
        if (step === 1) {
            if (!formData.name) return alert('Please enter a schedule name');
        }
        if (step === 2) {
            if (!formData.connection_id) return alert('Please select a Google Account');
            if (!formData.spreadsheet_id) return alert('Please enter a Spreadsheet ID');
            if (isFetchingSheets) return alert('Please wait while sheets are being fetched...');
            if (!formData.sheet_name) return alert('Please select a Sheet Tab');
        }
        if (step === 3) {
            if (formData.triggers.length === 0) return alert('Please add at least one trigger condition');
            const invalidInfo = formData.triggers.find(t => !t.column || !t.operator);
            if (invalidInfo) return alert('Please complete all trigger conditions (Column and Operator are required)');
        }
        if (step === 4) {
            if (!formData.template_id) return alert('Please select a message template');
        }

        setStep(step + 1);
    };

    const handleTemplateSelect = (templateId: string) => {
        const tpl = templates.find(t => t.id === templateId);
        if (tpl) {
            setFormData({ ...formData, template_id: templateId });

            // Extract Params
            const params: string[] = [];

            // 1. Header Components (Images, Video, Text Vars)
            const headerComp = tpl.components.find((c: any) => c.type === 'HEADER');
            if (headerComp) {
                if (headerComp.format === 'IMAGE') params.push('HEADER_IMAGE');
                else if (headerComp.format === 'VIDEO') params.push('HEADER_VIDEO');
                else if (headerComp.format === 'DOCUMENT') params.push('HEADER_DOCUMENT');
                else if (headerComp.format === 'TEXT' && headerComp.text && headerComp.text.includes('{{1}}')) {
                    params.push('header_variable_1');
                }
            }

            // 2. Body Components
            const bodyComp = tpl.components.find((c: any) => c.type === 'BODY');
            if (bodyComp && bodyComp.text) {
                // Match {{1}}, {{2}} etc.
                const matches = bodyComp.text.match(/{{(\d+)}}/g);
                if (matches) {
                    const unique = Array.from(new Set(matches)) as string[];
                    unique.forEach(m => params.push(`body_variable_${m.replace(/{|}/g, '')}`));
                }
            }

            console.log('Extracted Params:', params);
            setTemplateParams(params);
        }
    };

    const handleFinalSubmit = async () => {
        // Construct payload matching backend
        const payload = {
            name: formData.name,
            connection_id: formData.connection_id,
            spreadsheet_id: formData.spreadsheet_id,
            sheet_name: formData.sheet_name,
            automation_type: 'schedule', // hardcoded for MVP
            schedule_config: {
                time: formData.schedule_time,
                days: [] // All days
            },
            trigger_condition: formData.triggers, // Send array directly
            template_config: {
                template_name: templates.find(t => t.id === formData.template_id)?.name,
                language: 'en', // hardcoded
                components: [] // Logic to map params
            },
            mapping_config: {
                phone_col: formData.mapping['phone']?.value || columns[0],
                params: formData.mapping
            }
        };

        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;

        const res = await fetch('/api/sheet-automations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            onSave();
        } else {
            alert('Error saving automation');
        }
    };

    // --- Render ---
    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200">
            {/* Header Steps */}
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
                <div className="flex space-x-4">
                    {[1, 2, 3, 4, 5, 6].map(s => (
                        <div key={s} className={`flex items-center space-x-2 ${step >= s ? 'opacity-100' : 'opacity-40'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {s}
                            </div>
                            <span className="text-sm font-medium text-slate-700">
                                {['Schedule', 'Sheet', 'Trigger', 'Message', 'Accounts', 'Cell Map'][s - 1]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-8 min-h-[400px]">
                {/* STEP 1: SCHEDULE */}
                {step === 1 && (
                    <div className="max-w-md mx-auto space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Title</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full border border-slate-300 rounded px-3 py-2" placeholder="e.g. Birthday Wishes"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                            <div className="flex border border-slate-300 rounded overflow-hidden">
                                {['daily', 'weekly', 'monthly', 'custom'].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setFormData({ ...formData, schedule_type: t })}
                                        className={`flex-1 py-2 text-sm font-medium transition-colors border-r last:border-r-0 border-slate-300
                                            ${formData.schedule_type === t ? 'bg-orange-50 text-orange-600' : 'bg-white text-slate-600 hover:bg-slate-50'}
                                        `}
                                    >
                                        {t === 'custom' ? 'One-Time' : t.charAt(0).toUpperCase() + t.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {formData.schedule_type === 'custom' ? (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date & Time</label>
                                <input
                                    type="datetime-local"
                                    className="w-full border border-slate-300 rounded px-3 py-2"
                                    onChange={e => {
                                        // Store as "YYYY-MM-DD HH:mm"
                                        setFormData({ ...formData, schedule_time: e.target.value });
                                    }}
                                />
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Time of day</label>
                                <input
                                    type="time"
                                    value={formData.schedule_time}
                                    onChange={e => setFormData({ ...formData, schedule_time: e.target.value })}
                                    className="w-full border border-slate-300 rounded px-3 py-2"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2: SHEET */}
                {step === 2 && (
                    <div className="max-w-md mx-auto space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Use Integration</label>
                            <select
                                className="w-full border border-slate-300 rounded px-3 py-2"
                                value={formData.connection_id}
                                onChange={e => setFormData({ ...formData, connection_id: e.target.value })}
                            >
                                <option value="">Select Account</option>
                                {connections.map(c => (
                                    <option key={c.id} value={c.id}>{c.connection_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Spreadsheet ID</label>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 border border-slate-300 rounded px-3 py-2"
                                    placeholder="Paste Spreadsheet ID here"
                                    value={formData.spreadsheet_id}
                                    onChange={e => setFormData({ ...formData, spreadsheet_id: e.target.value })}
                                />
                                <button
                                    onClick={() => handleSheetSelect(formData.spreadsheet_id)}
                                    disabled={isFetchingSheets || !formData.spreadsheet_id}
                                    className="px-4 py-2 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 text-sm font-medium whitespace-nowrap"
                                >
                                    {isFetchingSheets ? 'Fetching...' : 'Fetch Sheets'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Paste ID from URL: docs.google.com/spreadsheets/d/<b>SpreadsheetID</b>/edit</p>
                        </div>
                        {isFetchingSheets && <p className="text-sm text-center text-slate-500 italic">Finding sheets...</p>}

                        <div className="flex justify-between items-end mb-1">
                            <label className="block text-sm font-medium text-slate-700">Sheet Tab</label>
                            <button
                                onClick={() => setManualSheetEntry(!manualSheetEntry)}
                                className="text-xs text-blue-600 hover:text-blue-800 underline pb-1"
                            >
                                {manualSheetEntry ? 'Select from list' : 'Enter manually'}
                            </button>
                        </div>

                        {manualSheetEntry ? (
                            <div>
                                <input
                                    className="w-full border border-slate-300 rounded px-3 py-2"
                                    placeholder="Type exactly as it appears (e.g. Sheet1)"
                                    value={formData.sheet_name}
                                    onChange={e => setFormData({ ...formData, sheet_name: e.target.value })}
                                    onBlur={() => {
                                        if (formData.sheet_name) handleTabSelect(formData.sheet_name);
                                    }}
                                />
                                <p className="text-xs text-slate-500 mt-1">Press tab or click away to load columns.</p>
                            </div>
                        ) : (
                            <select
                                className="w-full border border-slate-300 rounded px-3 py-2"
                                value={formData.sheet_name}
                                onChange={e => handleTabSelect(e.target.value)}
                                disabled={!manualSheetEntry && sheetTabs.length === 0}
                            >
                                <option value="">{sheetTabs.length === 0 ? 'No sheets loaded' : 'Select Tab'}</option>
                                {sheetTabs.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        )}

                        {!isFetchingSheets && formData.spreadsheet_id && sheetTabs.length === 0 && !manualSheetEntry && (
                            <div className="mt-2 p-3 bg-blue-50 text-blue-700 text-sm rounded border border-blue-100 flex justify-between items-center">
                                <span>Click "Fetch Sheets" above or enter manually.</span>
                                <button
                                    onClick={() => setManualSheetEntry(true)}
                                    className="text-xs font-bold underline"
                                >
                                    Enter Manually
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: TRIGGER */}
                {step === 3 && (
                    <div className="max-w-3xl mx-auto space-y-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 mb-4">
                            Define the conditions that must be met for a message to be sent. All conditions must be true (AND logic).
                        </div>

                        {formData.triggers.map((trigger, index) => (
                            <div key={index} className="flex items-start gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                {isLoading ? (
                                    <div className="text-sm text-slate-500 animate-pulse py-2 px-3">Loading columns...</div>
                                ) : (
                                    <select
                                        className="flex-1 w-1/3 border border-slate-300 rounded px-3 py-2 text-sm"
                                        value={trigger.column}
                                        onChange={e => {
                                            const newTriggers = [...formData.triggers];
                                            newTriggers[index].column = e.target.value;
                                            setFormData({ ...formData, triggers: newTriggers });
                                        }}
                                    >
                                        <option value="">Select Column</option>
                                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                )}

                                <select
                                    className="w-1/3 border border-slate-300 rounded px-3 py-2 text-sm"
                                    value={trigger.operator}
                                    onChange={e => {
                                        const newTriggers = [...formData.triggers];
                                        newTriggers[index].operator = e.target.value;
                                        // Reset value if operator doesn't need it
                                        if (['is_empty', 'is_not_empty', 'is_today', 'is_yesterday', 'is_tomorrow', 'day_month_equal'].includes(e.target.value)) {
                                            newTriggers[index].value = '';
                                        }
                                        setFormData({ ...formData, triggers: newTriggers });
                                    }}
                                >
                                    <optgroup label="General">
                                        <option value="equals">Equals</option>
                                        <option value="not_equals">Does Not Equal</option>
                                        <option value="contains">Contains</option>
                                        <option value="does_not_contain">Does Not Contain</option>
                                        <option value="starts_with">Starts With</option>
                                        <option value="ends_with">Ends With</option>
                                        <option value="is_empty">Is Empty</option>
                                        <option value="is_not_empty">Is Not Empty</option>
                                    </optgroup>
                                    <optgroup label="Date & Time (Dynamic)">
                                        <option value="is_today">Is Today</option>
                                        <option value="is_yesterday">Is Yesterday</option>
                                        <option value="is_tomorrow">Is Tomorrow</option>
                                        <option value="in_last_x_days">In Last X Days</option>
                                        <option value="in_next_x_days">In Next X Days</option>
                                        <option value="date_equals">Date Equals (Exact)</option>
                                        <option value="date_before">Date Before</option>
                                        <option value="date_after">Date After</option>
                                        <option value="date_between">Date Between</option>
                                    </optgroup>
                                    <optgroup label="Anniversary (Ignore Year)">
                                        <option value="day_month_equal">Birthday/Anniv. is Today</option>
                                        <option value="day_month_before">Birthday has passed</option>
                                        <option value="day_month_after">Birthday is coming</option>
                                    </optgroup>
                                    <optgroup label="Number">
                                        <option value="greater_than">Greater Than</option>
                                        <option value="less_than">Less Than</option>
                                        <option value="greater_than_or_equal">Greater or Equal</option>
                                        <option value="less_than_or_equal">Less or Equal</option>
                                    </optgroup>
                                </select>

                                {/* Value Input - Dynamic based on operator */}
                                {!['is_empty', 'is_not_empty', 'is_today', 'is_yesterday', 'is_tomorrow', 'day_month_equal'].includes(trigger.operator) && (
                                    <div className="w-1/3">
                                        {['date_equals', 'date_before', 'date_after'].includes(trigger.operator) ? (
                                            <input
                                                type="date"
                                                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                                                value={trigger.value}
                                                onChange={e => {
                                                    const newTriggers = [...formData.triggers];
                                                    newTriggers[index].value = e.target.value;
                                                    setFormData({ ...formData, triggers: newTriggers });
                                                }}
                                            />
                                        ) : ['in_last_x_days', 'in_next_x_days'].includes(trigger.operator) ? (
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm pr-10"
                                                    placeholder="Days"
                                                    value={trigger.value}
                                                    onChange={e => {
                                                        const newTriggers = [...formData.triggers];
                                                        newTriggers[index].value = e.target.value;
                                                        setFormData({ ...formData, triggers: newTriggers });
                                                    }}
                                                />
                                                <span className="absolute right-3 top-2 text-xs text-slate-400">Days</span>
                                            </div>
                                        ) : ['date_between'].includes(trigger.operator) ? (
                                            <input
                                                type="text"
                                                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                                                placeholder="YYYY-MM-DD,YYYY-MM-DD"
                                                title="Format: StartDate,EndDate"
                                                value={trigger.value}
                                                onChange={e => {
                                                    const newTriggers = [...formData.triggers];
                                                    newTriggers[index].value = e.target.value;
                                                    setFormData({ ...formData, triggers: newTriggers });
                                                }}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                                                placeholder="Value"
                                                value={trigger.value}
                                                onChange={e => {
                                                    const newTriggers = [...formData.triggers];
                                                    newTriggers[index].value = e.target.value;
                                                    setFormData({ ...formData, triggers: newTriggers });
                                                }}
                                            />
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        const newTriggers = formData.triggers.filter((_, i) => i !== index);
                                        setFormData({ ...formData, triggers: newTriggers });
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                                    title="Remove Condition"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        ))}

                        <button
                            onClick={() => {
                                setFormData({
                                    ...formData,
                                    triggers: [...formData.triggers, { column: '', operator: 'equals', value: '' }]
                                });
                            }}
                            className="flex items-center gap-2 text-sm text-orange-600 font-medium hover:text-orange-700 font"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            Add Another Condition
                        </button>
                    </div>
                )}

                {/* STEP 4: MESSAGE */}
                {step === 4 && (
                    <div className="max-w-md mx-auto space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Select Template</label>
                            <select
                                className="w-full border border-slate-300 rounded px-3 py-2"
                                value={formData.template_id}
                                onChange={e => handleTemplateSelect(e.target.value)}
                            >
                                <option value="">Select Template</option>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>

                        {formData.template_id && (
                            <div className="bg-slate-50 p-4 rounded border border-slate-200 text-sm space-y-2">
                                <h5 className="font-bold text-slate-700">Preview</h5>
                                {templates.find(t => t.id === formData.template_id)?.components.map((c: any, i: number) => (
                                    <div key={i}>
                                        <span className="text-xs font-semibold text-slate-500 block uppercase">{c.type}</span>
                                        <p className="whitespace-pre-wrap text-slate-700">{c.text || `[${c.format} Content]`}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 5: ACCOUNTS (Optional, skipped for now or just confirmation) */}
                {step === 5 && (
                    <div className="text-center text-slate-500 py-10">
                        <p>Sending from: default configured WhatsApp Business Account.</p>
                        <p className="text-sm mt-2">No additional configuration needed.</p>
                    </div>
                )}

                {/* STEP 6: MAPPING */}
                {step === 6 && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        <h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Map Template Variables</h4>

                        {/* Phone Number is Always Column */}
                        <div className="flex items-center gap-4 py-2">
                            <span className="w-40 text-sm font-bold text-slate-800">Phone Number</span>
                            <span className="text-slate-400">→</span>
                            <select
                                className="flex-1 w-full border border-slate-300 rounded px-3 py-2 bg-white"
                                onChange={e => setFormData(p => ({
                                    ...p,
                                    mapping: { ...p.mapping, phone: { type: 'column', value: e.target.value } }
                                }))}
                            >
                                <option value="">Select Phone Column</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className="h-px bg-slate-100 my-2"></div>

                        {/* Dynamic Template Params */}
                        {templateParams.map(param => {
                            const currentMap = formData.mapping[param] || { type: 'column', value: '' };

                            return (
                                <div key={param} className="flex flex-col sm:flex-row sm:items-center gap-4 py-3 border-b border-slate-50 last:border-0">
                                    <div className="w-40 shrink-0">
                                        <span className="text-sm font-medium text-slate-700 block mb-1">
                                            {param.replace(/_/g, ' ').toUpperCase()}
                                        </span>
                                        <div className="flex text-xs border border-slate-200 rounded overflow-hidden w-fit">
                                            <button
                                                onClick={() => setFormData(p => ({
                                                    ...p,
                                                    mapping: { ...p.mapping, [param]: { type: 'column', value: '' } }
                                                }))}
                                                className={`px-2 py-1 ${currentMap.type === 'column' ? 'bg-blue-50 text-blue-600 font-bold' : 'bg-slate-50 text-slate-500'}`}
                                            >
                                                Column
                                            </button>
                                            <button
                                                onClick={() => setFormData(p => ({
                                                    ...p,
                                                    mapping: { ...p.mapping, [param]: { type: 'static', value: '' } }
                                                }))}
                                                className={`px-2 py-1 border-l border-slate-200 ${currentMap.type === 'static' ? 'bg-blue-50 text-blue-600 font-bold' : 'bg-slate-50 text-slate-500'}`}
                                            >
                                                Static
                                            </button>
                                        </div>
                                    </div>

                                    <span className="hidden sm:inline text-slate-400">→</span>

                                    <div className="flex-1">
                                        {currentMap.type === 'column' ? (
                                            <select
                                                className="w-full border border-slate-300 rounded px-3 py-2 bg-white"
                                                value={currentMap.value}
                                                onChange={e => setFormData(p => ({
                                                    ...p,
                                                    mapping: { ...p.mapping, [param]: { type: 'column', value: e.target.value } }
                                                }))}
                                            >
                                                <option value="">Select Column</option>
                                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        ) : (
                                            <input
                                                type={param.includes('IMAGE') || param.includes('VIDEO') ? 'url' : 'text'}
                                                className="w-full border border-slate-300 rounded px-3 py-2"
                                                placeholder={param.includes('IMAGE') ? "Paste Image URL..." : "Type custom value..."}
                                                value={currentMap.value}
                                                onChange={e => setFormData(p => ({
                                                    ...p,
                                                    mapping: { ...p.mapping, [param]: { type: 'static', value: e.target.value } }
                                                }))}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {templateParams.length === 0 && (
                            <p className="text-sm text-slate-500 italic p-4 text-center bg-slate-50 rounded">
                                No variable fields found in the selected template.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                {step > 1 && (
                    <button onClick={() => setStep(step - 1)} className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-100 text-slate-600">
                        Previous
                    </button>
                )}

                {step < 6 ? (
                    <button onClick={handleNext} className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">
                        Next
                    </button>
                ) : (
                    <button
                        onClick={handleFinalSubmit}
                        className={`px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Saving...' : 'Finish & Save'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default SheetAutomationWizard;
