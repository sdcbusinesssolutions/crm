# Contact Import/Export & Filtering Features

## Features Implemented

### 1. CSV Import/Export
- **Sample CSV File**: Created `sample_contacts.csv` with proper format including groups, tags, and custom fields
- **Export**: Downloads all contacts with groups, tags, and custom fields
- **Import**: Automatically creates missing groups and custom fields from CSV data

### 2. Filtering by Groups and Tags
- **Click to Filter**: Click on any tag or group name to filter contacts
- **Active Filter Chips**: Visual indicators showing which filters are active
- **Clear Filters**: Easy-to-use "Clear all" button to remove all filters
- **Group Navigation**: Click group names in the Groups tab to view contacts in that group

## How to Use

### CSV Import
1. Use the sample file `sample_contacts.csv` as a template
2. Click the Upload icon in the Contact List
3. Select your CSV file
4. The system will:
   - Auto-create any new groups mentioned in the "Groups" column
   - Auto-create any new custom fields found in the CSV
   - Import all contacts with their data

### CSV Format
```csv
Name,Phone,Email,Status,Tags,Groups,Source
John Doe,+1234567890,john@example.com,New,"VIP, Premium",Sales Team,Website
```

- **Required**: Name, Phone
- **Optional**: Email, Status, Tags, Groups, Source
- **Custom Fields**: Any additional columns will be created as custom fields

### Filtering Contacts

#### By Tag:
1. In the Contact List, click on any tag badge
2. The list will filter to show only contacts with that tag
3. An active filter chip will appear at the top
4. Click the X on the chip to clear the filter

#### By Group:
1. **Method 1**: In the Contact List, click on a group name in the filter chips
2. **Method 2**: Go to the Groups tab, click on any group name
   - This will automatically switch to the Contacts tab and filter by that group

## Technical Details

### Files Modified:
- `client/src/components/ContactList.tsx` - Added filtering logic and clickable tags
- `client/src/components/ContactGroups.tsx` - Made group names clickable
- `client/src/components/Contacts.tsx` - Added state management for cross-tab filtering
- `sample_contacts.csv` - Sample CSV file for import

### New State Variables:
- `selectedGroupFilter`: Stores the currently selected group ID for filtering
- `selectedTagFilter`: Stores the currently selected tag for filtering

### Props Added:
- **ContactList**: `initialGroupFilter`, `onClearGroupFilter`
- **ContactGroups**: `onGroupClick`

## Troubleshooting

### Import Errors
If you see "Unexpected token '<'" error during import:
1. Check that your CSV file is properly formatted
2. Ensure the "Phone" column exists (required)
3. Verify the backend server is running
4. Check browser console for detailed error messages

### Filters Not Working
1. Ensure you have contacts with the tags/groups you're filtering by
2. Clear all filters and try again
3. Refresh the page if filters seem stuck
