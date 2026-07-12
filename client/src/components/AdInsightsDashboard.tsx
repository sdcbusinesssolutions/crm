import React, { useState, useEffect } from 'react';
import './AdInsightsDashboard.css';
import { tokenService } from '../services/tokenService';

interface AdInsightsDashboardProps {
  level: string;
  entityId: string;
}

const BREAKDOWN_OPTIONS = [
  { value: 'none', label: 'Overview (No Breakdown)' },
  { value: 'age,gender', label: 'Age & Gender' },
  { value: 'region', label: 'Region (State/City)' },
  { value: 'publisher_platform,platform_position', label: 'Platform & Placement' },
  { value: 'device_platform', label: 'Device Platform' },
];

const AdInsightsDashboard: React.FC<AdInsightsDashboardProps> = ({ level, entityId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBreakdown, setSelectedBreakdown] = useState('none');
  const [insightsData, setInsightsData] = useState<any[]>([]);
  
  const [metrics, setMetrics] = useState({
    spend: 0,
    reach: 0,
    impressions: 0,
    conversations: 0,
    costPerConversation: 0,
    currency: 'USD'
  });

  useEffect(() => {
    const fetchInsights = async () => {
      if (!entityId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const authHeader = await tokenService.getAuthHeader();
        
        let url = `/api/click-to-whatsapp/insights/${level}/${entityId}`;
        if (selectedBreakdown !== 'none') {
          const breakdownArray = selectedBreakdown.split(',');
          url += `?breakdowns=${JSON.stringify(breakdownArray)}`;
        }

        const response = await fetch(url, { headers: authHeader });
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to load insights.');
        }

        const dataArr = result.data || [];
        setInsightsData(dataArr);

        if (selectedBreakdown === 'none' && dataArr.length > 0) {
          const insight = dataArr[0];
          
          let convCount = 0;
          if (insight.actions) {
            const convAction = insight.actions.find((a: any) => 
               a.action_type === 'onsite_conversion.messaging_conversation_started_7d' ||
               a.action_type === 'onsite_conversion.messaging_first_reply' ||
               a.action_type.includes('messaging')
            );
            if (convAction) convCount = parseInt(convAction.value) || 0;
          }

          const spend = parseFloat(insight.spend || '0');
          const costPerConv = convCount > 0 ? (spend / convCount) : 0;

          setMetrics({
            spend: spend,
            reach: parseInt(insight.reach || '0'),
            impressions: parseInt(insight.impressions || '0'),
            conversations: convCount,
            costPerConversation: costPerConv,
            currency: 'USD' 
          });
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [level, entityId, selectedBreakdown]);

  // Process breakdown data for chart and table
  const getBreakdownRows = () => {
    if (selectedBreakdown === 'none' || !insightsData.length) return [];
    
    return insightsData.map(row => {
      let label = [];
      if (row.age) label.push(row.age);
      if (row.gender) label.push(row.gender === 'male' ? 'Male' : row.gender === 'female' ? 'Female' : row.gender);
      if (row.region) label.push(row.region);
      if (row.publisher_platform) label.push(row.publisher_platform === 'facebook' ? 'FB' : row.publisher_platform === 'instagram' ? 'IG' : row.publisher_platform);
      if (row.platform_position) label.push(row.platform_position);
      if (row.device_platform) label.push(row.device_platform);

      let convCount = 0;
      if (row.actions) {
        const convAction = row.actions.find((a: any) => a.action_type.includes('messaging'));
        if (convAction) convCount = parseInt(convAction.value) || 0;
      }

      const spend = parseFloat(row.spend || '0');
      const cpa = convCount > 0 ? (spend / convCount) : 0;

      return {
        id: Math.random().toString(),
        label: label.join(', ') || 'Unknown',
        spend,
        conversations: convCount,
        cpa,
      };
    }).sort((a, b) => b.spend - a.spend); // Sort by spend descending
  };

  const breakdownRows = getBreakdownRows();
  const maxSpend = breakdownRows.length ? Math.max(...breakdownRows.map(r => r.spend)) : 0;

  if (loading && insightsData.length === 0) {
    return (
      <div className="ctwa-insights-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="ctwa-insight-card loading-skeleton">
            <div className="skeleton-title"></div>
            <div className="skeleton-value"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="ctwa-error">Error loading insights: {error}</div>;
  }

  if (!entityId) {
    return <div className="ctwa-empty-state">Please enter a valid ID to see insights.</div>;
  }

  return (
    <div className="ctwa-insights-dashboard">
      
      {/* Overview KPI Cards - only show if no breakdown is selected or we maintain total state */}
      {selectedBreakdown === 'none' && (
        <div className="ctwa-insights-grid">
          <div className="ctwa-insight-card">
            <div className="ctwa-insight-icon spend-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ctwa-insight-content">
              <h3>Total Spend</h3>
              <div className="ctwa-insight-value">${metrics.spend.toFixed(2)}</div>
            </div>
          </div>

          <div className="ctwa-insight-card">
            <div className="ctwa-insight-icon reach-icon">
               <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div className="ctwa-insight-content">
              <h3>Reach & Impressions</h3>
              <div className="ctwa-insight-value">{metrics.reach} <span className="text-sm text-gray-500">/ {metrics.impressions}</span></div>
            </div>
          </div>

          <div className="ctwa-insight-card">
            <div className="ctwa-insight-icon conv-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="ctwa-insight-content">
              <h3>Conversations Started</h3>
              <div className="ctwa-insight-value">{metrics.conversations}</div>
            </div>
          </div>

          <div className="ctwa-insight-card">
            <div className="ctwa-insight-icon cpa-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ctwa-insight-content">
              <h3>Cost per Conversation</h3>
              <div className="ctwa-insight-value">${metrics.costPerConversation.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown Section */}
      <div className="ctwa-breakdown-section mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Header & Selector */}
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Performance Breakdowns</h3>
            <p className="text-sm text-gray-500">Analyze your Click-to-WhatsApp ad performance by segments.</p>
          </div>
          <div className="relative">
            <select 
              className="appearance-none bg-white border border-gray-300 text-gray-700 py-2.5 pl-4 pr-10 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
              value={selectedBreakdown}
              onChange={(e) => setSelectedBreakdown(e.target.value)}
            >
              <optgroup label="Popular Breakdowns">
                {BREAKDOWN_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
        </div>

        {loading && selectedBreakdown !== 'none' && (
           <div className="p-12 text-center text-gray-400">
             <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading breakdown data...
           </div>
        )}

        {/* Breakdown Chart & Table */}
        {!loading && selectedBreakdown !== 'none' && breakdownRows.length > 0 && (
          <div className="p-6">
            
            {/* Custom CSS Bar Chart */}
            <div className="mb-8 flex items-end gap-6 h-64 border-b border-gray-200 pb-2 px-2 overflow-x-auto">
              {breakdownRows.map((row) => (
                <div key={row.id} className="flex flex-col items-center flex-1 min-w-[80px] group">
                  <div className="text-xs font-bold text-gray-600 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    ${row.spend.toFixed(2)}
                  </div>
                  <div 
                    className="w-full max-w-[60px] bg-blue-400 hover:bg-blue-500 rounded-t-sm transition-all duration-300 relative"
                    style={{ height: `${Math.max((row.spend / maxSpend) * 100, 2)}%` }}
                  >
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity">
                      CPA: ${row.cpa.toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-3 text-xs font-medium text-gray-500 text-center truncate w-full px-1" title={row.label}>
                    {row.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Breakdown Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Segment</th>
                    <th className="py-3 px-4 text-right">Amount Spent</th>
                    <th className="py-3 px-4 text-right">Conversations</th>
                    <th className="py-3 px-4 text-right">Cost Per Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {breakdownRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-800">{row.label}</td>
                      <td className="py-3 px-4 text-right text-gray-600">${row.spend.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{row.conversations}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        ${row.cpa.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {!loading && selectedBreakdown !== 'none' && breakdownRows.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            No data available for this breakdown.
          </div>
        )}

      </div>
    </div>
  );
};

export default AdInsightsDashboard;
