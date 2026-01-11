# Facebook Lead Ads Permission Troubleshooting

If you are seeing the error **"This app needs at least one supported permission"** or users cannot connect their pages, it is due to the **Meta App Mode** and **Access Levels**.

## 1. The Root Cause
Facebook Apps have two modes:
1.  **Development Mode**: Only users listed as "Administrators", "Developers", or "Testers" in the App Dashboard can log in. Everyone else gets an error.
2.  **Live Mode**: Any user can log in, **BUT** they can only grant permissions that have been approved for **Advanced Access**.

If your app is **Live** but you haven't completed **App Review** for the required permissions, regular users effectively request *zero* permissions, causing the "at least one supported permission" error.

## 2. Solution Checklist

### A. For Internal Testing (Development Mode)
If you are just testing with a few specific people:
1.  Go to [developers.facebook.com](https://developers.facebook.com).
2.  Select your App.
3.  Ensure the toggle at the top is **OFF** (In Development).
4.  Go to **App Roles** -> **Roles**.
5.  Click **Add Testers** and enter the Facebook ID or Name of the "other user" trying to test.
6.  The user must accept the invitation at [developers.facebook.com/requests](https://developers.facebook.com/requests).

### B. For Production (Live Mode)
If you want **any** client to use this:
1.  Go to **App Review** -> **Permissions and Features**.
2.  You MUST request **Advanced Access** for the following permissions:
    *   `public_profile` (Default)
    *   `email` (Default)
    *   `pages_show_list`
    *   `pages_read_engagement`
    *   `pages_manage_metadata`
    *   `leads_retrieval`
3.  **Business Verification**: You will likely need to verify your Business Manager account to get `leads_retrieval` approved.
4.  Once Advanced Access is granted for these 4 permissions, switch the App Mode to **Live**.

## 3. Required Permissions Explained
We have updated the code to request the minimum required set:
*   `pages_show_list`: To show the dropdown of pages.
*   `leads_retrieval`: To actually fetch the lead data.
*   `pages_manage_metadata`: To subscribe to the webhook (real-time lead updates).
*   `pages_read_engagement`: Helper permission often required for page access.

## 4. Debugging
We have added detailed logs to:
*   `server/logs/facebook_lead_logs_DATE.log`

Check this file to see if the token exchange is happening. If you see "Missing permissions" logs, it confirms the user logged in but the app refused to grant the specific scopes (due to the Live Mode issue described above).
