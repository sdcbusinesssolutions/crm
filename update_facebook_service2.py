file_path = "/home/devendra/proj/wpcode/server/services/facebookAdsService.js"
with open(file_path, "r") as f:
    content = f.read()

old_custom_creative = """                // Handle Row Override Custom Creative
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
                }"""

new_custom_creative = """                // Handle Row Override Custom Creative(s)
                if (row.customMediaUrls && row.customMediaUrls.length > 0) {
                    rowMediaHashes = []; // Clear the master creatives if we are overriding
                    for (const url of row.customMediaUrls) {
                        const isVideo = url.match(/\.(mp4|webm|ogg|mov)(?:[\?#].*)?$/i) || mediaType === 'video';
                        if (isVideo) {
                            const videoRes = await axios.post(`${baseUrl}/act_${adAccountId}/advideos`, null, {
                                params: { access_token: accessToken, file_url: url }
                            });
                            if (videoRes.data.id) rowMediaHashes.push({ type: 'video', id: videoRes.data.id, url: url });
                        } else {
                            const FormData = require('form-data');
                            const imageBufferRes = await axios.get(url, { responseType: 'arraybuffer' });
                            const form = new FormData();
                            form.append('access_token', accessToken);
                            form.append('filename', imageBufferRes.data, 'ad_image.jpg');
                            const imageRes = await axios.post(`${baseUrl}/act_${adAccountId}/adimages`, form, { headers: { ...form.getHeaders() } });
                            const imagesMap = imageRes.data.images || {};
                            const firstImageKey = Object.keys(imagesMap)[0];
                            if (imagesMap[firstImageKey]?.hash) {
                                rowMediaHashes.push({ type: 'image', hash: imagesMap[firstImageKey].hash, url: url });
                            }
                        }
                    }
                }"""

content = content.replace(old_custom_creative, new_custom_creative)

with open(file_path, "w") as f:
    f.write(content)

print("Update complete!")
