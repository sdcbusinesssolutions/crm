import React, { useState, useEffect } from 'react';
import { dripCampaignService, DripCampaign } from '../../services/dripCampaignService';
import { format } from 'date-fns';

interface DripListProps {
    onCreate: () => void;
    onEdit: (id: string) => void;
    onToggleSidebar: () => void;
}

const DripList: React.FC<DripListProps> = ({ onCreate, onEdit, onToggleSidebar }) => {
    const [campaigns, setCampaigns] = useState<DripCampaign[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCampaigns();
    }, []);

    const loadCampaigns = async () => {
        setLoading(true);
        try {
            const data = await dripCampaignService.getCampaigns();
            setCampaigns(data);
        } catch (error) {
            console.error('Failed to load campaigns', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this campaign?')) return;
        try {
            await dripCampaignService.deleteCampaign(id);
            setCampaigns(campaigns.filter(c => c.id !== id));
        } catch (error) {
            console.error('Failed to delete campaign', error);
        }
    };

    const handleToggleStatus = async (campaign: DripCampaign) => {
        const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        try {
            const updated = await dripCampaignService.updateCampaign(campaign.id, { status: newStatus });
            setCampaigns(campaigns.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));
        } catch (error) {
            console.error('Failed to update status', error);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading campaigns...</div>;
    }

    if (campaigns.length === 0) {
        return (
            <div className="h-full flex flex-col p-4 md:p-8">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <button onClick={onToggleSidebar} className="lg:hidden p-2 hover:bg-slate-200 rounded-lg">
                            <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <h1 className="text-2xl font-bold text-slate-800">Drip Campaigns</h1>
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center p-8">
                    <div className="bg-brand-50 rounded-full p-4 mb-4">
                        <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                    <p className="text-slate-500 text-lg font-medium mb-2">No campaigns yet</p>
                    <p className="text-slate-400 text-sm mb-6 max-w-sm text-center">Create automated drip sequences to engage your leads over time.</p>
                    <button
                        onClick={onCreate}
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg shadow hover:bg-brand-700 transition font-medium"
                    >
                        Create Your First Campaign
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-4 md:p-8 bg-slate-50 container-mobile-fix">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onToggleSidebar} className="lg:hidden p-2 hover:bg-slate-200 rounded-lg">
                        <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h1 className="text-2xl font-bold text-slate-800">Drip Campaigns</h1>
                </div>
                <button
                    onClick={onCreate}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg shadow hover:bg-brand-700 transition"
                >
                    + New Campaign
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map(campaign => (
                    <div key={campaign.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-1">{campaign.name}</h3>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                            campaign.status === 'PAUSED' ? 'bg-amber-100 text-amber-700' :
                                                'bg-slate-100 text-slate-600'
                                        }`}>
                                        {campaign.status}
                                    </span>
                                    <span className="text-slate-400">• Created {format(new Date(campaign.created_at), 'MMM d, yyyy')}</span>
                                </div>
                            </div>
                            <div className="relative group">
                                <button className="p-1 text-slate-400 hover:text-slate-600 rounded">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                    </svg>
                                </button>
                                <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-slate-100 hidden group-hover:block z-10 py-1">
                                    <button
                                        onClick={() => handleToggleStatus(campaign)}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                                    >
                                        {campaign.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(campaign.id)}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>

                        <p className="text-slate-500 text-sm mb-4 line-clamp-2 min-h-[40px]">
                            {campaign.description || 'No description provided.'}
                        </p>

                        <div className="mt-auto border-t border-slate-100 pt-4 flex justify-between items-center text-sm">
                            <div className="flex gap-4">
                                <div>
                                    <span className="block font-bold text-slate-800">{campaign.enrollment_count || 0}</span>
                                    <span className="text-slate-400 text-xs">Enrolled</span>
                                </div>
                                <div>
                                    <span className="block font-bold text-slate-800">{campaign.steps?.length || 0}</span>
                                    <span className="text-slate-400 text-xs">Steps</span>
                                </div>
                            </div>
                            <button
                                onClick={() => onEdit(campaign.id)}
                                className="px-3 py-1.5 border border-brand-200 text-brand-600 rounded-lg hover:bg-brand-50 font-medium text-sm transition"
                            >
                                Edit / Manage
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DripList;
