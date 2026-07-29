import React, { useState } from 'react';
import { CampaignTree, AdSetTree, AdTree } from './AdCampaignBuilder';

interface CampaignReviewProps {
  campaign: CampaignTree;
  onPreviewAd?: (adSetId: string, adId: string) => void;
  selectedAdId?: string;
}

export default function CampaignReview({ campaign, onPreviewAd, selectedAdId }: CampaignReviewProps) {
  const [collapsedSets, setCollapsedSets] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string) => {
    setCollapsedSets(prev => ({ ...prev, [id]: !prev[id] }));
  };
  return (
    <div className="campaign-review-container" style={{ padding: '24px', background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Campaign Summary Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '2px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #046B2F, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(4, 107, 47, 0.3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>{campaign.name || 'Unnamed Campaign'}</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '0.8rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
                {campaign.objective === 'OUTCOME_SALES' ? 'Sales' : campaign.objective === 'OUTCOME_LEADS' ? 'Leads' : campaign.objective === 'OUTCOME_ENGAGEMENT' ? 'Engagement' : campaign.objective === 'OUTCOME_TRAFFIC' ? 'Traffic' : 'Awareness'}
              </span>
              <span style={{ fontSize: '0.8rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
                {campaign.budgetOptimization === 'CBO' ? `CBO (₹${campaign.dailyBudget}/day)` : 'ABO (Ad Set Budgets)'}
              </span>
            </div>
          </div>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#64748b' }}>
          Review your campaign structure below. You are launching <strong style={{ color: '#ea580c', fontSize: '1.05em' }}>{campaign.adSets.length}</strong> Ad Set(s) with a total of <strong style={{ color: '#ea580c', fontSize: '1.05em' }}>{campaign.adSets.reduce((acc, s) => acc + s.ads.length, 0)}</strong> Ad(s). Click on any Ad to preview it on the right.
        </p>
      </div>

      {/* Ad Sets List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {campaign.adSets.map((adSet, index) => {
          const isCollapsed = collapsedSets[adSet.id];
          return (
          <div key={adSet.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            
            {/* Ad Set Header */}
            <div 
              onClick={() => toggleCollapse(adSet.id)}
              style={{ padding: '16px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0', borderLeft: '4px solid #046B2F', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span style={{ fontSize: '1.1rem' }}>👥</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#046B2F', fontWeight: 800 }}>{adSet.name}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {isCollapsed && <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{adSet.ads.length} Ad(s)</span>}
                {campaign.budgetOptimization === 'ABO' && (
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#046B2F', background: '#dcfce7', padding: '4px 12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                    ₹{adSet.budget}/day
                  </div>
                )}
              </div>
            </div>

            {!isCollapsed && (
              <>
                {/* Targeting Summary */}
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>Location</div>
                <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                  {(() => {
                    const countries = (adSet.targetCountries || '').split('|').filter(Boolean);
                    const included = countries.filter(c => adSet.locationTypes?.[c] !== 'exclude');
                    const excluded = countries.filter(c => adSet.locationTypes?.[c] === 'exclude');
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {included.length > 0 && <div><span style={{color:'#046B2F', fontWeight:700}}>Include:</span> {included.join(', ')}</div>}
                        {excluded.length > 0 && <div><span style={{color:'#DC2626', fontWeight:700}}>Exclude:</span> {excluded.join(', ')}</div>}
                        {included.length === 0 && excluded.length === 0 && 'Not specified'}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>Age & Gender</div>
                <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                  {adSet.minAge} - {adSet.maxAge} • {adSet.gender === 'ALL' ? 'All Genders' : adSet.gender === '1' ? 'Men' : 'Women'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>Targeting</div>
                <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                  {(() => {
                    const dt = adSet.detailedTargeting || [];
                    if (dt.length === 0) return 'Broad (None)';
                    const inc = dt.filter(t => t.mode === 'include').map(t=>t.name);
                    const narrow = dt.filter(t => t.mode === 'narrow').map(t=>t.name);
                    const exc = dt.filter(t => t.mode === 'exclude').map(t=>t.name);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {inc.length > 0 && <div><span style={{color:'#046B2F', fontWeight:700}}>Include:</span> {inc.join(', ')}</div>}
                        {narrow.length > 0 && <div><span style={{color:'#0284c7', fontWeight:700}}>Must Also Match:</span> {narrow.join(', ')}</div>}
                        {exc.length > 0 && <div><span style={{color:'#DC2626', fontWeight:700}}>Exclude:</span> {exc.join(', ')}</div>}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Ads List */}
            <div style={{ padding: '20px 16px' }}>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {adSet.ads.length} Ad(s)
                <div style={{ height: '1px', background: '#e2e8f0', flex: 1 }}></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {adSet.ads.map(ad => {
                  const isSelected = ad.id === selectedAdId;
                  return (
                    <div 
                      key={ad.id} 
                      onClick={() => onPreviewAd && onPreviewAd(adSet.id, ad.id)}
                      style={{ 
                        background: isSelected ? '#f0fdf4' : 'white', 
                        border: isSelected ? '2px solid #046B2F' : '1px solid #cbd5e1', 
                        borderRadius: '8px', 
                        overflow: 'hidden', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        boxShadow: isSelected ? '0 4px 12px rgba(4, 107, 47, 0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
                        cursor: onPreviewAd ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        transform: isSelected ? 'translateY(-2px)' : 'none'
                      }}
                    >
                      <div style={{ height: '140px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        {ad.mediaUrls && ad.mediaUrls.length > 0 ? (
                          ad.mediaUrls[0].match(/\.(mp4|webm|ogg|mov)(?:[\?#].*)?$/i) ? (
                            <video src={ad.mediaUrls[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <img src={ad.mediaUrls[0]} alt="Ad preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )
                        ) : (
                          <div style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                            No Media
                          </div>
                        )}
                        {ad.mediaUrls && ad.mediaUrls.length > 1 && (
                          <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            +{ad.mediaUrls.length - 1} more
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '12px' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: isSelected ? '#046B2F' : '#1e293b', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ad.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '8px' }}>
                          <strong>Headline:</strong> {ad.headline || 'None'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {ad.primaryText || 'No primary text'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
              </>
            )}

          </div>
        );
        })}
      </div>
    </div>
  );
}
