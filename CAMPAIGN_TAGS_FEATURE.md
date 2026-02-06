# Campaign Recipients - Select by Tags Feature

## 🎯 Feature Overview

Users can now select campaign recipients using **Tags** in addition to the existing "Select Group" and "Paste Numbers" options. This provides more flexible targeting for WhatsApp campaigns.

---

## ✨ What's New

### Three Recipient Selection Methods

1. **Select Group** - Choose from existing contact groups
2. **Paste Numbers** - Manually enter phone numbers
3. **Select by Tags** ⭐ NEW - Target contacts by their assigned tags

---

## 🎨 User Interface

### Campaign Creation Screen

**Recipients Section** now has three radio button options:

```
○ Select Group
○ Paste Numbers  
○ Select by Tags
```

### Tag Selection UI

When "Select by Tags" is selected, users see:
- **Tag Pills**: Clickable buttons for each available tag
- **Multi-Select**: Users can select multiple tags
- **Visual Feedback**: Selected tags are highlighted in brand color
- **Counter**: Shows how many tags are selected

**Example UI**:
```
Select one or more tags to target contacts

[VIP]  [Customer]  [Lead]  [Partner]  [Prospect]

2 tags selected
```

---

## 🔧 Technical Implementation

### Frontend Changes

#### 1. State Management (`CreateCampaign.tsx`)

```typescript
// New state for tags
const [availableTags, setAvailableTags] = useState<any[]>([]);
const [selectedTags, setSelectedTags] = useState<string[]>([]);

// Updated recipient type
const [recipientType, setRecipientType] = useState<'group' | 'manual' | 'tags'>('group');
```

#### 2. Fetch Available Tags

```typescript
const [tplRes, grpRes, phRes, customFields, tagsRes] = await Promise.all([
    fetch('/api/whatsapp/templates', { headers }),
    fetch('/api/groups', { headers }),
    fetch('/api/settings/whatsapp', { headers }),
    inputFieldService.getInputs(),
    fetch('/api/tags', { headers }) // NEW
]);

if (tagsRes.ok) {
    const data = await tagsRes.json();
    setAvailableTags(data || []);
}
```

#### 3. Tag Selection UI

```tsx
<div className="flex flex-wrap gap-2">
    {availableTags.map(tag => (
        <button
            key={tag.id}
            type="button"
            onClick={() => {
                setSelectedTags(prev => 
                    prev.includes(tag.name) 
                        ? prev.filter(t => t !== tag.name)
                        : [...prev, tag.name]
                );
            }}
            className={selectedTags.includes(tag.name)
                ? 'bg-[var(--color-brand)] text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text)]'
            }
        >
            {tag.name}
        </button>
    ))}
</div>
```

#### 4. Validation

```typescript
if (recipientType === 'tags' && selectedTags.length === 0) {
    setToast({ 
        type: 'error', 
        title: 'Validation Error', 
        message: 'Please select at least one tag.' 
    });
    return;
}
```

#### 5. API Payload

```typescript
const payload = {
    // ... other fields
    recipientType, // 'group', 'manual', or 'tags'
    contactGroupId: recipientType === 'group' ? selectedGroup : null,
    manualNumbers: recipientType === 'manual' ? processedManualNumbers : [],
    selectedTags: recipientType === 'tags' ? selectedTags : [],
};
```

---

### Backend Changes

#### Campaign Route (`server/routes/campaigns.js`)

```javascript
if (recipientType === 'tags') {
    // Fetch contacts by tags
    const selectedTags = req.body.selectedTags || [];
    if (!selectedTags.length) {
        return res.status(400).json({ error: 'No tags selected.' });
    }

    // Query all contacts for the user
    const { data: contacts, error: tagsErr } = await supabase
        .from('contacts')
        .select('id, phone, name, email, tags')
        .eq('user_id', user.id);

    if (tagsErr) throw tagsErr;
    if (!contacts?.length) {
        return res.status(400).json({ error: 'No contacts found.' });
    }

    // Filter contacts that have at least one of the selected tags
    validContacts = contacts.filter(contact => {
        if (!contact.tags || !Array.isArray(contact.tags)) return false;
        return selectedTags.some(tag => contact.tags.includes(tag));
    });

    if (!validContacts.length) {
        return res.status(400).json({ 
            error: 'No contacts found with the selected tags.' 
        });
    }
}
```

---

## 📊 How It Works

### Tag Matching Logic

**OR Logic**: A contact is included if they have **ANY** of the selected tags.

**Example**:
- Selected Tags: `["VIP", "Customer"]`
- Contact A has tags: `["VIP", "Lead"]` → ✅ **Included** (has "VIP")
- Contact B has tags: `["Customer"]` → ✅ **Included** (has "Customer")
- Contact C has tags: `["Lead", "Prospect"]` → ❌ **Excluded** (has neither)

### Flow Diagram

```
User selects "Select by Tags"
    ↓
Available tags load from /api/tags
    ↓
User clicks tag pills to select
    ↓
Selected tags tracked in state
    ↓
User clicks "Launch Campaign"
    ↓
Frontend validates (at least 1 tag selected)
    ↓
Backend receives selectedTags array
    ↓
Backend fetches all user contacts
    ↓
Backend filters contacts by tags (OR logic)
    ↓
Campaign created with filtered contacts
```

---

## 🎯 Use Cases

### 1. **VIP Customers**
- Select tag: `VIP`
- Send exclusive offers to premium customers

### 2. **Product-Specific Campaigns**
- Select tags: `Product A`, `Product B`
- Target customers interested in specific products

### 3. **Segmented Marketing**
- Select tags: `New Lead`, `Hot Lead`
- Different messaging for different lead stages

### 4. **Geographic Targeting**
- Select tags: `Mumbai`, `Delhi`, `Bangalore`
- Location-based campaigns

### 5. **Multi-Segment Campaigns**
- Select tags: `VIP`, `Customer`, `Partner`
- Reach multiple audience segments at once

---

## ✅ Validation Rules

### Frontend Validation
1. **At least 1 tag must be selected** before launching campaign
2. **Error message** if no tags selected: "Please select at least one tag."

### Backend Validation
1. **selectedTags array must not be empty**
2. **At least 1 contact must match** the selected tags
3. **Error messages**:
   - "No tags selected."
   - "No contacts found."
   - "No contacts found with the selected tags."

---

## 🎨 UI/UX Features

### Visual Design
- **Unselected Tag**: Light background, border, text color
- **Selected Tag**: Brand color background, white text
- **Hover Effect**: Border color changes to brand color
- **Transition**: Smooth color transitions on click

### User Feedback
- **Counter**: "2 tags selected" below tag pills
- **Plural Handling**: "1 tag selected" vs "2 tags selected"
- **Empty State**: "No tags available" if no tags exist

### Responsive Design
- **Flex Wrap**: Tags wrap to multiple rows on small screens
- **Touch-Friendly**: Adequate padding for mobile taps
- **Consistent Spacing**: Gap between tag pills

---

## 📝 Files Modified

### Frontend
1. **`client/src/components/Campaigns/CreateCampaign.tsx`**
   - Added `availableTags` and `selectedTags` state
   - Updated `recipientType` type definition
   - Added tag fetching in `fetchData()`
   - Added tag selection UI
   - Added validation for tags
   - Updated API payload

### Backend
2. **`server/routes/campaigns.js`**
   - Added `recipientType === 'tags'` condition
   - Implemented tag-based contact filtering
   - Added validation for selected tags

---

## 🧪 Testing Checklist

- [ ] Tags load correctly from `/api/tags`
- [ ] Tag pills display properly
- [ ] Clicking tag toggles selection (visual feedback)
- [ ] Multiple tags can be selected
- [ ] Counter shows correct number of selected tags
- [ ] Validation error if no tags selected
- [ ] Backend receives selectedTags array correctly
- [ ] Contacts filtered correctly by tags (OR logic)
- [ ] Campaign creates successfully with tag-based recipients
- [ ] Error handling for no matching contacts
- [ ] Empty state displays when no tags available
- [ ] UI responsive on mobile devices

---

## 🚀 Future Enhancements

### Potential Improvements
1. **AND Logic Option**: Allow users to choose AND/OR logic
   - AND: Contact must have ALL selected tags
   - OR: Contact must have ANY selected tag

2. **Tag Search**: Search bar to filter available tags

3. **Tag Categories**: Group tags by category (e.g., Status, Location, Product)

4. **Preview Count**: Show how many contacts match selected tags before launching

5. **Exclude Tags**: Option to exclude contacts with certain tags

6. **Save Tag Combinations**: Save frequently used tag combinations as "Segments"

7. **Tag Analytics**: Show tag usage statistics (e.g., "VIP: 150 contacts")

---

## 📈 Benefits

### For Users
✅ **Flexible Targeting**: More precise audience selection  
✅ **Multi-Segment Reach**: Target multiple segments in one campaign  
✅ **Visual Selection**: Easy-to-use tag pill interface  
✅ **No Manual Entry**: No need to paste phone numbers  
✅ **Dynamic Filtering**: Automatically includes contacts as tags are updated

### For Business
✅ **Better Segmentation**: Improved marketing precision  
✅ **Higher Engagement**: Relevant messages to right audience  
✅ **Time Savings**: Faster campaign setup  
✅ **Scalability**: Easy to manage large contact lists  

---

## 🎉 Summary

The **Select by Tags** feature provides a powerful, flexible way to target campaign recipients. Users can now:

1. **Choose from 3 recipient methods**: Group, Manual, or Tags
2. **Select multiple tags** with an intuitive pill interface
3. **Target specific segments** without manual number entry
4. **See visual feedback** with selected tag highlighting
5. **Get validation** to ensure at least one tag is selected

**Result**: Faster, more precise campaign targeting with better user experience! 🚀
