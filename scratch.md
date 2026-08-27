I checked the database using the credentials you provided for `clickube.com`. I found the exact reason why the wallet balance isn't being deducted.

The user `user3.compnet@gmail.com` correctly has their **Billing Mode** set to `CREDIT_LINE_SUPER` (which means wallet deductions are turned ON). 

**The issue is that the `platform_rate` (the price charged to the user per message) is currently set to `0` in the database.**

Here are the current `GLOBAL` rates configured in your database for India (`IN`):
*   **Marketing:** Meta Cost: `0.8631`, Platform Rate: `0`
*   **Utility:** Meta Cost: `0.115`, Platform Rate: `0`
*   **Service:** Meta Cost: `0.004`, Platform Rate: `0`

Because the `platform_rate` is `0`, when `campaignWorker.js` runs, it calculates:
`Estimated Cost = 2 contacts * ₹0 = ₹0`.

Since the cost is ₹0, the system skips the wallet deduction and treats it as a "Free Message", which is why you see the campaign complete successfully without the ₹201 balance dropping.

**How to fix this:**
1. In the Admin Panel, go to the **Users** tab.
2. Click the **Rates** button (tag icon) next to `user3.compnet@gmail.com`.
3. Set the **Platform Rate** for Marketing messages (and other categories) to a value greater than `0` (e.g., `1.00`).
4. Once you set a non-zero platform rate, the wallet will start deducting correctly for all future campaigns!
