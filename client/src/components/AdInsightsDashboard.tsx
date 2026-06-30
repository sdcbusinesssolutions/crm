import React, { useState, useEffect } from 'react';
import './AdInsightsDashboard.css';
import { tokenService } from '../services/tokenService';

interface AdInsightsDashboardProps {
  level: string;
  entityId: string;
}

const AdInsightsDashboard: React.FC<AdInsightsDashboardProps> = ({ level, entityId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
              
        const response = await fetch(`/api/click-to-whatsapp/insights/${level}/${entityId}`, {
          headers: authHeader
        });
        
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to load insights.');
        }

        const dataArr = result.data;
        if (dataArr && dataArr.length > 0) {
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
            currency: 'USD' // Meta insights returns currency in account settings, assuming USD for now
          });
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [level, entityId]);

  if (loading) {
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
    </div>
  );
};

export default AdInsightsDashboard;
