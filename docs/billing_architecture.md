# Multi-Tenant Billing Architecture

This document defines the strict, hierarchical billing model used across the platform to manage Meta Cloud API costs and software SaaS markups. 

## 1. Overview

The platform employs a mutually exclusive, multi-tenant credit system. For any given tenant domain, the system enforces **Strict Isolation**: only *one* wallet credit source can be active at a time. The system dynamically routes deductions and updates UI visibility based entirely on this active credit line.

There are three primary entities involved in billing:
1.  **Super Admin:** The platform owner.
2.  **Tenant Domain Admin (Agency):** A client of the Super Admin managing their own sub-users.
3.  **Domain Users (End-Users):** The users actually sending WhatsApp messages.
4.  **Meta:** The underlying network provider charging base message costs.

---

## 2. Credit Types & Deduction Logic

The platform supports three distinct billing modes.

### A. Super Admin Credit Line (Wholesale Model)
The Super Admin controls the credit allocation for the tenant domain. The Super Admin pays Meta directly for all message costs.
*   **Assigned By:** Super Admin
*   **Assigned To:** Tenant Domain Admin
*   **Distribution Flow (Top-up):** The Super Admin distributes wholesale credits to the Tenant Admin. The Tenant Admin distributes retail credits to the User Wallet (cutting from the Tenant's Master Wallet).
*   **Usage Deduction (Sending):** The end-user's wallet is deducted at the assigned platform rate (base cost + SaaS markup).
*   **Description:** The Tenant buys wholesale credits from the Super Admin. The end-user buys retail credits from the Tenant.

### B. Tenant Admin Credit Line (Agency Model)
The Super Admin delegates financial responsibility to the Tenant Admin. The Tenant Admin connects their own credit card directly to Meta to pay for message costs.
*   **Assigned By:** Super Admin (delegated to Tenant Domain Admin)
*   **Assigned To:** Domain Users
*   **Distribution Flow (Top-up):** The Tenant Admin distributes credits directly to the User Wallet.
*   **Usage Deduction (Sending):** The end-user's wallet is deducted at the full defined platform rate. The system then automatically deducts only the **software markup fee** (SaaS fee) from the Tenant Admin's master wallet (since the base Meta cost is charged directly to the Tenant's credit card by Meta).
*   **Description:** The Tenant Admin manages their own domain's credit liability.

### C. Direct Meta Payment (Retail Model)
The end-user pays Meta directly via their own credit card attached to their own Meta Business account. 
*   **Assigned By:** User
*   **Assigned To:** Meta
*   **Wallet Deduction Source:** **NONE**. There are *zero* wallet deductions on the platform. The platform bypasses all balance checks and `WalletService` deductions. 
*   **Description:** Pure retail model. An independent payment flow where the software platform does not act as a financial middleman for message costs.

---

## 3. UI Visibility & Strict Isolation Rules

To prevent confusion and double-billing, the platform enforces strict UI isolation during the Top-up process. Users and Admins only see the credit source assigned to their domain.

| Domain Configuration | Show Options During Top-up |
| :--- | :--- |
| **Super Admin assigned credit line** | ✅ Super Admin Credit Line only <br> ❌ Tenant Credit Line hidden |
| **Tenant Admin has own credit line** | ✅ Tenant Credit Line only <br> ❌ Super Admin Credit Line hidden |
| **No credit line assigned** | ✅ Direct Meta Pay only |

*Note: For Direct Meta Payment, since no wallet balance is tracked or deducted, the UI hides the "Add Amount" fields, the "Reset Balance" button, and the "Enforce Wallet Balance Limit" toggle entirely.*

---

## 4. Final Credit Hierarchy

```text
                 SUPER ADMIN
                      |
        --------------------------------
        |                              |
 Super Admin Credit Line        Tenant Credit Line
        |                              |
 Tenant Domain Admin            Tenant Domain Admin
        |                              |
 Domain Users                   Domain Users
        |                              |
 Deduct from Super              Deduct from Tenant
 Credit Balance                 Credit Balance


                 OR

              Direct Meta Pay
                    |
             User Credit Card
                    |
                  Meta
```

---

## 5. Technical Enforcement (`WalletService.js`)

The rules above are strictly enforced at the database and service layer:
*   **Dynamic Rates:** When deductions occur (Modes A & B), the exact amount deducted is dynamic, based on custom pricing rates set by either the Tenant Admin or the Super Admin.
*   **Bypass Engine:** If a user's wallet is flagged as `DIRECT_META`, `WalletService.hasSufficientBalance` automatically returns `true`, and `WalletService.preDebit` immediately exits without calling the `adjust_wallet_balance` RPC.
*   **Domain Defaults:** The active billing mode is governed by `domain_wallet_settings.default_billing_mode`, ensuring a domain cannot accidentally mix wholesale and retail users.
*   **Permanent Limit Enforcement:** Wallet limits are strictly enforced at the SQL database layer. A user's wallet balance can *never* fall below zero during message sends. The previous "unlimited bypass" toggle has been permanently removed to ensure zero unbacked liability.
*   **Strict SaaS Fee Collection:** In `CREDIT_LINE_TENANT` mode, if the Tenant Admin's Master Wallet runs out of funds, the system will instantly throw an error and block the end-user's message. This guarantees the Super Admin never loses their SaaS markup fee.

---

## 6. Financial Reporting (Master Ledger)

To maintain absolute transparency and prevent unbounded loss, the platform includes a **Master Ledger Reporting Engine**:
*   **Domain Isolation:** Tenant Admins can only query ledger transactions for users within their own registered domain.
*   **Distribution vs Consumption:** The ledger explicitly tracks money flows by separating "Distribution" (credits created by Admins via `ADMIN_TOPUP`) from "Consumption" (credits spent by users via `INBOX_SEND`, `CAMPAIGN_SEND`, etc).
*   **SaaS Margin Tracking:** For the Super Admin, the ledger dynamically calculates the total Meta Cost versus total Platform Cost, instantly reporting the exact SaaS markup margin generated over any given period.
