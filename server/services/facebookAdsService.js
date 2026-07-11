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
                    fields: 'id,name,account_id,currency',
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
    static async fetchInsights(accessToken, entityId, level = 'campaign', timeIncrement = null, datePreset = 'last_30d') {
        try {
            const apiVersion = 'v20.0';
            const baseUrl = `https://graph.facebook.com/${apiVersion}`;
            const params = {
                fields: 'spend,reach,impressions,actions,date_start,date_stop,cpc,ctr,clicks,unique_clicks,quality_ranking,engagement_rate_ranking,frequency,inline_link_clicks',
                level: level,
                date_preset: datePreset,
                access_token: accessToken
            };
            if (timeIncrement) {
                params.time_increment = timeIncrement;
            }
            const res = await axios.get(`${baseUrl}/${entityId}/insights`, { params });
            // The insights API returns an array in data.
            return res.data.data;
        } catch (error) {
            console.error('Error fetching Insights:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to fetch Ad Insights');
        }
    }

    /**
     * Fetch complete analytics dashboard data (Campaigns, AdSets, Ads)
     */
    static async getAnalyticsDashboard(accessToken, adAccountId, datePreset = 'last_7d') {
        try {
            const apiVersion = 'v20.0';
            const baseUrl = `https://graph.facebook.com/${apiVersion}`;
            
            // We fetch campaigns, their adsets, and ads, along with insights
            const insightsFields = `spend,impressions,reach,actions,cpc,ctr,clicks,unique_clicks,quality_ranking,engagement_rate_ranking,frequency,inline_link_clicks`;
            const fields = `id,name,status,objective,daily_budget,start_time,stop_time,created_time,insights.date_preset(${datePreset}){${insightsFields}},adsets{id,name,status,daily_budget,start_time,stop_time,created_time,insights.date_preset(${datePreset}){${insightsFields}},ads{id,name,status,created_time,creative{thumbnail_url,image_url},insights.date_preset(${datePreset}){${insightsFields}}}}`;
            
            const res = await axios.get(`${baseUrl}/act_${adAccountId}/campaigns`, {
                params: {
                    fields: fields,
                    access_token: accessToken,
                    limit: 50 // Fetch recent campaigns
                }
            });
            
            return res.data.data;
        } catch (error) {
            console.error('Error fetching Analytics Dashboard:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to fetch Analytics');
        }
    }

    /**
     * Toggle the status of a Meta Ads Object (Campaign, AdSet, or Ad)
     */
    static async toggleStatus(accessToken, objectId, status) {
        try {
            const apiVersion = 'v20.0';
            const baseUrl = `https://graph.facebook.com/${apiVersion}`;
            
            const res = await axios.post(`${baseUrl}/${objectId}`, `status=${status}&access_token=${accessToken}`, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            
            return res.data;
        } catch (error) {
            console.error('Error toggling status:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to toggle status');
        }
    }

    /**
     * Launch a Click to WhatsApp Ad campaign
     */
    static async createCampaign(accessToken, adAccountId, { 
        campaignName, dailyBudget, pageId, headline, primaryText, imageUrl, mediaType, 
        targetCountries, geoLocations, excludedGeoLocations, minAge, maxAge, gender, startDate, endDate, 
        welcomeMessageText, iceBreakerText, whatsappNumber, description, status, objective, optimizationGoal, advantageAudience,
        flexibleSpec, exclusions, radius
    }) {
        try {
            const apiVersion = 'v20.0';
            const baseUrl = `https://graph.facebook.com/${apiVersion}`;

            // Dynamically resolve target locations via Meta API if raw geoLocations object is not provided
            let final_geo_locations = geoLocations || { countries: ['IN'], location_types: ['home', 'recent'] }; // Fallback

            if (!geoLocations && targetCountries) {
                const possibleCodes = targetCountries.split(',').map(c => c.trim().toUpperCase());
                const isAllCodes = possibleCodes.every(c => c.length === 2);

                if (isAllCodes && possibleCodes.length > 0) {
                    final_geo_locations = { countries: possibleCodes, location_types: ['home', 'recent'] };
                } else {
                    try {
                        const searchQuery = targetCountries.split(',')[0].trim();
                        const searchRes = await axios.get(`${baseUrl}/search`, {
                            params: {
                                type: 'adgeolocation',
                                q: searchQuery,
                                access_token: accessToken,
                                limit: 1
                            }
                        });

                        if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
                            const locationData = searchRes.data.data[0];
                            if (locationData.type === 'city') {
                                final_geo_locations = {
                                    cities: [{ key: locationData.key, radius: radius || 15, distance_unit: 'kilometer' }],
                                    location_types: ['home', 'recent']
                                };
                            } else if (locationData.type === 'region') {
                                final_geo_locations = {
                                    regions: [{ key: locationData.key }],
                                    location_types: ['home', 'recent']
                                };
                            } else if (locationData.type === 'country') {
                                final_geo_locations = {
                                    countries: [locationData.country_code || locationData.key],
                                    location_types: ['home', 'recent']
                                };
                            } else if (locationData.type === 'zip') {
                                final_geo_locations = {
                                    zips: [{ key: locationData.key }],
                                    location_types: ['home', 'recent']
                                };
                            }
                        }
                    } catch (err) {
                        console.error('Error dynamically resolving location via Meta API:', err.response?.data || err.message);
                    }
                }
            }

            // Step 0: Handle Media Upload
            let imageHash = null;
            let videoId = null;

            if (mediaType === 'video') {
                // Upload Video
                console.log(`[FacebookAdsService] Uploading video to advideos...`);
                // Meta API allows sending file_url directly for advideos
                const videoRes = await axios.post(`${baseUrl}/act_${adAccountId}/advideos`, null, {
                    params: {
                        access_token: accessToken,
                        file_url: imageUrl
                    }
                });
                
                videoId = videoRes.data.id;
                if (!videoId) {
                    throw new Error("Failed to retrieve video_id from Meta after uploading video URL.");
                }
            } else {
                // Upload Image
                console.log(`[FacebookAdsService] Uploading image to adimages...`);
                const FormData = require('form-data');
                const imageBufferRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                
                const form = new FormData();
                form.append('access_token', accessToken);
                form.append('filename', imageBufferRes.data, 'ad_image.jpg');

                const imageRes = await axios.post(`${baseUrl}/act_${adAccountId}/adimages`, form, {
                    headers: {
                        ...form.getHeaders()
                    }
                });
                
                const imagesMap = imageRes.data.images || {};
                const firstImageKey = Object.keys(imagesMap)[0];
                imageHash = imagesMap[firstImageKey]?.hash;

                if (!imageHash) {
                    throw new Error("Failed to retrieve image_hash from Meta after uploading image URL.");
                }
            }

            const campaignRes = await axios.post(`${baseUrl}/act_${adAccountId}/campaigns`, null, {
                params: {
                    name: campaignName,
                    objective: objective || 'OUTCOME_LEADS',
                    status: status || 'PAUSED',
                    special_ad_categories: '[]',
                    is_adset_budget_sharing_enabled: false,
                    access_token: accessToken
                }
            });
            const campaignId = campaignRes.data.id;

            // Prepare Gender targeting
            const gendersArray = gender === 'all' ? [1, 2] : [parseInt(gender)];

            // Prepare Start and End time (Meta requires Unix timestamps, and daily budget requires >= 24h schedule)
            const scheduleParams = {};
            const now = Math.floor(Date.now() / 1000);
            
            if (startDate) {
                scheduleParams.start_time = Math.floor(new Date(startDate).getTime() / 1000);
            } else {
                scheduleParams.start_time = now + 300; // 5 mins from now
            }
            
            if (endDate) {
                scheduleParams.end_time = Math.floor(new Date(endDate).getTime() / 1000);
            }

            // Step 2: Create Ad Set
            const adSetParams = {
                name: `${campaignName} - Ad Set`,
                campaign_id: campaignId,
                daily_budget: dailyBudget * 100, // Meta expects cents
                billing_event: 'IMPRESSIONS',
                optimization_goal: optimizationGoal || 'CONVERSATIONS',
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                is_adset_budget_sharing_enabled: false,
                destination_type: 'WHATSAPP',
                promoted_object: JSON.stringify({ 
                    page_id: pageId,
                    ...(whatsappNumber && whatsappNumber.trim() !== '' && { whatsapp_phone_number: whatsappNumber.trim() })
                }),
                targeting: JSON.stringify({
                    geo_locations: final_geo_locations,
                    ...(excludedGeoLocations && { excluded_geo_locations: excludedGeoLocations }),
                    device_platforms: ['mobile', 'desktop'],
                    age_min: minAge ? parseInt(minAge) : 18,
                    age_max: maxAge ? parseInt(maxAge) : 65,
                    genders: gendersArray,
                    publisher_platforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
                    facebook_positions: ['feed', 'story', 'marketplace', 'search'],
                    ...(flexibleSpec && flexibleSpec.length > 0 && { flexible_spec: flexibleSpec }),
                    ...(exclusions && exclusions.length > 0 && { exclusions: exclusions }),
                    targeting_automation: {
                        advantage_audience: advantageAudience !== undefined ? advantageAudience : 1
                    }
                }),
                status: status || 'PAUSED',
                access_token: accessToken,
                ...scheduleParams
            };

            console.log('--- Creating Ad Set with Params ---');
            console.log(JSON.stringify(adSetParams, null, 2));

            const adSetRes = await axios.post(`${baseUrl}/act_${adAccountId}/adsets`, null, { params: adSetParams });
            const adSetId = adSetRes.data.id;

            // Define the WhatsApp Welcome Experience (Visual Editor format)
            const visualEditorSpec = {
                type: "VISUAL_EDITOR",
                version: 2,
                landing_screen_type: "welcome_message",
                media_type: "text",
                text_format: {
                    customer_action_type: "ice_breakers",
                    message: {
                        text: welcomeMessageText || "Hi! I'm interested in this.",
                        ice_breakers: [{
                            title: iceBreakerText || "I'm interested!"
                        }]
                    }
                }
            };

            // Step 3: Create Ad Creative
            const objectStorySpec = {
                page_id: pageId
            };
            
            if (mediaType === 'video') {
                objectStorySpec.video_data = {
                    video_id: videoId,
                    image_url: "https://www.facebook.com/images/ads/video_placeholder.png", 
                    title: headline,
                    message: primaryText,
                    call_to_action: {
                        type: 'WHATSAPP_MESSAGE',
                        value: {
                            app_destination: 'WHATSAPP'
                        }
                    }
                };
            } else {
                objectStorySpec.link_data = {
                    image_hash: imageHash,
                    link: 'https://api.whatsapp.com/send',
                    name: headline,
                    message: primaryText,
                    ...(description && { description }),
                    call_to_action: {
                        type: 'WHATSAPP_MESSAGE',
                        value: {
                            app_destination: 'WHATSAPP'
                        }
                    },
                    page_welcome_message: JSON.stringify(visualEditorSpec)
                };
            }

            const creativeParams = {
                name: `${campaignName} - Creative`,
                object_story_spec: JSON.stringify(objectStorySpec),
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
                    status: status || 'PAUSED',
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
            console.error('--- Click to WhatsApp API Error (Full Response) ---');
            console.error(JSON.stringify(error.response?.data || error.message, null, 2));
            
            const errData = error.response?.data?.error;
            let finalMessage = 'Failed to launch ad via Meta Marketing API.';
            
            if (errData) {
                const title = errData.error_user_title || errData.type || 'Meta API Error';
                const msg = errData.error_user_msg || errData.message || 'Unknown error occurred.';
                const subcode = errData.error_subcode ? `(Subcode: ${errData.error_subcode})` : '';
                
                finalMessage = `${title}: ${msg} ${subcode}`.trim();
            } else if (error.message) {
                finalMessage = error.message;
            }

            throw new Error(finalMessage);
        }
    }
}

module.exports = FacebookAdsService;
