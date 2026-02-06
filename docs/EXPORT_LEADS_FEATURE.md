# Export Leads Feature - Documentation

## Overview

Added a comprehensive export functionality that allows users to export leads to CSV format based on current filters and selections.

## Features

### 1. **Export Button**
- **Location**: In the filter bar, between "Filters" button and "View Toggles"
- **Icon**: Download/document icon
- **Style**: Matches the overall design system

### 2. **Smart Export Functionality**

The export feature respects all active filters:

#### **Filters Respected:**
- ✅ **Stage Filters**: Only exports leads from selected stages
- ✅ **Search Filter**: Exports leads matching search criteria
- ✅ **Quick Filters**: Respects Hot/Cold/High Value filters
- ✅ **All Filters Combined**: Works with multiple filters simultaneously

### 3. **CSV Export Details**

#### **Exported Columns:**
1. Name
2. Email
3. Phone
4. Company
5. Stage (current stage name)
6. Value (estimated value)
7. Status
8. Source
9. Created At (formatted date/time)
10. Last Contact (formatted date/time)

#### **File Naming Convention:**
The exported file name is automatically generated based on active filters:

- **Base**: `leads`
- **With Stage Filter**: `leads_filtered_stages_2026-02-06.csv`
- **With Search**: `leads_search_2026-02-06.csv`
- **With Quick Filter**: `leads_hot_2026-02-06.csv`
- **Combined**: `leads_filtered_stages_search_hot_2026-02-06.csv`

### 4. **User Feedback**

#### **Success Toast:**
- Shows when export is successful
- Displays count of exported leads
- Message: "Exported X lead(s) to CSV."

#### **Warning Toast:**
- Shows when no leads match current filters
- Message: "No leads to export with current filters."

## Technical Implementation

### **Function: `handleExportLeads()`**

```typescript
const handleExportLeads = () => {
    // 1. Collect leads from filtered columns
    // 2. Check if leads exist
    // 3. Generate CSV content with proper escaping
    // 4. Create downloadable blob
    // 5. Generate smart filename
    // 6. Trigger download
    // 7. Show success toast
}
```

### **Key Features:**
- ✅ Proper CSV escaping (handles quotes, commas, special characters)
- ✅ UTF-8 encoding support
- ✅ Date/time formatting
- ✅ Null/undefined value handling
- ✅ Stage name inclusion
- ✅ Smart filename generation

## Usage Examples

### Example 1: Export All Leads
1. No filters active
2. Click "Export" button
3. Downloads: `leads_2026-02-06.csv`
4. Contains all leads from all stages

### Example 2: Export Specific Stage
1. Click "Filters" button
2. Select "Qualified" stage
3. Click "Export" button
4. Downloads: `leads_filtered_stages_2026-02-06.csv`
5. Contains only leads in "Qualified" stage

### Example 3: Export Hot Leads
1. Select "🔥 Hot Leads" from Quick Filter dropdown
2. Click "Export" button
3. Downloads: `leads_hot_2026-02-06.csv`
4. Contains only hot leads

### Example 4: Export Search Results
1. Type "john" in search bar
2. Click "Export" button
3. Downloads: `leads_search_2026-02-06.csv`
4. Contains only leads matching "john"

### Example 5: Combined Filters
1. Select "Qualified" stage
2. Select "🔥 Hot Leads" quick filter
3. Type "acme" in search
4. Click "Export" button
5. Downloads: `leads_filtered_stages_search_hot_2026-02-06.csv`
6. Contains only leads matching ALL criteria

## Benefits

✅ **Flexible**: Export exactly what you see  
✅ **Smart**: Filename reflects active filters  
✅ **Fast**: Client-side processing, instant download  
✅ **Safe**: Proper CSV escaping prevents data corruption  
✅ **User-Friendly**: Clear feedback via toasts  
✅ **Professional**: Clean, formatted CSV output  

## CSV Format Example

```csv
Name,Email,Phone,Company,Stage,Value,Status,Source,Created At,Last Contact
"John Doe","john@example.com","+1234567890","Acme Corp","Qualified",5000,"active","website","2/6/2026, 6:25:00 PM","2/5/2026, 3:15:00 PM"
"Jane Smith","jane@example.com","+0987654321","Tech Inc","New",3000,"active","referral","2/5/2026, 2:10:00 PM",""
```

## Error Handling

### No Leads to Export
- **Trigger**: When filtered results are empty
- **Action**: Shows warning toast
- **Message**: "No leads to export with current filters."
- **User Action**: Adjust filters or add leads

### Browser Compatibility
- **Supported**: All modern browsers (Chrome, Firefox, Safari, Edge)
- **Method**: Uses Blob API and download attribute
- **Fallback**: None needed (modern browsers only)

## Future Enhancements (Optional)

- [ ] Export to Excel (.xlsx) format
- [ ] Export with custom column selection
- [ ] Export with notes and tasks
- [ ] Scheduled/automated exports
- [ ] Export to Google Sheets
- [ ] Email export results

## Status: ✅ COMPLETE

The export feature is fully implemented and ready for use!
