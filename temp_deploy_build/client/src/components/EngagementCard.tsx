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
                [
                    { name: 'Welcome Drip', sent: 154, read: 120, rate: 78, color: 'from-emerald-400 to-emerald-600' },
                    { name: 'Re-engagement', sent: 89, read: 45, rate: 51, color: 'from-amber-400 to-amber-600' },
                    { name: 'Promo Blast #1', sent: 340, read: 210, rate: 62, color: 'from-blue-400 to-blue-600' }
                ].map((camp, idx) => (
                    <div key={idx} className="group">
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${camp.color}`}></div>
                                <span className="text-xs font-bold text-slate-700">{camp.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500">{camp.rate}% Open</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full bg-gradient-to-r ${camp.color}`}
                                style={{ width: `${camp.rate}%` }}
                            ></div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default EngagementCard;
