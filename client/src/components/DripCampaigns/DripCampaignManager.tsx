import React, { useState } from 'react';
import DripList from './DripList';
import DripBuilder from './DripBuilder';

const DripCampaignManager: React.FC<{ onToggleSidebar: () => void }> = ({ onToggleSidebar }) => {
    const [view, setView] = useState<'list' | 'builder'>('list');
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

    const handleCreate = () => {
        setSelectedCampaignId(null);
        setView('builder');
    };

    const handleEdit = (id: string) => {
        setSelectedCampaignId(id);
        setView('builder');
    };

    const handleBack = () => {
        setSelectedCampaignId(null);
        setView('list');
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
                    campaignId={selectedCampaignId}
                    onBack={handleBack}
                />
            )}
        </div>
    );
};

export default DripCampaignManager;
