import React, { useState, useEffect } from 'react';
import { PlusIcon, SearchIcon, EyeIcon } from '../icons';
import { supabase } from '../../lib/supabase';

interface Campaign {
    id: string;
    title: string;
    template_name: string;
    total_contacts: number;
    created_at: string;
    scheduled_at: string;
    status: string;
}

interface CampaignListProps {
    onCreate: () => void;
    onSelect: (id: string) => void;
}

const CampaignList: React.FC<CampaignListProps> = ({ onCreate, onSelect }) => {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'Active' | 'Archive'>('Active');

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch('/api/campaigns', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch campaigns');

            const data = await response.json();
            setCampaigns(data || []);
        } catch (error) {
            console.error('Error fetching campaigns:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    const filteredCampaigns = campaigns.filter(c => {
        const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase());
        const isArchive = c.status === 'COMPLETED' || c.status === 'ARCHIVED';
        if (activeTab === 'Active') return matchesSearch && c.status !== 'ARCHIVED';
        return matchesSearch && c.status === 'ARCHIVED';
    });

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab]);

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCampaigns = filteredCampaigns.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);

    return (
        <div className="flex-1 h-full overflow-y-auto custom-scrollbar p-6 md:p-10 bg-[var(--color-bg)] transition-colors duration-300">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 animate-fade-in">
                    <div>
                        <h1 className="text-4xl font-extrabold text-[var(--color-text)] tracking-tight">Campaigns</h1>
                        <p className="text-[var(--color-text)] opacity-60 mt-2 text-lg font-medium">Manage and monitor your WhatsApp marketing campaigns.</p>
                    </div>
                    <button
                        onClick={onCreate}
                        className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-[var(--radius-btn)] text-sm font-bold shadow-lg shadow-brand-200 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Create New Campaign
                    </button>
                </div>

                {/* Controls Section */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[var(--color-surface)] p-2 rounded-[var(--radius-btn)] shadow-sm border border-[var(--color-border)]">
                    {/* Tabs */}
                    <div className="flex p-1 bg-[var(--color-bg)] rounded-[var(--radius-btn)]">
                        <button
                            onClick={() => setActiveTab('Active')}
                            className={`px-6 py-2 text-sm font-bold rounded-[calc(var(--radius-btn)-4px)] transition-all ${activeTab === 'Active' ? 'bg-[var(--color-surface)] text-[var(--color-brand)] shadow-sm' : 'text-[var(--color-text)] opacity-60 hover:opacity-100'}`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setActiveTab('Archive')}
                            className={`px-6 py-2 text-sm font-bold rounded-[calc(var(--radius-btn)-4px)] transition-all ${activeTab === 'Archive' ? 'bg-[var(--color-surface)] text-[var(--color-brand)] shadow-sm' : 'text-[var(--color-text)] opacity-60 hover:opacity-100'}`}
                        >
                            Archive
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative w-full md:w-96">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand)]" />
                        <input
                            type="text"
                            placeholder="Search campaigns..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg)] border border-[var(--color-brand)] rounded-[var(--radius-btn)] text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/50 transition-all placeholder-[var(--color-text)]/30 shadow-sm"
                        />
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-[var(--color-surface)] rounded-[var(--radius-btn)] shadow-xl border border-[var(--color-border)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-brand-600 text-white shadow-md">
                                <tr className="bg-brand-600 border-none">
                                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Title</th>
                                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Template</th>
                                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Audience</th>
                                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Schedule</th>
                                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Status</th>
                                    <th className="px-6 py-5 text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {isLoading ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text)] opacity-50 animate-pulse">Loading campaigns...</td></tr>
                                ) : currentCampaigns.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-16 text-center">
                                            <div className="flex flex-col items-center justify-center text-[var(--color-text)] opacity-40">
                                                <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                <p className="text-lg font-medium">No campaigns found</p>
                                                <p className="text-sm mt-1">Create your first campaign to get started.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    currentCampaigns.map((campaign) => (
                                        <tr key={campaign.id} className="group hover:bg-[var(--color-bg)] transition-colors duration-200">
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-[var(--color-text)]">{campaign.title}</span>
                                                    <span className="text-xs text-[var(--color-text)] opacity-40 mt-0.5">Created {new Date(campaign.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-sm text-[var(--color-text)] opacity-70">{campaign.template_name}</td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2.5 py-1 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text)]">
                                                        {campaign.total_contacts} Contacts
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-sm text-[var(--color-text)] opacity-70">
                                                {new Date(campaign.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${campaign.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    campaign.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        campaign.status === 'PAUSED' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                            'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-2 ${campaign.status === 'COMPLETED' ? 'bg-green-500' :
                                                        campaign.status === 'FAILED' ? 'bg-red-500' :
                                                            campaign.status === 'PAUSED' ? 'bg-yellow-500' :
                                                                'bg-blue-500 animate-pulse'
                                                        }`}></span>
                                                    {campaign.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => onSelect(campaign.id)}
                                                        className="px-3 py-1.5 bg-[var(--color-brand)] text-white text-xs font-bold rounded-[var(--radius-btn)] hover:opacity-90 transition-all shadow-sm flex items-center gap-1"
                                                    >
                                                        <EyeIcon className="w-3 h-3" />
                                                        View
                                                    </button>
                                                    <button className="px-3 py-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold rounded-[var(--radius-btn)] hover:bg-[var(--color-surface)] transition-all">
                                                        Archive
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
                            <div className="text-sm text-[var(--color-text)] opacity-60">
                                Showing <span className="font-bold">{indexOfFirstItem + 1}</span> to <span className="font-bold">{Math.min(indexOfLastItem, filteredCampaigns.length)}</span> of <span className="font-bold">{filteredCampaigns.length}</span> results
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 text-sm border border-[var(--color-border)] rounded-[var(--radius-btn)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text)]"
                                >
                                    Previous
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                                    <button
                                        key={number}
                                        onClick={() => setCurrentPage(number)}
                                        className={`px-3 py-1 text-sm border rounded-[var(--radius-btn)] ${currentPage === number ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]' : 'border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text)]'}`}
                                    >
                                        {number}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 text-sm border border-[var(--color-border)] rounded-[var(--radius-btn)] hover:bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text)]"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CampaignList;
