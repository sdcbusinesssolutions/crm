
import React, { useState, useRef, useEffect } from 'react';
import { themeService, PRESETS } from '../services/themeService';
import { ThemeConfig } from '../types';

import { UploadIcon, BadgeIcon, SparklesIcon, CheckSquareIcon } from './icons';

const GlobalSettings: React.FC = () => {
    const [theme, setTheme] = useState<ThemeConfig>(PRESETS[0]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const nameImageInputRef = useRef<HTMLInputElement>(null);

    const mounted = useRef(false);

    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;

        const loadTheme = async () => {
            const loadedTheme = await themeService.getTheme();
            setTheme(loadedTheme);
        };
        loadTheme();
    }, []);

    const updateTheme = async (updates: Partial<ThemeConfig>) => {
        const newTheme = { ...theme, ...updates };
        setTheme(newTheme);
        await themeService.saveTheme(newTheme);
    };

    const handleColorChange = async (key: keyof ThemeConfig['colors'], value: string) => {
        const newTheme = {
            ...theme,
            id: 'custom',
            name: 'Custom Theme',
            colors: { ...theme.colors, [key]: value }
        };
        setTheme(newTheme);
        await themeService.saveTheme(newTheme);
    };

    const handlePresetSelect = async (presetId: string) => {
        const preset = PRESETS.find(p => p.id === presetId);
        if (preset) {
            // Persist user customization (logo, name, button style) when switching color presets
            const newTheme = {
                ...preset,
                logoUrl: theme.logoUrl,
                appName: theme.appName,
                buttonStyle: theme.buttonStyle,
                sidebarDisplay: theme.sidebarDisplay
            };
            setTheme(newTheme);
            await themeService.saveTheme(newTheme);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate File Type
            if (!file.type.startsWith('image/')) {
                alert('Please upload a valid image file');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                // Validate Dimensions
                const img = new Image();
                img.onload = () => {
                    const width = img.width;
                    const height = img.height;

                    // Strict Square Ratio Validation
                    if (width !== height) {
                        alert(`Image must be square (Equal Width and Height). \nCurrent dimensions: ${width}x${height}px.\n\nRecommended size: 512x512px.`);
                        return;
                    }

                    // Optional: Min/Max size validation if strictly requested
                    // For now, enforcing square ratio is usually sufficient for "that size" context

                    updateTheme({ logoUrl: event.target?.result as string });
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleNameImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Please upload a valid image file');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const width = img.width;
                    const height = img.height;

                    // Validation: Must be Landscape (Width > Height)
                    if (width <= height) {
                        alert(`Application Name image must be horizontal/landscape (Width > Height).\nCurrent: ${width}x${height}px.`);
                        return;
                    }

                    // Validation: Aspect Ratio (e.g., at least 2:1 recommended, but let's enforce > 1.2 for some flexibility)
                    const ratio = width / height;
                    if (ratio < 1.5) {
                        alert(`Image is not wide enough. Recommended aspect ratio is 4:1 (e.g., 200x50px).\nCurrent ratio: ${ratio.toFixed(2)}:1`);
                        return;
                    }

                    updateTheme({ appNameImageUrl: event.target?.result as string });
                };
                img.src = event.target?.result as string;
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
                                <p className="text-slate-500 text-sm mt-1">Set your application name and company logo. <br /><span className="text-orange-600 font-bold">Recommended Logo: 512x512px (Square)</span></p>
                            </div>
                            <div className="p-8 space-y-8">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Application Name</label>

                                    {/* App Name Source Toggle */}
                                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-max mb-3">
                                        <button
                                            onClick={() => updateTheme({ appNameType: 'text' })}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${theme.appNameType !== 'image' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Text
                                        </button>
                                        <button
                                            onClick={() => updateTheme({ appNameType: 'image' })}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${theme.appNameType === 'image' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Image
                                        </button>
                                    </div>

                                    {/* Conditional Input */}
                                    {theme.appNameType === 'image' ? (
                                        <div className="space-y-3">
                                            <div className="w-full h-16 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center relative overflow-hidden group hover:border-brand-400 transition-colors">
                                                {theme.appNameImageUrl ? (
                                                    <img src={theme.appNameImageUrl} alt="App Name" className="h-full object-contain p-2" />
                                                ) : (
                                                    <span className="text-slate-400 text-sm font-medium">No Image Uploaded</span>
                                                )}
                                                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer" onClick={() => nameImageInputRef.current?.click()}>
                                                    <div className="bg-white px-3 py-1.5 rounded-lg shadow-sm text-xs font-bold text-slate-700">Change</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <input type="file" ref={nameImageInputRef} className="hidden" accept="image/*" onChange={handleNameImageUpload} />
                                                <button onClick={() => nameImageInputRef.current?.click()} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-slate-800 transition-all flex items-center gap-2">
                                                    <UploadIcon className="w-3 h-3" /> Upload Image
                                                </button>
                                                {theme.appNameImageUrl && (
                                                    <button onClick={() => updateTheme({ appNameImageUrl: undefined })} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold shadow-sm hover:text-red-600 hover:border-red-200 transition-all">
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-sm text-orange-600 font-bold">Recommended: Rectangular image, approx 200x50px.</p>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={theme.appName ?? ''}
                                            onChange={(e) => updateTheme({ appName: e.target.value })}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder-slate-300"
                                            placeholder="Application Name"
                                        />
                                    )}
                                </div>
                                <div className="border-t border-slate-100 my-2"></div>
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

                                {/* Sidebar Header Display */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sidebar Display Preference</label>
                                    <div className="flex gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 max-w-md">
                                        {[
                                            { id: 'both', label: 'Show Both' },
                                            { id: 'logo_only', label: 'Logo Only' },
                                            { id: 'name_only', label: 'Name Only' }
                                        ].map((option) => (
                                            <button
                                                key={option.id}
                                                onClick={() => updateTheme({ sidebarDisplay: option.id as any })}
                                                className={`flex-1 py-2.5 text-xs font-bold transition-all shadow-sm rounded-xl ${theme.sidebarDisplay === option.id || (!theme.sidebarDisplay && option.id === 'both')
                                                    ? 'bg-white text-brand-600 ring-1 ring-slate-200 shadow-md'
                                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 shadow-none'
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">Choose what to display in the sidebar header.</p>
                                </div>
                            </div>
                        </div>


                        {/* Interface Style */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-8 py-6 border-b border-slate-100 bg-white">
                                <h3 className="text-lg font-bold text-slate-900">Interface Style</h3>
                                <p className="text-slate-500 text-sm mt-1">Customize button shapes and sidebar appearance.</p>
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Button Shape */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Button Shape</label>
                                        <div className="flex gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                            {['rounded', 'sharp', 'pill'].map((style) => (
                                                <button
                                                    key={style}
                                                    onClick={() => updateTheme({ buttonStyle: style as any })}
                                                    className={`flex-1 py-2.5 text-sm font-bold transition-all shadow-sm ${style === 'rounded' ? 'rounded-xl' : style === 'pill' ? 'rounded-full' : 'rounded-md'
                                                        } ${theme.buttonStyle === style
                                                            ? 'bg-white text-brand-600 ring-1 ring-slate-200 shadow-md'
                                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 shadow-none'
                                                        }`}
                                                >
                                                    {style.charAt(0).toUpperCase() + style.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

                        {/* File Upload Settings */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-8 py-6 border-b border-slate-100 bg-white">
                                <h3 className="text-lg font-bold text-slate-900">File Uploads</h3>
                                <p className="text-slate-500 text-sm mt-1">Configure limits for media uploads.</p>
                            </div>
                            <div className="p-8 space-y-8">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Max Video/Audio Size (MB)</label>
                                    <input
                                        type="number"
                                        value={theme.maxFileSize ?? 16}
                                        onChange={(e) => updateTheme({ maxFileSize: parseInt(e.target.value) || 16 })}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder-slate-300"
                                        placeholder="16"
                                    />
                                    <p className="text-xs text-slate-400 mt-2">Files larger than this limit will show a warning popup.</p>
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
                                            className={`relative p-3 rounded-xl border-2 text-left transition-all duration-200 group flex items-center gap-4 ${isActive
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
        </div >
    );
};

export default GlobalSettings;
