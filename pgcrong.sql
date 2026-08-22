-- Yeh har raat 12:00 AM (midnight) database ko khud saaf kar dega
SELECT cron.schedule(
  'daily-cleanup', 
  '0 0 * * *', 
  $$ 
    DELETE FROM flow_sessions WHERE status IN ('completed', 'cancelled') AND last_interaction_at < NOW() - INTERVAL '3 days';
    DELETE FROM flow_sessions WHERE status IN ('timeout', 'error') AND last_interaction_at < NOW() - INTERVAL '7 days';
    DELETE FROM flow_sessions WHERE status IN ('waiting_input', 'timeout_processing') AND last_interaction_at < NOW() - INTERVAL '15 days';
    DELETE FROM webhook_logs WHERE created_at < NOW() - INTERVAL '1 day';
    DELETE FROM sheet_automation_history
    WHERE sent_at < NOW() - INTERVAL '90 days';




    DELETE FROM messages
    WHERE created_at < NOW() - INTERVAL '120 days';


    DELETE FROM drip_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
  $$
);
