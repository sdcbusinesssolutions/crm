const assert = require('assert');
const service = require('../services/SheetAutomationService');

function testAllConditions() {
    console.log("Starting Comprehensive Sheet Automation Condition Tests...\n");

    const evalCond = (operator, val, targetVal) => {
        return service.checkSingleCondition(
            { column: 'ColA', operator: operator, value: targetVal },
            { 'ColA': val }
        );
    };

    let passed = 0;
    let failed = 0;

    const runTest = (name, operator, val, targetVal, expected) => {
        try {
            const result = evalCond(operator, val, targetVal);
            if (result === expected) {
                passed++;
            } else {
                failed++;
                console.error(`❌ FAILED: ${name} | Op: ${operator} | Val: ${val} | Target: ${targetVal} | Expected: ${expected} | Got: ${result}`);
            }
        } catch (e) {
            failed++;
            console.error(`❌ ERROR: ${name} | Op: ${operator} | Val: ${val} | Target: ${targetVal} | Exception: ${e.message}`);
        }
    };

    // --- 1. General String & Boolean Operators ---
    console.log("--- String & Boolean Operators ---");
    runTest("equals - match string", "equals", "Hello", "hello", true);
    runTest("equals - no match string", "equals", "Hello", "world", false);
    runTest("equals - boolean true", "equals", "TRUE", "true", true);
    runTest("equals - boolean false", "equals", "False", "false", true);
    runTest("not_equals - match", "not_equals", "Hello", "world", true);
    runTest("not_equals - boolean", "not_equals", "True", "false", true);
    runTest("contains - match", "contains", "Hello World", "wo", true);
    runTest("contains - no match", "contains", "Hello World", "xyz", false);
    runTest("does_not_contain - match", "does_not_contain", "Hello", "xyz", true);
    runTest("starts_with - match", "starts_with", "Hello World", "hell", true);
    runTest("ends_with - match", "ends_with", "Hello World", "rld", true);
    runTest("is_empty - empty string", "is_empty", "", "", true);
    runTest("is_empty - null", "is_empty", null, "", true);
    runTest("is_empty - undefined", "is_empty", undefined, "", true);
    runTest("is_not_empty - string", "is_not_empty", "text", "", true);
    runTest("is_not_empty - number 0", "is_not_empty", 0, "", true);
    runTest("is_not_empty - boolean false", "is_not_empty", false, "", true);
    runTest("is_not_empty - null", "is_not_empty", null, "", false);
    runTest("is_not_empty - undefined", "is_not_empty", undefined, "", false);

    runTest("equals - null vs string", "equals", null, "test", false);
    runTest("not_equals - null vs string", "not_equals", null, "test", true);
    runTest("contains - null vs string", "contains", null, "test", false);
    runTest("greater_than - null", "greater_than", null, "40", false);
    runTest("less_than - null", "less_than", null, "40", false);
    runTest("date_equals - null", "date_equals", null, "2026-05-15", false);
    
    // --- 2. Number Operators ---
    console.log("\n--- Number Operators ---");
    runTest("greater_than - true", "greater_than", "50", "40", true);
    runTest("greater_than - false", "greater_than", "30", "40", false);
    runTest("less_than - true", "less_than", "30", "40", true);
    runTest("greater_than_or_equal - true (greater)", "greater_than_or_equal", "50", "40", true);
    runTest("greater_than_or_equal - true (equal)", "greater_than_or_equal", "40", "40", true);
    runTest("less_than_or_equal - true (less)", "less_than_or_equal", "30", "40", true);
    runTest("less_than_or_equal - true (equal)", "less_than_or_equal", "40", "40", true);
    runTest("less_than - float true", "less_than", "30.5", "40.2", true);
    
    // --- 3. Date & Time (Dynamic) ---
    console.log("\n--- Date & Time Operators ---");
    const today = new Date();
    const getOffset = (d) => {
        const nd = new Date(today);
        nd.setDate(nd.getDate() + d);
        return `${String(nd.getDate()).padStart(2, '0')}/${String(nd.getMonth()+1).padStart(2, '0')}/${nd.getFullYear()}`;
    };

    runTest("is_today - true", "is_today", getOffset(0), "", true);
    runTest("is_today - false", "is_today", getOffset(-1), "", false);
    runTest("is_yesterday - true", "is_yesterday", getOffset(-1), "", true);
    runTest("is_tomorrow - true", "is_tomorrow", getOffset(1), "", true);
    runTest("in_last_x_days - true (today)", "in_last_x_days", getOffset(0), "5", true);
    runTest("in_last_x_days - true (-3)", "in_last_x_days", getOffset(-3), "5", true);
    runTest("in_last_x_days - false (-6)", "in_last_x_days", getOffset(-6), "5", false);
    runTest("in_next_x_days - true (+3)", "in_next_x_days", getOffset(3), "5", true);
    runTest("in_next_x_days - false (+6)", "in_next_x_days", getOffset(6), "5", false);
    
    runTest("date_equals - true", "date_equals", "15/05/2026", "2026-05-15", true);
    runTest("date_before - true", "date_before", "14/05/2026", "2026-05-15", true);
    runTest("date_after - true", "date_after", "16/05/2026", "2026-05-15", true);
    runTest("date_between - true", "date_between", "15/05/2026", "2026-05-10,2026-05-20", true);
    runTest("date_between - false", "date_between", "25/05/2026", "2026-05-10,2026-05-20", false);

    // --- 4. Day & Month (Annual) ---
    console.log("\n--- Annual (Day/Month) Operators ---");
    runTest("day_month_equal - true (diff year)", "day_month_equal", getOffset(0).replace(/\d{4}$/, '1990'), "", true);
    runTest("day_month_before - true", "day_month_before", getOffset(-5).replace(/\d{4}$/, '1990'), "", true);
    runTest("day_month_after - true", "day_month_after", getOffset(5).replace(/\d{4}$/, '1990'), "", true);

    // --- 5. Month & Year ---
    console.log("\n--- Month/Year Operators ---");
    const m = today.getMonth() + 1;
    const y = today.getFullYear();
    const nextM = m === 12 ? 1 : m + 1;
    
    runTest("month_equals - true", "month_equals", `15/${String(m).padStart(2,'0')}/${y}`, String(m), true);
    runTest("is_current_month - true", "is_current_month", `15/${String(m).padStart(2,'0')}/${y}`, "", true);
    runTest("is_next_month - true", "is_next_month", `15/${String(nextM).padStart(2,'0')}/${y}`, "", true);
    runTest("year_equals - true", "year_equals", `15/05/2025`, "2025", true);
    runTest("is_current_year - true", "is_current_year", `15/05/${y}`, "", true);

    // --- 6. Advanced Logic Groups (AND/OR Multiple Permutations) ---
    console.log("\n--- Advanced Logic Groups (AND/OR Permutations) ---");
    const runAdvTest = (name, condition, row, expected) => {
        const result = service.checkCondition(condition, row);
        if (result === expected) passed++;
        else { failed++; console.error(`❌ FAILED ADVANCED: ${name} | Expected ${expected}, Got ${result}`); }
    };

    // Permutation A: (A=1 AND B=2) OR (C=3 AND D=4) OR (E=5)
    const advCondition1 = {
        logic: 'OR',
        groups: [
            { logic: 'AND', conditions: [{ column: 'A', operator: 'equals', value: '1' }, { column: 'B', operator: 'equals', value: '2' }] },
            { logic: 'AND', conditions: [{ column: 'C', operator: 'equals', value: '3' }, { column: 'D', operator: 'equals', value: '4' }] },
            { logic: 'AND', conditions: [{ column: 'E', operator: 'equals', value: '5' }] }
        ]
    };
    
    runAdvTest("Permutation 1: Group 1 Match (A, B)", advCondition1, { A: '1', B: '2', C: '0', D: '0', E: '0' }, true);
    runAdvTest("Permutation 1: Group 2 Match (C, D)", advCondition1, { A: '0', B: '0', C: '3', D: '4', E: '0' }, true);
    runAdvTest("Permutation 1: Group 3 Match (E)", advCondition1, { A: '0', B: '0', C: '0', D: '0', E: '5' }, true);
    runAdvTest("Permutation 1: Partial Match G1/G2 (False)", advCondition1, { A: '1', B: '0', C: '3', D: '0', E: '0' }, false);
    runAdvTest("Permutation 1: All Match (True)", advCondition1, { A: '1', B: '2', C: '3', D: '4', E: '5' }, true);

    // Permutation B: Single Group with multiple ANDs (A=True AND B>5 AND C<10)
    const advCondition2 = {
        logic: 'OR',
        groups: [
            { logic: 'AND', conditions: [
                { column: 'Status', operator: 'equals', value: 'true' },
                { column: 'Score', operator: 'greater_than', value: '5' },
                { column: 'Age', operator: 'less_than', value: '10' }
            ]}
        ]
    };
    runAdvTest("Permutation 2: All Match", advCondition2, { Status: 'True', Score: '7', Age: '8' }, true);
    runAdvTest("Permutation 2: Status False", advCondition2, { Status: 'False', Score: '7', Age: '8' }, false);
    runAdvTest("Permutation 2: Score Low", advCondition2, { Status: 'True', Score: '4', Age: '8' }, false);
    runAdvTest("Permutation 2: Age High", advCondition2, { Status: 'True', Score: '7', Age: '12' }, false);

    console.log(`\n======================================`);
    console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log(`======================================`);

    if (failed > 0) process.exit(1);
}

testAllConditions();
