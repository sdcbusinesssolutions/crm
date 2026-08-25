import React, { useState, useEffect } from 'react';
import { superVideoGuideService, GlobalVideoGuide } from '../../../services/admin/superVideoGuideService';

const SuperVideoGuides: React.FC = () => {
    const [guides, setGuides] = useState<GlobalVideoGuide[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ module_name: '', video_url: '', is_active: true });
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchGuides();
    }, []);

    const fetchGuides = async () => {
        setIsLoading(true);
        const data = await superVideoGuideService.getGuides();
        setGuides(data);
        setIsLoading(false);
    };

    const handleOpenModal = (guide?: GlobalVideoGuide) => {
        if (guide) {
            setFormData({ module_name: guide.module_name, video_url: guide.video_url, is_active: guide.is_active });
        } else {
            setFormData({ module_name: '', video_url: '', is_active: true });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await superVideoGuideService.saveGuide(formData.module_name, formData.video_url, formData.is_active);
        await fetchGuides();
        setIsSaving(false);
        setIsModalOpen(false);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this global video guide?')) {
            await superVideoGuideService.deleteGuide(id);
            await fetchGuides();
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean) => {
        await superVideoGuideService.toggleActive(id, !currentStatus);
        await fetchGuides();
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Global Video Guides</h2>
                    <p className="text-slate-500 text-sm">Manage default YouTube video guides for modules. These defaults apply to all tenants unless overridden.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()} 
                    className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-btn font-bold text-sm shadow-sm"
                >
                    + Add Global Guide
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Module Name</th>
                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Default YouTube URL</th>
                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {isLoading ? (
                            <tr><td colSpan={3} className="text-center p-8 text-slate-500">Loading...</td></tr>
                        ) : guides.length === 0 ? (
                            <tr><td colSpan={3} className="text-center p-8 text-slate-500">No global video guides found.</td></tr>
                        ) : guides.map((guide) => (
                            <tr key={guide.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{guide.module_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                    {guide.video_url ? (
                                        <a href={guide.video_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{guide.video_url}</a>
                                    ) : (
                                        <span className="text-slate-400 italic">No URL</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <button 
                                        onClick={() => handleToggle(guide.id, guide.is_active)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${guide.is_active ? 'bg-brand-600' : 'bg-slate-300'}`}
                                        title={guide.is_active ? 'Disable' : 'Enable'}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${guide.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleOpenModal(guide)} className="text-slate-500 hover:text-brand-600 mr-4">Edit</button>
                                    <button onClick={() => handleDelete(guide.id)} className="text-rose-500 hover:text-rose-700">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Global Video Guide</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Module Name</label>
                                    <input 
                                        type="text" 
                                        value={formData.module_name}
                                        onChange={(e) => setFormData({...formData, module_name: e.target.value})}
                                        placeholder="e.g., Dashboard, Campaigns, Flow Builder"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">YouTube URL</label>
                                    <input 
                                        type="url" 
                                        value={formData.video_url}
                                        onChange={(e) => setFormData({...formData, video_url: e.target.value})}
                                        placeholder="https://www.youtube.com/watch?v=..."
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-bold text-slate-700">Active Status</label>
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, is_active: !formData.is_active})}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_active ? 'bg-brand-600' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-btn">Cancel</button>
                                    <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-bold text-white bg-brand-600 rounded-btn disabled:opacity-50">
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperVideoGuides;
