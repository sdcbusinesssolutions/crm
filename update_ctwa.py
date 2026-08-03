import re

def update_file():
    with open('/home/devendra/proj/wpcode/server/routes/clickToWhatsApp.js', 'r') as f:
        content = f.read()

    # 1. Add getMetaAdsToken function at the top
    helper_fn = """
const getMetaAdsToken = async (supabase, userId) => {
    const { data } = await supabase
        .from('user_integrations')
        .select('credentials')
        .eq('user_id', userId)
        .eq('provider', 'meta_ads')
        .maybeSingle();
    return data?.credentials?.systemUserToken || null;
};
"""
    if "getMetaAdsToken = async" not in content:
        content = content.replace("const getUserId = (req) => req.user.id;", "const getUserId = (req) => req.user.id;\n" + helper_fn)

    # 2. Update /accounts route
    accounts_old = """        // Fetch User's Meta Access Token from WhatsApp Config
        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('meta_access_token, phone_number, phone_number_id')
            .eq('user_id', userId)
            .single();

        const envToken = process.env.META_ACCESS_TOKEN;

        if (!envToken && (error || !config || !config.meta_access_token)) {
            return res.status(403).json({ 
                error: 'Meta Access Token not found. Please complete the WhatsApp Embedded Signup first.' 
            });
        }

        const accessToken = envToken || config.meta_access_token;"""

    accounts_new = """        const { data: config } = await supabase
            .from('whatsapp_config')
            .select('phone_number, phone_number_id')
            .eq('user_id', userId)
            .maybeSingle();

        const metaAdsToken = await getMetaAdsToken(supabase, userId);
        const envToken = process.env.META_ACCESS_TOKEN;

        if (!envToken && !metaAdsToken) {
            return res.status(403).json({ 
                error: 'Meta Ads Token not found. Please complete the Meta Ads Configuration first.' 
            });
        }

        const accessToken = envToken || metaAdsToken;"""
    content = content.replace(accounts_old, accounts_new)

    # 3. Update the standard get token block for analytics, search-targeting, insights, toggle-status, create-campaign
    standard_get_old = """        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('meta_access_token')
            .eq('user_id', userId)
            .single();

        const envToken = process.env.META_ACCESS_TOKEN;

        if (!envToken && (error || !config || !config.meta_access_token)) {
            return res.status(403).json({ error: 'Meta Access Token not found.' });
        }

        const accessToken = envToken || config.meta_access_token;"""
    
    standard_get_new = """        const metaAdsToken = await getMetaAdsToken(supabase, userId);
        const envToken = process.env.META_ACCESS_TOKEN;

        if (!envToken && !metaAdsToken) {
            return res.status(403).json({ error: 'Meta Ads Token not found.' });
        }

        const accessToken = envToken || metaAdsToken;"""
    content = content.replace(standard_get_old, standard_get_new)

    # Note: create-campaign has a slightly different error message
    launch_old = """        // Fetch User's Meta Access Token from WhatsApp Config
        // This makes it work dynamically for any user similar to embedded signup
        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('meta_access_token')
            .eq('user_id', userId)
            .single();

        const envToken = process.env.META_ACCESS_TOKEN;

        if (!envToken && (error || !config || !config.meta_access_token)) {
            return res.status(403).json({ 
                error: 'Meta Access Token not found. Please complete the WhatsApp Embedded Signup first.' 
            });
        }

        const accessToken = envToken || config.meta_access_token;"""
    
    launch_new = """        const metaAdsToken = await getMetaAdsToken(supabase, userId);
        const envToken = process.env.META_ACCESS_TOKEN;

        if (!envToken && !metaAdsToken) {
            return res.status(403).json({ 
                error: 'Meta Ads Token not found. Please complete the Meta Ads Configuration first.' 
            });
        }

        const accessToken = envToken || metaAdsToken;"""
    content = content.replace(launch_old, launch_new)

    # 4. Update the ones for forms and leads
    forms_old = """        // Fetch meta_access_token from whatsapp_config
        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('meta_access_token')
            .eq('user_id', userId)
            .single();
            
        const envToken = process.env.META_ACCESS_TOKEN;
        const systemToken = envToken || config?.meta_access_token;"""
    
    forms_new = """        const metaAdsToken = await getMetaAdsToken(supabase, userId);
        const envToken = process.env.META_ACCESS_TOKEN;
        const systemToken = envToken || metaAdsToken;"""
    content = content.replace(forms_old, forms_new)

    # 5. Update /auth
    auth_old = """        // Save to whatsapp_config (update first existing, or insert new)
        const { data: existingConfigs } = await supabase
            .from('whatsapp_config')
            .select('id')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        let upsertError = null;
        if (existingConfigs && existingConfigs.length > 0) {
            const { error } = await supabase
                .from('whatsapp_config')
                .update({ meta_access_token: finalToken, updated_at: new Date().toISOString() })
                .eq('user_id', userId); // Update all accounts for this user to have the new token
            upsertError = error;
        } else {
            const { error } = await supabase
                .from('whatsapp_config')
                .insert({
                    user_id: userId,
                    name: 'Facebook Ads Config',
                    meta_access_token: finalToken,
                    updated_at: new Date().toISOString()
                });
            upsertError = error;
        }

        if (upsertError) {
            throw upsertError;
        }"""
    
    auth_new = """        // Save to user_integrations (meta_ads provider)
        const { data: existingIntegration } = await supabase
            .from('user_integrations')
            .select('id, credentials')
            .eq('user_id', userId)
            .eq('provider', 'meta_ads')
            .maybeSingle();

        let upsertError = null;
        if (existingIntegration) {
            const newCredentials = { ...(existingIntegration.credentials || {}), systemUserToken: finalToken };
            const { error } = await supabase
                .from('user_integrations')
                .update({ credentials: newCredentials, updated_at: new Date().toISOString() })
                .eq('id', existingIntegration.id);
            upsertError = error;
        } else {
            const { error } = await supabase
                .from('user_integrations')
                .insert({
                    user_id: userId,
                    provider: 'meta_ads',
                    credentials: { systemUserToken: finalToken }
                });
            upsertError = error;
        }

        if (upsertError) {
            throw upsertError;
        }"""
    content = content.replace(auth_old, auth_new)


    with open('/home/devendra/proj/wpcode/server/routes/clickToWhatsApp.js', 'w') as f:
        f.write(content)

update_file()
