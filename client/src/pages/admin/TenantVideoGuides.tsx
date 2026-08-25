import React, { useState, useEffect } from 'react';
import { tenantVideoGuideService, TenantVideoGuide } from '../../services/admin/tenantVideoGuideService';

const TenantVideoGuides: React.FC = () => {
    const [guides, setGuides] = useState<TenantVideoGuide[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingModule, setEditingModule] = useState<string | null>(null);
    const [overrideUrl, setOverrideUrl] = useState('');

    useEffect(() => {
        fetchGuides();
    }, []);

    const fetchGuides = async () => {
        setIsLoading(true);
        const data = await tenantVideoGuideService.getGuides();
        setGuides(data);
        setIsLoading(false);
    };

    const handleEdit = (guide: TenantVideoGuide) => {
        setEditingModule(guide.module_name);
        setOverrideUrl(guide.override_video_url || '');
    };

    const handleSave = async (module_name: string) => {
        setIsSaving(true);
        if (overrideUrl.trim() === '') {
            // Remove override if empty
            await tenantVideoGuideService.removeOverride(module_name);
        } else {
            await tenantVideoGuideService.saveOverride(module_name, overrideUrl);
        }
        await fetchGuides();
        setEditingModule(null);
        setIsSaving(false);
    };

    const handleRevert = async (module_name: string) => {
        if (window.confirm('Are you sure you want to remove your custom video and revert to the global default?')) {
            await tenantVideoGuideService.removeOverride(module_name);
            await fetchGuides();
        }
    };

    return (
        <div className="p-8">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Custom Video Guides</h2>
                <p className="text-slate-500 text-sm">Customize the video tutorials your users see. If left empty, they will see the system default video.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Module</th>
                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 w-1/2">Video URL</th>
                            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {isLoading ? (
                            <tr><td colSpan={3} className="text-center p-8 text-slate-500">Loading...</td></tr>
                        ) : guides.length === 0 ? (
                            <tr><td colSpan={3} className="text-center p-8 text-slate-500">No modules available to customize yet.</td></tr>
                        ) : guides.map((guide) => (
                            <tr key={guide.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{guide.module_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {editingModule === guide.module_name ? (
                                        <input 
                                            type="url"
                                            value={overrideUrl}
                                            onChange={(e) => setOverrideUrl(e.target.value)}
                                            placeholder="https://youtube.com/..."
                                            className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-brand-500 outline-none"
                                            autoFocus
                                        />
                                    ) : guide.has_override ? (
                                        <span className="text-brand-600 font-medium inline-flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            Custom Video Set
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 italic">Using System Default</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {editingModule === guide.module_name ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => setEditingModule(null)} className="text-slate-500 hover:text-slate-700">Cancel</button>
                                            <button onClick={() => handleSave(guide.module_name)} disabled={isSaving} className="text-white bg-brand-600 px-3 py-1 rounded disabled:opacity-50">Save</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-end gap-3">
                                            {guide.has_override && (
                                                <button onClick={() => handleRevert(guide.module_name)} className="text-rose-500 hover:text-rose-700" title="Revert to system default">Reset to Default</button>
                                            )}
                                            <button onClick={() => handleEdit(guide)} className="text-slate-500 hover:text-brand-600 font-bold bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded">
                                                {guide.has_override ? 'Edit' : 'Customize'}
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TenantVideoGuides;
