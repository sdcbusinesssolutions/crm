# CRITICAL: Fix for Database Saving Issues

The "Failed to save form" and "Infinite recursion detected" errors you are seeing are caused by a **Database Policy (RLS)** issue in Supabase.

To fix this, you **MUST** run the SQL script that is currently in your project.

## Steps to Fix:

1.  **Open Supabase Dashboard**: Go to your Supabase project dashboard in your browser.
2.  **Go to SQL Editor**: Click on the SQL Editor icon in the left sidebar.
3.  **New Query**: Create a new query.
4.  **Copy Script**: Copy the **entire content** of the file `db_sql/fix_rls_and_update.sql` from your project.
5.  **Run Query**: Paste it into the SQL Editor and click **RUN**.

### What this does:
-   It fixes the "infinite recursion" error in the `org_members` and `orgs` policies.
-   It adds the necessary columns (`settings` JSONB) to the `form_definitions` table.
-   It updates the `submit_form` function to handle new fields correctly.

**Once you run this SQL, the Form Builder and Pipeline creation will start working immediately.**

## UI Updates Applied:
-   **Form Builder**:
    -   Fixed alignment and colors to match your global theme.
    -   Added a responsive layout (works better on mobile).
    -   Replaced native alerts with a nice **Modal** popup.
-   **Pipeline View**:
    -   Styled the "Create Pipeline" popup to match the theme.
    -   Fixed the "Infinite Recursion" error (once SQL is run).
