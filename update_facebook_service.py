import re

file_path = "/home/devendra/proj/wpcode/server/services/facebookAdsService.js"
with open(file_path, "r") as f:
    content = f.read()

# Replace destructure
old_destruct = """            const {
                campaignName, pageId, headline, primaryText, imageUrl, mediaType,
                welcomeMessageText, iceBreakerText, whatsappNumber, description, objective, status
            } = baseConfig;"""

new_destruct = """            const {
                campaignName, pageId, headline, primaryText, mediaUrls, imageUrl, mediaType,
                welcomeMessageText, iceBreakerText, whatsappNumber, description, objective, status
            } = baseConfig;"""
content = content.replace(old_destruct, new_destruct)

# Replace Media upload step
old_upload = """            // Step 0: Handle Media Upload (only once for all duplicates)
            let imageHash = null;
            let videoId = null;

            if (mediaType === 'video') {
                console.log(`[FacebookAdsService] Uploading video to advideos for bulk...`);
                const videoRes = await axios.post(`${baseUrl}/act_${adAccountId}/advideos`, null, {
                    params: { access_token: accessToken, file_url: imageUrl }
                });
                videoId = videoRes.data.id;
                if (!videoId) throw new Error("Failed to retrieve video_id from Meta after uploading video URL.");
            } else {
                console.log(`[FacebookAdsService] Uploading image to adimages for bulk...`);
                const FormData = require('form-data');
                const imageBufferRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const form = new FormData();
                form.append('access_token', accessToken);
                form.append('filename', imageBufferRes.data, 'ad_image.jpg');

                const imageRes = await axios.post(`${baseUrl}/act_${adAccountId}/adimages`, form, {
                    headers: { ...form.getHeaders() }
                });
                
                const imagesMap = imageRes.data.images || {};
                const firstImageKey = Object.keys(imagesMap)[0];
                imageHash = imagesMap[firstImageKey]?.hash;
                if (!imageHash) throw new Error("Failed to retrieve image_hash from Meta after uploading image URL.");
            }"""

new_upload = """            // Step 0: Handle Media Upload (only once for all duplicates)
            const masterMediaHashes = [];
            const urlsToUpload = mediaUrls && mediaUrls.length > 0 ? mediaUrls : (imageUrl ? [imageUrl] : []);
            
            for (const url of urlsToUpload) {
                if (!url) continue;
                const isVideo = url.match(/\.(mp4|webm|ogg|mov)(?:[\?#].*)?$/i) || mediaType === 'video';
                if (isVideo) {
                    console.log(`[FacebookAdsService] Uploading video to advideos for bulk...`);
                    const videoRes = await axios.post(`${baseUrl}/act_${adAccountId}/advideos`, null, {
                        params: { access_token: accessToken, file_url: url }
                    });
                    if (videoRes.data.id) masterMediaHashes.push({ type: 'video', id: videoRes.data.id, url });
                } else {
                    console.log(`[FacebookAdsService] Uploading image to adimages for bulk...`);
                    const FormData = require('form-data');
                    const imageBufferRes = await axios.get(url, { responseType: 'arraybuffer' });
                    const form = new FormData();
                    form.append('access_token', accessToken);
                    form.append('filename', imageBufferRes.data, 'ad_image.jpg');
    
                    const imageRes = await axios.post(`${baseUrl}/act_${adAccountId}/adimages`, form, {
                        headers: { ...form.getHeaders() }
                    });
                    
                    const imagesMap = imageRes.data.images || {};
                    const firstImageKey = Object.keys(imagesMap)[0];
                    if (imagesMap[firstImageKey]?.hash) {
                        masterMediaHashes.push({ type: 'image', hash: imagesMap[firstImageKey].hash, url });
                    }
                }
            }"""
content = content.replace(old_upload, new_upload)

# Replace targeting resolve
old_resolve = """                // Resolve Location for this AdSet
                let final_geo_locations = { countries: ['IN'], location_types: ['home', 'recent'] };
                if (row.location) {
                    try {
                        const searchRes = await axios.get(`${baseUrl}/search`, {
                            params: { type: 'adgeolocation', q: row.location.trim(), access_token: accessToken, limit: 1 }
                        });
                        if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
                            const locationData = searchRes.data.data[0];
                            if (locationData.type === 'city') {
                                final_geo_locations = { cities: [{ key: locationData.key, radius: 15, distance_unit: 'kilometer' }], location_types: ['home', 'recent'] };
                            } else if (locationData.type === 'region') {
                                final_geo_locations = { regions: [{ key: locationData.key }], location_types: ['home', 'recent'] };
                            } else if (locationData.type === 'country') {
                                final_geo_locations = { countries: [locationData.country_code || locationData.key], location_types: ['home', 'recent'] };
                            } else if (locationData.type === 'zip') {
                                final_geo_locations = { zips: [{ key: locationData.key }], location_types: ['home', 'recent'] };
                            }
                        }
                    } catch (err) {
                        console.error(`Error dynamically resolving location '${row.location}' for bulk row:`, err.message);
                    }
                }

                const scheduleParams = { start_time: Math.floor(Date.now() / 1000) + 300 }; // 5 mins from now
                const gendersArray = [1, 2];"""

new_resolve = """                // Resolve Location for this AdSet
                let final_geo_locations = { location_types: ['home', 'recent'] };
                
                const processLocations = async (locString, targetArrayName) => {
                    if (!locString) return;
                    const items = locString.split(',').map(s => s.trim()).filter(Boolean);
                    for (const item of items) {
                        try {
                            const searchRes = await axios.get(`${baseUrl}/search`, {
                                params: { type: 'adgeolocation', q: item, access_token: accessToken, limit: 1 }
                            });
                            if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
                                const locationData = searchRes.data.data[0];
                                if (!final_geo_locations[targetArrayName]) final_geo_locations[targetArrayName] = [];
                                
                                if (locationData.type === 'city') {
                                    if (targetArrayName === 'cities') final_geo_locations[targetArrayName].push({ key: locationData.key, radius: 15, distance_unit: 'kilometer' });
                                    else final_geo_locations[targetArrayName].push({ key: locationData.key });
                                } else if (locationData.type === 'region') {
                                    final_geo_locations[targetArrayName === 'cities' ? 'regions' : targetArrayName].push({ key: locationData.key });
                                } else if (locationData.type === 'country') {
                                    final_geo_locations[targetArrayName === 'cities' ? 'countries' : targetArrayName].push(locationData.country_code || locationData.key);
                                } else if (locationData.type === 'zip') {
                                    final_geo_locations[targetArrayName === 'cities' ? 'zips' : targetArrayName].push({ key: locationData.key });
                                }
                            }
                        } catch (err) {
                            console.error(`Error resolving location '${item}' for bulk row:`, err.message);
                        }
                    }
                };

                await processLocations(row.location, 'cities'); // Default mapped to cities/regions/countries
                await processLocations(row.locationsExclude, 'excluded_custom_locations'); // We use excluded_custom_locations as a general bucket for excluded keys

                // Ensure at least one country if empty
                if (!final_geo_locations.cities && !final_geo_locations.regions && !final_geo_locations.countries && !final_geo_locations.zips) {
                    final_geo_locations.countries = ['IN'];
                }

                const scheduleParams = { start_time: Math.floor(Date.now() / 1000) + 300 }; // 5 mins from now
                let gendersArray = [1, 2];
                if (row.gender === 'MALE') gendersArray = [1];
                if (row.gender === 'FEMALE') gendersArray = [2];
                
                // Detailed Targeting
                let flexible_spec = [];
                if (row.detailedTargeting) {
                    const dtItems = row.detailedTargeting.split(',').map(s => s.trim()).filter(Boolean);
                    const interests = [];
                    for (const item of dtItems) {
                        try {
                            const searchRes = await axios.get(`${baseUrl}/search`, {
                                params: { type: 'adinterest', q: item, access_token: accessToken, limit: 1 }
                            });
                            if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
                                interests.push({ id: searchRes.data.data[0].id, name: searchRes.data.data[0].name });
                            }
                        } catch (err) {}
                    }
                    if (interests.length > 0) flexible_spec = [{ interests }];
                }"""
content = content.replace(old_resolve, new_resolve)

# Fix targeting payload
old_targeting = """                        geo_locations: final_geo_locations,
                        device_platforms: ['mobile', 'desktop'],
                        age_min: minAge,
                        age_max: maxAge,
                        genders: gendersArray,
                        publisher_platforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
                        facebook_positions: ['feed', 'story', 'marketplace', 'search'],
                        targeting_automation: { advantage_audience: 1 }
                    }),"""

new_targeting = """                        geo_locations: final_geo_locations,
                        device_platforms: ['mobile', 'desktop'],
                        age_min: minAge,
                        age_max: maxAge,
                        genders: gendersArray,
                        ...(flexible_spec.length > 0 && { flexible_spec }),
                        publisher_platforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
                        facebook_positions: ['feed', 'story', 'marketplace', 'search'],
                        targeting_automation: { advantage_audience: 1 }
                    }),"""
content = content.replace(old_targeting, new_targeting)

# Fix Ad creation loop
old_creative = """                // Create Creative
                const objectStorySpec = { page_id: pageId };
                if (mediaType === 'video') {
                    objectStorySpec.video_data = {
                        video_id: videoId, image_url: "https://www.facebook.com/images/ads/video_placeholder.png", 
                        title: headline, message: primaryText, call_to_action: { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } }
                    };
                } else {
                    objectStorySpec.link_data = {
                        image_hash: imageHash, link: 'https://api.whatsapp.com/send', name: headline, message: primaryText,
                        ...(description && { description }), call_to_action: { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } },
                        page_welcome_message: JSON.stringify(visualEditorSpec)
                    };
                }

                const creativeRes = await axios.post(`${baseUrl}/act_${adAccountId}/adcreatives`, null, { 
                    params: { name: `${row.name} - Creative`, object_story_spec: JSON.stringify(objectStorySpec), access_token: accessToken } 
                });
                const creativeId = creativeRes.data.id;

                // Create Ad
                const adRes = await axios.post(`${baseUrl}/act_${adAccountId}/ads`, null, {
                    params: {
                        name: `${row.name} - Ad`, adset_id: adSetId, creative: JSON.stringify({ creative_id: creativeId }),
                        status: status || 'PAUSED', access_token: accessToken
                    }
                });
                const adId = adRes.data.id;

                results.push({ adSetId, creativeId, adId, row: row.name });"""

new_creative = """                // Create Creatives and Ads
                let rowMediaHashes = [...masterMediaHashes];

                // Handle Row Override Custom Creative
                if (row.customCreativeUrl) {
                    const isVideo = row.customCreativeUrl.match(/\.(mp4|webm|ogg|mov)(?:[\?#].*)?$/i) || mediaType === 'video';
                    if (isVideo) {
                        const videoRes = await axios.post(`${baseUrl}/act_${adAccountId}/advideos`, null, {
                            params: { access_token: accessToken, file_url: row.customCreativeUrl }
                        });
                        if (videoRes.data.id) rowMediaHashes = [{ type: 'video', id: videoRes.data.id, url: row.customCreativeUrl }];
                    } else {
                        const FormData = require('form-data');
                        const imageBufferRes = await axios.get(row.customCreativeUrl, { responseType: 'arraybuffer' });
                        const form = new FormData();
                        form.append('access_token', accessToken);
                        form.append('filename', imageBufferRes.data, 'ad_image.jpg');
                        const imageRes = await axios.post(`${baseUrl}/act_${adAccountId}/adimages`, form, { headers: { ...form.getHeaders() } });
                        const imagesMap = imageRes.data.images || {};
                        const firstImageKey = Object.keys(imagesMap)[0];
                        if (imagesMap[firstImageKey]?.hash) {
                            rowMediaHashes = [{ type: 'image', hash: imagesMap[firstImageKey].hash, url: row.customCreativeUrl }];
                        }
                    }
                }

                const adIds = [];
                for (let m = 0; m < rowMediaHashes.length; m++) {
                    const media = rowMediaHashes[m];
                    const objectStorySpec = { page_id: pageId };
                    if (media.type === 'video') {
                        objectStorySpec.video_data = {
                            video_id: media.id, image_url: "https://www.facebook.com/images/ads/video_placeholder.png", 
                            title: headline, message: primaryText, call_to_action: { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } }
                        };
                    } else {
                        objectStorySpec.link_data = {
                            image_hash: media.hash, link: 'https://api.whatsapp.com/send', name: headline, message: primaryText,
                            ...(description && { description }), call_to_action: { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } },
                            page_welcome_message: JSON.stringify(visualEditorSpec)
                        };
                    }
    
                    const creativeRes = await axios.post(`${baseUrl}/act_${adAccountId}/adcreatives`, null, { 
                        params: { name: `${row.name} - Creative ${m+1}`, object_story_spec: JSON.stringify(objectStorySpec), access_token: accessToken } 
                    });
                    const creativeId = creativeRes.data.id;
    
                    const adRes = await axios.post(`${baseUrl}/act_${adAccountId}/ads`, null, {
                        params: {
                            name: `${row.name} - Ad ${m+1}`, adset_id: adSetId, creative: JSON.stringify({ creative_id: creativeId }),
                            status: status || 'PAUSED', access_token: accessToken
                        }
                    });
                    adIds.push(adRes.data.id);
                }

                results.push({ adSetId, adIds, row: row.name });"""
content = content.replace(old_creative, new_creative)

with open(file_path, "w") as f:
    f.write(content)

print("Update complete!")
