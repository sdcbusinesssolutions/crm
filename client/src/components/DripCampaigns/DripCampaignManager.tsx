import React, { useState } from 'react';
import DripList from './DripList';
import DripBuilder from './DripBuilder';

const DripCampaignManager: React.FC<{ onToggleSidebar: () => void, initialView?: 'list' | 'builder', onExit?: () => void }> = ({ onToggleSidebar, initialView = 'list', onExit }) => {
    const [view, setView] = useState<'list' | 'builder'>(initialView);
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
                    campaignId={selectedCampaignId}
                    onBack={handleBack}
                />
            )}
        </div>
    );
};

export default DripCampaignManager;
