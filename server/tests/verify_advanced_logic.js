const assert = require('assert');
const service = require('../services/SheetAutomationService');

function testLogic() {
    console.log("Testing SheetAutomationService Advanced Logic Groups...");
    
    // Group 1: A AND B
    // Group 2: C
    // Logic: (A=1 AND B=2) OR (C=3)
    
    const condition = {
        logic: 'OR',
        groups: [
            {
                logic: 'AND',
                conditions: [
                    { column: 'A', operator: 'equals', value: '1' },
                    { column: 'B', operator: 'equals', value: '2' }
                ]
            },
            {
                logic: 'AND',
                conditions: [
                    { column: 'C', operator: 'equals', value: '3' }
                ]
            }
        ]
    };

    // Case 1: Matches Group 1
    const row1 = { 'A': '1', 'B': '2', 'C': '0' };
    assert.strictEqual(service.checkCondition(condition, row1), true, "Should match Group 1 (A AND B)");
    console.log("Row 1 passed.");

    // Case 2: Matches Group 2
    const row2 = { 'A': '0', 'B': '0', 'C': '3' };
    assert.strictEqual(service.checkCondition(condition, row2), true, "Should match Group 2 (C)");
    console.log("Row 2 passed.");

    // Case 3: Matches neither
    const row3 = { 'A': '1', 'B': '0', 'C': '0' }; // Only partial match for Group 1
    assert.strictEqual(service.checkCondition(condition, row3), false, "Should NOT match (Partial Group 1)");
    console.log("Row 3 passed.");

    // Case 4: Matches both
    const row4 = { 'A': '1', 'B': '2', 'C': '3' };
    assert.strictEqual(service.checkCondition(condition, row4), true, "Should match (Both groups)");
    console.log("Row 4 passed.");

    console.log("\n✅ All Advanced Logic checks passed successfully!");
}

try {
    testLogic();
} catch (e) {
    console.error("Test Failed!", e.message);
}
