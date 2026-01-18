# Sheet Automation Example Scenarios

This document ensures you understand how the new Sheet Automation logic works with concrete examples.

## Scenario 1: Daily Birthday Offer (The "Proper" Dynamic Way)

**Goal**: Send a birthday discount message with a specific product image every morning to users whose birthday is today.

### 1. Sheet Data (Assumed)
| Name | Phone | Birthday | Plan |
| :--- | :--- | :--- | :--- |
| Alice | 1234567890 | 25/01/1990 | Premium |
| Bob | 0987654321 | 18/01/1985 | Basic |
| Charlie | 1122334455 | 18/01/2000 | Premium |

*(Assume Today is 18th January)*

### 2. Configuration in Wizard

**Step 1: Schedule**
*   **Frequency**: "Daily" at "09:00"

**Step 3: Trigger (Multiple Conditions)**
*   **Condition 1**:
    *   Column: `Birthday`
    *   Operator: `Day Month Equal` (Ignore Year)
    *   Value: `Today` (Dynamic)
*   **Condition 2**:
    *   Column: `Plan`
    *   Operator: `Equals`
    *   Value: `Premium`

**Step 6: Mapping (Static vs Dynamic)**
*   **Phone**: Mapped to `Phone` (Column)
*   **HEADER_IMAGE**:
    *   Type: **Static**
    *   Value: `https://myshop.com/images/premium-bday-card.png`
*   **BODY_VAR_1 (Name)**:
    *   Type: **Column**
    *   Value: `Name`
*   **BODY_VAR_2 (Discount)**:
    *   Type: **Static**
    *   Value: `BDAY25OFF`

### 3. Execution Logic (Backend)

When the scheduler runs on **Jan 18th**:

1.  **Row 1 (Alice)**:
    *   `Birthday` (25/01) != Today (18/01) -> **Skipped**.
2.  **Row 2 (Bob)**:
    *   `Birthday` (18/01) == Today -> **Match**.
    *   `Plan` ("Basic") != "Premium" -> **Skipped**.
3.  **Row 3 (Charlie)**:
    *   `Birthday` (18/01) == Today -> **Match**.
    *   `Plan` ("Premium") == "Premium" -> **Match**.
    *   **ACTION -> Send Message**:
        *   **Header**: Uses static image URL.
        *   **Body**: "Happy Birthday Charlie! Use code BDAY25OFF".

---

## Scenario 2: Upcoming Renewal Reminder

**Goal**: Remind users 7 days before their subscription ends.

### 1. Sheet Data
| Customer | Phone | ExpiryDate |
| :--- | :--- | :--- |
| David | 5555555555 | 25/01/2026 |

*(Assume Today is 18th January 2026)*

### 2. Configuration

**Step 3: Trigger**
*   **Condition 1**:
    *   Column: `ExpiryDate`
    *   Operator: `in_next_x_days`
    *   Value: `7`
    *   *Correction*: `in_next_x_days` checks a window. If you want EXACTly 7 days from now, you might need a calculated column in Sheet or precise date math.
    *   *Better Operator*: If you want "Is exactly 7 days from now", we usually need `Date Equals` -> `Today + 7`.
    *   *Current Logic*: `in_next_x_days` (7) means "Is the date between Today and Today+7?". So it sends every day for that week?
    *   *Solution*: Use **Date After** `Today` AND **Date Before** `Today + 2`? Or we rely on "Last Processed" hash to not send twice.
    *   *New Feature*: We added specific date logic. If you used `Date Equals` with a dynamic `Today+7` (not yet in UI, but backend supports parsed math if we extended it).
    *   **Practical Setup**: Use `in_next_x_days` = 7. It will match. To prevent re-sending every day of that week, our backend logic checks if we already sent to this user today? Or user must add a "Status" column to write back "Sent".
    *   **Recommendation**: Add "Status" column and map it. Backend skips rows with Status="Sent".

---

## Scenario 3: One-Time Custom Blast

**Goal**: Send a message to everyone who signed up "Yesterday".

**Step 1: Schedule**
*   **Frequency**: One-Time (Custom)
*   **Date**: 2025-12-25 10:00

**Step 3: Trigger**
*   **Condition**:
    *   Column: `SignupDate`
    *   Operator: `is_yesterday`

**Step 6: Mapping**
*   **HEADER_VIDEO**: Static `https://.../welcome.mp4`
*   **Phone**: Column `Phone`

---

## Summary of "Proper" Features

1.  **Multiple Filters**: You can filter by Date AND Status AND Plan simultaneously.
2.  **Flexible Mapping**: You don't need a column for "Image URL" in your sheet. You just paste the URL in the wizard (Static).
3.  **Dynamic Dates**: No need to hardcode dates. "Today", "Yesterday", "Last 7 Days" adjust automatically every time the job runs.
