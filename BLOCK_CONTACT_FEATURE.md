# Block Contact Feature Documentation

## Overview
The Block Contact feature allows users to block contacts directly from the Inbox interface. When a contact is blocked, their status is updated to "Blocked" in the contacts table **for that specific user only**.

### ✅ User Isolation (Critical)
- **Blocking is USER-SPECIFIC**: When User A blocks a contact, it only affects User A's view
- **Other users are NOT affected**: User B can still interact with the same phone number normally
- **Per-user contact records**: Each user has their own contact record for the same phone number
- **Security**: Users can only block contacts in their own conversations

## How It Works

### User Flow
1. User opens a conversation in the Inbox
2. User clicks the **3-dot menu** (⋮) in the conversation header
3. User selects **"Block Contact"** from the dropdown menu
4. A confirmation dialog appears: "Are you sure you want to block this contact? They will be marked as 'Blocked'."
5. Upon confirmation:
   - The contact's status is updated to "Blocked" in the database
   - A success message is displayed
   - The menu closes automatically

### Technical Implementation

#### Frontend (Inbox.tsx)
- **Location**: `client/src/components/Inbox.tsx`
- **Function**: `handleBlockContact()`
- **Trigger**: Button click in the 3-dot menu dropdown

```typescript
const handleBlockContact = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeChatId) return;

    if (window.confirm("Are you sure you want to block this contact? They will be marked as 'Blocked'.")) {
        try {
            await inboxService.blockContact(activeChatId);
            alert("Contact blocked successfully.");
            setIsHeaderMenuOpen(false);
        } catch (error: any) {
            console.error("Error blocking contact:", error);
            alert(`Failed to block contact: ${error.message || "Unknown error"}`);
        }
    }
};
```

#### Service Layer (inboxService.ts)
- **Location**: `client/src/services/inboxService.ts`
- **Method**: `blockContact(conversationId: string)`
- **Returns**: `Promise<boolean>`

```typescript
blockContact: async (conversationId: string): Promise<boolean> => {
    try {
        const headers = getAuthHeaders();
        const response = await fetch(`${API_BASE}/conversations/${conversationId}/block`, {
            method: 'POST',
            headers
        });
        if (!response.ok) throw new Error('Failed to block contact');
        return true;
    } catch (e) {
        console.error("Failed to block contact", e);
        throw e;
    }
}
```

#### Backend API (inbox.js)
- **Location**: `server/routes/inbox.js`
- **Endpoint**: `POST /api/inbox/conversations/:conversationId/block`
- **Authentication**: Required (via middleware)

**Logic Flow**:
1. Extract `conversationId` from request parameters
2. Get authenticated user's ID from `req.user.id`
3. Fetch the conversation to get the `contact_phone` AND `user_id`
4. **Verify ownership**: Ensure the conversation belongs to the requesting user (403 if not)
5. Update the contact's status to "Blocked" using **both** phone number AND user_id
6. If no contact exists for this user+phone combination, create a new blocked contact record
7. Return success response

```javascript
router.post('/conversations/:conversationId/block', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id; // ✅ Get authenticated user
        const { supabaseAdmin } = require('../lib/supabaseClient');

        // 1. Get Conversation AND verify ownership
        const { data: conversation, error: convErr } = await supabaseAdmin
            .from('conversations')
            .select('contact_phone, user_id')
            .eq('id', conversationId)
            .single();

        if (convErr || !conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // 2. Verify ownership
        if (conversation.user_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const phone = conversation.contact_phone;

        // 3. Update Contact Status - USER-SPECIFIC
        const { data: updatedContact, error: updateErr } = await supabaseAdmin
            .from('contacts')
            .update({ status: 'Blocked' })
            .eq('phone', phone)
            .eq('user_id', userId) // ✅ CRITICAL: Only for THIS user
            .select()
            .maybeSingle();

        if (updateErr) throw updateErr;

        if (!updatedContact) {
            // Create blocked contact for THIS user only
            await supabaseAdmin.from('contacts').insert({
                user_id: userId, // ✅ User-specific
                phone: phone,
                name: 'Unknown',
                status: 'Blocked',
                source: 'Inbox Block'
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error blocking contact:', error);
        res.status(500).json({ error: error.message });
    }
});
```

## Database Schema

### Contacts Table
The feature updates the `status` field in the `contacts` table:

```sql
-- Status field accepts various values including 'Blocked'
status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost' | 'Blocked'
```

## UI/UX Details

### Menu Location
The "Block Contact" option appears in the conversation header's 3-dot menu (⋮), alongside:
- Export Contact Info
- Export Chat
- Clear Chat

### Visual Design
- **Icon**: Red X icon (CloseIcon)
- **Text Color**: Red (`text-red-600`)
- **Hover State**: Light red background (`hover:bg-red-50`)
- **Position**: Above "Clear Chat" option, below a divider

### User Feedback
- **Confirmation**: Browser native `confirm()` dialog
- **Success**: Browser native `alert()` with "Contact blocked successfully."
- **Error**: Browser native `alert()` with error message

## Future Enhancements

### Recommended Improvements
1. **Prevent Messaging**: Add logic to prevent sending messages to blocked contacts
2. **Visual Indicator**: Show a "Blocked" badge in the conversation list
3. **Unblock Feature**: Add an "Unblock Contact" option for reversing the action
4. **Filter Option**: Add a filter to show/hide blocked contacts in the inbox
5. **Webhook Integration**: Prevent incoming messages from blocked contacts via webhook filtering
6. **Better UI Feedback**: Replace native alerts with custom toast notifications
7. **Audit Trail**: Log blocking actions for compliance and review

### Database Considerations
- Consider adding a dedicated `is_blocked` boolean column for faster queries
- Add an index on `status` column if filtering by blocked status becomes common
- Consider adding `blocked_at` timestamp and `blocked_by` user_id for audit purposes

## Testing Checklist

- [ ] Block a contact that exists in the contacts table
- [ ] Block a contact that only exists in conversations (not in contacts table)
- [ ] Verify the contact's status updates to "Blocked"
- [ ] Verify the menu closes after blocking
- [ ] Test error handling when conversation doesn't exist
- [ ] Test error handling when database update fails
- [ ] Verify authentication is required for the endpoint
- [ ] Test with different user accounts to ensure proper isolation

## Related Files

### Modified Files
1. `client/src/components/Inbox.tsx` - UI and event handler
2. `client/src/services/inboxService.ts` - Service layer method
3. `server/routes/inbox.js` - Backend API endpoint

### Database Migrations
- `db_sql/add_block_contact.sql` - (Optional) Adds `is_blocked` column

## API Reference

### Block Contact Endpoint

**Request**:
```http
POST /api/inbox/conversations/:conversationId/block
Authorization: Bearer <token>
```

**Response (Success)**:
```json
{
  "success": true
}
```

**Response (Error)**:
```json
{
  "error": "Error message"
}
```

**Status Codes**:
- `200` - Contact blocked successfully
- `404` - Conversation not found
- `500` - Server error

## Security Considerations

1. **Authentication**: Endpoint requires valid JWT token
2. **Authorization**: Uses Supabase Admin client to bypass RLS, but validates conversation ownership indirectly
3. **Data Validation**: Validates conversation existence before blocking
4. **Error Handling**: Gracefully handles missing contacts by creating new blocked records

## Known Limitations

1. **No Automatic Message Blocking**: Currently only updates status; doesn't prevent incoming messages
2. **No Bulk Block**: Can only block one contact at a time
3. **No Unblock UI**: Must manually update database to unblock
4. **Native Dialogs**: Uses browser native alerts instead of custom UI components
