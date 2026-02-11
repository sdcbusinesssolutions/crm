import React, { useState, useEffect } from 'react';
import { dripCampaignService, DripCampaign } from '../../services/dripCampaignService';
import { format } from 'date-fns';
import {
    PlusIcon,
    TrashIcon,
    SearchIcon,
    FilterIcon,
    EditIcon,
    MenuIcon,
    TriggerIcon,
    PlayIcon,
    PauseIcon
} from '../icons';
import Modal from '../Modal';

interface DripListProps {
    onCreate: () => void;
    onEdit: (id: string) => void;
    onToggleSidebar: () => void;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const s = (status || '').toUpperCase();
    let colorClass = 'bg-slate-100 text-slate-500 border-slate-200';
    let dotClass = 'bg-slate-400';
    let label = status;

    if (s === 'ACTIVE') {
        colorClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
        dotClass = 'bg-emerald-500';
        label = 'Active';
    } else if (s === 'PAUSED') {
        colorClass = 'bg-amber-100 text-amber-700 border-amber-200';
        dotClass = 'bg-amber-500';
        label = 'Paused';
    } else if (s === 'DRAFT') {
        label = 'Draft';
    } else if (s === 'ARCHIVED') {
        colorClass = 'bg-gray-100 text-gray-700 border-gray-200';
        dotClass = 'bg-gray-500';
        label = 'Archived';
    }

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${colorClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotClass}`}></span>
            {label}
        </span>
    );
};

const StatusToggle: React.FC<{ status: string; onClick: (e: React.MouseEvent) => void }> = ({ status, onClick }) => {
    const isActive = status === 'ACTIVE';
    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
            title={isActive ? "Pause campaign" : "Activate campaign"}
        >
            <span className="sr-only">Toggle status</span>
            <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-4' : 'translate-x-0'}`}
            />
        </button>
    );
};

const DripList: React.FC<DripListProps> = ({ onCreate, onEdit, onToggleSidebar }) => {
    const [campaigns, setCampaigns] = useState<DripCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);

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

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setCampaignToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!campaignToDelete) return;

        try {
            await dripCampaignService.deleteCampaign(campaignToDelete);
            setCampaigns(prev => prev.filter(c => c.id !== campaignToDelete));
        } catch (error) {
            console.error('Failed to delete campaign', error);
            alert("Failed to delete campaign");
        } finally {
            setIsDeleteModalOpen(false);
            setCampaignToDelete(null);
        }
    };

    const handleToggleStatus = async (e: React.MouseEvent, campaign: DripCampaign) => {
        e.preventDefault();
        e.stopPropagation();

        const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

        // Optimistic update
        setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));

        try {
            await dripCampaignService.updateCampaign(campaign.id, { status: newStatus });
        } catch (error) {
            console.error('Failed to update status', error);
            // Revert
            setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: campaign.status } : c));
        }
    };

    const filteredCampaigns = campaigns.filter(campaign => {
        const term = searchTerm.toLowerCase().trim();

        // 1. Status Filter
        if (statusFilter !== 'All' && campaign.status !== statusFilter) {
            return false;
        }

        // 2. Search Filter
        if (!term) return true;

        const searchable = [
            campaign.name,
            campaign.description || '',
            campaign.trigger_type,
            campaign.status
        ].join(' ').toLowerCase();

        return searchable.includes(term);
    });

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredCampaigns.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);

    const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

    return (
        <div className="flex flex-col w-full h-full bg-canvas-bg font-sans text-canvas-text animate-fade-in relative overflow-hidden container-mobile-fix">
            {/* Header - Fixed to Top */}
            <div className="bg-canvas-surface/80 backdrop-blur-md border-b border-slate-200 shrink-0 z-30 sticky top-0">
                <div className="px-4 sm:px-8 py-6 max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            {onToggleSidebar && (
                                <button
                                    onClick={onToggleSidebar}
                                    className="lg:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <MenuIcon className="w-6 h-6" />
                                </button>
                            )}
                            <h1 className="text-2xl font-extrabold text-canvas-text tracking-tight">Drip Campaigns</h1>
                        </div>
                        <p className="text-slate-500 text-sm mt-1 font-medium hidden sm:block">Automated nurturing sequences to engage your leads.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button onClick={onCreate} className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-[var(--color-brand)] hover:opacity-90 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-200 transition-all transform hover:-translate-y-0.5 text-sm font-bold active:scale-95">
                            <PlusIcon /> <span>New Campaign</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-24">
                <div className="max-w-7xl mx-auto">
                    {/* Statistics Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        {(() => {
                            const stats = {
                                total: campaigns.length,
                                active: campaigns.filter(c => c.status === 'ACTIVE').length,
                                paused: campaigns.filter(c => c.status === 'PAUSED').length
                            };

                            return (
                                <>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Campaigns</div>
                                        <div className="text-2xl font-black text-slate-900">{stats.total}</div>
                                        <div className="text-xs text-slate-400 mt-1 font-medium">All sequences</div>
                                    </div>
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Active</div>
                                        <div className="text-2xl font-black text-emerald-700">{stats.active}</div>
                                        <div className="text-xs text-emerald-600 mt-1 font-medium">Running now</div>
                                    </div>
                                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Paused</div>
                                        <div className="text-2xl font-black text-amber-700">{stats.paused}</div>
                                        <div className="text-xs text-amber-600 mt-1 font-medium">Temporarily stopped</div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div className="relative w-full md:max-w-sm group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-600 group-focus-within:text-brand-600 transition-colors">
                                <SearchIcon />
                            </div>
                            <input
                                type="text"
                                placeholder="Search campaigns..."
                                className="pl-10 pr-4 py-3 w-full bg-white border border-brand-600 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 text-sm shadow-sm transition-all outline-none font-medium placeholder-slate-400"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                            {searchTerm && (
                                <span className="absolute right-3 top-3.5 text-xs text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                                    {filteredCampaigns.length} found
                                </span>
                            )}
                        </div>

                        <div className="relative w-full md:w-auto">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-600">
                                <FilterIcon />
                            </div>
                            <select
                                className="pl-9 pr-10 py-3 w-full md:w-48 bg-white border border-brand-600 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 text-sm shadow-sm appearance-none cursor-pointer font-bold text-slate-700 outline-none"
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="All">All Status</option>
                                <option value="ACTIVE">Active</option>
                                <option value="PAUSED">Paused</option>
                                <option value="DRAFT">Draft</option>
                                <option value="ARCHIVED">Archived</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-brand-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="min-h-[400px]">
                        {loading ? (
                            <div className="flex flex-col justify-center items-center h-64 text-slate-400 font-medium">
                                <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
                                Loading campaigns...
                            </div>
                        ) : filteredCampaigns.length === 0 ? (
                            <div className="text-center py-24 px-4 bg-white rounded-2xl border border-slate-200 border-dashed shadow-sm">
                                <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <TriggerIcon className="w-8 h-8 text-brand-300" />
                                </div>
                                <p className="text-slate-900 font-bold text-lg mb-2">No campaigns found</p>
                                <p className="text-slate-500 text-sm mb-8 max-w-xs mx-auto leading-relaxed">We couldn't find any campaigns matching your current search or filters.</p>
                                <button onClick={onCreate} className="text-brand-600 font-bold hover:text-brand-700 text-sm flex items-center justify-center mx-auto hover:underline">
                                    Create a new campaign <span className="ml-1">&rarr;</span>
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table View */}
                                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                    <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-[var(--color-brand)] text-white shadow-md">
                                            <tr>
                                                <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Name</th>
                                                <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Trigger</th>
                                                <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Steps</th>
                                                <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Status</th>
                                                <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Created</th>
                                                <th className="px-6 py-5 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {currentItems.map((campaign) => {
                                                const isActive = campaign.status === 'ACTIVE';

                                                return (
                                                    <tr
                                                        key={campaign.id}
                                                        className={`transition-all duration-200 group cursor-pointer ${isActive
                                                            ? 'bg-emerald-50/60 shadow-[inset_4px_0_0_0_#10b981]'
                                                            : 'bg-white hover:bg-slate-50 shadow-[inset_4px_0_0_0_transparent] hover:shadow-[inset_4px_0_0_0_#cbd5e1]'
                                                            }`}
                                                        onClick={() => onEdit(campaign.id)}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm mr-4 transition-transform group-hover:scale-110 border ${isActive
                                                                    ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                                                                    : 'bg-brand-50 text-brand-600 border-brand-100'
                                                                    }`}>
                                                                    <PlayIcon className="w-5 h-5" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-slate-800">{campaign.name}</span>
                                                                    <span className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{campaign.description || 'No description'}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                                                                {campaign.trigger_type}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="text-sm font-bold text-slate-700">{campaign.steps?.length || 0}</span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <StatusBadge status={campaign.status} />
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                                                            {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <div className="flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center space-x-2 mr-4 border-r border-slate-200 pr-4">
                                                                    <StatusToggle
                                                                        status={campaign.status}
                                                                        onClick={(e) => handleToggleStatus(e, campaign)}
                                                                    />
                                                                </div>
                                                                <button onClick={() => onEdit(campaign.id)} className="p-2 rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-colors" title="Edit">
                                                                    <EditIcon className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={(e) => handleDeleteClick(e, campaign.id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden grid grid-cols-1 gap-4">
                                    {currentItems.map((campaign) => {
                                        const isActive = campaign.status === 'ACTIVE';
                                        return (
                                            <div
                                                key={campaign.id}
                                                onClick={() => onEdit(campaign.id)}
                                                className={`rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all active:scale-[0.99] relative overflow-hidden group ${isActive
                                                    ? 'bg-emerald-50 border-emerald-200/60 shadow-[inset_4px_0_0_0_#10b981]'
                                                    : 'bg-white border-slate-200 shadow-[inset_4px_0_0_0_transparent]'
                                                    }`}
                                            >
                                                <div className="pl-2">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${isActive
                                                                ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                                                                : 'bg-brand-50 text-brand-600 border-brand-100'
                                                                }`}>
                                                                {isActive ? <PlayIcon className="w-5 h-5" /> : <PauseIcon className="w-5 h-5" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h3 className="font-bold text-slate-900 text-lg leading-tight truncate">{campaign.name}</h3>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">{format(new Date(campaign.created_at), 'MMM d, yyyy')}</p>
                                                            </div>
                                                        </div>
                                                        <StatusBadge status={campaign.status} />
                                                    </div>

                                                    <p className="text-sm text-slate-500 mb-4 line-clamp-2 font-medium leading-relaxed">
                                                        {campaign.description || 'No description provided'}
                                                    </p>

                                                    <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">{campaign.trigger_type}</span>
                                                        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">{campaign.steps?.length || 0} Steps</span>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center gap-3">
                                                            <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                                                                <StatusToggle status={campaign.status} onClick={(e) => handleToggleStatus(e, campaign)} />
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1">
                                                            <button onClick={(e) => handleDeleteClick(e, campaign.id)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                            <button onClick={() => onEdit(campaign.id)} className="ml-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-md active:scale-95 transition-all flex items-center gap-1">
                                                                Manage Steps
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-8 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => paginate(currentPage - 1)}
                                disabled={currentPage === 1}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${currentPage === 1
                                    ? 'text-slate-300 cursor-not-allowed bg-slate-50'
                                    : 'text-slate-600 hover:text-brand-600 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-200'
                                    }`}
                            >
                                Previous
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                                    <button
                                        key={number}
                                        onClick={() => paginate(number)}
                                        className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${currentPage === number
                                            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                                            : 'text-slate-500 hover:text-brand-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        {number}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => paginate(currentPage + 1)}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${currentPage === totalPages || totalPages === 0
                                    ? 'text-slate-300 cursor-not-allowed bg-slate-50'
                                    : 'text-slate-600 hover:text-brand-600 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-200'
                                    }`}
                            >
                                Next
                            </button>
                        </div>

                        <span className="text-xs font-medium text-slate-400">
                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredCampaigns.length)} of {filteredCampaigns.length} campaigns
                        </span>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Delete Campaign"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="px-4 py-2 text-sm font-bold text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-md shadow-red-500/30 transition-all active:scale-95"
                        >
                            Delete Campaign
                        </button>
                    </div>
                }
            >
                <div className="flex flex-col gap-4">
                    <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex items-start gap-3">
                        <div className="p-2 bg-white rounded-full text-red-500 shrink-0">
                            <TrashIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-red-800 mb-1">Warning</h4>
                            <p className="text-xs text-red-600 leading-relaxed">
                                You are about to permanently delete this drip campaign. This will top all running enrollments immediately.
                            </p>
                        </div>
                    </div>
                    <p className="text-slate-600 font-medium text-sm">
                        Are you sure you want to delete this campaign?
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default DripList;
