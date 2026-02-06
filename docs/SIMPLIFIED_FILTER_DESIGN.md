# Simplified Filter UI Design

Based on your requirements, here's the new simplified filter design:

## Layout Structure:

```
[Pipeline Dropdown] [+] [★] [🗑️] [Search Bar................] | [Total: 123] [Sort ▼] [Quick Filter ▼] [Filters] [⊞] [≡]
                                                                  
[When Filters clicked, show stage pills below]
```

## Key Changes:

1. **Search Bar**: Moved inline after the delete button
   - Compact size with simple border
   - Just "Search..." placeholder
   - Clear X button when typing

2. **Quick Filter**: Changed to dropdown select
   - Options: All Leads, 🔥 Hot Leads, ❄️ Cold Leads, 💰 High Value
   - Changes color when active (orange background)
   - Simple and compact

3. **Stage Filters**: Only show when "Filters" button clicked
   - Horizontal pill layout
   - Each pill shows stage color dot + name + count
   - "Clear all" button on the right

## Implementation Code:

### Search Bar (after delete button):
```tsx
{/* Search Bar - Inline */}
<div className="flex-1 max-w-md">
    <div className="relative">
        <input
            type="text"
            placeholder="Search..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="w-full bg-white border border-[var(--color-border)] focus:border-[var(--color-brand)] rounded-lg pl-9 pr-9 py-2 text-sm"
        />
        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">...</svg>
        {filters.search && (
            <button onClick={() => setFilters({ ...filters, search: '' })}>
                <svg className="w-3 h-3">×</svg>
            </button>
        )}
    </div>
</div>
```

### Quick Filter Dropdown:
```tsx
<select
    value={filters.quickFilter}
    onChange={(e) => setFilters({ ...filters, quickFilter: e.target.value })}
    className={`border rounded-lg pl-3 pr-8 py-2 text-sm ${
        filters.quickFilter !== 'all'
            ? 'bg-[var(--color-brand)] text-white'
            : 'bg-white text-[var(--color-text)]'
    }`}
>
    <option value="all">All Leads</option>
    <option value="hot">🔥 Hot Leads</option>
    <option value="cold">❄️ Cold Leads</option>
    <option value="high_value">💰 High Value</option>
</select>
```

### Stage Filters (collapsible):
```tsx
{showFilters && (
    <div className="p-4 bg-[var(--color-surface)] border-b">
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold opacity-50 mr-2">STAGE:</span>
            <button>All Stages</button>
            {boardData?.columns.map(col => (
                <button className="px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{backgroundColor: col.stage.color}}></span>
                    {col.stage.name}
                    <span className="px-1.5 py-0.5 rounded-full text-[10px]">{col.total_count}</span>
                </button>
            ))}
            <button className="ml-auto text-xs">Clear all</button>
        </div>
    </div>
)}
```

## Visual Benefits:

✅ **Much Cleaner**: Everything on one line
✅ **Less Clutter**: No big search box taking up space
✅ **Simple Dropdowns**: Quick filters are just a dropdown
✅ **Progressive Disclosure**: Stage filters only show when needed
✅ **Compact**: Matches the reference images you showed

This design is similar to the screenshots you provided - clean, inline, and simple!
