import React, { useState } from 'react';
import SidebarTreeView from './SidebarTreeView';

// Core State Structures for the new hierarchical layout
export type AdTree = {
  id: string;
  type: 'AD';
  name: string;
  mediaUrls: string[];
  primaryText: string;
  headline: string;
  description: string;
};

export type AdSetTree = {
  id: string;
  type: 'AD_SET';
  name: string;
  budget: number;
  targetCountries: string;
  minAge: number;
  maxAge: number;
  gender: string;
  locationRadiuses?: Record<string, number>;
  locationTypes?: Record<string, 'include' | 'exclude'>;
  detailedTargeting?: any[];
  metaLocations?: { name: string, radius: number, type: 'include' | 'exclude' }[];
  droppedPins?: {lat: number, lng: number, name?: string}[];
  advantagePlacements: boolean;
  publisherPlatforms: string[];
  startTime?: string;
  endTime?: string;
  ads: AdTree[];
};

export type CampaignTree = {
  id: string;
  type: 'CAMPAIGN';
  name: string;
  objective: string;
  budgetOptimization: 'CBO' | 'ABO';
  dailyBudget: number;
  adSets: AdSetTree[];
};

// Initial Placeholder State
const initialCampaign: CampaignTree = {
  id: 'campaign-1',
  type: 'CAMPAIGN',
  name: 'New WhatsApp Campaign',
  objective: 'OUTCOME_SALES',
  budgetOptimization: 'CBO',
  dailyBudget: 1000,
  adSets: [
    {
      id: 'adset-1',
      type: 'AD_SET',
      name: 'Ad Set 1',
      budget: 500,
      targetCountries: 'IN',
      minAge: 18,
      maxAge: 65,
      gender: 'ALL',
      advantagePlacements: true,
      publisherPlatforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
      ads: [
        {
          id: 'ad-1',
          type: 'AD',
          name: 'Ad 1',
          mediaUrls: [],
          primaryText: 'Get instant support!',
          headline: 'Chat with us on WhatsApp',
          description: ''
        }
      ]
    }
  ]
};

const AdCampaignBuilder: React.FC = () => {
  const [campaign, setCampaign] = useState<CampaignTree>(initialCampaign);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(campaign.id);
  const [selectedNodeType, setSelectedNodeType] = useState<'CAMPAIGN' | 'AD_SET' | 'AD'>('CAMPAIGN');

  const handleSelectNode = (id: string, type: 'CAMPAIGN' | 'AD_SET' | 'AD') => {
    setSelectedNodeId(id);
    setSelectedNodeType(type);
  };

  const handleAddAdSet = () => {
    const newAdSetId = `adset-${Date.now()}`;
    const newAdSet: AdSetTree = {
      id: newAdSetId,
      type: 'AD_SET',
      name: `Ad Set ${campaign.adSets.length + 1}`,
      budget: 500,
      targetCountries: 'IN',
      minAge: 18,
      maxAge: 65,
      gender: 'ALL',
      locationRadiuses: {},
      locationTypes: {},
      detailedTargeting: [],
      droppedPins: [],
      advantagePlacements: true,
      publisherPlatforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
      ads: [
        {
          id: `ad-${Date.now()}`,
          type: 'AD',
          name: 'Ad 1',
          mediaUrls: [],
          primaryText: 'Get instant support!',
          headline: 'Chat with us on WhatsApp',
          description: ''
        }
      ]
    };
    setCampaign({
      ...campaign,
      adSets: [...campaign.adSets, newAdSet]
    });
    handleSelectNode(newAdSetId, 'AD_SET');
  };

  const handleDuplicateAdSet = (id: string) => {
    const adSetToCopy = campaign.adSets.find(s => s.id === id);
    if (!adSetToCopy) return;

    const newAdSetId = `adset-${Date.now()}`;
    const newAdSet: AdSetTree = {
      ...adSetToCopy,
      id: newAdSetId,
      name: `${adSetToCopy.name} (copy)`,
      ads: adSetToCopy.ads.map(ad => ({
        ...ad,
        id: `ad-${Date.now()}-${Math.random()}`
      }))
    };

    setCampaign({
      ...campaign,
      adSets: [...campaign.adSets, newAdSet]
    });
    handleSelectNode(newAdSetId, 'AD_SET');
  };

  const handleDeleteAdSet = (id: string) => {
    if (campaign.adSets.length <= 1) {
      alert("You must have at least one Ad Set.");
      return;
    }
    const newAdSets = campaign.adSets.filter(s => s.id !== id);
    setCampaign({
      ...campaign,
      adSets: newAdSets
    });
    // Auto-select Campaign if we deleted the currently selected adset
    if (selectedNodeId === id || campaign.adSets.find(s => s.id === id)?.ads.some(a => a.id === selectedNodeId)) {
      handleSelectNode(campaign.id, 'CAMPAIGN');
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: '#f8fafc', overflow: 'hidden' }}>
      {/* LEFT SIDEBAR - TREE VIEW */}
      <SidebarTreeView 
        campaign={campaign}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
        onAddAdSet={handleAddAdSet}
        onDuplicateAdSet={handleDuplicateAdSet}
        onDeleteAdSet={handleDeleteAdSet}
      />

      {/* RIGHT MAIN AREA - FORM */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          
          {selectedNodeType === 'CAMPAIGN' && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Campaign Settings</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Campaign Name</label>
                  <input 
                    type="text" 
                    value={campaign.name} 
                    onChange={(e) => setCampaign({...campaign, name: e.target.value})}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Budget Optimization</label>
                  <select 
                    value={campaign.budgetOptimization}
                    onChange={(e) => setCampaign({...campaign, budgetOptimization: e.target.value as 'CBO' | 'ABO'})}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="CBO">Advantage+ Campaign Budget (CBO)</option>
                    <option value="ABO">Ad Set Budget Optimization (ABO)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {selectedNodeType === 'AD_SET' && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Ad Set Settings</h2>
              <p style={{ color: '#64748b' }}>Here you will configure your audience, locations, detailed targeting, and placements for the selected Ad Set.</p>
              {/* Future Integration: Move the Leaflet Map and Targeting Selectors here */}
              <div style={{ marginTop: '24px', padding: '16px', background: '#f1f5f9', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <p style={{ margin: 0, color: '#475569', fontSize: '14px', textAlign: 'center' }}>
                  Audience & Placement Controls will be migrated here from the old wizard.
                </p>
              </div>
            </div>
          )}

          {selectedNodeType === 'AD' && (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Ad Creative Settings</h2>
              <p style={{ color: '#64748b' }}>Here you will upload media and set the primary text, headline, and WhatsApp icebreakers for the selected Ad.</p>
              {/* Future Integration: Move the Media Uploader here */}
              <div style={{ marginTop: '24px', padding: '16px', background: '#f1f5f9', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <p style={{ margin: 0, color: '#475569', fontSize: '14px', textAlign: 'center' }}>
                  Media Uploader & Text Inputs will be migrated here from the old wizard.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AdCampaignBuilder;
