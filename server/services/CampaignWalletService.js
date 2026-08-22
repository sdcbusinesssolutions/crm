/**
 * CampaignWalletService
 * Implements the Enterprise 0-Loss Architecture calculations for Campaign Safe Batching.
 */

const WalletService = require('./WalletService');

class CampaignWalletService {
    /**
     * Calculates the mathematically safe batch size based on current available balance 
     * and the highest possible risk rate (MARKETING).
     * @param {number} availableBalance The user's current available wallet balance
     * @param {number} marketingRate The platform's MARKETING rate for this user/country
     * @param {number} maxCap Optional maximum cap (e.g. 500) to force periodic live checks for rich users.
     * @returns {number} The safe batch size (0 if insufficient for even 1 message)
     */
    static calculateSafeBatchSize(availableBalance, marketingRate, maxCap = 500) {
        if (!marketingRate || marketingRate <= 0) return maxCap;
        if (availableBalance <= 0) return 0;
        
        const rawBatchSize = Math.floor(availableBalance / marketingRate);
        return Math.max(0, Math.min(rawBatchSize, maxCap));
    }

    /**
     * Fetches the applicable platform rates for a user/whatsapp_account.
     * Needs to fetch both UTILITY and MARKETING to calculate differences if needed.
     */
    static async getPlatformRates(userId, whatsappAccountId) {
        // Fetch actual platform rates via WalletService or DB
        const marketingRate = await WalletService.getRate(userId, 'MARKETING', whatsappAccountId) || 0.89;
        const utilityRate = await WalletService.getRate(userId, 'UTILITY', whatsappAccountId) || 0.32;
        
        return {
            marketingRate: parseFloat(marketingRate),
            utilityRate: parseFloat(utilityRate)
        };
    }
}

module.exports = CampaignWalletService;
