const axios = require('axios');

class FacebookAdsService {
    /**
     * Fetch Ad Accounts associated with the user
     */
    static async fetchAdAccounts(accessToken) {
        try {
            const apiVersion = 'v20.0';
            const baseUrl = `https://graph.facebook.com/${apiVersion}`;
            const res = await axios.get(`${baseUrl}/me/adaccounts`, {
                params: {
                    fields: 'id,name,account_id',
                    access_token: accessToken
                }
            });
            return res.data.data;
        } catch (error) {
            console.error('Error fetching Ad Accounts:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to fetch Ad Accounts');
        }
    }

    /**
     * Fetch Facebook Pages managed by the user
     */
    static async fetchPages(accessToken) {
        try {
            const apiVersion = 'v20.0';
            const baseUrl = `https://graph.facebook.com/${apiVersion}`;
            const res = await axios.get(`${baseUrl}/me/accounts`, {
                params: {
                    fields: 'id,name,access_token',
                    access_token: accessToken
                }
            });
            return res.data.data;
        } catch (error) {
            console.error('Error fetching Pages:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to fetch Facebook Pages');
        }
    }

    /**
     * Fetch Ad Insights
     */
    static async fetchInsights(accessToken, entityId, level = 'campaign') {
        try {
            const apiVersion = 'v20.0';
            const baseUrl = `https://graph.facebook.com/${apiVersion}`;
            const res = await axios.get(`${baseUrl}/${entityId}/insights`, {
                params: {
                    fields: 'spend,reach,impressions,actions,date_start,date_stop',
                    level: level,
                    access_token: accessToken
                }
            });
            // The insights API returns an array in data.
            return res.data.data;
        } catch (error) {
            console.error('Error fetching Insights:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to fetch Ad Insights');
        }
    }

    /**
     * Launch a Click to WhatsApp Ad campaign
     */
    static async launchAd({
        accessToken,
        adAccountId,
        pageId,
        campaignName,
        dailyBudget,
        headline,
        primaryText,
        imageUrl,
        targetCountries,
        minAge,
        maxAge,
        gender,
        startDate,
        endDate
    }) {
        try {
            const apiVersion = 'v20.0';
            const baseUrl = `https://graph.facebook.com/${apiVersion}`;

            // Parse target countries e.g. "US, IN, GB" -> ["US", "IN", "GB"]
            const countriesArray = targetCountries
                ? targetCountries.split(',').map(c => c.trim().toUpperCase()).filter(c => c.length === 2)
                : ['US']; // Fallback

            // Step 0: Upload Image to Asset Library to get image_hash
            const imageRes = await axios.post(`${baseUrl}/act_${adAccountId}/adimages`, null, {
                params: {
                    url: imageUrl,
                    access_token: accessToken
                }
            });
            
            // Meta returns: { images: { "filename": { hash: "..." } } }
            // The filename is dynamically generated when uploading via URL, so we extract the first hash.
            const imagesMap = imageRes.data.images || {};
            const firstImageKey = Object.keys(imagesMap)[0];
            const imageHash = imagesMap[firstImageKey]?.hash;

            if (!imageHash) {
                throw new Error("Failed to retrieve image_hash from Meta after uploading image URL.");
            }

            // Step 1: Create Campaign
            const campaignRes = await axios.post(`${baseUrl}/act_${adAccountId}/campaigns`, null, {
                params: {
                    name: campaignName,
                    objective: 'OUTCOME_ENGAGEMENT',
                    status: 'ACTIVE',
                    special_ad_categories: '[]',
                    access_token: accessToken
                }
            });
            const campaignId = campaignRes.data.id;

            // Prepare Gender targeting
            const gendersArray = gender === 'all' ? [1, 2] : [parseInt(gender)];

            // Prepare Start and End time
            const scheduleParams = {};
            if (startDate) {
                scheduleParams.start_time = new Date(startDate).toISOString();
            }
            if (endDate) {
                scheduleParams.end_time = new Date(endDate).toISOString();
            }

            // Step 2: Create Ad Set
            const adSetParams = {
                name: `${campaignName} - Ad Set`,
                campaign_id: campaignId,
                daily_budget: dailyBudget * 100, // Meta expects cents
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'CONVERSATIONS',
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                destination_type: 'WHATSAPP',
                promoted_object: JSON.stringify({ page_id: pageId }),
                targeting: JSON.stringify({
                    geo_locations: { countries: countriesArray },
                    device_platforms: ['mobile', 'desktop'],
                    age_min: minAge ? parseInt(minAge) : 18,
                    age_max: maxAge ? parseInt(maxAge) : 65,
                    genders: gendersArray
                }),
                status: 'ACTIVE',
                access_token: accessToken,
                ...scheduleParams
            };

            const adSetRes = await axios.post(`${baseUrl}/act_${adAccountId}/adsets`, null, { params: adSetParams });
            const adSetId = adSetRes.data.id;

            // Step 3: Create Ad Creative
            const creativeParams = {
                name: `${campaignName} - Creative`,
                object_story_spec: JSON.stringify({
                    page_id: pageId,
                    link_data: {
                        image_hash: imageHash,
                        link: 'https://api.whatsapp.com/send', // Standard for CTWA
                        name: headline,
                        message: primaryText,
                        call_to_action: {
                            type: 'WHATSAPP_MESSAGE',
                            value: { app_destination: 'WHATSAPP' }
                        }
                    }
                }),
                access_token: accessToken
            };

            const creativeRes = await axios.post(`${baseUrl}/act_${adAccountId}/adcreatives`, null, { params: creativeParams });
            const creativeId = creativeRes.data.id;

            // Step 4: Create Ad
            const adRes = await axios.post(`${baseUrl}/act_${adAccountId}/ads`, null, {
                params: {
                    name: `${campaignName} - Ad`,
                    adset_id: adSetId,
                    creative: JSON.stringify({ creative_id: creativeId }),
                    status: 'ACTIVE',
                    access_token: accessToken
                }
            });
            const adId = adRes.data.id;

            return {
                success: true,
                data: {
                    campaignId,
                    adSetId,
                    creativeId,
                    adId
                }
            };
        } catch (error) {
            console.error('Error launching Click to WhatsApp Ad:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to launch ad via Meta Marketing API');
        }
    }
}

module.exports = FacebookAdsService;
