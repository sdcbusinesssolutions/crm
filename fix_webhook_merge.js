const fs = require('fs');

const file = 'server/routes/webhook.js';
let content = fs.readFileSync(file, 'utf8');

// Fix first conflict
content = content.replace(/<<<<<<< HEAD\n=======\n([\s\S]*?)>>>>>>> [a-f0-9]+/, '$1');

// Fix second conflict
const secondConflictRegex = /<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [a-f0-9]+/;
const match = content.match(secondConflictRegex);

if (match) {
    const headCode = match[1];
    const incomingCode = match[2];
    
    // We want the incomingCode's RACE CONDITION MITIGATION
    // And then the combined success block
    
    const replacement = `                    if (!updateSuccess) {
                        // RACE CONDITION MITIGATION: WhatsApp often fires webhooks BEFORE our backend finishes inserting the message!
                        // If it's false, wait 1.5 seconds and retry.
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        const { data: retrySuccess } = await supabase.rpc('update_message_status', {
                            p_whatsapp_message_id: waMessageId,
                            p_status: newStatus
                        });
                        updateSuccess = retrySuccess;
                    }

                    if (updateSuccess) {
                        console.log(\`[Webhook] Message \${waMessageId} updated to '\${newStatus}' (Rows updated: true)\`);
                        
                        // --- WALLET SYSTEM: 24-HOUR CONVERSATION WINDOW BILLING ---
                        // Meta charges per CONVERSATION WINDOW (24h), not per MESSAGE.
                        // We pass both pricing (category, billable) and conversation
                        // (id, expiration_timestamp) so WalletService can correctly
                        // check if this window was already billed before charging.
                        if (['sent'].includes(newStatus) && status.pricing) {
                            WalletService.handleWebhookPricing(
                                userId, waMessageId, status.pricing, status.conversation || null
                            ).catch(err => console.error('[Wallet] Error handling webhook pricing:', err));
                        } else if (newStatus === 'failed') {
                            // FAILED MESSAGE: Full refund of pre-debit
                            WalletService.handleWebhookFailure(
                                userId, waMessageId
                            ).catch(err => console.error('[Wallet] Error handling webhook failure:', err));
                        }
                    } else {
                        console.log(\`[Webhook] Message \${waMessageId} updated to '\${newStatus}', but RPC returned false (likely not a campaign message).\`);
                    }
                    
                    // Fetch the updated message to emit via Socket.IO so ticks update in real-time
                    // We do this even if updateSuccess is false, because the message table update might have succeeded
                    // while the campaign_queue update affected 0 rows (returning false).
                    const { data: updatedMsg } = await supabaseAdmin
                        .from('messages')
                        .select('*')
                        .eq('whatsapp_message_id', waMessageId)
                        .maybeSingle();
                        
                    if (updatedMsg) {
                        realtimeSync.emitMessage(userId, updatedMsg, 'UPDATE');
                    } else {
                        console.warn(\`[Webhook] Message \${waMessageId} NOT found in DB when trying to emit status update.\`);
                    }`;
    
    content = content.replace(secondConflictRegex, replacement);
}

fs.writeFileSync(file, content);
console.log('Merged webhook.js');
