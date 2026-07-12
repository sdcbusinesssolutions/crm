import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { tokenService } from '../services/tokenService';

const BREAKDOWNS = [
  { id: 'campaign.name', label: 'Campaign name' },
  { id: 'adset.name', label: 'Ad set name' },
  { id: 'ad.name', label: 'Ad name' },
  { id: 'age', label: 'Age' },
  { id: 'platform_position', label: 'Placement' },
  { id: 'gender', label: 'Gender' },
  { id: 'call_to_action_asset', label: 'Call to action' },
  { id: 'region', label: 'Region' },
  { id: 'country', label: 'Country' },
  { id: 'publisher_platform', label: 'Platform' },
  { id: 'device_platform', label: 'Device' },
  { id: 'date', label: 'Day' } // Maps to time_increment=1
];

const METRICS = [
  { id: 'spend', label: 'Amount spent', color: '#60a5fa' }, // blue-400
  { id: 'reach', label: 'Reach', color: '#a78bfa' }, // violet-400
  { id: 'impressions', label: 'Impressions', color: '#2dd4bf' }, // teal-400
  { id: 'cpc', label: 'Cost per lead', color: '#f87171' }, // red-400
  { id: 'results', label: 'Leads', color: '#facc15' } // yellow-400
];

const CustomAdsReportBuilder = ({ accountId, level = 'account', entityId = null }) => {
  const [selectedBreakdowns, setSelectedBreakdowns] = useState<string[]>(['campaign.name', 'platform_position']);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['spend']);
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [datePreset, setDatePreset] = useState('maximum');

  const handleBreakdownToggle = (id: string) => {
    setSelectedBreakdowns(prev => {
      if (prev.includes(id)) {
        return prev.filter(b => b !== id);
      } else {
        const newBreakdowns = [...prev, id];
        const realBreakdowns = newBreakdowns.filter(b => !['campaign.name', 'adset.name', 'ad.name', 'date'].includes(b));
        if (realBreakdowns.length > 2) {
          alert('Meta Graph API allows a maximum of 2 non-entity breakdowns at a time.');
          return prev;
        }
        return newBreakdowns;
      }
    });
  };

  const handleMetricToggle = (id: string) => {
    setSelectedMetrics(prev => {
      if (prev.includes(id)) return prev.filter(m => m !== id);
      return [...prev, id];
    });
  };

  useEffect(() => {
    const fetchReport = async () => {
      const targetId = entityId || accountId;
      if (!targetId) return;
      if (selectedMetrics.length === 0) return;

      try {
        setLoading(true);
        setError(null);
        const authHeader = await tokenService.getAuthHeader();
        
        let apiLevel = level; // default from props
        if (selectedBreakdowns.includes('ad.name')) apiLevel = 'ad';
        else if (selectedBreakdowns.includes('adset.name')) apiLevel = 'adset';
        else if (selectedBreakdowns.includes('campaign.name') && apiLevel === 'account') apiLevel = 'campaign';
        
        // Build fields list based on selected metrics to avoid API conflicts
        const needsActions = selectedMetrics.includes('results') || selectedMetrics.includes('cpc') || selectedMetrics.includes('leads');
        let requestedFields = 'spend,reach,impressions,date_start,date_stop,campaign_name,adset_name,ad_name';
        if (needsActions) {
           requestedFields += ',actions,cpc,ctr,clicks,unique_clicks';
        }
        
        let url = `/api/click-to-whatsapp/insights/${apiLevel}/${targetId}?datePreset=${datePreset}&fields=${requestedFields}`;
        
        // Handle Day breakdown
        if (selectedBreakdowns.includes('date')) {
          url += '&timeIncrement=1';
        }

        const apiBreakdowns = selectedBreakdowns.filter(b => !['campaign.name', 'adset.name', 'ad.name', 'date'].includes(b));
        if (apiBreakdowns.length > 0) {
          url += `&breakdowns=${JSON.stringify(apiBreakdowns)}`;
        }

        const response = await fetch(url, { headers: authHeader });
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch custom report data.');
        }

        // Process data
        const processed = (result.data || []).map((row: any) => {
          let labelParts = [];
          
          if (selectedBreakdowns.includes('date') && row.date_start) {
            labelParts.push(row.date_start);
          }
          
          apiBreakdowns.forEach(b => {
             const key = b.replace('.name', '_name'); // campaign.name -> campaign_name
             if (row[key]) {
               labelParts.push(row[key]);
             } else if (row[b]) {
               labelParts.push(row[b]);
             }
          });

          const actions = row.actions || [];
          const convAction = actions.find((a: any) => a.action_type.includes('messaging'));
          const results = convAction ? parseInt(convAction.value) : 0;
          const spend = parseFloat(row.spend || 0);
          
          return {
            id: Math.random().toString(),
            label: labelParts.length > 0 ? labelParts.join(', ') : `${level} Total`,
            spend: spend,
            reach: parseInt(row.reach || 0),
            impressions: parseInt(row.impressions || 0),
            results: results,
            cpc: results > 0 ? (spend / results) : 0,
            ...row // keep raw for table
          };
        });
        
        // Sort by first selected metric descending if date is not selected
        if (!selectedBreakdowns.includes('date') && selectedMetrics.length > 0) {
           const primaryMetric = selectedMetrics[0];
           processed.sort((a, b) => b[primaryMetric] - a[primaryMetric]);
        }

        setData(processed);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [accountId, entityId, level, selectedBreakdowns, selectedMetrics, datePreset]);

  return (
    <div className="flex h-full min-h-[600px] max-h-[800px] bg-slate-50 overflow-hidden rounded-xl border border-slate-200">
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Custom Bar Chart</h2>
            <p className="text-sm text-slate-500">
              Showing {data.length} breakdown segments
            </p>
          </div>
          <div className="flex items-center gap-3">
             <select 
               className="border border-slate-300 rounded-md text-sm py-1.5 px-3 bg-white"
               value={datePreset}
               onChange={(e) => setDatePreset(e.target.value)}
             >
               <option value="today">Today</option>
               <option value="yesterday">Yesterday</option>
               <option value="last_7d">Last 7 Days</option>
               <option value="last_14d">Last 14 Days</option>
               <option value="last_30d">Last 30 Days</option>
               <option value="this_month">This Month</option>
               <option value="maximum">Maximum (Lifetime)</option>
             </select>
          </div>
        </div>

        {/* Chart & Table Area */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
              <span className="font-bold">API Error:</span> {error}
            </div>
          )}
          
          {loading ? (
             <div className="h-64 flex items-center justify-center">
               <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
             </div>
          ) : data.length === 0 ? (
             <div className="h-64 flex items-center justify-center text-slate-500">
               No data found for this selection.
             </div>
          ) : (
            <>
              {/* Dynamic Grouped Bar Chart */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6 shadow-sm" style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.slice(0, 15)} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="label" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      dy={10}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      dx={-10}
                    />
                    <RechartsTooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    
                    {selectedMetrics.map(metricId => {
                      const metricDef = METRICS.find(m => m.id === metricId);
                      return (
                        <Bar 
                          key={metricId} 
                          dataKey={metricId} 
                          name={metricDef?.label || metricId} 
                          fill={metricDef?.color || '#3b82f6'} 
                          radius={[4, 4, 0, 0]} 
                          maxBarSize={50}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {selectedBreakdowns.map(bId => {
                           const bDef = BREAKDOWNS.find(b => b.id === bId);
                           return <th key={bId} className="px-6 py-3 font-semibold text-slate-700">{bDef?.label || bId}</th>
                        })}
                        {selectedBreakdowns.length === 0 && (
                          <th className="px-6 py-3 font-semibold text-slate-700">Segment</th>
                        )}
                        {selectedMetrics.map(mId => {
                           const mDef = METRICS.find(m => m.id === mId);
                           return <th key={mId} className="px-6 py-3 font-semibold text-slate-700 text-right">{mDef?.label || mId}</th>
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          {selectedBreakdowns.map(bId => {
                             let val = '';
                             if (bId === 'date') val = row.date_start;
                             else {
                               const key = bId.replace('.name', '_name');
                               val = row[key] || row[bId] || 'Not specified';
                             }
                             return <td key={bId} className="px-6 py-4 text-slate-800">{val}</td>
                          })}
                          {selectedBreakdowns.length === 0 && (
                             <td className="px-6 py-4 text-slate-800">Total</td>
                          )}
                          {selectedMetrics.map(mId => {
                             let val = row[mId];
                             if (mId === 'spend' || mId === 'cpc') {
                               val = `₹${Number(val).toFixed(2)}`;
                             }
                             return <td key={mId} className="px-6 py-4 text-slate-600 text-right font-medium">{val}</td>
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-72 bg-white border-l border-slate-200 shrink-0 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-800">Customize bar chart</h3>
        </div>
        
        <div className="p-4">
          <h4 className="font-bold text-slate-700 mb-3 text-sm flex items-center justify-between">
            Data
            <span className="text-xs text-slate-400 font-normal">Breakdowns (Bar groups)</span>
          </h4>
          
          <div className="space-y-2 mb-6 border border-slate-200 rounded-lg p-3 max-h-64 overflow-y-auto custom-scrollbar">
             {BREAKDOWNS.map(breakdown => (
               <label key={breakdown.id} className="flex items-center gap-3 group cursor-pointer">
                 <input 
                   type="checkbox" 
                   className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                   checked={selectedBreakdowns.includes(breakdown.id)}
                   onChange={() => handleBreakdownToggle(breakdown.id)}
                   disabled={!selectedBreakdowns.includes(breakdown.id) && selectedBreakdowns.length >= 2}
                 />
                 <span className="text-sm text-slate-700 group-hover:text-slate-900 select-none">
                   {breakdown.label}
                 </span>
               </label>
             ))}
          </div>

          <h4 className="font-bold text-slate-700 mb-3 text-sm flex items-center justify-between pt-4 border-t border-slate-200">
            Metrics
            <span className="text-xs text-slate-400 font-normal">(Bars)</span>
          </h4>
          
          <div className="space-y-2 border border-slate-200 rounded-lg p-3">
             {METRICS.map(metric => (
               <label key={metric.id} className="flex items-center gap-3 group cursor-pointer">
                 <input 
                   type="checkbox" 
                   className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                   checked={selectedMetrics.includes(metric.id)}
                   onChange={() => handleMetricToggle(metric.id)}
                   disabled={selectedMetrics.length === 1 && selectedMetrics.includes(metric.id)} // Prevent deselecting all
                 />
                 <span className="text-sm text-slate-700 group-hover:text-slate-900 select-none">
                   {metric.label}
                 </span>
               </label>
             ))}
          </div>

        </div>
      </div>

    </div>
  );
};

export default CustomAdsReportBuilder;
