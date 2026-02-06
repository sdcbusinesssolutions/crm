# User Isolation Example - Block Contact Feature

## Scenario: Multiple Users, Same Phone Number

### Database Structure
```
contacts table:
+----+----------+----------------+----------+
| id | user_id  | phone          | status   |
+----+----------+----------------+----------+
| 1  | user-A   | +919876543210  | Active   |
| 2  | user-B   | +919876543210  | Active   |
| 3  | user-C   | +919876543210  | Active   |
+----+----------+----------------+----------+
```

### What Happens When User A Blocks This Contact?

#### ✅ CORRECT BEHAVIOR (Current Implementation)
```
UPDATE contacts 
SET status = 'Blocked' 
WHERE phone = '+919876543210' 
  AND user_id = 'user-A';  ← Only affects User A's record
```

**Result:**
```
contacts table:
+----+----------+----------------+----------+
| id | user_id  | phone          | status   |
+----+----------+----------------+----------+
| 1  | user-A   | +919876543210  | Blocked  | ← Only this changed
| 2  | user-B   | +919876543210  | Active   | ← Still active
| 3  | user-C   | +919876543210  | Active   | ← Still active
+----+----------+----------------+----------+
```

**User Experience:**
- ✅ User A: Sees contact as "Blocked"
- ✅ User B: Still sees contact as "Active" (can message normally)
- ✅ User C: Still sees contact as "Active" (can message normally)

---

#### ❌ WRONG BEHAVIOR (Previous Bug - Now Fixed)
```
UPDATE contacts 
SET status = 'Blocked' 
WHERE phone = '+919876543210';  ← Would affect ALL users!
```

**Result (BAD):**
```
contacts table:
+----+----------+----------------+----------+
| id | user_id  | phone          | status   |
+----+----------+----------------+----------+
| 1  | user-A   | +919876543210  | Blocked  | ← Changed
| 2  | user-B   | +919876543210  | Blocked  | ← Changed (BAD!)
| 3  | user-C   | +919876543210  | Blocked  | ← Changed (BAD!)
+----+----------+----------------+----------+
```

**User Experience (BAD):**
- ❌ User A: Sees contact as "Blocked" (intended)
- ❌ User B: Sees contact as "Blocked" (UNINTENDED - privacy violation!)
- ❌ User C: Sees contact as "Blocked" (UNINTENDED - privacy violation!)

---

## Security Verification

### Authorization Check
The endpoint also verifies that the user owns the conversation:

```javascript
// 1. Fetch conversation with user_id
const conversation = await supabase
    .from('conversations')
    .select('contact_phone, user_id')
    .eq('id', conversationId)
    .single();

// 2. Verify ownership
if (conversation.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
}
```

### Attack Prevention
**Scenario**: Malicious User D tries to block User A's contact

```http
POST /api/inbox/conversations/user-a-conversation-123/block
Authorization: Bearer <user-d-token>
```

**Response**: `403 Forbidden - Unauthorized: You do not own this conversation`

---

## Multi-Tenant Architecture

### Key Principles
1. **Data Isolation**: Each user has their own contact records
2. **Ownership Verification**: Users can only modify their own data
3. **Phone Number Sharing**: Multiple users can have contacts with the same phone number
4. **Independent Status**: Each user's contact status is independent

### Database Design
```sql
-- contacts table has composite uniqueness
CREATE UNIQUE INDEX idx_contacts_user_phone 
ON contacts(user_id, phone);

-- This allows:
-- (user-A, +919876543210) ✓
-- (user-B, +919876543210) ✓  Same phone, different user
-- (user-A, +919876543210) ✗  Duplicate - would fail
```

---

## Real-World Example

### Company CRM Scenario
**Company**: ABC Corp
**Users**: 
- Sales Rep A (user-id: alice)
- Sales Rep B (user-id: bob)
- Manager C (user-id: charlie)

**Shared Lead**: Customer at +919876543210

**Timeline**:
1. **Day 1**: All three reps have this customer as "Active"
2. **Day 2**: Alice has a bad experience, blocks the customer
3. **Day 3**: Bob successfully closes a deal with the same customer
4. **Day 4**: Charlie assigns the customer to Bob for follow-up

**Result**:
- Alice's view: Contact is "Blocked" (she won't see them in active lists)
- Bob's view: Contact is "Active" (he can continue working)
- Charlie's view: Contact is "Active" (he can manage assignments)

✅ **Perfect isolation** - Alice's personal decision doesn't affect the team!

---

## Testing Scenarios

### Test Case 1: Basic Block
1. User A logs in
2. User A blocks contact +919876543210
3. Verify: Only User A's contact record is updated
4. User B logs in
5. Verify: User B still sees contact as Active

### Test Case 2: Cross-User Security
1. User A creates conversation with contact
2. User B attempts to block User A's conversation (via API)
3. Verify: Returns 403 Forbidden
4. Verify: No data is modified

### Test Case 3: Non-Existent Contact
1. User A has conversation but no contact record
2. User A blocks the contact
3. Verify: New contact record created with status "Blocked"
4. Verify: Record has correct user_id (User A)

---

## Summary

### ✅ What's Protected
- User privacy (blocking is private)
- Data isolation (per-user records)
- Authorization (ownership verification)
- Multi-tenancy (independent user spaces)

### 🔒 Security Features
1. JWT authentication required
2. Conversation ownership verification
3. User-specific database queries
4. No cross-user data leakage

### 📊 Database Integrity
- Composite unique constraint (user_id + phone)
- Foreign key to users table
- Proper indexing for performance
- Audit trail via logs
