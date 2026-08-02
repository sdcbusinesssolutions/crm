const service = require('../services/SheetAutomationService');

const today = new Date();
const formatDateForSheet = (d) => {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
};

const val = formatDateForSheet(today);

const cond = {
    column: 'TestDate',
    operator: 'in_last_x_days',
    value: "5"
};

const originalParseDate = service.parseDate.bind(service);
service.parseDate = function(v) {
    const d = originalParseDate(v);
    console.log("parseDate:", v, "->", d);
    return d;
};

console.log("val:", val);
const result = service.checkSingleCondition(cond, { 'TestDate': val });
console.log("Result:", result);

