# Calendar Integration Guide

## 1. Setup
Before using the Calendar Node, you must connect your Google Calendar account.

1. Navigate to **Integration** in the side menu.
2. Click **Connect** next to Google Calendar.
3. Follow the Google OAuth pop-up capabilities to authorize the application.
4. Once connected, you will see your account listed (e.g., `google_calendar_...`).

## 2. Using the Calendar Node
The Calendar Node allows you to automate scheduling directly within your WhatsApp flows.

### Basic Configuration
1. **Drag & Drop**: Pull the "Calendar" node from the sidebar into your flow.
2. **Select Account**: Choose the connected Google Calendar account.
3. **Action**: Select one of two modes:
   - **Create Event**: Books a slot on the calendar.
   - **Check Availability**: Verifies if a slot is free before booking.

### Fields Explanation

| Field | Description | Examples |
| :--- | :--- | :--- |
| **Start Time** | When the event starts. Accepts standard ISO dates OR natural language. | `2024-12-25T14:00:00`<br>`Tomorrow at 4pm`<br>`Next Monday 10am`<br>`{{user_input_date}}` |
| **End Time / Duration** | How long the event lasts. You can toggle between specifying an exact End Time or a simple Duration. | **Duration:** `30` Minutes<br>**End Time:** `Tomorrow at 5pm` |
| **Attendees** | Who to invite. Comma-separated emails. | `client@example.com, {{email}}` |
| **Meet Link** | Toggle "Add Google Meet Link" to automatically generate a video conference link. | - |

---

## 3. Example Workflows

### Scenario A: Simple Instant Booking
*Use this if you just want to book a slot based on user input without complex checks.*

1. **Ask Question Node**: "When would you like to meet? (e.g. Tomorrow at 2pm)" -> Save to variable `{{meeting_time}}`.
2. **Calendar Node (Create Event)**:
   - **Start Time**: `{{meeting_time}}`
   - **Duration**: `60` Minutes
   - **Summary**: "Meeting with {{name}}"
   - **Meet Link**: ON
3. **Text Message Node**: "Booking confirmed! Here is your link: {{meetLink}}"

### Scenario B: Smart Availability Check (Recommended)
*Use this to prevent double-booking.*

1. **Ask Question Node**: "What day works for you? (e.g. Tomorrow)" -> Save to `{{day}}`.
2. **Ask Question Node**: "What time? (e.g. 10am)" -> Save to `{{time}}`.
3. **Calendar Node (Check Availability)**:
   - **Action**: `Check Availability`
   - **Start Time**: `{{day}} at {{time}}`
   - **Duration**: `30` Minutes
   - **Save Result To**: `is_free`
4. **Condition Node**:
   - Check if `is_free` EQUALS `true`.
   - **Green Path (True)** -> **Calendar Node (Create Event)** (Same settings as above triggers actual booking).
   - **Red Path (False)** -> **Text Message Node**: "Sorry, that time is booked. Please try another time." -> Connect back to start.

### Scenario C: Interactive Booking (Lists)
*Use this to present the user with a clickable menu of available times.*

1. **Calendar Node (Get Available Slots)**:
   - **Action**: `Get Available Slots`
   - **Start Time**: Leave empty (starts checking from Now) or specific date `Tomorrow`.
   - **Duration**: `30` Minutes (Duration of each slot).
   - **Work Start/End Hour**: e.g., `9` to `17` (9 PM to 5 PM).
   - **Days to Look Ahead**: `3` (Checks busy status for next 3 days).
2. **Condition Node**:
   - Check if `{{calendar.count}}` (Slot Count) IS GREATER THAN `0`.
3. **List Message Node (Connected to Success)**:
   - **Body**: "Please select a time:"
   - **Dynamic Sections (Advanced)**: `{{calendar.list_sections}}`
   - **Save Response to Variable**: Enter `selected_slot` (or any name you prefer).
   - *This ensures the selected time (ISO string) is stored in `selected_slot.id`.*

4. **Calendar Node (Create Event)** (Connected to List Reply):
   - **Start Time**: `{{selected_slot.id}}`
   - **Duration**: `30` Minutes.

---

### New Action: Get Available Slots (Fields)

| Field | Description |
| :--- | :--- |
| **Search From (Start Time)** | **Select a preset from the dropdown:**<br>• **Now (Immediate)**: Start searching from the current time.<br>• **Tomorrow Morning**: Skip today and start searching from tomorrow.<br>• **Next Monday**: Start searching from the next Monday.<br>• **Custom / Variable**: Enter a specific date or variable (e.g. `{{user_date}}`). |
| **Duration** | The length of the appointment you want to book (e.g., 30 mins). |
| **Work Start/End Hour** | Your business hours (0-23). The system will ONLY look for slots within these hours (e.g., 9 to 17). |
| **Days to Look Ahead** | How many days into the future to search. `3` means it checks Today, Tomorrow, and Day After looking for free slots inside work hours. |

---

## 4. Technical Notes

- **Timezones**: The natural language parser uses the SERVER'S time zone. If your server is in UTC, "Tomorrow at 9am" means 9am UTC. Ensure your users are aware or adjust accordingly.
- **Natural Language**: Supported keywords include `Tomorrow`, `Next Week`, `Monday`, `Friday`, `at 5pm`, `14:00`.
- **Variables**: The node outputs the following variables you can use later (found under the Calendar Node section in variables list):
  - `{{meetLink}}`: The Google Meet video link.
  - `{{htmlLink}}`: Direct link to the Google Calendar event.
  - `{{formattedDate}}`: Friendly date (e.g. "Friday, April 29th").
  - `{{formattedTime}}`: Friendly time (e.g. "10:00 AM").
  - `{{formattedDateTime}}`: Full friendly timestamp.
  - `{{startTime}}`: ISO Start Time.
  - `{{endTime}}`: ISO End Time.
  - `{{eventId}}`: The unique ID of the created event.
