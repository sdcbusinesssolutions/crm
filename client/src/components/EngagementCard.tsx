import React from 'react';
import { DashboardStats } from './Dashboard';

const EngagementCard: React.FC<{ stats: DashboardStats | null }> = ({ stats }) => {
    return (
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar px-1">
            {stats?.campaignStats && stats.campaignStats.length > 0 ? (
                stats.campaignStats.slice(0, 5).map((camp, idx) => {
                    const readRate = camp.sent > 0 ? Math.round((camp.read / camp.sent) * 100) : 0;

                    return (
                        <div key={idx} className="group">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{camp.name}</span>
                                    <span className="text-[10px] text-slate-400">{camp.sent} Sent</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-bold text-slate-800">{readRate}%</span>
                                    <span className="text-[10px] text-slate-400">Read Rate</span>
                                </div>
                            </div>
                            {/* Progress Bar */}
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden relative">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-1000"
                                    style={{ width: `${readRate}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })
            ) : (
                // Mock Data for "Drip" visualization if no real campaigns exist yet
                <div className="flex flex-col items-center justify-center h-full py-8 text-center opacity-60">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                        </svg>
                    </div>
                    <p className="text-xs font-bold text-slate-500">No campaigns sent yet</p>
                </div>
            )}
        </div>
    );
};

export default EngagementCard;
