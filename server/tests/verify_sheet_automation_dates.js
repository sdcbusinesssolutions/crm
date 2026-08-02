const assert = require('assert');
const service = require('../services/SheetAutomationService');

function testDates() {
    console.log("Testing SheetAutomationService date logic...");
    
    const today = new Date();
    
    const formatDateForSheet = (d) => {
        // format as DD/MM/YYYY
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const getOffsetDate = (days) => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d;
    };

    // Helper to evaluate
    const evalCondition = (op, val, targetVal) => {
        return service.checkSingleCondition({
            column: 'TestDate',
            operator: op,
            value: targetVal
        }, { 'TestDate': val });
    };

    // Test: in_last_x_days
    console.log("\n--- in_last_x_days (target: 5) ---");
    // Today
    assert.strictEqual(evalCondition('in_last_x_days', formatDateForSheet(today), "5"), true, "Today should be true for last 5 days");
    console.log("Today passed.");
    // 3 days ago
    assert.strictEqual(evalCondition('in_last_x_days', formatDateForSheet(getOffsetDate(-3)), "5"), true, "3 days ago should be true for last 5 days");
    console.log("3 days ago passed.");
    // 5 days ago
    assert.strictEqual(evalCondition('in_last_x_days', formatDateForSheet(getOffsetDate(-5)), "5"), true, "5 days ago should be true for last 5 days");
    console.log("5 days ago passed.");
    // 6 days ago
    assert.strictEqual(evalCondition('in_last_x_days', formatDateForSheet(getOffsetDate(-6)), "5"), false, "6 days ago should be false for last 5 days");
    console.log("6 days ago passed.");
    // Tomorrow
    assert.strictEqual(evalCondition('in_last_x_days', formatDateForSheet(getOffsetDate(1)), "5"), false, "Tomorrow should be false for last 5 days");
    console.log("Tomorrow passed.");

    // Test: in_next_x_days
    console.log("\n--- in_next_x_days (target: 5) ---");
    // Today
    assert.strictEqual(evalCondition('in_next_x_days', formatDateForSheet(today), "5"), true, "Today should be true for next 5 days");
    console.log("Today passed.");
    // 3 days from now
    assert.strictEqual(evalCondition('in_next_x_days', formatDateForSheet(getOffsetDate(3)), "5"), true, "3 days from now should be true for next 5 days");
    console.log("3 days from now passed.");
    // 5 days from now
    assert.strictEqual(evalCondition('in_next_x_days', formatDateForSheet(getOffsetDate(5)), "5"), true, "5 days from now should be true for next 5 days");
    console.log("5 days from now passed.");
    // 6 days from now
    assert.strictEqual(evalCondition('in_next_x_days', formatDateForSheet(getOffsetDate(6)), "5"), false, "6 days from now should be false for next 5 days");
    console.log("6 days from now passed.");
    // Yesterday
    assert.strictEqual(evalCondition('in_next_x_days', formatDateForSheet(getOffsetDate(-1)), "5"), false, "Yesterday should be false for next 5 days");
    console.log("Yesterday passed.");

    console.log("\n✅ All Sheet Automation date checks passed successfully!");
}

try {
    testDates();
} catch (e) {
    console.error("Test Failed!", e.message);
}
