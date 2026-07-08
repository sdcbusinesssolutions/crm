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
            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === tab.id ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600 rounded-t-full"></div>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-8">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Impressions</p>
              <p className="text-xl font-black text-slate-700">{metrics.impressions}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Reach</p>
              <p className="text-xl font-black text-slate-700">{metrics.reach}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Frequency</p>
              <p className="text-xl font-black text-slate-700">{metrics.frequency !== '-' ? parseFloat(metrics.frequency).toFixed(2) : '-'}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Clicks</p>
              <p className="text-xl font-black text-slate-700">{metrics.clicks}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Unique Clicks</p>
              <p className="text-xl font-black text-slate-700">{metrics.uniqueClicks}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Inline Link Clicks</p>
              <p className="text-xl font-black text-slate-700">{metrics.inlineLinkClicks}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">CTR (%)</p>
              <p className="text-xl font-black text-slate-700">{metrics.ctr !== '-' ? parseFloat(metrics.ctr).toFixed(2) : '-'}</p>
            </div>
          </div>

          {/* Time Series Graph */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-4">Performance Over Time (Impressions)</h4>
            <div className="h-64 w-full bg-slate-50 rounded-xl border border-slate-100 p-4">
              {loading ? (
                <div className="w-full h-full flex justify-center items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
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

      {activeTab === 'insights' && (
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
             <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Quality Ranking</p>
             <p className="text-sm font-bold text-slate-700 capitalize">{metrics.qualityRanking.replace(/_/g, ' ')}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
             <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Engagement Ranking</p>
             <p className="text-sm font-bold text-slate-700 capitalize">{metrics.engagementRanking.replace(/_/g, ' ')}</p>
          </div>
        </div>
      )}

      {(activeTab === 'metrics' || activeTab === 'conversions') && (
        <div className="text-slate-500 italic text-sm p-4 bg-slate-50 rounded-xl border border-slate-100">
          This tab is under construction. Please refer to Summary for primary metrics.
        </div>
      )}
    </div>
  );
};

export default AdDetailPanel;
