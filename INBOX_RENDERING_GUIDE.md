# Inbox Rendering Architecture: The "Template is Truth" Approach

This document outlines the architectural pattern used to ensure that the **Inbox Preview** in the CRM exactly matches the **Actual WhatsApp Message** received by the user.

## The Core Problem
Previously, the Inbox tried to reconstruct the message from raw parameters (e.g., `image_url`, `text_param`). This failed because:
1.  **Missing Context**: The Inbox didn't know the static text of the template (e.g., "Hello {{1}}, welcome...").
2.  **Generic Placeholders**: Buttons showed as "Button 1" because the specific label (e.g., "View Offer") is part of the template definition, not the usage parameters.
3.  **Complex Structures**: Carousel (MPM) templates have complex nested structures that are hard to rebuild on the fly.

## The Solution: Server-Side Pre-Rendering

The solution moves the responsibility of "understanding the message" from the Frontend (Inbox) to the Backend (Worker).

**The Worker now acts as a Pre-Renderer.** It fetches the full Template Definition, merges it with the Campaign Parameters, and saves a **Rich Rendered Payload** to the database. The Inbox then simply displays this payload.

---

## Technical Implementation Steps

### 1. The Hybrid Definition Strategy (Worker)
We prioritize the **Local Database Definition** for content (text, button labels) because it reflects the user's latest edits in the Builder. We use the **Meta API Definition** for structural validation.

**Code Pattern (`campaignWorker.js`):**
```javascript
// 1. Find Local Definition (User's Custom Labels)
let localCarouselDef = templateDef.buttons.find(b => b.type === 'MEDIA_CARD_CAROUSEL');

// 2. Find Meta Definition (Structural Truth)
const metaCarouselDef = templateDef.components.find(c => c.type === 'CAROUSEL');

// 3. Merge Logic
// Always check Local first for Body Text and Button Labels.
const cardBody = localCard.body || metaCard.components.find(c => c.type === 'BODY').text;
// Use Meta only if Local is missing.
```

### 2. Parameter Replacement (Worker)
The worker proactively replaces variables (`{{1}}`) with the actual campaign data *before* saving to the inbox log.

**Code Pattern:**
```javascript
// Worker replaces {{1}} with 'Name'
renderedBody = bodyText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), paramValue);
```

### 3. Rich Payload Storage
We add special fields starting with `_` (underscore) to the `template` log object. These contain the final, ready-to-display data.

*   `_rendered_header_text`: The main header text with variables replaced.
*   `_rendered_body`: The main message body with variables replaced.
*   `_rendered_cards`: An array of pre-processed cards for Carousels.

**Why this is crucial**: The Frontend no longer guesses. It strictly renders:
*   Header: `data._rendered_header_text`
*   Body: `data._rendered_body`
*   Cards: `data._rendered_cards`

### 4. Robust Frontend Rendering (Inbox.tsx)
The Frontend's job is now simple logic: **"Render the Rich Data if available."**

**Priority Logic:**
1.  **Check `_rendered_` fields first.**
2.  **Render Main Bubble** (Header + Body).
3.  **Render Carousel** (if present) *below* the main bubble.

**Code Pattern (`Inbox.tsx`):**
```tsx
// 1. Render Main Msg
<div>
  <h1>{data._rendered_header_text}</h1>
  <p>{data._rendered_body}</p>
</div>

// 2. Render Carousel (Iterate through _rendered_cards)
<div className="carousel">
  {data._rendered_cards.map(card => (
     <Card 
       image={card.media_url} 
       text={card.body}      // Shows "caro1", not "Card 1"
       buttons={card.buttons} // Shows "Visit", not "Button 1"
     />
  ))}
</div>
```

---

## How to Apply to Other Templates

To apply this to **Authentication**, **Coupon**, or **Catalog** templates:

1.  **Update `campaignWorker.js`**:
    *   Ensure the logic extracts the specific components (e.g., `OTP_BUTTON`, `COUPON_CODE`).
    *   Perform variable substitution on the server.
    *   Save it into `_rendered_body` or a new field like `_rendered_otp`.

2.  **Update `Inbox.tsx`**:
    *   Look for these specific `_rendered_` fields.
    *   Style them to match the specific template type (e.g., larger font for OTP).

## Checklist for Consistency
*   [ ] **Never Hardcode**: "Button", "Card" strings should never appear in the UI code. Always come from the DB definition.
*   [ ] **Case Insensitivity**: Always use `.toLowerCase()` or `.toUpperCase()` when checking component types (`BODY`, `Body`, `header`).
*   [ ] **Button Types**: Handle `URL`, `QUICK_REPLY`, and `PHONE_NUMBER` button sub-types dynamically to show the correct icon.
