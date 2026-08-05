const service = require('./services/SheetAutomationService');

// Mock getISTNow to always return Aug 6, 2026
service.getISTNow = () => {
    return {
        year: 2026,
        month: 7, // August is 7 (0-indexed)
        day: 6,
        hour: 12,
        minute: 0
    };
};

function test(testName, operator, targetVal, dateStr, expected) {
    const row = { DOB: dateStr };
    const cond = { column: 'DOB', operator: operator, value: targetVal };
    const result = service.checkSingleCondition(cond, row);
    console.log(`[${result === expected ? 'PASS' : 'FAIL'}] ${testName}: ${operator} (val=${targetVal}) on ${dateStr} => ${result}`);
}

console.log("--- Testing Date Logic (Assume Today is 06/08/2026) ---");

// is_today, is_yesterday, is_tomorrow
test("Today", "is_today", "", "06/08/2026", true);
test("Today (Fail)", "is_today", "", "05/08/2026", false);
test("Yesterday", "is_yesterday", "", "05/08/2026", true);
test("Tomorrow", "is_tomorrow", "", "07/08/2026", true);

// in_last_x_days, in_next_x_days (Exact Match)
test("Last 2 Days", "in_last_x_days", "2", "04/08/2026", true);
test("Last 2 Days (Not combined)", "in_last_x_days", "2", "05/08/2026", false);
test("Last 4 Days", "in_last_x_days", "4", "02/08/2026", true);
test("Next 4 Days", "in_next_x_days", "4", "10/08/2026", true);

// day_month_equal (Birthday)
test("Birthday Today", "day_month_equal", "", "06/08/1990", true);
test("Birthday Not Today", "day_month_equal", "", "05/08/1990", false);

// is_current_month, is_next_month
test("Current Month", "is_current_month", "", "15/08/2026", true);
test("Current Month (Wrong)", "is_current_month", "", "15/09/2026", false);
test("Next Month", "is_next_month", "", "10/09/2026", true);

// is_current_year
test("Current Year", "is_current_year", "", "01/01/2026", true);
test("Current Year (Wrong)", "is_current_year", "", "01/01/2025", false);

