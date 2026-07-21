import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { integrationsService } from '../services/integrationsService';

interface CallLog {
    id: string;
    employee: string;
    client_name: string;
    client_number: string;
    call_type: string;
    duration_seconds: number;
    call_date: string;
    call_time: string;
    call_method: string;
    call_recording_url: string;
}

interface CallyzerCallHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    phoneNumber: string;
    leadName: string;
}

const CallyzerCallHistoryModal: React.FC<CallyzerCallHistoryModalProps> = ({ isOpen, onClose, phoneNumber, leadName }) => {
    const [loading, setLoading] = useState(false);
    const [callLogs, setCallLogs] = useState<CallLog[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && phoneNumber) {
            fetchHistory();
        } else {
            setCallLogs([]);
            setError(null);
        }
    }, [isOpen, phoneNumber]);

    const fetchHistory = async () => {
        setLoading(true);
        setError(null);
        try {
            // Strip formatting from phone number just to be safe
            const cleanNumber = phoneNumber.replace(/\D/g, '');
            const response = await integrationsService.getCallyzerHistory(cleanNumber);
            if (response && response.result) {
                setCallLogs(response.result);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load call history.');
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Call History: ${leadName}`} size="4xl">
            <div className="space-y-4 min-h-[300px]">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-48 space-y-3">
                        <div className="w-8 h-8 border-4 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[var(--color-text)] opacity-70 text-sm font-medium">Fetching from Callyzer...</span>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
                        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div>
                            <p className="font-bold text-sm">Error Loading History</p>
                            <p className="text-xs opacity-90 mt-1">{error}</p>
                            {error.includes('not connected') && (
                                <p className="text-xs mt-2 font-medium">Please configure Callyzer on the Integrations page.</p>
                            )}
                        </div>
                    </div>
                ) : callLogs.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-48 text-center px-4">
                        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        </div>
                        <p className="text-[var(--color-text)] font-semibold">No Call Logs Found</p>
                        <p className="text-[var(--color-text)] opacity-60 text-sm mt-1 max-w-xs">There are no recorded calls for {phoneNumber} in the last 30 days.</p>
                    </div>
                ) : (
                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar-dark border border-[var(--color-border)] rounded-xl">
                        <table className="min-w-full divide-y divide-[var(--color-border)]">
                            <thead className="bg-[var(--color-surface)] sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Type</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Client</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Employee</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Date & Time</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Duration</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Recording</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-bg)]">
                                {callLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-[var(--color-surface)] transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold ${log.call_type === 'Incoming' ? 'bg-blue-50 text-blue-600' : log.call_type === 'Outgoing' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                                {log.call_type === 'Incoming' ? (
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                                ) : log.call_type === 'Outgoing' ? (
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                                ) : (
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                )}
                                                {log.call_type}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="text-sm font-bold text-[var(--color-text)]">{log.client_name}</div>
                                            <div className="text-xs text-[var(--color-text)] opacity-60">{log.client_number}</div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="text-sm font-bold text-[var(--color-text)]">{log.employee}</div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="text-sm text-[var(--color-text)] font-medium">{log.call_date}</div>
                                            <div className="text-xs text-[var(--color-text)] opacity-60">{log.call_time}</div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="text-sm text-[var(--color-text)] opacity-90 font-medium">
                                                {formatDuration(log.duration_seconds)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap min-w-[200px]">
                                            {log.call_recording_url ? (
                                                <audio controls className="h-8 w-full max-w-[220px]" src={log.call_recording_url}>
                                                    Your browser does not support the audio element.
                                                </audio>
                                            ) : (
                                                <span className="text-xs text-[var(--color-text)] opacity-40 italic">No recording</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            {/* Action buttons inside Modal body to maintain modal flow */}
            <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-[var(--color-bg)] hover:bg-[var(--color-border)] text-[var(--color-text)] rounded-lg font-bold transition-colors text-sm"
                >
                    Close
                </button>
            </div>
        </Modal>
    );
};

export default CallyzerCallHistoryModal;
