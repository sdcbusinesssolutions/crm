# Sheet Automation Reference

This document outlines the supported operators and condition structures for Google Sheet Automation triggers.

## Condition Structure

The `trigger_condition` field in the automation configuration can be either a **Single Object** (legacy support) or an **Array of Objects** (recommended for multiple conditions).

### Single Condition
```json
{
  "column": "Status",
  "operator": "equals",
  "value": "Pending"
}
```

### Multiple Conditions (AND Logic)
All conditions must be true for the trigger to fire.
```json
[
  {
    "column": "Status",
    "operator": "equals",
    "value": "Pending"
  },
  {
    "column": "Date",
    "operator": "is_today",
    "value": ""
  }
]
```

## Supported Operators

### String / General
| Operator | Description | Matches |
| :--- | :--- | :--- |
| `equals` | String equality (case-insensitive) | "Yes" == "yes" |
| `not_equals` | String inequality | "Paid" != "Unpaid" |
| `contains` | Substring match | "Hello World" contains "World" |
| `does_not_contain` | Substring exclusion | "Hello World" !contains "Moon" |
| `starts_with` | Prefix match | "Order-123" starts with "Order" |
| `ends_with` | Suffix match | "image.png" ends with ".png" |
| `is_empty` | Check if cell is empty | "" or null |
| `is_not_empty` | Check if cell has value | "Any text" |

### Metric / Number
| Operator | Description | Logic |
| :--- | :--- | :--- |
| `greater_than` | Numeric > | 10 > 5 |
| `less_than` | Numeric < | 5 < 10 |
| `greater_than_or_equal` | Numeric >= | 5 >= 5 |
| `less_than_or_equal` | Numeric <= | 5 <= 5 |

### Date & Time
The system attempts to parse dates in multiple formats (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`).

| Operator | Description | Logic |
| :--- | :--- | :--- |
| `date_equals` | Precise date match | Row Date == Target Date |
| `date_before` | Date is strictly before target | Row Date < Target Date |
| `date_after` | Date is strictly after target | Row Date > Target Date |
| `date_between` | Date is within range (inclusive) | Start <= Row Date <= End |

**Relative Dates (Dynamic)**
| Operator | Description | Logic |
| :--- | :--- | :--- |
| `is_today` | Date matches today's date | Row Date == TODAY |
| `is_yesterday` | Date matches yesterday | Row Date == TODAY - 1 |
| `is_tomorrow` | Date matches tomorrow | Row Date == TODAY + 1 |
| `in_last_x_days` | Relative past window | TODAY - X <= Row Date <= TODAY |
| `in_next_x_days` | Relative future window | TODAY <= Row Date <= TODAY + X |

### Anniversary (Day/Month Only)
Useful for Birthdays and Anniversaries. Ignores the Year.

| Operator | Description | Logic |
| :--- | :--- | :--- |
| `day_month_equal` | Birthday is today | Month/Day matches Today |
| `day_month_before` | Birthday has passed this year | Month/Day < Today |
| `day_month_after` | Birthday is yet to come this year | Month/Day > Today |

## Important Notes
- **Empty Values**: Most operators return `false` if the cell value is empty (except `is_empty`, `not_equals`).
- **Date Parsing**: The system is robust and attempts to parse `DD/MM/YYYY` (common outside US) and `MM/DD/YYYY`. Standard `YYYY-MM-DD` is always preferred.
- **Multiple Conditions**: Currently supports **AND** logic (all conditions must be true).
