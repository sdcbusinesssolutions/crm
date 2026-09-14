import React, { useState, useEffect } from 'react';

interface PricingOption {
    id: string;
    name: string; // e.g., 'Monthly'
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count: number;
    price_id: string;
    amount: number | string;
    enabled: boolean;
}

interface PlanEditorProps {
    plan?: any;
    onSave: (planData: any) => Promise<void>;
    onCancel: () => void;
}

const PlanEditor: React.FC<PlanEditorProps> = ({ plan, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        is_active: false,
        limits: {
            contacts: -1,
            campaigns: -1,
            bot_replies: -1,
            bot_flows: -1,
            custom_fields: -1,
            team_members: -1
        },
        ai_bot_enabled: false,
        api_access_enabled: false,
        pricing: [] as PricingOption[]
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial Pricing Templates
    const defaultPricingOptions: PricingOption[] = [
        { id: 'monthly', name: 'Monthly', interval: 'month', interval_count: 1, price_id: '', amount: 0, enabled: false },
        { id: 'quarterly', name: 'Quarterly', interval: 'month', interval_count: 3, price_id: '', amount: 0, enabled: false },
        { id: 'half_yearly', name: 'Half Yearly', interval: 'month', interval_count: 6, price_id: '', amount: 0, enabled: false },
        { id: 'yearly', name: 'Yearly', interval: 'year', interval_count: 1, price_id: '', amount: 0, enabled: false }
    ];

    useEffect(() => {
        if (plan) {
            // Handle legacy format (object) conversion to array if needed
            let pricingArray: PricingOption[] = [];

            if (Array.isArray(plan.pricing)) {
                pricingArray = plan.pricing;
            } else if (plan.pricing && typeof plan.pricing === 'object') {
                // Convert old format to new format
                if (plan.pricing.monthly) pricingArray.push({ ...defaultPricingOptions[0], ...plan.pricing.monthly, enabled: plan.pricing.monthly.enabled });
                if (plan.pricing.yearly) pricingArray.push({ ...defaultPricingOptions[3], ...plan.pricing.yearly, enabled: plan.pricing.yearly.enabled });
            } else {
                pricingArray = [...defaultPricingOptions];
            }

            // Ensure we at least have the defaults if they are missing (for existing plans)
            defaultPricingOptions.forEach(def => {
                const exists = pricingArray.find(p => p.id === def.id);
                if (!exists) {
                    pricingArray.push({ ...def });
                }
            });

            // Sort to keep standard order: Monthly, Quarterly, Half-Yearly, Yearly, Others
            const sortOrder = ['monthly', 'quarterly', 'half_yearly', 'yearly'];
            pricingArray.sort((a, b) => {
                const indexA = sortOrder.indexOf(a.id);
                const indexB = sortOrder.indexOf(b.id);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return 0;
            });


            setFormData({
                name: plan.name || '',
                is_active: plan.is_active || false,
                limits: {
                    contacts: plan.limits?.contacts ?? -1,
                    campaigns: plan.limits?.campaigns ?? -1,
                    bot_replies: plan.limits?.bot_replies ?? -1,
                    bot_flows: plan.limits?.bot_flows ?? -1,
                    custom_fields: plan.limits?.custom_fields ?? -1,
                    team_members: plan.limits?.team_members ?? -1
                },
                ai_bot_enabled: plan.ai_bot_enabled || false,
                api_access_enabled: plan.api_access_enabled || false,
                pricing: pricingArray
            });
        } else {
            // New Plan
            setFormData(prev => ({ ...prev, pricing: defaultPricingOptions }));
        }
    }, [plan]);

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleLimitChange = (key: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            limits: { ...prev.limits, [key]: parseInt(value) || 0 }
        }));
    };

    const handlePricingChange = (index: number, field: keyof PricingOption, value: any) => {
        setFormData(prev => {
            const newPricing = [...prev.pricing];
            newPricing[index] = { ...newPricing[index], [field]: value };
            return { ...prev, pricing: newPricing };
        });
    };

    const addCustomPricing = () => {
        const newOption: PricingOption = {
            id: `custom_${Date.now()}`,
            name: 'Custom Duration',
            interval: 'day',
            interval_count: 7,
            price_id: '',
            amount: 0,
            enabled: true
        };
        setFormData(prev => ({
            ...prev,
            pricing: [...prev.pricing, newOption]
        }));
    };

    const removePricing = (index: number) => {
        setFormData(prev => ({
            ...prev,
            pricing: prev.pricing.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Sanitize pricing: Convert string amounts to numbers
        const cleanedPricing = formData.pricing.map(p => ({
            ...p,
            amount: typeof p.amount === 'string' ? (parseFloat(p.amount) || 0) : p.amount
        }));

        await onSave({ ...formData, pricing: cleanedPricing });
        setIsSubmitting(false);
    };

    const limitFields = [
        { key: 'contacts', label: 'Contacts' },
        { key: 'campaigns', label: 'Campaigns', suffix: 'Per Month' },
        { key: 'bot_replies', label: 'Bot Replies' },
        { key: 'bot_flows', label: 'Bot Flows' },
        { key: 'custom_fields', label: 'Contact Custom Fields' },
        { key: 'team_members', label: 'Team Members/Agents' }
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">{plan ? `Edit Plan: ${plan.name}` : 'Create New Plan'}</h3>
                <div>
                    <label className="flex items-center cursor-pointer gap-2">
                        <span className="text-sm font-medium text-slate-600">Enable Plan</span>
                        <div className="relative inline-flex items-center">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={formData.is_active}
                                onChange={e => handleChange('is_active', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                        </div>
                    </label>
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Title</label>
                <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                    placeholder="e.g. Standard"
                    value={formData.name}
                    onChange={e => handleChange('name', e.target.value)}
                />
            </div>

            <div>
                <h4 className="text-sm font-bold text-red-500 mb-4 uppercase tracking-wide">Feature Limits</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {limitFields.map((field) => (
                        <div key={field.key} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="mb-2">
                                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold mb-2">
                                    {field.label}
                                </span>
                            </div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{field.label}</label>
                            <div className="flex relative">
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                                    value={formData.limits[field.key as keyof typeof formData.limits]}
                                    onChange={e => handleLimitChange(field.key, e.target.value)}
                                />
                                {field.suffix && (
                                    <span className="absolute right-0 top-0 bottom-0 px-3 flex items-center bg-slate-100 text-slate-500 text-xs border-l border-slate-300 rounded-r-lg">
                                        {field.suffix}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Use -1 for unlimited</p>
                        </div>
                    ))}
                </div>
            </div>


            <div>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-red-500 uppercase tracking-wide">Charges & Durations</h4>
                    <button
                        type="button"
                        onClick={addCustomPricing}
                        className="text-xs bg-brand-50 text-brand-600 border border-brand-200 px-3 py-1.5 rounded-lg font-bold hover:bg-brand-100 transition-colors"
                    >
                        + Add Custom Duration
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {formData.pricing.map((option, index) => {
                        const isCustom = option.id.startsWith('custom_');
                        return (
                            <div key={option.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow relative">
                                {isCustom && (
                                    <button
                                        type="button"
                                        onClick={() => removePricing(index)}
                                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}

                                <div className="flex justify-between items-center mb-4">
                                    {isCustom ? (
                                        <input
                                            type="text"
                                            className="font-bold text-xs text-brand-700 bg-brand-50 border-none px-2 py-1 rounded w-32 focus:ring-1 focus:ring-brand-300"
                                            value={option.name}
                                            onChange={e => handlePricingChange(index, 'name', e.target.value)}
                                            placeholder="Custom Name"
                                        />
                                    ) : (
                                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold capitalize">
                                            {option.name}
                                        </span>
                                    )}

                                    {!isCustom && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={option.enabled}
                                                onChange={e => handlePricingChange(index, 'enabled', e.target.checked)}
                                            />
                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
                                        </label>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {isCustom && (
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Duration</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                                                    value={option.interval_count}
                                                    onChange={e => handlePricingChange(index, 'interval_count', parseInt(e.target.value) || 1)}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Unit</label>
                                                <select
                                                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                                                    value={option.interval}
                                                    onChange={e => handlePricingChange(index, 'interval', e.target.value)}
                                                >
                                                    <option value="day">Days</option>
                                                    <option value="week">Weeks</option>
                                                    <option value="month">Months</option>
                                                    <option value="year">Years</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Stripe Price ID</label>
                                        <input
                                            type="text"
                                            placeholder="price_..."
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-700 text-xs"
                                            value={option.price_id}
                                            onChange={e => handlePricingChange(index, 'price_id', e.target.value)}
                                            disabled={!option.enabled && !isCustom}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Charge Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-slate-400 text-xs">₹</span>
                                            <input
                                                type="number"
                                                className="w-full pl-6 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-700 text-xs"
                                                value={option.amount}
                                                onChange={e => handlePricingChange(index, 'amount', e.target.value)}
                                                disabled={!option.enabled && !isCustom}
                                            />
                                            <span className="absolute right-3 top-2 text-[10px] text-slate-400">INR</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2.5 text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-bold transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200 disabled:opacity-70"
                >
                    {isSubmitting ? 'Saving...' : 'Save Plan'}
                </button>
            </div>
        </form>
    );
};

export default PlanEditor;
