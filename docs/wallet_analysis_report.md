# Wallet System & Deduction Analysis Report

This report outlines all the locations in the codebase where the `WalletService` is used, specifically focusing on how wallet deductions (charges) and balance verifications are handled.

## 1. Primary Deduction Logic (`WalletService.preDebit`)

The `preDebit` function is the core of the billing system. It is called **before** a message is actually sent to Meta. It looks up the rate for the user (using `getRate`), checks if they have enough balance, and immediately deducts the money from their wallet while creating a `PENDING` ledger entry.

**Where it is used:**
- **[server/services/whatsappService.js](file:///home/devendra/proj/wpcode/server/services/whatsappService.js#L294):** 
  - This is the main messaging hub. Anytime a template message is sent via API, Inbox, Automation, or Drip Campaigns, this file intercepts it and calls `preDebit`.
  - It specifically checks if the message is a `template` and belongs to `UTILITY`, `MARKETING`, or `AUTHENTICATION` categories before charging.
- **[server/workers/campaignWorker.js](file:///home/devendra/proj/wpcode/server/workers/campaignWorker.js#L1295):** 
  - This background worker handles Bulk Campaigns. Before dispatching each message in a massive campaign queue, it calls `preDebit` to ensure the user still has funds for that specific message.

## 2. Webhook Reconciliation (`WalletService.handleWebhookPricing`)

Meta finalizes the cost of a message when it is delivered and sends a webhook with a `pricing` object. The system uses this to verify the deduction.

**Where it is used:**
- **[server/routes/webhook.js](file:///home/devendra/proj/wpcode/server/routes/webhook.js#L917):**
  - When a webhook event containing `pricing` data arrives from Meta, this route calls `handleWebhookPricing`.
  - It cross-references the Meta charge with the `preDebit` charge to ensure the ledger is accurate.

## 3. Refunds (`WalletService.refundFailedApiCall`)

If `preDebit` successfully deducts the money, but the actual HTTP request to Meta fails (e.g., network error, invalid number), the system automatically refunds the user.

**Where it is used:**
- **[server/services/whatsappService.js](file:///home/devendra/proj/wpcode/server/services/whatsappService.js):** Triggered in the `catch` block if the Axios request to Facebook Graph API fails.
- **[server/workers/campaignWorker.js](file:///home/devendra/proj/wpcode/server/workers/campaignWorker.js#L1390):** Triggered if a specific number fails during bulk sending.

## 4. Rate Calculations (`WalletService.getRate`)

Determines how much to charge based on the hierarchy: `USER > WORKSPACE > TENANT > GLOBAL`. (This is where we just fixed the Tenant Admin fallback logic and the Meta Cost minimum).

**Where it is used:**
- **[server/routes/admin/walletAdminRoutes.js](file:///home/devendra/proj/wpcode/server/routes/admin/walletAdminRoutes.js):** Used to calculate the `costFloor` when setting rates in the admin panel.
- Inside `WalletService.preDebit` and `WalletService.hasSufficientBalance` to know the cost before acting.
- **[server/workers/campaignWorker.js](file:///home/devendra/proj/wpcode/server/workers/campaignWorker.js#L407):** Used to calculate estimated campaign costs before starting.

## Summary of the Flow
1. **User attempts to send message** -> System checks balance.
2. **System determines rate** -> `WalletService.getRate()` finds the exact amount based on country & admin settings.
3. **Money is deducted upfront** -> `WalletService.preDebit()` removes funds and logs it.
4. **Message is sent** -> If sending fails, `WalletService.refundFailedApiCall()` returns the funds.
5. **Meta confirms delivery** -> `webhook.js` receives pricing and `WalletService.handleWebhookPricing()` finalizes the ledger.
