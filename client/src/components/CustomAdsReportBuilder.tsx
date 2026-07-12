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
  { id: 'spend', label: 'Amount spent', color: '#60a5fa' },
  { id: 'impressions', label: 'Impressions', color: '#2dd4bf' },
  { id: 'reach', label: 'Reach', color: '#a78bfa' },
  { id: 'frequency', label: 'Frequency', color: '#fb923c' },
  { id: 'inline_link_clicks', label: 'Link clicks', color: '#facc15' },
  { id: 'cpc', label: 'CPC (cost per link click)', color: '#f87171' },
  { id: 'cpm', label: 'CPM (cost per 1,000 impressions)', color: '#c084fc' },
  { id: 'ctr', label: 'CTR (all)', color: '#38bdf8' }
];

const CustomAdsReportBuilder = ({ accountId, level = 'account', entityId = null }) => {
  const [selectedBreakdowns, setSelectedBreakdowns] = useState<string[]>(['campaign.name', 'age']);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['spend', 'reach', 'impressions']);
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [datePreset, setDatePreset] = useState('maximum');
  
  const [sortMetric, setSortMetric] = useState<string>('spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [barGroupCount, setBarGroupCount] = useState<number>(6);

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
      setLoading(true);
      setError(null);
      setData([]);
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
        
        // Build fields list based on selected metrics
        let requestedFields = 'spend,reach,impressions,date_start,date_stop,campaign_name,adset_name,ad_name,frequency,inline_link_clicks,cpc,cpm,ctr';
        
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

          const spend = parseFloat(row.spend || 0);
          const impressions = parseInt(row.impressions || 0);
          
          return {
            id: Math.random().toString(),
            label: labelParts.length > 0 ? labelParts.join(', ') : `${level} Total`,
            spend: spend,
            reach: parseInt(row.reach || 0),
            impressions: impressions,
            frequency: parseFloat(row.frequency || 0),
            inline_link_clicks: parseInt(row.inline_link_clicks || 0),
            cpc: parseFloat(row.cpc || 0),
            cpm: parseFloat(row.cpm || 0),
            ctr: parseFloat(row.ctr || 0),
            ...row // keep raw for table
          };
        });
        
        // We do sorting dynamically during render based on sortMetric and sortDirection
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
              Showing {Math.min(data.length, barGroupCount)} of {data.length} breakdown segments
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
                  <BarChart 
                    data={[...data].sort((a, b) => {
                       let aVal = a[sortMetric];
                       let bVal = b[sortMetric];
                       if (aVal === undefined) aVal = '';
                       if (bVal === undefined) bVal = '';
                       
                       if (typeof aVal === 'number' && typeof bVal === 'number') {
                         return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
                       }
                       
                       const aStr = String(aVal);
                       const bStr = String(bVal);
                       return sortDirection === 'desc' 
                         ? bStr.localeCompare(aStr) 
                         : aStr.localeCompare(bStr);
                    }).slice(0, barGroupCount)} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
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
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {selectedBreakdowns.map(bId => {
                           const bDef = BREAKDOWNS.find(b => b.id === bId);
                           return <th key={bId} className="px-6 py-4 font-bold text-slate-700 text-xs uppercase tracking-wider">{bDef?.label || bId}</th>
                        })}
                        {selectedMetrics.map(mId => {
                           const mDef = METRICS.find(m => m.id === mId);
                           return <th key={mId} className="px-6 py-4 font-bold text-slate-700 text-xs uppercase tracking-wider text-right">{mDef?.label || mId}</th>
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...data].sort((a, b) => {
                         let aVal = a[sortMetric];
                         let bVal = b[sortMetric];
                         if (aVal === undefined) aVal = '';
                         if (bVal === undefined) bVal = '';
                         if (typeof aVal === 'number' && typeof bVal === 'number') {
                           return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
                         }
                         const aStr = String(aVal);
                         const bStr = String(bVal);
                         return sortDirection === 'desc' 
                           ? bStr.localeCompare(aStr) 
                           : aStr.localeCompare(bStr);
                      }).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
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


          <h4 className="font-bold text-slate-700 mb-3 text-sm flex items-center justify-between pt-4 border-t border-slate-200 mt-6">
            Format
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bar group sorting</label>
              <select 
                className="w-full border border-slate-300 rounded-md text-sm py-1.5 px-3 bg-white mb-2"
                value={sortMetric}
                onChange={(e) => setSortMetric(e.target.value)}
              >
                <optgroup label="Breakdowns">
                  {selectedBreakdowns.map(bId => {
                     const bDef = BREAKDOWNS.find(b => b.id === bId);
                     return <option key={bId} value={bId}>{bDef?.label || bId}</option>
                  })}
                </optgroup>
                <optgroup label="Metrics">
                  {selectedMetrics.map(mId => {
                     const mDef = METRICS.find(m => m.id === mId);
                     return <option key={mId} value={mId}>{mDef?.label || mId}</option>
                  })}
                </optgroup>
              </select>
              <div className="flex rounded-md shadow-sm">
                <button
                  type="button"
                  className={`flex-1 py-1 text-xs font-medium border ${sortDirection === 'asc' ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} rounded-l-md`}
                  onClick={() => setSortDirection('asc')}
                >
                  Ascending
                </button>
                <button
                  type="button"
                  className={`flex-1 py-1 text-xs font-medium border-y border-r ${sortDirection === 'desc' ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} rounded-r-md`}
                  onClick={() => setSortDirection('desc')}
                >
                  Descending
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                Bar group count
                <span className="cursor-help text-slate-400" title="Number of bar groups to show on chart">ℹ️</span>
              </label>
              <select 
                className="w-full border border-slate-300 rounded-md text-sm py-1.5 px-3 bg-white"
                value={barGroupCount}
                onChange={(e) => setBarGroupCount(parseInt(e.target.value) || 1)}
              >
                {[3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default CustomAdsReportBuilder;
