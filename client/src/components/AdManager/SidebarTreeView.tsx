import React from 'react';
import { CampaignTree, AdSetTree } from './AdCampaignBuilder';

interface SidebarTreeViewProps {
  campaign: CampaignTree;
  selectedNodeId: string;
  onSelectNode: (id: string, type: 'CAMPAIGN' | 'AD_SET' | 'AD') => void;
  onAddAdSet: () => void;
  onAddAd?: (adSetId: string) => void;
  onDuplicateNode?: (id: string) => void;
  onDeleteNode?: (id: string) => void;
  onDuplicateAdSet?: (id: string) => void;
  onDeleteAdSet?: (id: string) => void;
  onDuplicateAd?: (adSetId: string, adId: string) => void;
  onDeleteAd?: (adSetId: string, adId: string) => void;
}

const SidebarTreeView: React.FC<SidebarTreeViewProps> = ({ 
  campaign, selectedNodeId, onSelectNode, onAddAdSet, onAddAd,
  onDuplicateAdSet, onDeleteAdSet, onDuplicateAd, onDeleteAd
}) => {
  return (
    <div style={{ 
      width: '260px', 
      minWidth: '260px',
      background: '#ffffff', 
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      height: 'fit-content',
      position: 'sticky',
      top: '16px'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '14px 16px', 
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '13px', letterSpacing: '0.02em' }}>Campaign Structure</span>
        </div>
        <button 
          onClick={onAddAdSet}
          style={{ 
            background: '#25D366', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            width: '24px', 
            height: '24px', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '18px',
            lineHeight: 1
          }}
          title="Add Ad Set"
        >
          +
        </button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {/* Campaign Root Node */}
        <div 
          onClick={() => onSelectNode(campaign.id, 'CAMPAIGN')}
          style={{ 
            padding: '8px 12px',
            marginBottom: '4px',
            background: selectedNodeId === campaign.id 
              ? 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)'
              : 'transparent',
            borderRadius: '8px',
            cursor: 'pointer',
            border: selectedNodeId === campaign.id ? '1px solid #c7d2fe' : '1px solid transparent',
            fontWeight: 700,
            fontSize: '13px',
            color: selectedNodeId === campaign.id ? '#3730a3' : '#334155',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: '24px', height: '24px', background: selectedNodeId === campaign.id ? '#6366f1' : '#e2e8f0',
            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={selectedNodeId === campaign.id ? 'white' : '#64748b'} strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: selectedNodeId === campaign.id ? '#6366f1' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>Campaign</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: selectedNodeId === campaign.id ? '#3730a3' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.name || 'New Campaign'}</div>
          </div>
        </div>

        {/* Ad Sets */}
        <div style={{ marginLeft: '8px', paddingLeft: '12px', borderLeft: '2px solid #e2e8f0', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {campaign.adSets.map((adSet) => (
            <div key={adSet.id}>
              {/* Ad Set Node */}
              <div 
                style={{ 
                  padding: '8px 10px',
                  background: selectedNodeId === adSet.id 
                    ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                    : 'transparent',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: selectedNodeId === adSet.id ? '1px solid #86efac' : '1px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
              >
                <div 
                  onClick={() => onSelectNode(adSet.id, 'AD_SET')} 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}
                >
                  <div style={{
                    width: '22px', height: '22px', background: selectedNodeId === adSet.id ? '#22c55e' : '#e2e8f0',
                    borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={selectedNodeId === adSet.id ? 'white' : '#64748b'} strokeWidth="2.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: selectedNodeId === adSet.id ? '#16a34a' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>Ad Set</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: selectedNodeId === adSet.id ? '#15803d' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adSet.name}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                  {onAddAd && (
                    <button onClick={(e) => { e.stopPropagation(); onAddAd(adSet.id); }} 
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#22c55e', padding: '3px', borderRadius: '4px', display: 'flex' }} 
                      title="Add Ad">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  )}
                  {onDuplicateAdSet && (
                    <button onClick={(e) => { e.stopPropagation(); onDuplicateAdSet(adSet.id); }} 
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '3px', borderRadius: '4px', display: 'flex' }} 
                      title="Duplicate Ad Set">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                  )}
                  {onDeleteAdSet && (
                    <button onClick={(e) => { e.stopPropagation(); onDeleteAdSet(adSet.id); }} 
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#f87171', padding: '3px', borderRadius: '4px', display: 'flex' }} 
                      title="Delete Ad Set">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Ads under Ad Set */}
              <div style={{ marginLeft: '8px', paddingLeft: '12px', borderLeft: '2px solid #e2e8f0', marginTop: '2px', marginBottom: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {adSet.ads.map((ad) => (
                  <div 
                    key={ad.id}
                    style={{ 
                      padding: '7px 10px', 
                      background: selectedNodeId === ad.id 
                        ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'
                        : 'transparent',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      border: selectedNodeId === ad.id ? '1px solid #fed7aa' : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div 
                      onClick={() => onSelectNode(ad.id, 'AD')}
                      style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, minWidth: 0 }}
                    >
                      <div style={{
                        width: '20px', height: '20px', background: selectedNodeId === ad.id ? '#f97316' : '#e2e8f0',
                        borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={selectedNodeId === ad.id ? 'white' : '#64748b'} strokeWidth="2.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: selectedNodeId === ad.id ? '#ea580c' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>Ad</div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: selectedNodeId === ad.id ? '#c2410c' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.name}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      {onDuplicateAd && (
                        <button onClick={(e) => { e.stopPropagation(); onDuplicateAd(adSet.id, ad.id); }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '3px', borderRadius: '4px', display: 'flex' }}
                          title="Duplicate Ad">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                      )}
                      {onDeleteAd && adSet.ads.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); onDeleteAd(adSet.id, ad.id); }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#f87171', padding: '3px', borderRadius: '4px', display: 'flex' }}
                          title="Delete Ad">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer hint */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          Click a node to edit it
        </div>
      </div>
    </div>
  );
};

export default SidebarTreeView;

