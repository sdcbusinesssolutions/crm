import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronLeftIcon, UsersIcon, CheckIcon, DoubleCheckIcon, EyeIcon, CloseIcon } from '../icons';
import Toast from '../Toast';

interface CampaignDetailsProps {
    campaignId: string;
    onBack: () => void;
    onRetarget: (data: { templateId: string, manualNumbers: string[], title: string }) => void;
}

const CampaignDetails: React.FC<CampaignDetailsProps> = ({ campaignId, onBack, onRetarget }) => {
    const [campaign, setCampaign] = useState<any>(null);
    const [queueItems, setQueueItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeTab, setActiveTab] = useState<'Queue' | 'Executed'>('Queue');

    // Polling Ref
    const pollInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        fetchCampaignDetails();
        fetchQueue();

        startPolling();

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopPolling();
            } else {
                startPolling();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [campaignId, page, statusFilter]);

    const startPolling = () => {
        stopPolling();
        pollInterval.current = setInterval(() => {
            if (!document.hidden) {
                fetchCampaignDetails(true);
                fetchQueue(true);
            }
        }, 5000);
    };

    const stopPolling = () => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
        }
    };

    const fetchCampaignDetails = async (silent = false) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`/api/campaigns/${campaignId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            const data = await response.json();
            setCampaign(data);
        } catch (error) {
            console.error('Error fetching details:', error);
        }
    };

    const fetchQueue = async (silent = false) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const query = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                status: statusFilter
            });

            const response = await fetch(`/api/campaigns/${campaignId}/queue?${query}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            const data = await response.json();
            setQueueItems(data.data || []);
            setTotalPages(data.totalPages || 1);
            if (!silent) setIsLoading(false);
        } catch (error) {
            console.error('Error fetching queue:', error);
            if (!silent) setIsLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`/api/campaigns/${campaignId}/export`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `campaign_${campaignId}_report.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export campaign report.');
        }
    };

    if (!campaign) return <div className="p-10 text-center">Loading Campaign...</div>;

    // Calculate percentages
    const total = campaign.stats?.total || 1; // Avoid division by zero
    const sent = campaign.stats?.sent || 0;
    const delivered = campaign.stats?.delivered || 0;
    const read = campaign.stats?.read || 0;
    const failed = campaign.stats?.failed || 0;
    const processing = campaign.stats?.processing || 0;
    const accepted = campaign.stats?.accepted || 0;

    const sentPct = Math.round((sent / total) * 100);
    const deliveredPct = Math.round((delivered / total) * 100);
    const readPct = Math.round((read / total) * 100);
    const failedPct = Math.round((failed / total) * 100);
    const processingPct = Math.round((processing / total) * 100);
    const acceptedPct = Math.round((accepted / total) * 100);

    const overallSuccess = sent + delivered + read;
    const overallSuccessPct = Math.round((overallSuccess / total) * 100);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">{campaign.title}</h1>
                        <div className="flex items-center gap-2 text-xs mt-1">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${campaign.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                campaign.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700' :
                                    'bg-yellow-100 text-yellow-700'
                                }`}>
                                {campaign.status}
                            </span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-500">Scheduled: {new Date(campaign.scheduled_at).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {campaign.status === 'PROCESSING' && (
                        <span className="flex items-center gap-2 text-xs text-blue-600 animate-pulse">
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                            Live Updates
                        </span>
                    )}
                    <button onClick={() => { fetchCampaignDetails(); fetchQueue(); }} className="text-sm text-slate-500 hover:text-brand-600 transition-colors">Refresh</button>

                    <button onClick={async () => {
                        try {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!session) return;

                            const query = new URLSearchParams({ status: statusFilter });
                            const res = await fetch(`/api/campaigns/${campaignId}/phones?${query}`, {
                                headers: { 'Authorization': `Bearer ${session.access_token}` }
                            });
                            const data = await res.json();

                            if (data.phones?.length) {
                                const cleanPhones = data.phones.map((p: string) => p.replace(/^\+/, ''));
                                await navigator.clipboard.writeText(cleanPhones.join(', '));
                                alert(`Copied ${cleanPhones.length} numbers to clipboard!`);
                            } else {
                                alert('No numbers found for current filter.');
                            }
                        } catch (e) {
                            console.error(e);
                            alert('Failed to copy numbers.');
                        }
                    }} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                        Copy Numbers
                    </button>

                    <button onClick={async () => {
                        try {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!session) return;

                            const query = new URLSearchParams({ status: statusFilter });
                            const res = await fetch(`/api/campaigns/${campaignId}/phones?${query}`, {
                                headers: { 'Authorization': `Bearer ${session.access_token}` }
                            });
                            const data = await res.json();

                            if (data.phones?.length) {
                                const cleanPhones = data.phones.map((p: string) => p.replace(/^\+/, ''));
                                onRetarget({
                                    templateId: campaign.template_id, // Use string template ID
                                    manualNumbers: cleanPhones,
                                    title: `Retarget: ${campaign.title} (${statusFilter === 'all' ? 'All' : statusFilter})`
                                });
                            } else {
                                alert('No numbers found for current filter.');
                            }
                        } catch (e) {
                            console.error(e);
                            alert('Failed to retarget.');
                        }
                    }} className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 transition-colors shadow-sm">
                        Retarget ({statusFilter === 'all' ? 'All' : statusFilter})
                    </button>

                    <button onClick={handleExport} className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm shadow-brand-200">
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8">

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Row 1 */}
                    {/* Total Contacts */}
                    <div className="bg-white p-5 rounded-xl border border-brand-200 shadow-sm relative overflow-hidden hover:border-brand-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Contacts</p>
                                <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{total}</h3>
                                <p className="text-xs text-slate-400 mt-1">All contacts in campaign</p>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-full text-blue-600">
                                <UsersIcon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Single Tick (Sent) */}
                    <div className="bg-white p-5 rounded-xl border border-brand-200 shadow-sm relative overflow-hidden hover:border-brand-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Single Tick</p>
                                <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{sentPct}%</h3>
                                <p className="text-xs text-slate-400 mt-1">{sent} Messages</p>
                            </div>
                            <div className="p-2 bg-green-50 rounded-full text-green-600">
                                <CheckIcon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Double Tick (Delivered) */}
                    <div className="bg-white p-5 rounded-xl border border-brand-200 shadow-sm relative overflow-hidden hover:border-brand-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Double Tick</p>
                                <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{deliveredPct}%</h3>
                                <p className="text-xs text-slate-400 mt-1">{delivered} Contacts</p>
                            </div>
                            <div className="p-2 bg-green-50 rounded-full text-green-600">
                                <DoubleCheckIcon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Unified Right Corner Card (Processing + Analytics) */}
                    <div className="lg:row-span-2 bg-white rounded-xl border border-brand-200 shadow-sm relative overflow-hidden hover:border-brand-300 transition-all duration-200 flex flex-col order-last lg:order-none">
                        {/* Top: Processing Section */}
                        <div className="p-5 border-b border-slate-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Current Processing</p>
                                    <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{processingPct}%</h3>
                                    <p className="text-xs text-slate-400 mt-1">{processing} Messages</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-full text-green-600">
                                    <span className="text-[10px] font-bold whitespace-nowrap">Live update</span>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Bottom: Analytics Section */}
                        <div className="p-5 flex-1 flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Analytics Overview</p>
                                <div className="p-1.5 bg-indigo-50 rounded-full text-indigo-600">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                                    </svg>
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-6">
                                {/* Pie Chart */}
                                <div className="relative w-28 h-28 rounded-full flex-shrink-0 shadow-inner" style={{
                                    background: `conic-gradient(
                                        #3b82f6 0% ${readPct}%, 
                                        #22c55e ${readPct}% ${readPct + deliveredPct}%, 
                                        #93c5fd ${readPct + deliveredPct}% ${readPct + deliveredPct + sentPct}%,
                                        #ef4444 ${readPct + deliveredPct + sentPct}% ${readPct + deliveredPct + sentPct + failedPct}%,
                                        #eab308 ${readPct + deliveredPct + sentPct + failedPct}% ${readPct + deliveredPct + sentPct + failedPct + processingPct}%,
                                        #f3f4f6 ${readPct + deliveredPct + sentPct + failedPct + processingPct}% 100%
                                    )`
                                }}>
                                    <div className="absolute inset-0 m-[15%] bg-white rounded-full flex items-center justify-center shadow-sm">
                                        <span className="text-xs font-bold text-slate-600">{overallSuccessPct}%</span>
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="w-full grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        <span className="text-slate-600">Read ({read})</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        <span className="text-slate-600">Deliv ({delivered})</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg">
                                        <span className="w-2 h-2 rounded-full bg-blue-300"></span>
                                        <span className="text-slate-600">Sent ({sent})</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                        <span className="text-slate-600">Fail ({failed})</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Read (Blue Tick) */}
                    <div className="bg-white p-5 rounded-xl border border-brand-200 shadow-sm relative overflow-hidden hover:border-brand-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Read</p>
                                <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{readPct}%</h3>
                                <p className="text-xs text-slate-400 mt-1">{read} Contacts</p>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-full text-blue-600">
                                <DoubleCheckIcon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Row 2 */}
                    {/* Meta Accepted */}
                    <div className="bg-white p-5 rounded-xl border border-brand-200 shadow-sm relative overflow-hidden hover:border-brand-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Meta Accepted</p>
                                <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{acceptedPct}%</h3>
                                <p className="text-xs text-slate-400 mt-1">{accepted} Messages</p>
                            </div>
                            <div className="p-2 bg-yellow-50 rounded-full text-yellow-600">
                                <CheckIcon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Failed */}
                    <div className="bg-white p-5 rounded-xl border border-brand-200 shadow-sm relative overflow-hidden hover:border-brand-300 transition-all duration-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Failed</p>
                                <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{failedPct}%</h3>
                                <p className="text-xs text-slate-400 mt-1">{failed} Contacts</p>
                            </div>
                            <div className="p-2 bg-red-50 rounded-full text-red-600">
                                <CloseIcon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Queue / List Section */}
                <div className="bg-white rounded-xl border border-brand-200 shadow-sm overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('Queue')}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'Queue' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Queue
                        </button>
                        <button
                            onClick={() => setActiveTab('Executed')}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'Executed' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            Executed
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="p-4 border-b border-slate-100 flex items-center gap-4">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="SENT">Sent</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="READ">Read</option>
                            <option value="FAILED">Failed</option>
                            <option value="ACCEPTED">Accepted</option>
                        </select>
                        <span className="text-xs text-slate-400">Showing {queueItems.length} items</span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Phone Number</th>
                                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Message Status</th>
                                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Last Update</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
                                ) : queueItems.length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No items found.</td></tr>
                                ) : (
                                    queueItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-3 text-sm font-medium text-slate-900">{item.contact_name}</td>
                                            <td className="px-6 py-3 text-sm text-slate-600 font-mono">{item.phone_number}</td>
                                            <td className="px-6 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${item.status === 'READ' ? 'bg-blue-100 text-blue-700' :
                                                    item.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                                                        item.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                                                            item.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                                                                item.status === 'ACCEPTED' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {item.status === 'READ' && <DoubleCheckIcon className="w-3 h-3 text-blue-600" />}
                                                    {item.status === 'DELIVERED' && <DoubleCheckIcon className="w-3 h-3 text-green-600" />}
                                                    {item.status === 'SENT' && <CheckIcon className="w-3 h-3" />}
                                                    {item.status === 'ACCEPTED' && <CheckIcon className="w-3 h-3" />}
                                                    {item.status}
                                                </span>
                                                {item.error_message && (
                                                    <p className="text-[10px] text-red-500 mt-1 max-w-xs truncate" title={item.error_message}>
                                                        {item.error_message}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-xs text-slate-500">
                                                {new Date(item.updated_at || item.created_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="px-3 py-1 bg-white border border-slate-300 rounded text-sm font-medium text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                        >
                            Previous
                        </button>
                        <span className="text-xs text-slate-500 font-medium">Page {page} of {totalPages}</span>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="px-3 py-1 bg-white border border-slate-300 rounded text-sm font-medium text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CampaignDetails;


