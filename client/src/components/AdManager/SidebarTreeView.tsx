import React, { useState } from 'react';
import { CampaignTree } from './AdCampaignBuilder';

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

/* ── Injected styles ────────────────────────────────────────────────────── */
const CSS = `
  .stv-wrap * { box-sizing: border-box; }
  .stv-row { position: relative; display: flex; align-items: center; gap: 0; cursor: pointer; border-radius: 8px; transition: background 0.13s, border-color 0.13s; }
  .stv-row:hover { background: #f5f7fa !important; }
  .stv-row:hover .stv-acts { opacity: 1 !important; pointer-events: all !important; }
  .stv-acts { opacity: 0; pointer-events: none; display: flex; align-items: center; gap: 2px; transition: opacity 0.15s; }
  .stv-act-btn { border: none; cursor: pointer; border-radius: 5px; padding: 4px 5px; display: flex; align-items: center; justify-content: center; line-height: 0; transition: background 0.13s, color 0.13s; }
  .stv-add-inline { display: flex; align-items: center; gap: 6px; border-radius: 7px; cursor: pointer; border: none; background: transparent; transition: background 0.13s; font-family: inherit; }
  .stv-add-inline:hover { background: #f0f4ff; color: #4338ca !important; }
  .stv-add-inline.orange:hover { background: #fff7ed; color: #c2410c !important; }
  .stv-chev { border: none; cursor: pointer; background: transparent; padding: 2px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.13s; line-height: 0; }
  .stv-chev:hover { background: #e2e8f0; }
`;

/* ── Icons ────────────────────────────────────────────────────────────────── */
const ChevRight = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ display:'block', transition:'transform 0.2s ease', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const Plus = ({ s = 12 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const Copy = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const Trash = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);
const IcoCampaign = ({ active }: { active: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? '#4f46e5' : '#94a3b8'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const IcoAdSet = ({ active }: { active: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={active ? '#059669' : '#94a3b8'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IcoAd = ({ active }: { active: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={active ? '#f97316' : '#94a3b8'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
);

/* ── Small action button ────────────────────────────────────────────────── */
const ActBtn = ({ onClick, title, color, bg, children }: {
  onClick: (e: React.MouseEvent) => void;
  title: string; color: string; bg: string;
  children: React.ReactNode;
}) => (
  <button
    className="stv-act-btn"
    onClick={onClick} title={title}
    style={{ color: '#64748b', background: '#eef2f7' }}
    onMouseEnter={e => { e.currentTarget.style.background = bg; e.currentTarget.style.color = color; }}
    onMouseLeave={e => { e.currentTarget.style.background = '#eef2f7'; e.currentTarget.style.color = '#64748b'; }}
  >
    {children}
  </button>
);

/* ── Level indicator stripe ──────────────────────────────────────────────── */
const Stripe = ({ color }: { color: string }) => (
  <div style={{ width: '3px', alignSelf: 'stretch', background: color, borderRadius: '2px', flexShrink: 0, margin: '4px 0' }} />
);

/* ── Main ────────────────────────────────────────────────────────────────── */
const SidebarTreeView: React.FC<SidebarTreeViewProps> = ({
  campaign, selectedNodeId, onSelectNode, onAddAdSet, onAddAd,
  onDuplicateAdSet, onDeleteAdSet, onDuplicateAd, onDeleteAd
}) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const campSel = selectedNodeId === campaign.id;
  const totalAds = campaign.adSets.reduce((a, s) => a + s.ads.length, 0);

  return (
    <div className="stv-wrap" style={{
      width: '100%',
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      position: 'sticky', top: '16px',
    }}>
      <style>{CSS}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '11px 14px 10px',
        borderBottom: '1px solid #e9ecf0',
        background: '#f8f9fb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 2px 8px rgba(37,211,102,0.3)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.01em' }}>Campaign Structure</div>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
              {campaign.adSets.length} Ad Sets · {totalAds} Ads
            </div>
          </div>
        </div>
        <button
          onClick={onAddAdSet} title="Add Ad Set"
          style={{
            width: '28px', height: '28px', borderRadius: '7px', border: 'none',
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            color: 'white', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(37,211,102,0.4)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,211,102,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(37,211,102,0.4)'; }}
        >
          <Plus s={13} />
        </button>
      </div>

      {/* ── Tree body ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 4px' }}>

        {/* ══ CAMPAIGN NODE ══════════════════════════════════════════════ */}
        <div
          className="stv-row"
          onClick={() => onSelectNode(campaign.id, 'CAMPAIGN')}
          style={{
            background: campSel ? '#eef2ff' : 'transparent',
            border: campSel ? '1px solid #c7d2fe' : '1px solid transparent',
            padding: '0 8px 0 0',
            marginBottom: '2px',
          }}
        >
          <Stripe color={campSel ? '#6366f1' : '#c7d2fe'} />

          <div style={{
            width: '32px', height: '32px', flexShrink: 0, margin: '6px 8px 6px 10px',
            borderRadius: '8px',
            background: campSel ? '#eef2ff' : '#f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: campSel ? '1.5px solid #c7d2fe' : '1.5px solid #e2e8f0',
          }}>
            <IcoCampaign active={campSel} />
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: campSel ? '#4f46e5' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>Campaign</div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: campSel ? '#1e1b4b' : '#1e293b', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {campaign.name || 'New Campaign'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 2px rgba(34,197,94,0.2)', flexShrink: 0 }} />
          </div>
        </div>

        {/* ══ AD SETS ════════════════════════════════════════════════════ */}
        <div style={{ paddingLeft: '12px', borderLeft: '2px solid #e9ecf0', marginLeft: '13px', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '2px' }}>

          {campaign.adSets.map((adSet, asi) => {
            const sel = selectedNodeId === adSet.id;
            const isCollapsed = collapsed.has(adSet.id);

            return (
              <div key={adSet.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>

                {/* Ad Set row */}
                <div
                  className="stv-row"
                  style={{
                    background: sel ? '#f0fdf4' : 'transparent',
                    border: sel ? '1px solid #bbf7d0' : '1px solid transparent',
                    padding: '0 6px 0 0',
                  }}
                >
                  {/* Left color stripe */}
                  <Stripe color={sel ? '#22c55e' : '#bbf7d0'} />

                  {/* Chevron */}
                  <button
                    className="stv-chev"
                    onClick={e => { e.stopPropagation(); toggle(adSet.id); }}
                    style={{ margin: '0 2px 0 8px', color: isCollapsed ? '#94a3b8' : '#22c55e' }}
                  >
                    <ChevRight open={!isCollapsed} />
                  </button>

                  {/* Icon */}
                  <div
                    onClick={() => onSelectNode(adSet.id, 'AD_SET')}
                    style={{
                      width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                      margin: '5px 8px 5px 4px',
                      background: sel ? '#dcfce7' : '#f0fdf4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: sel ? '1.5px solid #86efac' : '1.5px solid #d1fae5',
                    }}>
                    <IcoAdSet active={sel} />
                  </div>

                  {/* Labels */}
                  <div onClick={() => onSelectNode(adSet.id, 'AD_SET')} style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: sel ? '#059669' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Ad Set {asi + 1}
                      </span>
                      <span style={{
                        fontSize: '9.5px', fontWeight: 700,
                        background: sel ? '#dcfce7' : '#f1f5f9',
                        color: sel ? '#059669' : '#64748b',
                        padding: '1px 6px', borderRadius: '10px', lineHeight: '15px',
                      }}>
                        {adSet.ads.length}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: sel ? '#064e3b' : '#1e293b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {adSet.name}
                    </div>
                  </div>

                  {/* Actions (hover-reveal) */}
                  <div className="stv-acts" onClick={e => e.stopPropagation()}>
                    {onAddAd && (
                      <ActBtn onClick={() => onAddAd(adSet.id)} title="Add Ad" color="#059669" bg="#dcfce7"><Plus s={11}/></ActBtn>
                    )}
                    {onDuplicateAdSet && (
                      <ActBtn onClick={() => onDuplicateAdSet(adSet.id)} title="Duplicate" color="#4f46e5" bg="#eef2ff"><Copy /></ActBtn>
                    )}
                    {onDeleteAdSet && (
                      <ActBtn onClick={() => onDeleteAdSet(adSet.id)} title="Delete" color="#dc2626" bg="#fee2e2"><Trash /></ActBtn>
                    )}
                  </div>
                </div>

                {/* Ads under Ad Set */}
                {!isCollapsed && (
                  <div style={{ paddingLeft: '14px', borderLeft: '2px solid #e9ecf0', marginLeft: '17px', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '2px' }}>

                    {adSet.ads.map((ad, ai) => {
                      const adSel = selectedNodeId === ad.id;
                      return (
                        <div
                          key={ad.id}
                          className="stv-row"
                          style={{
                            background: adSel ? '#fff7ed' : 'transparent',
                            border: adSel ? '1px solid #fed7aa' : '1px solid transparent',
                            padding: '0 6px 0 0',
                          }}
                        >
                          <Stripe color={adSel ? '#f97316' : '#fed7aa'} />

                          <div
                            onClick={() => onSelectNode(ad.id, 'AD')}
                            style={{
                              width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
                              margin: '5px 8px 5px 10px',
                              background: adSel ? '#ffedd5' : '#fafafa',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: adSel ? '1.5px solid #fdba74' : '1.5px solid #e2e8f0',
                            }}>
                            <IcoAd active={adSel} />
                          </div>

                          <div onClick={() => onSelectNode(ad.id, 'AD')} style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: adSel ? '#ea580c' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              Ad {ai + 1}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: adSel ? '#7c2d12' : '#1e293b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ad.name}
                            </div>
                          </div>

                          <div className="stv-acts" onClick={e => e.stopPropagation()}>
                            {onDuplicateAd && (
                              <ActBtn onClick={() => onDuplicateAd(adSet.id, ad.id)} title="Duplicate" color="#4f46e5" bg="#eef2ff"><Copy /></ActBtn>
                            )}
                            {onDeleteAd && adSet.ads.length > 1 && (
                              <ActBtn onClick={() => onDeleteAd(adSet.id, ad.id)} title="Delete" color="#dc2626" bg="#fee2e2"><Trash /></ActBtn>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* + Add Ad */}
                    {onAddAd && (
                      <button
                        className="stv-add-inline orange"
                        onClick={() => onAddAd(adSet.id)}
                        style={{ padding: '6px 10px', color: '#f97316', fontSize: '11.5px', fontWeight: 600, width: '100%' }}
                      >
                        <Plus s={10} /> Add Ad
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* + Add Ad Set */}
          <button
            className="stv-add-inline"
            onClick={onAddAdSet}
            style={{ padding: '7px 10px', color: '#6366f1', fontSize: '11.5px', fontWeight: 600, width: '100%', marginTop: '2px' }}
          >
            <Plus s={10} /> Add Ad Set
          </button>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid #e9ecf0',
        background: '#f8f9fb',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 2px rgba(34,197,94,0.2)', flexShrink: 0 }} />
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Click to select · Hover for actions</span>
      </div>
    </div>
  );
};

export default SidebarTreeView;
