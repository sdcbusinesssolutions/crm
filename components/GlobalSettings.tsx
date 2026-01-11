
import React, { useState, useRef } from 'react';
import { themeService, PRESETS } from '../services/themeService';
import { ThemeConfig } from '../types';
import { UploadIcon, BadgeIcon, SparklesIcon, CheckSquareIcon } from './icons';

const GlobalSettings: React.FC = () => {
    const [theme, setTheme] = useState<ThemeConfig>(themeService.getTheme());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const updateTheme = (updates: Partial<ThemeConfig>) => {
        const newTheme = { ...theme, ...updates };
        setTheme(newTheme);
        themeService.saveTheme(newTheme);
    };

    const handleColorChange = (key: keyof ThemeConfig['colors'], value: string) => {
        const newTheme = {
            ...theme,
            id: 'custom',
            name: 'Custom Theme',
            colors: { ...theme.colors, [key]: value }
        };
        setTheme(newTheme);
        themeService.saveTheme(newTheme);
    };

    const handlePresetSelect = (presetId: string) => {
        const preset = PRESETS.find(p => p.id === presetId);
        if (preset) {
            // Persist user customization (logo, name, button style) when switching color presets
            const newTheme = { 
                ...preset, 
                logoUrl: theme.logoUrl,
                appName: theme.appName,
                buttonStyle: theme.buttonStyle 
            };
            setTheme(newTheme);
            themeService.saveTheme(newTheme);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                updateTheme({ logoUrl: event.target?.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-slate-50/50">
            <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
                        <p className="text-slate-500 mt-2 text-lg font-medium">Manage branding, appearance, and workspace preferences.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Left Column: Configuration */}
                    <div className="xl:col-span-2 space-y-8">
                        
                        {/* Brand Identity */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-8 py-6 border-b border-slate-100 bg-white">
                                <h3 className="text-lg font-bold text-slate-900">Brand Identity</h3>
                                <p className="text-slate-500 text-sm mt-1">Set your application name and company logo.</p>
                            </div>
                            <div className="p-8 space-y-8">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Application Name</label>
                                    <input 
                                        type="text" 
                                        value={theme.appName ?? ''}
                                        onChange={(e) => updateTheme({ appName: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder-slate-300"
                                        placeholder="UpShpoi"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Company Logo</label>
                                    <div className="flex items-center gap-6">
                                        <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group hover:border-brand-400 transition-colors">
                                            {theme.logoUrl ? (
                                                <img src={theme.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                                            ) : (
                                                <span className="text-slate-300 font-bold">Logo</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                            <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2 transform active:scale-95">
                                                <UploadIcon className="w-4 h-4" /> Upload New
                                            </button>
                                            {theme.logoUrl && (
                                                <button onClick={() => updateTheme({ logoUrl: undefined })} className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-600 rounded-xl text-sm font-bold shadow-sm transition-all">
                                                    Remove Logo
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Interface Style */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-8 py-6 border-b border-slate-100 bg-white">
                                <h3 className="text-lg font-bold text-slate-900">Interface Style</h3>
                                <p className="text-slate-500 text-sm mt-1">Customize button shapes and accent colors.</p>
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Button Shape</label>
                                        <div className="flex gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                            {['rounded', 'sharp', 'pill'].map((style) => (
                                                <button
                                                    key={style}
                                                    onClick={() => updateTheme({ buttonStyle: style as any })}
                                                    className={`flex-1 py-2.5 text-sm font-bold transition-all shadow-sm ${
                                                        style === 'rounded' ? 'rounded-xl' : style === 'pill' ? 'rounded-full' : 'rounded-md'
                                                    } ${
                                                        theme.buttonStyle === style 
                                                            ? 'bg-white text-brand-600 ring-1 ring-slate-200 shadow-md' 
                                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 shadow-none'
                                                    }`}
                                                >
                                                    {style.charAt(0).toUpperCase() + style.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Primary Color Hex</label>
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-sm border border-slate-200 shrink-0 ring-2 ring-offset-2 ring-slate-50">
                                                <input 
                                                    type="color" 
                                                    value={theme.colors.brand} 
                                                    onChange={(e) => handleColorChange('brand', e.target.value)}
                                                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
                                                />
                                            </div>
                                            <input 
                                                type="text" 
                                                value={theme.colors.brand}
                                                onChange={(e) => handleColorChange('brand', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-brand-500 outline-none text-slate-700 uppercase"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Theme Presets */}
                    <div className="xl:col-span-1 space-y-8">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
                            <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5 text-brand-500" />
                                <h3 className="text-lg font-bold text-slate-900">Color Themes</h3>
                            </div>
                            <div className="p-6 grid grid-cols-1 gap-4">
                                {PRESETS.map(preset => {
                                    const isActive = (theme.id === preset.id || (theme.id === 'custom' && theme.colors.brand === preset.colors.brand));
                                    return (
                                        <button
                                            key={preset.id}
                                            onClick={() => handlePresetSelect(preset.id)}
                                            className={`relative p-3 rounded-xl border-2 text-left transition-all duration-200 group flex items-center gap-4 ${
                                                isActive
                                                    ? 'border-brand-500 bg-brand-50/30 ring-1 ring-brand-500' 
                                                    : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {/* Mini UI Mockup */}
                                            <div className="w-16 h-12 rounded-lg shadow-sm border border-slate-200 flex overflow-hidden bg-white shrink-0">
                                                {/* Sidebar Mock */}
                                                <div className="w-5 h-full" style={{ backgroundColor: preset.colors.surface }}>
                                                    <div className="w-3 h-3 mx-auto mt-1.5 rounded-full opacity-20" style={{ backgroundColor: preset.colors.text }}></div>
                                                    <div className="w-3 h-1.5 mx-auto mt-1 rounded-sm opacity-10" style={{ backgroundColor: preset.colors.text }}></div>
                                                </div>
                                                {/* Body Mock */}
                                                <div className="flex-1 bg-slate-50 p-1.5">
                                                    <div className="w-6 h-2 rounded-full" style={{ backgroundColor: preset.colors.brand }}></div>
                                                    <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1 opacity-50"></div>
                                                </div>
                                            </div>

                                            <div className="flex-1">
                                                <h4 className={`font-bold text-sm ${isActive ? 'text-brand-700' : 'text-slate-700'}`}>{preset.name}</h4>
                                                {isActive && <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Active</span>}
                                            </div>

                                            {isActive && <div className="text-brand-600"><CheckSquareIcon className="w-5 h-5" /></div>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalSettings;
