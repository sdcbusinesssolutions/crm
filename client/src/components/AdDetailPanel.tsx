import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { tokenService } from '../services/tokenService';
import CustomAdsReportBuilder from './CustomAdsReportBuilder';

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
    { id: 'insights', label: 'Insights' },
    { id: 'custom_report', label: 'Custom Report' }
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
          <div className="flex flex-wrap justify-center -mx-2">
            {[
              {
                label: 'Impressions',
                value: metrics.impressions,
                title: 'Total number of times your ad was seen on a screen.',
                icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'Reach',
                value: metrics.reach,
                title: 'Number of unique people who saw your ad at least once.',
                icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'Frequency',
                value: metrics.frequency !== '-' ? parseFloat(metrics.frequency).toFixed(2) : '-',
                title: 'Average number of times each person saw your ad.',
                icon: <><polyline points="17 1 21 5 17 9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 11V9a4 4 0 0 1 4-4h14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><polyline points="7 23 3 19 7 15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 13v2a4 4 0 0 1-4 4H3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'Clicks',
                value: metrics.clicks,
                title: 'Total number of clicks on your ad (including anywhere on the ad card).',
                icon: <><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 13l6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'Unique Clicks',
                value: metrics.uniqueClicks,
                title: 'Number of unique people who clicked your ad.',
                icon: <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'Link Clicks',
                value: metrics.inlineLinkClicks,
                title: 'Clicks specifically on the WhatsApp button or link.',
                icon: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              },
              {
                label: 'CTR (%)',
                value: metrics.ctr !== '-' ? parseFloat(metrics.ctr).toFixed(2) : '-',
                title: 'Click-Through Rate: Percentage of times people saw your ad and clicked it.',
                icon: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
              }
            ].map((item, idx) => (
              <div key={idx} className="w-1/2 md:w-1/4 p-2">
                <div className="bg-white border border-[rgba(var(--color-brand-rgb),0.3)] rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[var(--color-brand)] transition-all relative h-full">
                  <div className="flex items-center gap-4 mb-2">
                  <div className="w-11 h-11 rounded-xl bg-[var(--color-brand)] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      {item.icon}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-black text-slate-800 leading-none mb-1 truncate">{item.value}</h3>
                    <p className="text-[10px] uppercase font-bold text-[var(--color-brand)] tracking-wider truncate">{item.label}</p>
                  </div>
                </div>
                <div className="absolute top-4 right-4 cursor-help" title={item.title}>
                  <span className="text-[9px] font-bold text-[var(--color-brand)] bg-[rgba(var(--color-brand-rgb),0.1)] px-2 py-1 rounded-full">ℹ️</span>
                </div>
                </div>
              </div>
            ))}
          </div>

          {/* Time Series Graph */}
          <div>
            <h4 className="text-sm font-bold text-[var(--color-brand)] mb-4">Performance Over Time (Impressions)</h4>
            <div className="h-64 w-full bg-[rgba(var(--color-brand-rgb),0.03)] rounded-xl border border-[rgba(var(--color-brand-rgb),0.2)] p-4 shadow-sm">
              {loading ? (
                <div className="w-full h-full flex justify-center items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-brand)]"></div>
                </div>
              ) : timeSeriesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeSeriesData} margin={{ top: 30, right: 30, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} padding={{ left: 50, right: 50 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, dataMax => Math.max(10, Math.ceil(dataMax * 1.2))]} />
                    <RechartsTooltip 
                      contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      labelStyle={{fontWeight: 'bold', color: '#334155'}}
                      cursor={{fill: 'rgba(245,158,11,0.05)'}}
                    />
                    <Bar dataKey="impressions" fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={80} />
                  </BarChart>
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
          {[
            {
              label: 'Total Spend',
              value: '₹' + (metrics.spend ? metrics.spend.toFixed(2) : '0.00'),
              title: 'Total amount of money spent on this item so far.',
              icon: <><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
            },
            {
              label: 'CPC',
              value: '₹' + (metrics.clicks > 0 ? (metrics.spend / metrics.clicks).toFixed(2) : '0.00'),
              title: 'Cost Per Click: Average cost you paid for each click.',
              icon: <><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
            },
            {
              label: 'CPM (Cost per 1k)',
              value: '₹' + (metrics.impressions > 0 ? ((metrics.spend / metrics.impressions) * 1000).toFixed(2) : '0.00'),
              title: 'Cost per Mille: Average cost you paid for 1,000 impressions.',
              icon: <><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
            },
            {
              label: 'CTR',
              value: metrics.ctr !== '-' ? `${parseFloat(metrics.ctr).toFixed(2)}%` : '0.00%',
              title: 'Percentage of times people saw your ad and clicked on it.',
              icon: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-white border border-[rgba(var(--color-brand-rgb),0.3)] rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[var(--color-brand)] transition-all relative">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-11 h-11 rounded-xl bg-[var(--color-brand)] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    {item.icon}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl font-black text-slate-800 leading-none mb-1 truncate">{item.value}</h3>
                  <p className="text-[10px] uppercase font-bold text-[var(--color-brand)] tracking-wider truncate">{item.label}</p>
                </div>
              </div>
              <div className="absolute top-4 right-4 cursor-help" title={item.title}>
                <span className="text-[9px] font-bold text-[var(--color-brand)] bg-[rgba(var(--color-brand-rgb),0.1)] px-2 py-1 rounded-full">ℹ️</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'conversions' && (
        <div className="space-y-6">
          <div className="bg-[rgba(var(--color-brand-rgb),0.05)] border border-[rgba(var(--color-brand-rgb),0.3)] rounded-2xl p-6 relative overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs uppercase font-bold text-[var(--color-brand)] mb-1 cursor-help" title="Number of people who started a WhatsApp chat from this ad.">
                  Total Leads (Chats) ℹ️
                </p>
                <p className="text-4xl font-black text-[var(--color-brand)]">{metrics.results || 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-[var(--color-brand)] mb-1 cursor-help" title="Average cost to acquire one WhatsApp chat (Total Spend / Leads).">
                  Cost Per Lead (CPL) ℹ️
                </p>
                <p className="text-4xl font-black text-[var(--color-brand)]">{metrics.cpc !== '-' ? `₹${metrics.cpc}` : '₹0.00'}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-[var(--color-brand)] mb-1 cursor-help" title="Conversion Rate: Percentage of link clicks that turned into actual WhatsApp chats.">
                  Conv. Rate (Leads / Link Clicks) ℹ️
                </p>
                <p className="text-4xl font-black text-[var(--color-brand)]">
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
            <div className="bg-[rgba(var(--color-brand-rgb),0.03)] border border-[rgba(var(--color-brand-rgb),0.2)] rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[rgba(var(--color-brand-rgb),0.4)] transition-all">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Quality Ranking</p>
              <p className="text-sm font-bold text-[var(--color-brand)] capitalize">{metrics.qualityRanking.replace(/_/g, ' ')}</p>
            </div>
            <div className="bg-[rgba(var(--color-brand-rgb),0.03)] border border-[rgba(var(--color-brand-rgb),0.2)] rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[rgba(var(--color-brand-rgb),0.4)] transition-all">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Engagement Ranking</p>
              <p className="text-sm font-bold text-[var(--color-brand)] capitalize">{metrics.engagementRanking.replace(/_/g, ' ')}</p>
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

      {activeTab === 'custom_report' && (
        <div className="mt-2">
          <CustomAdsReportBuilder level={level} entityId={item.id} accountId={null} />
        </div>
      )}
    </div>
  );
};

export default AdDetailPanel;
