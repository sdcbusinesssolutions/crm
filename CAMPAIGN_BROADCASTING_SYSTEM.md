# Campaign Recipients - Complete Broadcasting System

## 🎯 Overview

The WhatsApp CRM supports **three methods** for selecting campaign recipients. **All three methods work identically** - they fetch contacts, add them to a queue, and broadcast messages either immediately or on schedule.

---

## 📋 Three Recipient Selection Methods

### 1. **Select Group** 
Select from existing contact groups

### 2. **Paste Numbers**
Manually enter phone numbers

### 3. **Select by Tags** ⭐
Target contacts by their assigned tags

---

## ✅ **IMPORTANT: All Methods Work the Same Way**

Regardless of which method you choose, the **broadcasting process is identical**:

```
Select Recipients → Fetch Contacts → Add to Queue → Schedule/Broadcast → Deliver
```

**The ONLY difference** is **HOW** contacts are selected. Everything else (queueing, scheduling, broadcasting, tracking) is **100% identical**.

---

## 🔄 Complete Broadcasting Flow

### **Method 1: Select Group**
```
User selects "Select Group"
    ↓
Choose group (e.g., "VIP Customers")
    ↓
Backend fetches all contacts WHERE group_ids contains selected group
    ↓
Add all contacts to campaign_queue table
    ↓
Schedule/Send Now
    ↓
Campaign Worker processes queue
    ↓
Broadcast to all contacts in queue
```

### **Method 2: Paste Numbers**
```
User selects "Paste Numbers"
    ↓
Paste phone numbers (e.g., 919876543210, 918888888888)
    ↓
Backend validates and normalizes numbers
    ↓
Add all numbers to campaign_queue table
    ↓
Schedule/Send Now
    ↓
Campaign Worker processes queue
    ↓
Broadcast to all contacts in queue
```

### **Method 3: Select by Tags** ⭐
```
User selects "Select by Tags"
    ↓
Choose tags (e.g., "VIP", "Customer")
    ↓
Backend fetches all contacts WHERE tags contains ANY selected tag
    ↓
Add all matched contacts to campaign_queue table
    ↓
Schedule/Send Now
    ↓
Campaign Worker processes queue
    ↓
Broadcast to all contacts in queue
```

---

## 🔧 Technical Implementation

### **Backend Logic - All Methods Converge**

```javascript
// STEP 1: Fetch Contacts (Different method for each type)
let validContacts = [];

if (recipientType === 'group') {
    // Fetch by group_ids
    const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .contains('group_ids', [selectedGroup]);
    
    validContacts = contacts;

} else if (recipientType === 'manual') {
    // Manual phone numbers
    const manualNumbers = req.body.manualNumbers;
    // Validate, normalize, and create contact objects
    validContacts = processedManualNumbers;

} else if (recipientType === 'tags') {
    // Fetch by tags (OR logic)
    const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id);
    
    // Filter contacts that have ANY of the selected tags
    validContacts = contacts.filter(contact => 
        selectedTags.some(tag => contact.tags.includes(tag))
    );
}

// STEP 2: Add to Queue (IDENTICAL for all methods)
const queue = validContacts.map(c => ({
    campaign_id: campaign.id,
    contact_id: c.id,
    phone_number: c.phone,
    status: 'PENDING'
}));

await supabase.from('campaign_queue').insert(queue);

// STEP 3: Create Campaign Record (IDENTICAL for all methods)
const campaign = await supabase.from('campaigns').insert({
    user_id: user.id,
    title: campaignTitle,
    template_id: templateId,
    scheduled_at: sendNow ? new Date() : scheduledAt,
    status: sendNow ? 'PROCESSING' : 'SCHEDULED',
    total_contacts: validContacts.length
});

// STEP 4: Broadcasting (IDENTICAL for all methods)
// Campaign Worker picks up the queue and processes it
```

---

## 📊 Campaign Queue Table

**All contacts** from all three methods are added to the **same queue table**:

```sql
campaign_queue
├── id (uuid)
├── campaign_id (uuid)
├── contact_id (uuid)
├── phone_number (text)
├── status (text) -- PENDING → PROCESSING → SENT → DELIVERED → READ
├── message_id (text)
├── sent_at (timestamp)
├── error_message (text)
└── updated_at (timestamp)
```

**Example Queue for Mixed Campaign**:
```
Campaign ID: abc-123
Title: "Summer Sale 2026"

Queue Entries:
├── Contact 1 (from Group "VIP") → status: PENDING
├── Contact 2 (from Tag "Customer") → status: PENDING  
├── Contact 3 (from Manual "919876543210") → status: PENDING
├── Contact 4 (from Tag "VIP") → status: PENDING
└── Contact 5 (from Group "Leads") → status: PENDING

All will be broadcast when scheduled time arrives!
```

---

## ⏰ Scheduling - Works Identically for All Methods

### **Option 1: Send Now**
```
User clicks "Send Now"
    ↓
Campaign status = 'PROCESSING'
    ↓
Campaign Worker immediately picks up queue
    ↓
Broadcasts to all contacts in queue
    ↓
Updates status: PENDING → SENT → DELIVERED → READ
```

### **Option 2: Schedule for Later**
```
User selects date/time (e.g., Tomorrow 10:00 AM)
    ↓
Campaign status = 'SCHEDULED'
    ↓
Campaign Worker waits until scheduled_at time
    ↓
At 10:00 AM: Worker picks up queue
    ↓
Broadcasts to all contacts in queue
    ↓
Updates status: PENDING → SENT → DELIVERED → READ
```

**Examples**:
- **Group**: Select "VIP Customers" → Schedule for tomorrow 10 AM → All VIP customers receive message at 10 AM
- **Tags**: Select "VIP" + "Customer" → Schedule for tomorrow 10 AM → All contacts with those tags receive message at 10 AM
- **Manual**: Paste 100 numbers → Schedule for tomorrow 10 AM → All 100 numbers receive message at 10 AM

---

## 🎯 Tag Selection - Detailed Example

### **User Flow**:
1. **Create Campaign** → Select WhatsApp template
2. **Campaign Details** → Enter title
3. **Recipients** → Select "Select by Tags"
4. **Select Tags** → Click `[VIP]` and `[Customer]` pills (multi-select)
5. **Schedule** → Choose "Send Now" or "Schedule for Later"
6. **Launch Campaign** → Click "Launch Campaign" button

### **Backend Processing**:
```javascript
// 1. Receive request
const { selectedTags } = req.body; // ["VIP", "Customer"]

// 2. Fetch all user contacts
const { data: contacts } = await supabase
    .from('contacts')
    .select('id, phone, name, email, tags')
    .eq('user_id', user.id);

// 3. Filter by tags (OR logic - ANY tag matches)
const validContacts = contacts.filter(contact => {
    if (!contact.tags || !Array.isArray(contact.tags)) return false;
    return selectedTags.some(tag => contact.tags.includes(tag));
});

// Example:
// Contact A: tags = ["VIP", "Lead"] → ✅ Included (has "VIP")
// Contact B: tags = ["Customer"] → ✅ Included (has "Customer")
// Contact C: tags = ["Prospect"] → ❌ Excluded (has neither)

// 4. Add to queue (SAME as group/manual)
const queue = validContacts.map(c => ({
    campaign_id: campaign.id,
    contact_id: c.id,
    phone_number: c.phone,
    status: 'PENDING'
}));

await supabase.from('campaign_queue').insert(queue);

// 5. Campaign Worker processes queue (SAME as group/manual)
// Worker sends messages one by one, updates status
```

---

## 📈 Queue Processing - Campaign Worker

**The Campaign Worker processes ALL queues identically**, regardless of recipient selection method:

```javascript
// Campaign Worker (runs every minute)
async function processCampaigns() {
    // 1. Find campaigns ready to send
    const campaigns = await supabase
        .from('campaigns')
        .select('*')
        .in('status', ['PROCESSING', 'SCHEDULED'])
        .lte('scheduled_at', new Date());

    for (const campaign of campaigns) {
        // 2. Get pending queue items
        const { data: queue } = await supabase
            .from('campaign_queue')
            .select('*')
            .eq('campaign_id', campaign.id)
            .eq('status', 'PENDING')
            .limit(10); // Process in batches

        // 3. Send messages
        for (const item of queue) {
            try {
                // Send WhatsApp message via Meta API
                const result = await sendWhatsAppMessage({
                    to: item.phone_number,
                    template: campaign.template_name,
                    // ... other params
                });

                // Update status
                await supabase
                    .from('campaign_queue')
                    .update({ 
                        status: 'SENT',
                        message_id: result.message_id,
                        sent_at: new Date()
                    })
                    .eq('id', item.id);

            } catch (error) {
                // Mark as failed
                await supabase
                    .from('campaign_queue')
                    .update({ 
                        status: 'FAILED',
                        error_message: error.message
                    })
                    .eq('id', item.id);
            }
        }
    }
}
```

---

## ✅ Feature Comparison Table

| Feature | Group | Manual | Tags |
|---------|-------|--------|------|
| **Select Recipients** | ✅ Choose from groups | ✅ Paste phone numbers | ✅ Select tags |
| **Fetch Contacts** | ✅ By `group_ids` | ✅ By phone numbers | ✅ By `tags` array |
| **Add to Queue** | ✅ Same process | ✅ Same process | ✅ Same process |
| **Queue Table** | ✅ `campaign_queue` | ✅ `campaign_queue` | ✅ `campaign_queue` |
| **Schedule** | ✅ Send Now / Later | ✅ Send Now / Later | ✅ Send Now / Later |
| **Broadcast** | ✅ Campaign Worker | ✅ Campaign Worker | ✅ Campaign Worker |
| **Status Tracking** | ✅ PENDING → SENT → DELIVERED | ✅ PENDING → SENT → DELIVERED | ✅ PENDING → SENT → DELIVERED |
| **Delivery Reports** | ✅ Same reports | ✅ Same reports | ✅ Same reports |
| **Export CSV** | ✅ Same export | ✅ Same export | ✅ Same export |
| **Retry Failed** | ✅ Same retry logic | ✅ Same retry logic | ✅ Same retry logic |

---

## 🎨 User Interface

### **Recipients Section**

```
RECIPIENTS
○ Select Group
○ Paste Numbers  
● Select by Tags

[VIP] [Customer] [Lead] [Partner] [Prospect]

2 tags selected
```

### **Schedule Section** (Same for all methods)

```
SCHEDULE
● Send Now
○ Schedule for Later

[Date/Time Picker]
```

---

## 📊 Status Flow - Identical for All Methods

```
PENDING
   ↓
PROCESSING (Campaign Worker picks up)
   ↓
SENT (Message sent to WhatsApp)
   ↓
DELIVERED (WhatsApp confirms delivery)
   ↓
READ (User reads message)
```

**Failed Messages**:
```
PENDING → PROCESSING → FAILED (with error_message)
```

---

## 🔍 Campaign Reports - Same for All Methods

### **Campaign Details Page**

```
Campaign: "Summer Sale 2026"
Status: COMPLETED
Total Contacts: 150

Stats:
├── Sent: 148
├── Delivered: 145
├── Read: 120
├── Failed: 2
└── Pending: 0

Recipients Source:
├── 50 from Group "VIP Customers"
├── 75 from Tags ["VIP", "Customer"]
└── 25 from Manual Numbers
```

### **Export Report** (CSV)

```csv
Contact Name,Phone Number,Status,Message ID,Sent At,Last Update
John Doe,+919876543210,DELIVERED,wamid.123,2026-02-07 10:00,2026-02-07 10:01
Jane Smith,+918888888888,READ,wamid.456,2026-02-07 10:00,2026-02-07 10:05
```

---

## 🚀 Use Cases

### **1. VIP Campaign (Tags)**
- Select tags: `["VIP"]`
- Schedule: Tomorrow 10 AM
- Result: All VIP contacts receive exclusive offer at 10 AM

### **2. Product Launch (Group)**
- Select group: "Product A Customers"
- Schedule: Send Now
- Result: All Product A customers immediately receive launch announcement

### **3. Emergency Broadcast (Manual)**
- Paste: 100 critical phone numbers
- Schedule: Send Now
- Result: Immediate broadcast to specific numbers

### **4. Multi-Segment Campaign (Tags)**
- Select tags: `["VIP", "Customer", "Partner"]`
- Schedule: Next Monday 9 AM
- Result: All contacts with any of these tags receive message on Monday

---

## 🎉 Summary

### **Key Takeaway**

**All three recipient selection methods (Group, Manual, Tags) work EXACTLY the same way:**

1. ✅ **Select Recipients** - Different UI, same goal
2. ✅ **Fetch Contacts** - Different query, same result (list of contacts)
3. ✅ **Add to Queue** - Identical process for all
4. ✅ **Schedule** - Same scheduling logic
5. ✅ **Broadcast** - Same Campaign Worker
6. ✅ **Track Status** - Same status updates
7. ✅ **Reports** - Same reporting system

### **The ONLY Difference**

**HOW contacts are selected:**
- **Group**: Filter by `group_ids` field
- **Manual**: Use pasted phone numbers
- **Tags**: Filter by `tags` array (OR logic)

**Everything else is 100% identical!**

---

## 📝 Files Involved

### Frontend
- `client/src/components/Campaigns/CreateCampaign.tsx` - Campaign creation UI

### Backend
- `server/routes/campaigns.js` - Campaign creation logic
- `server/routes/tags.js` - Tags API endpoint
- `server/workers/campaignWorker.js` - Queue processing

### Database
- `campaigns` - Campaign records
- `campaign_queue` - Message queue
- `contacts` - Contact records with tags

---

## ✅ Confirmed: Tags Work Like Groups!

**YES** - Tags work **exactly** like Groups:
- ✅ Select tags → Fetch matching contacts
- ✅ Add all to queue
- ✅ Schedule or send immediately  
- ✅ Broadcast to all contacts in queue
- ✅ Same scheduling logic
- ✅ Same queue processing
- ✅ Same delivery tracking
- ✅ Same reporting

**The system is unified and consistent across all recipient selection methods!** 🚀
