# Database Schema

This directory contains the SQL schema for the WhatsApp Flow Builder application.

## Main Schema File

**`schema.sql`**

This is the single source of truth for the database. It contains:
1.  **Core CRM Tables**: Contacts, Pipelines, Leads, Forms, etc.
2.  **WhatsApp Integration**: Campaigns, Templates, Config, Queue.
3.  **Flow Engine**: Tables and functions for the WhatsApp Flow Builder.
4.  **Webhook Logic**: Secure functions for logging and processing webhooks.
5.  **Security**: Row Level Security (RLS) policies and helper functions.

### How to Apply
Run the contents of `schema.sql` in your Supabase SQL Editor. The script is idempotent (uses `IF NOT EXISTS` and `CREATE OR REPLACE`), so it is safe to run multiple times to apply updates.

## Directory Structure
- `schema.sql`: The complete database setup script.
- `archive/`: Contains old migration scripts and partial schema files.
- `README.md`: This documentation file.
