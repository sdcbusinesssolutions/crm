import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronLeftIcon, CheckIcon, DoubleCheckIcon, CloseIcon } from '../icons';

interface SheetAutomationReportProps {
    automationId: string;
    automationName: string;
    onBack: () => void;
}

const SheetAutomationReport: React.FC<SheetAutomationReportProps> = ({ automationId, automationName, onBack }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    useEffect(() => {
        fetchHistory();
    }, [automationId, page]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const query = new URLSearchParams({
                page: page.toString(),
                limit: '20'
            });

            const response = await fetch(`/api/sheet-automations/${automationId}/report-json?${query}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            
            const data = await response.json();
            setHistory(data.data || []);
            setTotalPages(data.totalPages || 1);
            setTotalRecords(data.total || 0);
        } catch (error) {
            console.error('Error fetching report:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatIST = (utcString: string) => {
        if (!utcString) return '-';
        try {
            const dt = new Date(utcString);
            return dt.toLocaleString('en-IN', { 
                timeZone: 'Asia/Kolkata', 
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit', second: '2-digit', 
                hour12: true 
            });
        } catch {
            return utcString;
        }
    };

    const formatRowData = (meta: any) => {
        if (!meta || !meta.row_data) return '-';
        return JSON.stringify(meta.row_data);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Report: {automationName}</h1>
                        <p className="text-xs text-slate-500 mt-1">Automation Execution History</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => fetchHistory()} className="text-sm text-slate-500 hover:text-brand-600 transition-colors">Refresh</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                
                {/* Info Bar */}
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-600 font-medium">
                        Showing {history.length} records on this page
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                        Total Recorded Events: {totalRecords}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-brand-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Date & Time (IST)</th>
                                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Phone Number</th>
                                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Row Data</th>
                                    <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading Report Data...</td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No execution history found for this automation.</td></tr>
                                ) : (
                                    history.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900 whitespace-nowrap">
                                                {formatIST(item.sent_at)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 font-mono whitespace-nowrap">
                                                {item.phone_number ? `+${item.phone_number}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                    item.status?.toUpperCase() === 'SENT' ? 'bg-green-100 text-green-700' :
                                                    item.status?.toUpperCase() === 'FAILED' ? 'bg-red-100 text-red-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {item.status?.toUpperCase() === 'SENT' && <CheckIcon className="w-3 h-3" />}
                                                    {item.status?.toUpperCase() === 'FAILED' && <CloseIcon className="w-3 h-3 text-red-600" />}
                                                    {item.status?.toUpperCase() || 'UNKNOWN'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate" title={formatRowData(item.meta)}>
                                                {formatRowData(item.meta)}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate" title={item.error_message || item.row_hash}>
                                                {item.status === 'FAILED' ? (
                                                    <span className="text-red-500 font-medium">{item.error_message || 'Unknown Error'}</span>
                                                ) : (
                                                    <span className="text-slate-400 font-mono text-[10px]">Hash: {item.row_hash}</span>
                                                )}
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
                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-slate-600 font-medium">Page {page} of {totalPages}</span>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SheetAutomationReport;
