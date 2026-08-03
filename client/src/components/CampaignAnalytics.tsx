import React, { useState } from 'react';
import AdInsightsDashboard from './AdInsightsDashboard';
import './ClickToWhatsAppLauncher.css'; // Reuse common container styles

const CampaignAnalytics = () => {
  const [entityId, setEntityId] = useState('');
  const [submittedId, setSubmittedId] = useState('');
  const [level, setLevel] = useState('campaign');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedId(entityId);
  };

  return (
    <div className="ctwa-container">
      <div className="ctwa-card" style={{ maxWidth: '800px' }}>
        <div className="ctwa-header">
          <div className="ctwa-icon-container" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ctwa-icon">
               <line x1="18" y1="20" x2="18" y2="10"></line>
               <line x1="12" y1="20" x2="12" y2="4"></line>
               <line x1="6" y1="20" x2="6" y2="14"></line>
             </svg>
          </div>
          <h2>Campaign Analytics</h2>
          <p>Track the performance of your Click-to-WhatsApp Ads.</p>
        </div>

        <form onSubmit={handleSubmit} className="ctwa-form" style={{ marginBottom: '2rem' }}>
          <div className="ctwa-form-row">
            <div className="ctwa-form-group" style={{ flex: 1 }}>
              <label>Select Level</label>
              <select 
                value={level} 
                onChange={(e) => setLevel(e.target.value)} 
                className="ctwa-select"
              >
                <option value="campaign">Campaign</option>
                <option value="adset">Ad Set</option>
                <option value="ad">Ad</option>
              </select>
            </div>
            <div className="ctwa-form-group" style={{ flex: 2 }}>
              <label>Entity ID (Campaign, AdSet, or Ad ID)</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input 
                  type="text" 
                  placeholder="e.g. 1234567890123" 
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  required 
                  style={{ flex: 1 }}
                />
                <button type="submit" className="ctwa-submit-btn" style={{ padding: '0 1.5rem', width: 'auto' }}>
                  View Insights
                </button>
              </div>
            </div>
          </div>
        </form>

        {submittedId && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '2rem 0' }} />
            <AdInsightsDashboard level={level} entityId={submittedId} />
          </>
        )}
      </div>
    </div>
  );
};

export default CampaignAnalytics;
