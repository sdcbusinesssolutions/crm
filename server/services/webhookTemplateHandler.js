const { supabaseAdmin } = require('../lib/supabaseClient');
const { logWebhookEvent } = require('../utils/logger');
const whatsappService = require('./whatsappService'); // In case we want to clear Redis cache from here

/**
 * Handles Meta 'message_template_status_update' webhook events.
 * 
 * @param {Object} rawBody - The raw JSON body of the incoming webhook
 * @returns {Boolean} - Returns true if the event was a template event and was handled.
 */
async function handleTemplateStatusUpdate(rawBody) {
    try {
        const entry = rawBody.entry?.[0];
        const changes = entry?.changes?.[0];
        if (changes?.field !== 'message_template_status_update') return false;

        const wabaId = entry?.id;
        const payload = changes?.value;
        if (!wabaId || !payload) return true;

        console.log(`[Template Webhook] Received status update for WABA ${wabaId}:`, payload.message_template_name, payload.event);

        const { data: config, error: configError } = await supabaseAdmin
            .from('whatsapp_config')
            .select('user_id')
            .eq('whatsapp_business_account_id', wabaId)
            .maybeSingle();

        if (configError) {
            console.error(`[Template Webhook] Config fetch error for WABA ${wabaId}:`, configError.message);
        }

        if (!config?.user_id) return true;
        const userId = config.user_id;

        const templateName = payload.message_template_name;
        const language = payload.message_template_language; // en_US
        const status = payload.event; // APPROVED, REJECTED, etc
        const category = payload.category?.toUpperCase() || null;

        logWebhookEvent('TEMPLATE_STATUS_UPDATE', { userId, wabaId, payload });

        // DELETED case
        if (status === 'DELETED') {
            let delQuery = supabaseAdmin.from('whatsapp_templates')
                .delete().eq('user_id', userId).eq('name', templateName);
            
            if (language) {
                const shortLang = language.split('_')[0];
                const langFilter = `language.eq.${language},language.eq.${shortLang},language.is.null`;
                delQuery = delQuery.or(langFilter);
            }
            const { error: delError } = await delQuery;
            if (delError) {
                console.error(`[Template Webhook] Failed to delete whatsapp_templates for '${templateName}':`, delError.message);
            }

            const { error: cacheDelError } = await supabaseAdmin.from('template_components_cache')
                .delete().eq('user_id', userId).eq('template_name', templateName);
            
            if (cacheDelError) {
                console.error(`[Template Webhook] Failed to delete template_components_cache for '${templateName}':`, cacheDelError.message);
            } else {
                console.log(`[Template Webhook] 🗑️ Deleted template '${templateName}' from DB cache due to DELETED event.`);
            }
        } else {
            // Update case
            let query = supabaseAdmin.from('whatsapp_templates').update({
                status,
                ...(category && { category }),
                updated_at: new Date().toISOString()
            }).eq('user_id', userId).eq('name', templateName);

            if (language) {
                // en_US -> en
                const shortLang = language.split('_')[0];
                const langFilter = `language.eq.${language},language.eq.${shortLang},language.is.null`;
                query = query.or(langFilter);
            }

            const { error } = await query;
            if (error) console.error('[Template Webhook] Update failed:', error.message);
            else console.log(`[Template Webhook] ✅ Updated whatsapp_templates for '${templateName}' (Status: ${status})`);
        }

        // Cache update + Redis clear
        if (category && status !== 'DELETED') {
            const { error: cacheUpdateError } = await supabaseAdmin.from('template_components_cache')
                .update({ category })
                .eq('user_id', userId)
                .eq('template_name', templateName);
            
            if (cacheUpdateError) {
                console.error(`[Template Webhook] Failed to update template_components_cache category for '${templateName}':`, cacheUpdateError.message);
            } else {
                console.log(`[Template Webhook] ✅ Updated template_components_cache category for '${templateName}' to ${category}`);
            }
        }

        // Always clear Redis keys on any update/delete to avoid stale data
        if (whatsappService.redisClient?.isReady) {
            await whatsappService.redisClient.del(`whatsapp:template_category:${wabaId}:${templateName}`).catch(() => {});
            await whatsappService.redisClient.del(`whatsapp:template_category:${userId}:${templateName}`).catch(() => {});
            console.log(`[Template Webhook] 🧹 Cleared Redis cache for ${templateName}`);
        }

        return true;
    } catch (err) {
        console.error('[Template Webhook] Error:', err);
        return false;
    }
}

module.exports = {
    handleTemplateStatusUpdate
};
