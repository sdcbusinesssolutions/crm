import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { tokenService } from '../services/tokenService';
import { ComposedChart, Bar, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import AdDetailPanel from './AdDetailPanel';
import CustomAdsReportBuilder from './CustomAdsReportBuilder';

const ClickToWhatsAppAnalytics = ({ accountId, adAccounts }) => {
  const [activeAccountId, setActiveAccountId] = useState(accountId);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [datePreset, setDatePreset] = useState('last_7d');
  const [customSince, setCustomSince] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [customUntil, setCustomUntil] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [accountData, setAccountData] = useState<any>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  
  // Track expanded rows. Using a Set for efficient lookup.
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState(new Set());
  const [viewLevel, setViewLevel] = useState('hierarchy'); // 'hierarchy' | 'campaign' | 'adset'
  const [activeInsightsItem, setActiveInsightsItem] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Update active account if prop changes
  useEffect(() => {
    if (accountId) {
      setActiveAccountId(accountId);
    }
  }, [accountId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const authHeader = await tokenService.getAuthHeader();
      
      let queryParams = `?datePreset=${datePreset}`;
      if (datePreset === 'custom') {
        queryParams += `&since=${customSince}&until=${customUntil}`;
      }
      
      const response = await fetch(`/api/click-to-whatsapp/analytics/${activeAccountId}${queryParams}`, {
        headers: { ...authHeader }
      });
      const result = await response.json();
      
      if (result.success) {
        if (result.data && result.data.campaigns) {
          setData(result.data.campaigns);
          setAccountData(result.data.account);
          setTimeSeriesData(result.data.timeSeries || []);
        } else {
          setData(result.data);
          setTimeSeriesData([]);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeAccountId) {
      setCurrentPage(1); // Reset page on new load
      fetchAnalytics();
    }
  }, [activeAccountId, datePreset, customSince, customUntil]);

  const toggleStatus = async (objectId, currentStatus, type) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    
    // Optimistic UI update recursively
    const updateNestedStatus = (items, id, newStatus) => {
      return items.map(item => {
        if (item.id === id) {
          return { ...item, status: newStatus };
        }
        if (item.adsets?.data) {
          return { ...item, adsets: { data: updateNestedStatus(item.adsets.data, id, newStatus) } };
        }
        if (item.ads?.data) {
          return { ...item, ads: { data: updateNestedStatus(item.ads.data, id, newStatus) } };
        }
        return item;
      });
    };

    setData(prev => updateNestedStatus(prev, objectId, newStatus));
    
    try {
      const authHeader = await tokenService.getAuthHeader();
      await fetch('/api/click-to-whatsapp/toggle-status', {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ objectId, status: newStatus })
      });
    } catch (err) {
      // Revert on error
      setData(prev => updateNestedStatus(prev, objectId, currentStatus));
      alert('Failed to toggle status: ' + err.message);
    }
  };

  const toggleCampaignExpand = (id) => {
    setExpandedCampaigns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleAdSetExpand = (id) => {
    setExpandedAdSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const extractMetrics = (item) => {
    const insights = item.insights?.data?.[0] || {};
    const actions = insights.actions || [];
    
    // Extract exact WhatsApp messaging conversations as "Leads"
    const msgStarted = actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d') || 
                       actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_1d') || {};
    const results = parseInt(msgStarted.value || 0, 10);
    
    // Extract Link Clicks
    const linkClicksAction = actions.find(a => a.action_type === 'link_click') || {};
    const linkClicks = parseInt(linkClicksAction.value || 0, 10);

    const spend = parseFloat(insights.spend || 0);
    const cpcRaw = results > 0 ? (spend / results) : 0;
    const cpc = results > 0 ? cpcRaw.toFixed(2) : '-';
    const budgetRaw = parseInt(item.daily_budget || 0, 10);
    const dailyBudget = budgetRaw > 0 ? budgetRaw / 100 : 0;
    
    return { 
      results, 
      linkClicks,
      spend, 
      cpc, 
      cpcRaw, 
      dailyBudget,
      impressions: insights.impressions || '-',
      reach: insights.reach || '-',
      ctr: insights.ctr || '-',
      clicks: insights.clicks || '-',
      uniqueClicks: insights.unique_clicks || '-',
      qualityRanking: insights.quality_ranking || 'N/A',
      engagementRanking: insights.engagement_rate_ranking || 'N/A',
      frequency: insights.frequency || '-',
      inlineLinkClicks: insights.inline_link_clicks || '-',
      thumbnailUrl: item.creative?.thumbnail_url || item.creative?.image_url || null,
      startTime: item.start_time || item.created_time || '-',
      stopTime: item.stop_time || '-'
    };
  };

  // Calculate Aggregated KPIs & Graph Data
  let totalSpend = 0;
  let totalResults = 0;
  let maxResults = 0;
  let topCampaign = null;

  // Pre-process data: sort adsets by CPC
  const processedData = [...data].map(camp => {
    let sortedAdsets = [];
    if (camp.adsets?.data) {
      sortedAdsets = [...camp.adsets.data].sort((a, b) => {
        const ma = extractMetrics(a);
        const mb = extractMetrics(b);
        // Put 0/Infinity at the bottom
        const cpcA = (ma.cpcRaw > 0) ? ma.cpcRaw : Infinity;
        const cpcB = (mb.cpcRaw > 0) ? mb.cpcRaw : Infinity;
        return cpcA - cpcB;
      });
    }

    return {
      ...camp,
      adsets: {
        ...camp.adsets,
        data: sortedAdsets
      }
    };
  });

  processedData.forEach(camp => {
    const m = extractMetrics(camp);
    totalSpend += m.spend;
    totalResults += m.results;
  });
  const avgCpc = totalResults > 0 ? (totalSpend / totalResults).toFixed(2) : '0.00';
  
  // Calculate dynamic thresholds based on average performance
  const avgCpcVal = parseFloat(avgCpc);
  const excellentThreshold = avgCpcVal > 0 ? (avgCpcVal * 0.8) : 0;
  const expensiveThreshold = avgCpcVal > 0 ? (avgCpcVal * 1.2) : 0;

  // Flatten adsets for the 'adset' view
  const allAdsets = [];
  processedData.forEach(camp => {
    if (camp.adsets?.data) {
      camp.adsets.data.forEach(adset => {
        allAdsets.push({
          ...adset,
          parentCampaignName: camp.name
        });
      });
    }
  });

  // Build Graph Data dynamically based on selected view
  const graphData = [];
  let bestItemId = null;
  let bestItemName = null;
  let bestItemLeads = 0;
  let bestItemCpc = 0;
  let lowestCpc = Infinity;

  if (viewLevel === 'campaign') {
    processedData.forEach(camp => {
      const m = extractMetrics(camp);
      if (m.cpcRaw > 0 && m.cpcRaw < lowestCpc) {
        lowestCpc = m.cpcRaw;
        bestItemId = camp.id;
        bestItemName = camp.name;
        bestItemLeads = m.results;
        bestItemCpc = m.cpc;
      }
      graphData.push({
        name: camp.name.length > 15 ? camp.name.substring(0, 15) + '...' : camp.name,
        leads: m.results,
        spend: m.spend,
        cpc: m.cpcRaw
      });
    });
  } else {
    allAdsets.forEach(adset => {
      const m = extractMetrics(adset);
      if (m.cpcRaw > 0 && m.cpcRaw < lowestCpc) {
        lowestCpc = m.cpcRaw;
        bestItemId = adset.id;
        bestItemName = adset.name;
        bestItemLeads = m.results;
        bestItemCpc = m.cpc;
      }
      graphData.push({
        name: adset.name.length > 15 ? adset.name.substring(0, 15) + '...' : adset.name,
        leads: m.results,
        spend: m.spend,
        cpc: m.cpcRaw
      });
    });
  }

  const handleExportCSV = () => {
    const csvRows = [
      ['Level', 'Name', 'Parent Campaign', 'Status', 'Start Date', 'End Date', 'Leads (Chats)', 'Cost/Lead', 'CTR (%)', 'Link Clicks', 'Unique Clicks', 'Reach', 'Impressions', 'Spent', 'Daily Budget', 'Quality Ranking', 'Engagement Ranking']
    ];

    const addRow = (item, levelName, parentCampaignName = '') => {
      const m = extractMetrics(item);
      csvRows.push([
        levelName,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${parentCampaignName.replace(/"/g, '""')}"`,
        item.status,
        m.startTime !== '-' ? new Date(m.startTime).toISOString().split('T')[0] : 'N/A',
        m.stopTime !== '-' ? new Date(m.stopTime).toISOString().split('T')[0] : 'Ongoing',
        m.results,
        m.cpc,
        m.ctr,
        m.linkClicks,
        m.uniqueClicks,
        m.reach,
        m.impressions,
        m.spend.toFixed(2),
        m.dailyBudget || 0,
        m.qualityRanking,
        m.engagementRanking
      ]);
    };

    if (viewLevel === 'campaign' || viewLevel === 'hierarchy') {
      processedData.forEach(camp => {
        addRow(camp, 'Campaign');
        if (viewLevel === 'hierarchy' && camp.adsets?.data) {
          camp.adsets.data.forEach(adset => {
            addRow(adset, 'AdSet', camp.name);
            if (adset.ads?.data) {
              adset.ads.data.forEach(ad => {
                addRow(ad, 'Ad', camp.name);
              });
            }
          });
        }
      });
    } else if (viewLevel === 'adset') {
      allAdsets.forEach(adset => {
        addRow(adset, 'AdSet', adset.parentCampaignName);
      });
    }

    const csvString = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `meta_ads_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-brand)]"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 mt-4 shadow-sm animate-fade-in">
        <h3 className="font-bold flex items-center gap-2"><span className="text-xl">⚠️</span> Error loading Analytics</h3>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  const getCpcColor = (cpcValue) => {
    if (cpcValue === 0) return 'text-slate-500 bg-slate-100';
    if (cpcValue <= 10) return 'text-green-700 bg-green-100 border-green-200'; // Excellent
    if (cpcValue <= 20) return 'text-amber-700 bg-amber-100 border-amber-200'; // Average
    return 'text-red-700 bg-red-100 border-red-200'; // Expensive
  };

  const renderRow = (item, level = 0, isExpanded = false, onToggleExpand = null, index = 0) => {
    const metrics = extractMetrics(item);
    const paddingLeft = level * 32 + 16;
    const isCampaign = level === 0;
    const isAdSet = level === 1;

    let ratingBadge = null;
    if (metrics.results > 0) {
      if (metrics.cpcRaw <= excellentThreshold) ratingBadge = <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">🌟 Excellent</span>;
      else if (metrics.cpcRaw <= expensiveThreshold) ratingBadge = <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">👍 Good</span>;
      else ratingBadge = <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">⚠️ Expensive</span>;
    }

    const hasChildren = isCampaign || isAdSet; // Always allow expansion for Campaigns and AdSets
    
    // Calculate progress bar width based on max results
    const progressWidth = maxResults > 0 ? Math.min(100, (metrics.results / maxResults) * 100) : 0;

    const bgClass = index % 2 === 0 ? 'bg-[#f0fdf4]' : 'bg-[#ffffff]';

    return (
      <div 
        key={item.id} 
        className={`group transition-all duration-200 border-b border-slate-100 hover:bg-[#dcfce7] relative
          ${isCampaign ? `${bgClass} p-4` : isAdSet ? `${bgClass} p-3 border-l-4 border-l-[var(--color-brand)]` : 'bg-slate-100/50 p-2 border-l-4 border-l-slate-300'}
        `}
      >
        <div className="flex items-center justify-between" style={{ paddingLeft: `${paddingLeft}px` }}>
          <div className="flex items-center gap-4 flex-1">
            {viewLevel === 'hierarchy' && hasChildren ? (
              <button 
                onClick={() => onToggleExpand && onToggleExpand(item.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-[var(--color-brand)] transition-colors shadow-sm"
              >
                {isExpanded ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                )}
              </button>
            ) : viewLevel === 'hierarchy' ? (
              <div className="w-7 h-7"></div> // spacer
            ) : null}
            
            <div className="flex flex-col items-center shrink-0 w-12" title="Turn Ad ON (Active) or OFF (Paused)">
              <p className="text-[9px] uppercase font-bold text-[var(--color-brand)] mb-1.5 tracking-wider">Action</p>
              <label className="relative flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={item.status === 'ACTIVE'}
                  onChange={() => toggleStatus(item.id, item.status, isCampaign ? 'campaign' : isAdSet ? 'adset' : 'ad')}
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500 shadow-inner"></div>
              </label>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                {metrics.thumbnailUrl ? (
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                    <img src={metrics.thumbnailUrl} alt="Ad Thumbnail" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 text-lg">
                    🖼️
                  </div>
                )}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${isCampaign ? 'bg-indigo-100 text-indigo-700' : isAdSet ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-500'}`}>
                      {isCampaign ? 'Campaign' : isAdSet ? 'AdSet' : 'Ad'}
                    </span>
                    <p className={`font-bold text-slate-800 truncate ${isCampaign ? 'text-base' : 'text-sm'}`}>{item.name}</p>
                    {ratingBadge}
                    {item.id === bestItemId && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md shadow-sm bg-slate-100 text-[var(--color-brand)] border border-slate-200 ml-1">
                        🏆 #1 Pick
                      </span>
                    )}
                  </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md shadow-sm ${item.status === 'ACTIVE' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-200 text-slate-600 border border-slate-300'}`}>
                  {item.status}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {metrics.startTime !== '-' ? new Date(metrics.startTime).toLocaleDateString() : 'N/A'} 
                  {metrics.stopTime !== '-' ? ` - ${new Date(metrics.stopTime).toLocaleDateString()}` : ' - Ongoing'}
                </span>
                <span className="text-xs text-slate-400 font-mono hidden xl:inline-block ml-2">{item.id}</span>
              </div>
              </div>
            </div>
          </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8 text-right flex-wrap justify-end">
            <div className="w-24 md:w-32 hidden sm:block">
              <div className="text-xs font-semibold text-slate-500 mb-1 flex justify-between">
                <span title="onsite_conversion.messaging_conversation_started_7d">Leads (Chats)</span>
                <span className="text-[var(--color-brand)] font-bold">{metrics.results || 0}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-[var(--color-brand)] h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progressWidth}%` }}></div>
              </div>
            </div>

            <div className="w-20">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Cost/Lead</p>
              <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold border ${metrics.cpcRaw > 0 ? getCpcColor(metrics.cpcRaw) : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {metrics.cpc !== '-' ? `₹${metrics.cpc}` : '-'}
              </span>
            </div>

            <div className="w-16 hidden lg:block">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">CTR</p>
              <p className="text-sm font-semibold text-slate-700">{metrics.ctr !== '-' ? `${parseFloat(metrics.ctr).toFixed(2)}%` : '-'}</p>
            </div>

            <div className="w-16 hidden xl:block">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5" title="Unique Clicks">U. Clicks</p>
              <p className="text-sm font-semibold text-slate-700">{metrics.uniqueClicks || '-'}</p>
            </div>

            <div className="w-20 hidden lg:block">
              <p className="text-[10px] uppercase font-bold text-[var(--color-brand)] mb-0.5">Daily Budget</p>
              <p className="text-sm font-bold text-[var(--color-brand)]">{metrics.dailyBudget ? `₹${metrics.dailyBudget}` : '-'}</p>
            </div>

            <div className="w-20 hidden md:block">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Total Spent</p>
              <p className="text-sm font-semibold text-slate-700">{metrics.spend ? `₹${metrics.spend.toFixed(2)}` : '-'}</p>
            </div>

            <div className="hidden lg:block border-l border-slate-200 pl-4 ml-2">
              <button 
                onClick={() => setActiveInsightsItem({ item, level: isCampaign ? 'campaign' : isAdSet ? 'adset' : 'ad', metrics })}
                className="px-4 py-2 bg-[var(--color-brand)] hover:brightness-110 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-1.5 whitespace-nowrap border border-[var(--color-brand)]"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Insights
              </button>
            </div>
          </div>
        </div>

        {/* Empty state when expanded but no children */}
        {viewLevel === 'hierarchy' && isExpanded && ((isCampaign && (!item.adsets?.data || item.adsets.data.length === 0)) || (isAdSet && (!item.ads?.data || item.ads.data.length === 0))) && (
          <div className="py-3 px-4 text-xs text-slate-400 italic bg-slate-50 border-t border-slate-100" style={{ paddingLeft: `${paddingLeft + 32}px` }}>
            No {isCampaign ? 'AdSets' : 'Ads'} found for this {isCampaign ? 'Campaign' : 'AdSet'}.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Controls & KPI Cards */}
      <div className="bg-gradient-to-br from-orange-100 via-orange-50 to-orange-100 p-8 rounded-[2rem] border-2 border-orange-300 shadow-lg shadow-orange-500/20">
        <div 
          className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-5 px-5 mb-3 bg-white hover:bg-slate-50 border-2 border-orange-300 shadow-sm rounded-xl transition-all"
        >    
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="text-[var(--color-brand)]">⚡</span> WhatsApp Ads Dashboard
            </h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">Track your messaging leads, costs, and campaign ROI.</p>
          </div>
          
          <div className="flex items-center gap-3">
            {adAccounts && adAccounts.length > 0 && (
              <div className="relative">
                <select 
                  value={activeAccountId}
                  onChange={(e) => setActiveAccountId(e.target.value)}
                  className="appearance-none bg-white border-2 border-orange-300 text-slate-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] font-bold shadow-sm transition-all cursor-pointer"
                >
                  {adAccounts.map(acc => (
                    <option key={acc.account_id} value={acc.account_id}>
                      {acc.name || acc.account_id}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <select 
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value)}
                  className="appearance-none bg-white border-2 border-orange-300 text-slate-700 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] font-bold shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last_7d">Last 7 Days</option>
                  <option value="this_month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              {datePreset === 'custom' && (
                <div className="flex items-center gap-2 ml-1 animate-fade-in">
                  <input
                    type="date"
                    value={customSince}
                    onChange={(e) => setCustomSince(e.target.value)}
                    className="border-2 border-slate-200 text-slate-700 py-2 px-3 rounded-xl focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] font-semibold shadow-sm text-sm h-[44px]"
                  />
                  <span className="text-slate-400 font-bold">to</span>
                  <input
                    type="date"
                    value={customUntil}
                    onChange={(e) => setCustomUntil(e.target.value)}
                    className="border-2 border-slate-200 text-slate-700 py-2 px-3 rounded-xl focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] font-semibold shadow-sm text-sm h-[44px]"
                  />
                </div>
              )}
            </div>
            <button onClick={fetchAnalytics} className="p-2.5 bg-slate-50 hover:bg-slate-100 text-[var(--color-brand)] rounded-xl transition-colors shadow-sm" title="Refresh Data">
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-indigo-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 text-white">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-black text-indigo-900 tracking-tight">{totalResults}</p>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mt-1">Total Leads</p>
            </div>
          </div>
          
          <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-emerald-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30 text-white">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
              </svg>
            </div>
            <div>
              <p className="text-3xl font-black text-emerald-900 tracking-tight">₹{avgCpc}</p>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mt-1">Avg Cost / Lead</p>
            </div>
          </div>
          
          <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-slate-300 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center shrink-0 shadow-lg shadow-slate-500/30 text-white">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 7.28V5c0-1.1-.9-2-2-2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-2.28A2 2 0 0 0 22 15V9a2 2 0 0 0-1-1.72zM20 9v6h-7V9h7zM5 19V5h14v2h-6c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h6v2H5z"/>
                <circle cx="16" cy="12" r="1.5"/>
              </svg>
            </div>
            <div>
              <p className="text-3xl font-black text-slate-800 tracking-tight">₹{totalSpend.toFixed(0)}</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Total Spend</p>
            </div>
          </div>

          <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-rose-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-xl bg-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30 text-white">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-black text-rose-900 tracking-tight">
                {accountData && accountData.balance ? `₹${(parseFloat(accountData.balance) / 100).toFixed(2)}` : '₹0.00'}
              </p>
              <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mt-1">Due Balance</p>
            </div>
          </div>
          
          <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-amber-300 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30 text-white">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold text-amber-900 truncate tracking-tight" title={bestItemName || 'N/A'}>
                {bestItemName || 'No Data Yet'}
              </p>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mt-1">
                {viewLevel === 'campaign' ? 'Best Campaign' : 'Best AdSet'}
              </p>
              {bestItemName && (
                <p className="text-xs text-amber-700 mt-0.5 font-medium">
                  {bestItemLeads} leads @ ₹{bestItemCpc}
                </p>
              )}
            </div>
          </div>
        </div>
        
      </div>

      {/* Data List */}
      <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200 overflow-hidden">
        <div className="p-5 bg-[var(--color-brand)] flex items-center justify-between flex-wrap gap-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-white uppercase tracking-wider text-sm">Performance Breakdown</h3>
            <span className="text-xs font-bold text-[var(--color-brand)] bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
              {viewLevel === 'adset' ? allAdsets.length + ' AdSets' : data.length + ' Campaigns'}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-white/10 rounded-lg p-1 border border-white/20 shadow-inner overflow-hidden text-sm font-medium">
              <button 
                onClick={() => setViewLevel('hierarchy')}
                className={`px-4 py-1.5 rounded-md transition-all ${viewLevel === 'hierarchy' ? 'bg-white text-[var(--color-brand)] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
              >
                Tree View
              </button>
              <button 
                onClick={() => setViewLevel('campaign')}
                className={`px-4 py-1.5 rounded-md transition-all mx-1 ${viewLevel === 'campaign' ? 'bg-white text-[var(--color-brand)] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
              >
                Campaigns Only
              </button>
              <button 
                onClick={() => setViewLevel('adset')}
                className={`px-4 py-1.5 rounded-md transition-all ${viewLevel === 'adset' ? 'bg-white text-[var(--color-brand)] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
              >
                AdSets Only
              </button>
              <button 
                onClick={() => setViewLevel('custom_report')}
                className={`px-4 py-1.5 rounded-md transition-all ${viewLevel === 'custom_report' ? 'bg-white text-[var(--color-brand)] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
              >
                Custom Report Builder
              </button>

            </div>
            
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-white/20 rounded-lg text-sm font-semibold text-[var(--color-brand)] hover:bg-slate-50 transition-colors shadow-sm"
            >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export CSV
            </button>
          </div>
        </div>
        
        <div className="flex flex-col">
          {processedData.length === 0 && !loading && (
            <div className="p-12 text-center">
              <div className="text-3xl mb-2">📊</div>
              <p>No {viewLevel === 'campaign' ? 'Campaigns' : 'AdSets'} found.</p>
              <p className="text-xs mt-1">Graph will appear here once you create {viewLevel === 'campaign' ? 'Campaigns' : 'AdSets'}.</p>
            </div>
          )}
          
          {(() => {
            const currentList = viewLevel === 'adset' ? allAdsets : processedData;
            const totalPages = Math.ceil(currentList.length / itemsPerPage);
            const paginatedList = currentList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

            return (
              <>
                {viewLevel === 'adset' ? (
                  paginatedList.map((adset: any, idx: number) => (
                    <React.Fragment key={adset.id}>
                      {renderRow(adset, 0, false, null, idx)}
                    </React.Fragment>
                  ))
                ) : (
                  paginatedList.map((campaign: any, idx: number) => {
                    const isCampExpanded = expandedCampaigns.has(campaign.id);
                    
                    return (
                      <React.Fragment key={campaign.id}>
                        {renderRow(campaign, 0, isCampExpanded, toggleCampaignExpand, idx)}
                        
                        {viewLevel === 'hierarchy' && isCampExpanded && campaign.adsets?.data?.map((adset: any, adsetIdx: number) => {
                          const isAdSetExpanded = expandedAdSets.has(adset.id);
                          
                          return (
                            <React.Fragment key={adset.id}>
                              {renderRow(adset, 1, isAdSetExpanded, toggleAdSetExpand, adsetIdx)}
                              
                              {isAdSetExpanded && adset.ads?.data?.map((ad: any, adIdx: number) => (
                                renderRow(ad, 2, false, null, adIdx)
                              ))}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    );
                  })
                )}

                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-100 rounded-b-xl">
                    <span className="text-sm text-slate-500 font-medium">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, currentList.length)} of {currentList.length} Entries
                    </span>
                    <div className="flex gap-2">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
                      >
                        Previous
                      </button>
                      <button 
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
              </>
            );
          })()}
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-100 via-orange-50 to-orange-100 p-8 rounded-[2rem] border-2 border-orange-300 shadow-lg shadow-orange-500/20">
        {/* Time Series Graph Section */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rounded-3xl -z-10"></div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">📈</span>
              Performance Over Time
            </h3>
          </div>
          
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden" style={{ height: '450px' }}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            
            {timeSeriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeSeriesData.map(d => {
                  const actions = d.actions || [];
                  const leads = actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || 
                                actions.find(a => a.action_type === 'leads')?.value || 
                                actions.find(a => a.action_type === 'link_click')?.value || 0;
                  // Formatting date to a readable string like '12 Jul'
                  const dateObj = new Date(d.date_start);
                  const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  return {
                    name: dateStr,
                    spend: parseFloat(d.spend || 0),
                    leads: parseInt(leads)
                  };
                })} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <defs>
                    <linearGradient id="timeColorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#9333ea" stopOpacity={0.6}/>
                    </linearGradient>
                    <linearGradient id="timeColorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} 
                    dy={15}
                  />
                  
                  <YAxis 
                    yAxisId="left" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} 
                    dx={-10}
                    tickFormatter={(value) => value}
                  />
                  
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} 
                    dx={10}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  
                  <RechartsTooltip 
                    cursor={{fill: '#f8fafc', opacity: 0.8}} 
                    contentStyle={{
                      borderRadius: '16px', 
                      border: '1px solid rgba(255,255,255,0.9)', 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(12px)',
                      boxShadow: '0 20px 40px -10px rgb(0 0 0 / 0.1)', 
                      padding: '16px 20px',
                    }}
                    formatter={(value, name) => [
                      <span className="font-bold text-slate-800 text-base">{name === 'spend' ? `₹${Number(value).toFixed(2)}` : value}</span>, 
                      <span className="text-slate-500 font-semibold tracking-wide uppercase text-[10px] ml-2">{name === 'spend' ? 'Total Spent' : 'Total Leads'}</span>
                    ]}
                    labelStyle={{fontWeight: '800', color: '#0f172a', marginBottom: '12px', fontSize: '15px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px'}}
                  />
                  
                  <Legend 
                    wrapperStyle={{paddingTop: '30px', fontSize: '13px', fontWeight: 700, color: '#475569'}} 
                    iconType="circle"
                    iconSize={10}
                  />
                  
                  <Bar 
                    yAxisId="left" 
                    dataKey="leads" 
                    name="Leads" 
                    fill="url(#timeColorLeads)"
                    radius={[8, 8, 8, 8]} 
                    maxBarSize={48} 
                    minPointSize={5}
                    animationDuration={1500} 
                    animationEasing="ease-out"
                  />
                  
                  <Bar 
                    yAxisId="right" 
                    dataKey="spend" 
                    name="Total Spent" 
                    fill="url(#timeColorCost)"
                    radius={[8, 8, 8, 8]} 
                    maxBarSize={48} 
                    minPointSize={5}
                    animationDuration={2000}
                    animationEasing="ease-in-out"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center opacity-70">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">📅</span>
                </div>
                <p className="text-lg font-bold text-slate-700">No Time-Series Data</p>
                <p className="text-sm text-slate-500 max-w-md text-center mt-2 font-medium">Select a broader date range to see day-by-day performance trends over time.</p>
              </div>
            )}
          </div>
        </div>

        {/* AdSet Comparison Graph Section */}
        <div className="mt-10 pt-10 border-t border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              {viewLevel === 'campaign' ? 'Campaign Performance Comparison' : 'AdSet Performance Comparison'}
            </h3>
          </div>
          
          <div className="h-[450px] w-full bg-white rounded-3xl p-6 shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group">
            {/* Decorative ambient background */}
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-to-br from-indigo-400/20 via-purple-400/20 to-pink-400/20 rounded-full blur-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none"></div>
            
            {graphData.length > 0 && graphData.some(d => d.leads > 0 || d.spend > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={graphData} margin={{ top: 30, right: 30, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.4}/>
                    </linearGradient>
                    <linearGradient id="colorLeadsGood" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.4}/>
                    </linearGradient>
                    <linearGradient id="colorLeadsBad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0.4}/>
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000000" floodOpacity="0.15"/>
                    </filter>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.8} />
                  
                  <XAxis 
                    dataKey="name" 
                    axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }} 
                    tickLine={false} 
                    tick={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} 
                    dy={16} 
                    padding={{ left: 20, right: 20 }}
                  />
                  <YAxis 
                    yAxisId="left" 
                    orientation="left" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 13, fill: '#94a3b8', fontWeight: 500 }} 
                    dx={-10}
                    allowDecimals={false}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 13, fill: '#f59e0b', fontWeight: 700 }} 
                    tickFormatter={(val) => `₹${val}`} 
                    dx={10}
                  />
                  
                  <RechartsTooltip 
                    cursor={{fill: '#f8fafc', opacity: 0.8}} 
                    contentStyle={{
                      borderRadius: '16px', 
                      border: '1px solid rgba(255,255,255,0.9)', 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(12px)',
                      boxShadow: '0 20px 40px -10px rgb(0 0 0 / 0.1)', 
                      padding: '16px 20px',
                    }}
                    formatter={(value, name) => [
                      <span className="font-bold text-slate-800 text-base">{name === 'spend' ? `₹${Number(value).toFixed(2)}` : value}</span>, 
                      <span className="text-slate-500 font-semibold tracking-wide uppercase text-[10px] ml-2">{name === 'spend' ? 'Total Spent' : 'Total Leads'}</span>
                    ]}
                    labelStyle={{fontWeight: '800', color: '#0f172a', marginBottom: '12px', fontSize: '15px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px'}}
                  />
                  
                  <Legend 
                    wrapperStyle={{paddingTop: '30px', fontSize: '13px', fontWeight: 700, color: '#475569'}} 
                    iconType="circle"
                    iconSize={10}
                  />
                  
                  <Bar 
                    yAxisId="left" 
                    dataKey="leads" 
                    name="Leads" 
                    radius={[8, 8, 8, 8]} 
                    maxBarSize={48} 
                    minPointSize={5}
                    filter="url(#barShadow)" 
                    animationDuration={1500} 
                    animationEasing="ease-out"
                  >
                    {graphData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#${entry.cpcRaw > expensiveThreshold ? 'colorLeadsBad' : entry.cpcRaw <= excellentThreshold ? 'colorLeadsGood' : 'colorLeads'})`} 
                      />
                    ))}
                  </Bar>
                  
                  <Bar 
                    yAxisId="right" 
                    dataKey="spend" 
                    name="Total Spent" 
                    fill="url(#colorCost)"
                    radius={[8, 8, 8, 8]} 
                    maxBarSize={48} 
                    minPointSize={5}
                    animationDuration={2000}
                    animationEasing="ease-in-out"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-2xl relative overflow-hidden">
                {/* Decorative background elements for empty state */}
                <div className="absolute top-10 left-10 w-32 h-32 bg-[var(--color-brand)] rounded-full blur-3xl opacity-30"></div>
                <div className="absolute bottom-10 right-10 w-40 h-40 bg-indigo-100 rounded-full blur-3xl opacity-30"></div>
                
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <span className="text-4xl filter drop-shadow-md">📈</span>
                  </div>
                  <h4 className="text-lg font-black text-slate-700 tracking-tight">No Performance Data Yet</h4>
                  <p className="text-sm text-slate-500 mt-2 max-w-sm text-center font-medium leading-relaxed">
                    Once your AdSets start generating leads and spending budget, a beautiful performance graph will appear right here.
                  </p>
                </div>
              </div>
            )}
          </div>
          {graphData.length > 0 && avgCpcVal > 0 && (
            <div className="flex gap-4 mt-3 text-xs justify-center text-slate-500 font-medium">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-[#34D399]"></div> Excellent CPC (≤ ₹{excellentThreshold.toFixed(1)})</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-[#818CF8]"></div> Average CPC (₹{(excellentThreshold + 0.1).toFixed(1)} - ₹{expensiveThreshold.toFixed(1)})</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-[#FCA5A5]"></div> Expensive CPC ({'>'} ₹{expensiveThreshold.toFixed(1)})</div>
            </div>
          )}
        </div>
      </div>

      {/* Full-Screen Modal for Insights */}
      {activeInsightsItem && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 sm:p-6 md:p-8 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto" style={{ maxHeight: '100vh' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-auto flex flex-col overflow-hidden border border-slate-200" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
            <div className="flex justify-between items-center p-5 border-b-2 border-orange-200 bg-gradient-to-r from-orange-50 to-orange-100/50 shrink-0">
              <h2 className="text-xl font-black text-orange-950 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shadow-md shadow-orange-500/30 text-white">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/>
                  </svg>
                </div>
                {activeInsightsItem.item.name} 
                <span className="text-xs font-bold text-orange-700 uppercase tracking-widest px-2.5 py-1 bg-orange-200/70 border border-orange-300 rounded-lg">
                  {activeInsightsItem.level}
                </span>
              </h2>
              <button 
                onClick={() => setActiveInsightsItem(null)}
                className="p-2 bg-white border-2 border-orange-200 rounded-xl text-orange-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 shadow-sm transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              <AdDetailPanel 
                item={activeInsightsItem.item} 
                level={activeInsightsItem.level} 
                metrics={activeInsightsItem.metrics} 
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
export default ClickToWhatsAppAnalytics;
