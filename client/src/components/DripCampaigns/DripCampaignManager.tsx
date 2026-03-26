import React, { useState } from 'react';
import DripList from './DripList';
import DripBuilder from './DripBuilder';

const DripCampaignManager: React.FC<{ onToggleSidebar: () => void, initialView?: 'list' | 'builder', initialCampaignId?: string | null, initialCampaignName?: string, onExit?: () => void }> = ({ onToggleSidebar, initialView = 'list', initialCampaignId = null, initialCampaignName = '', onExit }) => {
    const [view, setView] = useState<'list' | 'builder'>(initialCampaignId ? 'builder' : initialView);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(initialCampaignId);
    const [selectedCampaignName, setSelectedCampaignName] = useState<string>(initialCampaignName);

    const handleCreate = () => {
        setSelectedCampaignId(null);
        setSelectedCampaignName('New Sequence');
        setView('builder');
    };

    const handleEdit = (id: string, name?: string) => {
        setSelectedCampaignId(id);
        if (name) setSelectedCampaignName(name);
        setView('builder');
    };

    const handleBack = () => {
        setSelectedCampaignId(null);

        // If we started in builder mode (direct navigation), exit should go back to origin
        if (initialView === 'builder' && onExit) {
            onExit();
        } else {
            setView('list');
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {view === 'list' ? (
                <DripList
                    onCreate={handleCreate}
                    onEdit={handleEdit}
                    onToggleSidebar={onToggleSidebar}
                />
            ) : (
                <DripBuilder
                    key={selectedCampaignId || 'new-drip'}
                    campaignId={selectedCampaignId}
                    initialCampaignName={selectedCampaignName}
                    onBack={handleBack}
                />
            )}
        </div>
    );
};

export default DripCampaignManager;
