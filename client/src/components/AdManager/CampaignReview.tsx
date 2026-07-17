import React from 'react';
import { CampaignTree, AdSetTree, AdTree } from './AdCampaignBuilder';

interface CampaignReviewProps {
  campaign: CampaignTree;
}

export default function CampaignReview({ campaign }: CampaignReviewProps) {
  return (
    <div className="campaign-review-container" style={{ padding: '24px', background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Campaign Summary Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '2px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>{campaign.name || 'Unnamed Campaign'}</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '0.8rem', background: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
                {campaign.objective === 'OUTCOME_SALES' ? 'Sales' : campaign.objective === 'OUTCOME_LEADS' ? 'Leads' : campaign.objective === 'OUTCOME_ENGAGEMENT' ? 'Engagement' : campaign.objective === 'OUTCOME_TRAFFIC' ? 'Traffic' : 'Awareness'}
              </span>
              <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
                {campaign.budgetOptimization === 'CBO' ? `CBO (₹${campaign.dailyBudget}/day)` : 'ABO (Ad Set Budgets)'}
              </span>
            </div>
          </div>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#64748b' }}>
          Review your campaign structure below. You are launching <strong>{campaign.adSets.length}</strong> Ad Set(s) with a total of <strong>{campaign.adSets.reduce((acc, s) => acc + s.ads.length, 0)}</strong> Ad(s).
        </p>
      </div>

      {/* Ad Sets List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {campaign.adSets.map((adSet, index) => (
          <div key={adSet.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            
            {/* Ad Set Header */}
            <div style={{ padding: '16px', background: '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1rem' }}>👥</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{adSet.name}</h3>
              </div>
              {campaign.budgetOptimization === 'ABO' && (
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#047857', background: '#dcfce7', padding: '4px 12px', borderRadius: '6px' }}>
                  ₹{adSet.budget}/day
                </div>
              )}
            </div>

            {/* Targeting Summary */}
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>Location</div>
                <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{adSet.targetCountries || 'Not specified'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>Age & Gender</div>
                <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                  {adSet.minAge} - {adSet.maxAge} • {adSet.gender === 'ALL' ? 'All Genders' : adSet.gender === '1' ? 'Men' : 'Women'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>Placements</div>
                <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                  {adSet.advantagePlacements ? 'Advantage+ (Auto)' : 'Manual'}
                </div>
              </div>
            </div>

            {/* Ads List */}
            <div style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, marginBottom: '12px' }}>{adSet.ads.length} Ad(s)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                {adSet.ads.map(ad => (
                  <div key={ad.id} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
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
                        <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          +{ad.mediaUrls.length - 1} more
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                ))}
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
