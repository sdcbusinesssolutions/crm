import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { tokenService } from '../services/tokenService';

const AdDetailPanel = ({ item, level, metrics }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTimeData = async () => {
      try {
        setLoading(true);
        const authHeader = await tokenService.getAuthHeader();
        // Fetch daily insights (timeIncrement=1)
        const response = await fetch(`/api/click-to-whatsapp/insights/${level}/${item.id}?timeIncrement=1`, {
          headers: { ...authHeader }
        });
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
          // Format data for Recharts
          const formatted = result.data.map(d => ({
            date: new Date(d.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            impressions: parseInt(d.impressions || 0, 10),
            leads: parseInt(d.actions?.find(a => a.action_type.includes('messaging_conversation_started'))?.value || 0, 10)
          })).reverse(); // Often comes descending
          
          setTimeSeriesData(formatted);
        }
      } catch (err) {
        console.error("Failed to fetch time series:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeData();
  }, [item.id, level]);

  const tabs = [
    { id: 'summary', label: 'Ad Summary' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'conversions', label: 'Conversions' },
    { id: 'insights', label: 'Insights' }
  ];

  return (
    <div className="bg-white border-t border-slate-200 p-6 animate-fade-in shadow-inner">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 gap-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === tab.id ? 'text-[var(--color-brand)]' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--color-brand)] rounded-t-full"></div>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-8">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between group cursor-help" title="Total number of times your ad was seen on a screen.">
                Impressions <span className="opacity-0 group-hover:opacity-50">ℹ️</span>
              </p>
              <p className="text-xl font-black text-slate-700">{metrics.impressions}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between group cursor-help" title="Number of unique people who saw your ad at least once.">
                Reach <span className="opacity-0 group-hover:opacity-50">ℹ️</span>
              </p>
              <p className="text-xl font-black text-slate-700">{metrics.reach}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between group cursor-help" title="Average number of times each person saw your ad.">
                Frequency <span className="opacity-0 group-hover:opacity-50">ℹ️</span>
              </p>
              <p className="text-xl font-black text-slate-700">{metrics.frequency !== '-' ? parseFloat(metrics.frequency).toFixed(2) : '-'}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between group cursor-help" title="Total number of clicks on your ad (including anywhere on the ad card).">
                Clicks <span className="opacity-0 group-hover:opacity-50">ℹ️</span>
              </p>
              <p className="text-xl font-black text-slate-700">{metrics.clicks}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between group cursor-help" title="Number of unique people who clicked your ad.">
                Unique Clicks <span className="opacity-0 group-hover:opacity-50">ℹ️</span>
              </p>
              <p className="text-xl font-black text-slate-700">{metrics.uniqueClicks}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between group cursor-help" title="Clicks specifically on the 'WhatsApp' button or link.">
                Inline Link Clicks <span className="opacity-0 group-hover:opacity-50">ℹ️</span>
              </p>
              <p className="text-xl font-black text-slate-700">{metrics.inlineLinkClicks}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between group cursor-help" title="Click-Through Rate: Percentage of times people saw your ad and clicked it.">
                CTR (%) <span className="opacity-0 group-hover:opacity-50">ℹ️</span>
              </p>
              <p className="text-xl font-black text-slate-700">{metrics.ctr !== '-' ? parseFloat(metrics.ctr).toFixed(2) : '-'}</p>
            </div>
          </div>

          {/* Time Series Graph */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-4">Performance Over Time (Impressions)</h4>
            <div className="h-64 w-full bg-slate-50 rounded-xl border border-slate-100 p-4">
              {loading ? (
                <div className="w-full h-full flex justify-center items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-brand)]"></div>
                </div>
              ) : timeSeriesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <RechartsTooltip 
                      contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      labelStyle={{fontWeight: 'bold', color: '#334155'}}
                    />
                    <Area type="monotone" dataKey="impressions" stroke="#F59E0B" strokeWidth={3} fillOpacity={1} fill="url(#colorImp)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex justify-center items-center text-slate-400 text-sm font-medium">
                  No time-series data available for this date range.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between group cursor-help" title="Total amount of money spent on this item so far.">
              Total Spend <span className="opacity-0 group-hover:opacity-50">ℹ️</span>
            </p>
            <p className="text-xl font-black text-[var(--color-brand)]">₹{metrics.spend ? metrics.spend.toFixed(2) : '0.00'}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between group cursor-help" title="Average cost you paid for each click on your ad.">
              Cost Per Click (CPC) <span className="opacity-0 group-hover:opacity-50">ℹ️</span>
            </p>
            <p className="text-xl font-black text-slate-700">₹{metrics.clicks > 0 ? (metrics.spend / metrics.clicks).toFixed(2) : '0.00'}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between group cursor-help" title="Cost per Mille: Average cost you paid for 1,000 impressions.">
              CPM (Cost per 1k Imp) <span className="opacity-0 group-hover:opacity-50">ℹ️</span>
            </p>
            <p className="text-xl font-black text-slate-700">₹{metrics.impressions > 0 ? ((metrics.spend / metrics.impressions) * 1000).toFixed(2) : '0.00'}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between group cursor-help" title="Percentage of times people saw your ad and clicked on it.">
              Click-Through Rate <span className="opacity-0 group-hover:opacity-50">ℹ️</span>
            </p>
            <p className="text-xl font-black text-slate-700">{metrics.ctr !== '-' ? `${parseFloat(metrics.ctr).toFixed(2)}%` : '0.00%'}</p>
          </div>
        </div>
      )}

      {activeTab === 'conversions' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100 rounded-2xl p-6 relative overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs uppercase font-bold text-emerald-600 mb-1 cursor-help" title="Number of people who started a WhatsApp chat from this ad.">
                  Total Leads (Chats) ℹ️
                </p>
                <p className="text-4xl font-black text-emerald-900">{metrics.results || 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-emerald-600 mb-1 cursor-help" title="Average cost to acquire one WhatsApp chat (Total Spend / Leads).">
                  Cost Per Lead (CPL) ℹ️
                </p>
                <p className="text-4xl font-black text-emerald-900">{metrics.cpc !== '-' ? `₹${metrics.cpc}` : '₹0.00'}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-emerald-600 mb-1 cursor-help" title="Conversion Rate: Percentage of link clicks that turned into actual WhatsApp chats.">
                  Conv. Rate (Leads / Link Clicks) ℹ️
                </p>
                <p className="text-4xl font-black text-emerald-900">
                  {metrics.inlineLinkClicks > 0 && metrics.results > 0 
                    ? `${((metrics.results / metrics.inlineLinkClicks) * 100).toFixed(1)}%` 
                    : '0%'}
                </p>
              </div>
            </div>
            <div className="absolute -bottom-10 -right-10 text-9xl opacity-10">💬</div>
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Quality Ranking</p>
              <p className="text-sm font-bold text-slate-700 capitalize">{metrics.qualityRanking.replace(/_/g, ' ')}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Engagement Ranking</p>
              <p className="text-sm font-bold text-slate-700 capitalize">{metrics.engagementRanking.replace(/_/g, ' ')}</p>
            </div>
          </div>
          
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-indigo-900 shadow-sm">
            <h4 className="font-bold text-base mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              Performance Summary
            </h4>
            <p className="text-sm leading-relaxed">
              {metrics.results > 0 
                ? `This ${level} is successfully generating WhatsApp conversations at ₹${metrics.cpc} per lead. With a CTR of ${metrics.ctr !== '-' ? parseFloat(metrics.ctr).toFixed(2) : 0}%, the audience engagement is ${parseFloat(metrics.ctr) > 1.5 ? 'excellent' : 'average'}. Keep monitoring the Cost Per Lead to ensure it stays within your target margins.`
                : metrics.spend > 0
                  ? `You have spent ₹${metrics.spend.toFixed(2)} on this ${level} but haven't received any leads yet. Consider reviewing your ad creatives or audience targeting to improve relevance as it continues to run.`
                  : `This ${level} is currently active but hasn't gathered enough data for a definitive performance conclusion. It has reached ${metrics.reach || 0} people so far. Allow it to run a bit longer to optimize.`
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdDetailPanel;
