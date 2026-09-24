const DripTriggerService = {
    async handleTagAdded(userId, contact, addedTags) {
        // Stubbed
    },
    async handleTagRemoved(userId, contact, removedTags) {
        // Stubbed
    },
    async handleStageChanged(userId, lead, newStageId) {
        // Stubbed
    },
    async enrollContact(userId, contactId, campaign, contactObj = null) {
        return { success: true };
    },
    calculateDelay(startDate, value, unit) {
        return startDate || new Date();
    },
    async handleReply(userId, contactPhone) {
        // Stubbed
    },
    async syncCampaignEnrollments(userId, campaignId) {
        return { count: 0 };
    }
};

module.exports = DripTriggerService;
